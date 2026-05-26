import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import {
  buildLocalIconReference,
  buildRemoteIconFileName,
  downloadIconLibrary,
  getIconLibraryStatuses,
  listIconLibraryFiles,
  parseLocalIconReference,
  resolveIconFilePath
} from '../src/iconLibrary.js';
import { iconLibrariesDir } from '../src/paths.js';

function createLibraryFixture(libraryId, files) {
  const libraryDir = path.join(iconLibrariesDir, libraryId);
  fs.mkdirSync(libraryDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const targetPath = path.join(libraryDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content);
  }
  return libraryDir;
}

function createTestConfig() {
  const suffix = crypto.randomUUID();
  return {
    iconLibraries: [
      {
        id: `test-library-a-${suffix}`,
        name: 'Alpha Pack',
        zipUrl: 'https://example.com/a.zip',
        zipSubdir: 'a',
        publicBaseUrl: 'http://tower.local:3149'
      },
      {
        id: `test-library-b-${suffix}`,
        name: 'Beta Pack',
        zipUrl: 'https://example.com/b.zip',
        zipSubdir: 'b',
        publicBaseUrl: 'http://tower.local:3149'
      }
    ]
  };
}

test('getIconLibraryStatuses summarizes multiple configured libraries', () => {
  const config = createTestConfig();
  const [alpha, beta] = config.iconLibraries;

  createLibraryFixture(alpha.id, {
    'plex.png': 'alpha-plex',
    'media/jellyfin.png': 'alpha-jellyfin'
  });
  createLibraryFixture(beta.id, {
    'immich.png': 'beta-immich'
  });

  try {
    const summary = getIconLibraryStatuses(config);

    assert.equal(summary.libraryCount, 2);
    assert.equal(summary.iconCount, 3);
    assert.equal(summary.exists, true);
    assert.deepEqual(
      summary.libraries.map((library) => [library.id, library.name, library.exists, library.iconCount]),
      [
        [alpha.id, 'Alpha Pack', true, 2],
        [beta.id, 'Beta Pack', true, 1]
      ]
    );
  } finally {
    fs.rmSync(path.join(iconLibrariesDir, alpha.id), { recursive: true, force: true });
    fs.rmSync(path.join(iconLibrariesDir, beta.id), { recursive: true, force: true });
  }
});

test('listIconLibraryFiles merges results across configured libraries', () => {
  const config = createTestConfig();
  const [alpha, beta] = config.iconLibraries;

  createLibraryFixture(alpha.id, {
    'plex.png': 'alpha-plex'
  });
  createLibraryFixture(beta.id, {
    'photo/immich.png': 'beta-immich',
    'paperless.png': 'beta-paperless'
  });

  try {
    const payload = listIconLibraryFiles(config, '', 10);

    assert.equal(payload.libraryCount, 2);
    assert.equal(payload.iconCount, 3);
    assert.equal(payload.items.length, 3);
    assert.deepEqual(
      payload.items.map((item) => [item.libraryId, item.libraryName, item.relativePath]),
      [
        [alpha.id, 'Alpha Pack', 'plex.png'],
        [beta.id, 'Beta Pack', 'paperless.png'],
        [beta.id, 'Beta Pack', 'photo/immich.png']
      ]
    );
    assert.match(payload.items[0].previewUrl, new RegExp(`/api/icon-library/file/${alpha.id}/`));
  } finally {
    fs.rmSync(path.join(iconLibrariesDir, alpha.id), { recursive: true, force: true });
    fs.rmSync(path.join(iconLibrariesDir, beta.id), { recursive: true, force: true });
  }
});

test('resolveIconFilePath stays inside the selected icon library', () => {
  const config = createTestConfig();
  const [alpha, beta] = config.iconLibraries;

  createLibraryFixture(alpha.id, {
    'plex.png': 'alpha-plex'
  });

  try {
    const resolved = resolveIconFilePath(config, alpha.id, 'plex.png');

    assert.equal(path.basename(resolved), 'plex.png');
    assert.throws(() => resolveIconFilePath(config, alpha.id, '../secret.png'), /Unsafe icon file path/);
    assert.throws(() => resolveIconFilePath(config, beta.id, 'plex.png'), /Icon file not found/);
  } finally {
    fs.rmSync(path.join(iconLibrariesDir, alpha.id), { recursive: true, force: true });
    fs.rmSync(path.join(iconLibrariesDir, beta.id), { recursive: true, force: true });
  }
});

test('local icon references round-trip encoded paths', () => {
  const reference = buildLocalIconReference('HD Icons', 'media/Plex Icon.png');

  assert.equal(reference, 'local-icon://HD%20Icons/media/Plex%20Icon.png');
  assert.deepEqual(parseLocalIconReference(reference), {
    libraryId: 'HD Icons',
    relativePath: 'media/Plex Icon.png'
  });
  assert.equal(parseLocalIconReference('https://example.com/icon.png'), null);
});

test('buildRemoteIconFileName creates stable container-scoped names', () => {
  const fileName = buildRemoteIconFileName(
    { containerName: '/Plex Media Server' },
    { libraryId: 'hd-icons', relativePath: 'media/plex.logo.png' }
  );

  assert.match(fileName, /^plex-media-server-[a-f0-9]{10}\.png$/);
});

test('downloadIconLibrary expands zip archives without platform shell tools', async () => {
  const libraryId = `download-test-${crypto.randomUUID()}`;
  const zipBuffer = Buffer.from(
    'UEsDBBQAAAAIAHBYulyQAxiDBQAAAAMAAAATAAAAcGFja1xpY29uc1x0ZXN0LnBuZyvISwcAUEsBAhQAFAAAAAgAcFi6XJADGIMFAAAAAwAAABMAAAAAAAAAAAAAAAAAAAAAAHBhY2tcaWNvbnNcdGVzdC5wbmdQSwUGAAAAAAEAAQBBAAAANgAAAAAA',
    'base64'
  );
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'application/zip',
      'content-length': zipBuffer.length
    });
    response.end(zipBuffer);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const result = await downloadIconLibrary({
      iconLibraries: [
        {
          id: libraryId,
          name: 'Download Test',
          zipUrl: `http://127.0.0.1:${port}/icons.zip`,
          zipSubdir: 'pack/icons'
        }
      ]
    });

    assert.equal(result.downloaded.iconCount, 1);
    assert.equal(
      fs.readFileSync(path.join(iconLibrariesDir, libraryId, 'test.png'), 'utf8'),
      'png'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(path.join(iconLibrariesDir, libraryId), { recursive: true, force: true });
  }
});
