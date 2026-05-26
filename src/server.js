import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, mergeConfigPatch, sanitizeConfig, saveConfig } from './configStore.js';
import { defaultHostIconPath, iconStoreDir } from './paths.js';
import {
  downloadIconLibrary,
  getIconLibraryStatuses,
  listIconLibraryFiles,
  resolveIconFilePath
} from './iconLibrary.js';
import {
  getRemoteIconPreviewBuffer,
  listContainersWithIcons,
  syncIconUpdates,
  testSftp
} from './sftpSync.js';
import {
  configPatchSchema,
  configSchema,
  formatZodError,
  hasSshConfig,
  iconLibraryRequestSchema,
  parsePreviewAllowedPaths,
  syncRequestSchema
} from './validation.js';

const app = express();
const port = Number(process.env.PORT || 3149);
const currentFile = fileURLToPath(import.meta.url);
const publicDir = path.resolve(path.dirname(currentFile), '..', 'public');
const downloadJobs = new Map();
const iconPreviewContentTypes = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon']
]);
const defaultRemoteIconPreviewPaths = [
  '/mnt/user',
  '/mnt/cache',
  '/boot/config/plugins/dockerMan/images',
  '/var/lib/docker/unraid/images',
  '/var/local/emhttp/plugins/dynamix.docker.manager/images',
  '/usr/local/emhttp/state/plugins/dynamix.docker.manager/images'
];

app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDir));

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function requireConfig() {
  const config = loadConfig();
  if (!config) {
    const error = new Error('Connection config has not been saved yet');
    error.status = 400;
    throw error;
  }
  return config;
}

function parseIconListLimit(value) {
  if (value === 'all') {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Number(value || 256);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 256;
  }

  return Math.min(parsed, 5000);
}

