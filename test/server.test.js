import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  getIconPreviewContentType,
  getPreviewAllowedPaths,
  isRemoteIconPreviewPathAllowed,
  resolveMappedHostIconPath
} from '../src/server.js';

test('resolveMappedHostIconPath maps Unraid host paths into the local icon store', () => {
  const resolved = resolveMappedHostIconPath(
    {
      hostIconPath: '/mnt/user/download/test/icons',
      localIconStoreDir: '/app/icons'
    },
    '/mnt/user/download/test/icons/cms-6df069ede1.png'
  );

  assert.equal(resolved, path.resolve('/app/icons/cms-6df069ede1.png'));
});

test('resolveMappedHostIconPath rejects paths outside the configured host icon path', () => {
  assert.throws(() => resolveMappedHostIconPath(
    {
      hostIconPath: '/mnt/user/download/test/icons',
      localIconStoreDir: '/app/icons'
    },
    '/mnt/user/download/other/cms.png'
  ), /outside the configured Unraid host icon path/);
});

test('getPreviewAllowedPaths includes host icon path and configured fallback paths', () => {
  const paths = getPreviewAllowedPaths({
    hostIconPath: '/mnt/user/download/test/icons/',
    previewAllowedPaths: [
      '/boot/config/plugins/dockerMan/images',
      '/mnt/user/download/test/icons'
    ]
  });

  assert.equal(paths[0], '/mnt/user/download/test/icons');
  assert.equal(paths.includes('/mnt/user'), true);
  assert.equal(paths.includes('/boot/config/plugins/dockerMan/images'), true);
});

test('isRemoteIconPreviewPathAllowed accepts only paths inside the preview allowlist', () => {
  const config = {
    hostIconPath: '/mnt/user/download/test/icons',
    previewAllowedPaths: ['/boot/config/plugins/dockerMan/images']
  };

  assert.equal(
    isRemoteIconPreviewPathAllowed(config, '/boot/config/plugins/dockerMan/images/Cms.png'),
    true
  );
  assert.equal(
    isRemoteIconPreviewPathAllowed(config, '/mnt/user/not-mapped/test.png'),
    true
  );
  assert.equal(
    isRemoteIconPreviewPathAllowed(config, '/boot/config/plugins/dockerMan/images-old/Cms.png'),
    false
  );
  assert.equal(
    isRemoteIconPreviewPathAllowed(config, '/etc/passwd'),
    false
  );
});

test('getIconPreviewContentType allows image extensions only', () => {
  assert.equal(getIconPreviewContentType('/boot/config/plugins/dockerMan/images/Cms.PNG'), 'image/png');
  assert.equal(getIconPreviewContentType('/boot/config/plugins/dockerMan/images/logo.svg'), 'image/svg+xml');
  assert.throws(
    () => getIconPreviewContentType('/boot/config/plugins/dockerMan/images/not-image.txt'),
    /Unsupported icon preview file type/
  );
});
