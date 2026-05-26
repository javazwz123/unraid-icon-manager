import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildComposeRecreateCommand,
  buildDockerRecreateCommand,
  buildDockerRestartCommand,
  buildDockerInspectCommand,
  getRemoteIconPreviewBuffer,
  getRestartContainerName,
  normalizeDockerInspectContainers,
  resolveSyncIconValue,
  shouldRestartContainer
} from '../src/sftpSync.js';
import { buildLocalIconReference, buildRemoteIconFileName } from '../src/iconLibrary.js';
import { iconLibrariesDir } from '../src/paths.js';

test('shouldRestartContainer restarts changed entries that have a container name', () => {
  assert.equal(
    shouldRestartContainer({ name: 'plex', state: 'running' }, true),
    true
  );
  assert.equal(
    shouldRestartContainer({ name: 'plex', state: 'exited' }, true),
    true
  );
  assert.equal(
    shouldRestartContainer({ name: 'plex', state: 'template-only' }, true),
    true
  );
  assert.equal(
    shouldRestartContainer({ name: 'plex', state: 'running' }, false),
    false
  );
  assert.equal(
    shouldRestartContainer({ name: '', state: 'running' }, true),
    false
  );
});

test('getRestartContainerName removes leading docker slash', () => {
  assert.equal(getRestartContainerName({ containerName: '/plex', name: 'ignored' }), 'plex');
  assert.equal(getRestartContainerName({ name: '/fallback' }), 'fallback');
});

test('buildDockerRestartCommand separates assignment and if statement', () => {
  const command = buildDockerRestartCommand('plex');
  assert.match(command, /true\)\nif \[ "\$state" = "true" \]; then/);
  assert.doesNotMatch(command, /true\) if/);
});

test('buildDockerRecreateCommand uses dockerMan rebuild and preserves running state', () => {
  const command = buildDockerRecreateCommand('Cms');
  assert.match(command, /rebuild_container/);
  assert.match(command, /docker inspect -f/);
  assert.match(command, /docker start 'Cms'/);
  assert.match(command, /docker stop 'Cms'/);
  assert.match(command, /__UNRAID_ICON_REBUILT_RUNNING__/);
  assert.match(command, /__UNRAID_ICON_REBUILT_STOPPED__/);
  assert.doesNotMatch(command, /docker restart/);
});

test('buildComposeRecreateCommand uses a valid multiline shell shape', () => {
  const command = buildComposeRecreateCommand({
    containerName: 'libretv',
    projectPath: '/boot/config/plugins/compose.manager/projects/Libre_Tv',
    serviceName: 'libretv'
  });
  assert.match(command, /true\)\nif \[ "\$state" = "true" \]; then/);
  assert.match(command, /docker compose version/);
  assert.match(command, /up -d --force-recreate --no-deps 'libretv'/);
  assert.doesNotMatch(command, /true\) if/);
  assert.doesNotMatch(command, /then;/);
});

test('buildDockerInspectCommand returns an empty JSON array when no containers exist', () => {
  const command = buildDockerInspectCommand();
  assert.match(command, /docker ps -aq --no-trunc/);
  assert.match(command, /printf '%s\\n' '\[\]'/);
  assert.match(command, /docker inspect \$ids/);
});