function updateDownloadJob(jobId, patch) {
  const previous = downloadJobs.get(jobId);
  if (!previous) {
    return;
  }
  downloadJobs.set(jobId, {
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

function getPublicDownloadJob(jobId) {
  const job = downloadJobs.get(jobId);
  if (!job) {
    return null;
  }
  const { config, ...publicJob } = job;
  return publicJob;
}

function runDownloadJob(jobId, config, libraryId) {
  downloadIconLibrary(config, libraryId, (progress) => {
    updateDownloadJob(jobId, progress);
  })
    .then((result) => {
      updateDownloadJob(jobId, {
        phase: 'done',
        message: `${result.downloaded?.name || '图标库'} 已下载，${result.downloaded?.iconCount || 0} 个图标`,
        percent: 100,
        result
      });
    })
    .catch((error) => {
      updateDownloadJob(jobId, {
        phase: 'error',
        message: error.message,
        error: error.message,
        percent: 100
      });
    });
}

app.get('/api/config', (_request, response) => {
  response.json(sanitizeConfig(loadConfig()));
});

app.get('/api/icon-library', (_request, response) => {
  const config = loadConfig() ?? {};
  response.json({
    ...getIconLibraryStatuses(config),
    iconLibraries: config.iconLibraries ?? []
  });
});

app.get('/api/icon-library/icons', (request, response) => {
  const limit = parseIconListLimit(request.query.limit);
  response.json(listIconLibraryFiles(
    loadConfig() ?? {},
    request.query.q ?? '',
    limit,
    request.query.libraryId ?? ''
  ));
});

function sendIconFile(request, response, next) {
  try {
    const libraryName = decodeURIComponent(request.params[0]);
    const relativePath = decodeURIComponent(request.params[1]);
    response.sendFile(resolveIconFilePath(loadConfig() ?? {}, libraryName, relativePath));
  } catch (error) {
    next(error);
  }
}

function normalizePosixPath(value) {
  const source = String(value || '').trim().replaceAll('\\', '/');
  return source ? path.posix.normalize(source) : '';
}

function createHttpError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function getIconPreviewContentType(hostPathValue) {
  const hostPath = normalizePosixPath(hostPathValue);
  const extension = path.posix.extname(hostPath).toLowerCase();
  const contentType = iconPreviewContentTypes.get(extension);
  if (!contentType) {
    throw createHttpError('Unsupported icon preview file type.', 415);
  }
  return contentType;
}

export function getPreviewAllowedPaths(config = {}) {
  const configuredPaths = Array.isArray(config.previewAllowedPaths)
    ? config.previewAllowedPaths
    : parsePreviewAllowedPaths(config.previewAllowedPaths || '');
  return parsePreviewAllowedPaths([
    config.hostIconPath || defaultHostIconPath,
    ...defaultRemoteIconPreviewPaths,
    ...configuredPaths
  ]);
}

export function isRemoteIconPreviewPathAllowed(config, hostPathValue) {
  const hostPath = normalizePosixPath(hostPathValue);
  if (!path.posix.isAbsolute(hostPath)) {
    return false;
  }

  return getPreviewAllowedPaths(config).some((allowedPath) => {
    const relativePath = path.posix.relative(allowedPath, hostPath);
    return relativePath === '' ||
      (!relativePath.startsWith('..') && !path.posix.isAbsolute(relativePath));
  });
}

export function resolveMappedHostIconPath(config, hostPathValue) {
  const hostPath = normalizePosixPath(hostPathValue);
  const hostIconPath = normalizePosixPath(config.hostIconPath || defaultHostIconPath).replace(/\/+$/, '');
  if (!hostPath || !hostIconPath) {
    throw new Error('Icon preview path is not configured.');
  }

  const relativePath = path.posix.relative(hostIconPath, hostPath);
  if (!relativePath || relativePath.startsWith('..') || path.posix.isAbsolute(relativePath)) {
    const error = new Error('Icon preview path is outside the configured Unraid host icon path.');
    error.status = 403;
    throw error;
  }

  const localIconStoreDir = path.resolve(config.localIconStoreDir || iconStoreDir);
  const localPath = path.resolve(localIconStoreDir, ...relativePath.split('/'));
  if (localPath !== localIconStoreDir && !localPath.startsWith(`${localIconStoreDir}${path.sep}`)) {
    const error = new Error('Icon preview path is outside the configured local icon store.');
    error.status = 403;
    throw error;
  }
  return localPath;
}

async function sendMappedIconPreview(config, hostPath, response) {
  const localPath = resolveMappedHostIconPath(config, hostPath);
  await fs.access(localPath);
  response.sendFile(localPath);
}

async function sendRemoteIconPreview(config, hostPath, response) {
  if (!hasSshConfig(config)) {
    throw createHttpError('SSH/SFTP is required to preview icons outside the mapped icon directory.', 400);
  }
  if (!isRemoteIconPreviewPathAllowed(config, hostPath)) {
    throw createHttpError('Icon preview path is outside the allowed Unraid preview paths.', 403);
  }

  const buffer = await getRemoteIconPreviewBuffer(config, hostPath);
  response.set('Content-Type', getIconPreviewContentType(hostPath));
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('Cache-Control', 'private, max-age=60');
  response.send(buffer);
}

app.get(/^\/api\/icon-library\/file\/([^/]+)\/(.+)$/, sendIconFile);
app.get(/^\/icons\/([^/]+)\/(.+)$/, sendIconFile);

app.get('/api/icon-preview', asyncRoute(async (request, response) => {
  const config = loadConfig() ?? {};
  const hostPath = normalizePosixPath(request.query.path);
  if (!hostPath || !path.posix.isAbsolute(hostPath)) {
    throw createHttpError('Icon preview path must be an absolute Unraid path.', 400);
  }
  getIconPreviewContentType(hostPath);

  try {
    await sendMappedIconPreview(config, hostPath, response);
  } catch (error) {
    if (!isRemoteIconPreviewPathAllowed(config, hostPath)) {
      throw error.status ? error : createHttpError('Mapped icon preview file was not found.', 404);
    }
    await sendRemoteIconPreview(config, hostPath, response);
  }
}));

app.put('/api/config', (request, response) => {
  const parsed = configPatchSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const merged = mergeConfigPatch(loadConfig(), parsed.data);
  const validated = configSchema.safeParse(merged);
  if (!validated.success) {
    response.status(400).json({ error: formatZodError(validated.error) });
    return;
  }

  saveConfig(validated.data);
  response.json(sanitizeConfig(validated.data));
});

app.post('/api/test', asyncRoute(async (_request, response) => {
  const config = requireConfig();
  const ssh = hasSshConfig(config)
    ? await testSftp(config).catch((error) => ({ ok: false, error: error.message }))
    : { ok: false, error: '请先填写 SSH 地址、用户名，以及密码或私钥' };

  response.status(ssh.ok ? 200 : 502).json({
    ok: Boolean(ssh.ok),
    ssh,
    error: ssh.ok ? undefined : 'SSH 连接测试未通过'
  });
}));

app.put('/api/icon-library', (request, response) => {
  const parsed = iconLibraryRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const previous = loadConfig();
  const merged = mergeConfigPatch(previous, parsed.data);
  if (previous) {
    saveConfig(merged);
  }
  response.json({
    ...getIconLibraryStatuses(merged),
    iconLibraries: merged.iconLibraries ?? []
  });
});

app.post('/api/icon-library/download', asyncRoute(async (request, response) => {
  const parsed = iconLibraryRequestSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    response.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const previous = loadConfig();
  const config = mergeConfigPatch(previous, parsed.data);
  if (previous) {
    saveConfig(config);
  }
  const jobId = crypto.randomUUID();
  const libraryId = parsed.data.libraryId || (config.iconLibraries ?? [])[0]?.id || '';
  downloadJobs.set(jobId, {
    id: jobId,
    libraryId,
    phase: 'queued',
    message: '下载任务已创建',
    percent: 0,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  setImmediate(() => runDownloadJob(jobId, config, libraryId));
  response.status(202).json(getPublicDownloadJob(jobId));
}));

app.get('/api/icon-library/download/:jobId', (request, response) => {
  const job = getPublicDownloadJob(request.params.jobId);
  if (!job) {
    response.status(404).json({ error: '下载任务不存在或已过期' });
    return;
  }
  response.json(job);
});

app.get('/api/containers', asyncRoute(async (_request, response) => {
  const config = requireConfig();
  if (!hasSshConfig(config)) {
    response.status(400).json({ error: '请先配置 SSH/SFTP 连接' });
    return;
  }

  response.json({
    source: 'ssh',
    items: await listContainersWithIcons(config)
  });
}));

app.post('/api/sync', asyncRoute(async (request, response) => {
  const parsed = syncRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const config = requireConfig();
  if (!hasSshConfig(config)) {
    response.status(400).json({ error: '同步到 Unraid 需要 SSH/SFTP 配置' });
    return;
  }

  const results = await syncIconUpdates(config, parsed.data.updates);
  response.json({ results });
}));

app.use((error, _request, response, _next) => {
  const status = error.status || 500;
  response.status(status).json({
    error: error.message || 'Unexpected server error'
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  app.listen(port, () => {
    console.log(`Unraid Icon Manager listening on http://localhost:${port}`);
  });
}
