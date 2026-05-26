import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configSchema,
  hasSshConfig,
  iconLibraryRequestSchema,
  parsePreviewAllowedPaths
} from '../src/validation.js';

test('config accepts ssh-only connection', () => {
  const parsed = configSchema.parse({
    sshHost: 'tower.local',
    sshUsername: 'root',
    sshPassword: 'secret'
  });

  assert.equal(hasSshConfig(parsed), true);
  assert.equal(Object.hasOwn(parsed, 'remoteIconDir'), false);
  assert.equal(parsed.localIconStoreDir, '/app/icons');
  assert.equal(parsed.hostIconPath, '/mnt/user/appdata/unraid-icon-manager/icons');
  assert.deepEqual(parsed.previewAllowedPaths, []);
});

test('config rejects web-only connection', () => {
  assert.throws(
    () => configSchema.parse({ webUrl: 'https://tower.local', apiKey: 'api-key' }),
    /SSH\/SFTP/
  );
});

test('config ignores legacy web api fields when ssh is valid', () => {
  const parsed = configSchema.parse({
    webUrl: 'https://tower.local',
    apiKey: 'api-key',
    verifyTls: true,
    sshHost: 'tower.local',
    sshUsername: 'root',
    sshPassword: 'secret'
  });

  assert.equal(parsed.sshHost, 'tower.local');
  assert.equal(Object.hasOwn(parsed, 'webUrl'), false);
  assert.equal(Object.hasOwn(parsed, 'apiKey'), false);
  assert.equal(Object.hasOwn(parsed, 'verifyTls'), false);
});

test('config ignores legacy remote icon directory and accepts mapped icon paths', () => {
  const parsed = configSchema.parse({
    sshHost: 'tower.local',
    sshUsername: 'root',
    sshPassword: 'secret',
    remoteIconDir: '/mnt/user/appdata/unraid-icon-manager/legacy-icons',
    localIconStoreDir: '/custom/icons',
    hostIconPath: '/mnt/user/appdata/custom-icons'
  });

  assert.equal(Object.hasOwn(parsed, 'remoteIconDir'), false);
  assert.equal(parsed.localIconStoreDir, '/custom/icons');
  assert.equal(parsed.hostIconPath, '/mnt/user/appdata/custom-icons');
});

test('config accepts preview allowlist paths from textarea input', () => {
  const parsed = configSchema.parse({
    sshHost: 'tower.local',
    sshUsername: 'root',
    sshPassword: 'secret',
    previewAllowedPaths: '/boot/config/plugins/dockerMan/images\n/mnt/user/download/test/icons,\n/etc/'
  });

  assert.deepEqual(parsed.previewAllowedPaths, [
    '/boot/config/plugins/dockerMan/images',
    '/mnt/user/download/test/icons',
    '/etc'
  ]);
});

test('parsePreviewAllowedPaths keeps absolute unique paths only', () => {
  assert.deepEqual(parsePreviewAllowedPaths([
    '/mnt/user/icons/',
    '/mnt/user/icons',
    'relative/path',
    '',
    ' /boot/config/plugins/dockerMan/images '
  ]), [
    '/mnt/user/icons',
    '/boot/config/plugins/dockerMan/images'
  ]);
});

test('config accepts multiple icon libraries with stable ids', () => {
  const parsed = configSchema.parse({
    sshHost: 'tower.local',
    sshUsername: 'root',
    sshPassword: 'secret',
    iconLibraries: [
      {
        id: 'hd-icons',
        name: 'HD Icons',
        zipUrl: 'https://example.com/hd-icons.zip',
        zipSubdir: 'hd-icons',
        publicBaseUrl: 'http://tower.local:3149'
      },
      {
        id: 'custom-pack',
        name: '自定义图标包',
        zipUrl: 'https://example.com/custom-pack.zip',
        zipSubdir: 'custom-pack',
        publicBaseUrl: 'http://tower.local:3149'
      }
    ]
  });

  assert.equal(parsed.iconLibraries.length, 2);
  assert.deepEqual(
    parsed.iconLibraries.map((library) => [library.id, library.name]),
    [
      ['hd-icons', 'HD Icons'],
      ['custom-pack', '自定义图标包']
    ]
  );
});

test('config accepts multiple zip subdirectories per icon library', () => {
  const parsed = configSchema.parse({
    sshHost: 'tower.local',
    sshUsername: 'root',
    sshPassword: 'secret',
    iconLibraries: [
      {
        id: 'multi-pack',
        name: 'Multi Pack',
        zipUrl: 'https://example.com/multi-pack.zip',
        zipSubdir: 'pack/flat\npack/rounded, pack/flat'
      }
    ]
  });

  assert.equal(parsed.iconLibraries[0].zipSubdir, 'pack/flat\npack/rounded');
});

test('config rejects empty connection settings', () => {
  assert.throws(() => configSchema.parse({}), /SSH\/SFTP/);
});

test('config rejects partial ssh connection', () => {
  assert.throws(
    () => configSchema.parse({ sshHost: 'tower.local', sshUsername: 'root' }),
    /SSH 连接/
  );
});

test('icon library request keeps missing libraryId empty', () => {
  const parsed = iconLibraryRequestSchema.parse({
    iconLibraries: [
      {
        name: 'HD Icons',
        zipUrl: 'https://example.com/hd-icons.zip',
        zipSubdir: 'hd-icons'
      }
    ]
  });

  assert.equal(parsed.libraryId, '');
});