test('normalizeDockerInspectContainers reads state and compose labels from ssh docker inspect', () => {
  const containers = normalizeDockerInspectContainers([
    {
      Id: 'abc123',
      Name: '/libretv',
      State: { Running: true, Status: 'running' },
      Config: {
        Image: 'danndee1/libretv:latest',
        Labels: {
          'com.docker.compose.project': 'tutu_libretv',
          'com.docker.compose.service': 'libretv',
          'com.docker.compose.project.working_dir': '/boot/config/plugins/compose.manager/projects/TUTU_libretv',
          'com.docker.compose.project.config_files': '/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.yml,/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.override.yml'
        }
      }
    },
    {
      Id: 'def456',
      Name: '/stopped-app',
      State: { Running: false, Status: 'exited' },
      Config: {
        Image: 'example/stopped:latest',
        Labels: null
      }
    }
  ]);

  assert.deepEqual(containers, [
    {
      id: 'abc123',
      name: 'libretv',
      names: ['libretv'],
      state: 'running',
      status: 'running',
      autoStart: false,
      labels: {
        'com.docker.compose.project': 'tutu_libretv',
        'com.docker.compose.service': 'libretv',
        'com.docker.compose.project.working_dir': '/boot/config/plugins/compose.manager/projects/TUTU_libretv',
        'com.docker.compose.project.config_files': '/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.yml,/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.override.yml'
      },
      repository: 'danndee1/libretv:latest',
      composeProject: 'tutu_libretv',
      composeService: 'libretv',
      composeWorkingDir: '/boot/config/plugins/compose.manager/projects/TUTU_libretv',
      composeConfigFiles: '/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.yml,/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.override.yml'
    },
    {
      id: 'def456',
      name: 'stopped-app',
      names: ['stopped-app'],
      state: 'exited',
      status: 'exited',
      autoStart: false,
      labels: {},
      repository: 'example/stopped:latest',
      composeProject: '',
      composeService: '',
      composeWorkingDir: '',
      composeConfigFiles: ''
    }
  ]);
});

test('resolveSyncIconValue leaves normal icon values unchanged', async () => {
  const clientCalls = [];
  const result = await resolveSyncIconValue(
    { remoteIconDir: '/boot/config/plugins/unraid-icon-manager/icons' },
    { icon: 'https://example.com/plex.png' },
    {
      mkdir: async (...args) => clientCalls.push(['mkdir', ...args]),
      put: async (...args) => clientCalls.push(['put', ...args])
    }
  );

  assert.equal(result.icon, 'https://example.com/plex.png');
  assert.equal(result.uploadedIcon, null);
  assert.deepEqual(clientCalls, []);
});

test('getRemoteIconPreviewBuffer is exported for server fallback previews', () => {
  assert.equal(typeof getRemoteIconPreviewBuffer, 'function');
});

test('resolveSyncIconValue copies local library icons into mapped store path', async () => {
  const libraryId = `sync-test-${Date.now()}`;
  const libraryDir = path.join(iconLibrariesDir, libraryId);
  const iconRelativePath = 'media/plex.png';
  const sourceIconPath = path.join(libraryDir, iconRelativePath);
  const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unraid-icon-store-'));
  const update = {
    name: 'Plex Media Server',
    containerName: '/plex',
    icon: buildLocalIconReference(libraryId, iconRelativePath)
  };
  const reference = { libraryId, relativePath: iconRelativePath };
  const expectedFileName = buildRemoteIconFileName(update, reference);
  const clientCalls = [];

  fs.mkdirSync(path.dirname(sourceIconPath), { recursive: true });
  fs.writeFileSync(sourceIconPath, 'fake-png');

  try {
    const result = await resolveSyncIconValue(
      {
        localIconStoreDir: targetDir,
        hostIconPath: '/mnt/user/appdata/unraid-icon-manager/icons',
        iconLibraries: [
          {
            id: libraryId,
            name: 'Sync Test',
            zipUrl: 'https://example.com/icons.zip',
            zipSubdir: 'icons'
          }
        ]
      },
      update,
      {
        mkdir: async (...args) => clientCalls.push(['mkdir', ...args]),
        put: async (...args) => clientCalls.push(['put', ...args])
      }
    );

    assert.equal(result.icon, `/mnt/user/appdata/unraid-icon-manager/icons/${expectedFileName}`);
    assert.equal(result.uploadedIcon.hostPath, result.icon);
    assert.equal(fs.readFileSync(path.join(targetDir, expectedFileName), 'utf8'), 'fake-png');
    assert.deepEqual(clientCalls, []);
  } finally {
    fs.rmSync(libraryDir, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
});
