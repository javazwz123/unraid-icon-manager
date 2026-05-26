import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fetch } from 'undici';
import yauzl from 'yauzl';
import {
  DEFAULT_ICON_LIBRARY,
  findIconLibrary,
  getIconLibrariesFromConfig,
  parseZipSubdirs
} from './iconLibraryConfig.js';
import { iconLibrariesDir } from './paths.js';

function resolveInside(parentDir, childPath) {
  const resolvedParent = path.resolve(parentDir);
  const resolvedChild = path.resolve(parentDir, childPath);
  if (resolvedChild !== resolvedParent && !resolvedChild.startsWith(`${resolvedParent}${path.sep}`)) {
    throw new Error(`Unsafe path outside icon library directory: ${childPath}`);
  }
  return resolvedChild;
}

function getLibraryDir(library) {
  return path.join(iconLibrariesDir, library.id);
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

export function buildLocalIconReference(libraryId, relativePath) {
  const encodedPath = String(relativePath || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `local-icon://${encodeURIComponent(libraryId)}/${encodedPath}`;
}

export function parseLocalIconReference(value) {
  const source = String(value || '').trim();
  if (!source.toLowerCase().startsWith('local-icon://')) {
    return null;
  }

  const reference = source.slice('local-icon://'.length);
  const slashIndex = reference.indexOf('/');
  if (slashIndex <= 0 || slashIndex === reference.length - 1) {
    throw new Error('Invalid local icon reference');
  }

  const libraryId = decodeURIComponent(reference.slice(0, slashIndex));
  const relativePath = reference
    .slice(slashIndex + 1)
    .split('/')
    .map((part) => decodeURIComponent(part))
    .join('/');

  if (!libraryId || !relativePath) {
    throw new Error('Invalid local icon reference');
  }

  return { libraryId, relativePath };
}

export function buildRemoteIconFileName(update, reference) {
  const sourceName = String(update?.containerName || update?.name || 'icon')
    .trim()
    .replace(/^\//, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'icon';
  const extension = path.extname(reference.relativePath).toLowerCase() || '.png';
  const digest = crypto
    .createHash('sha256')
    .update(`${reference.libraryId}/${reference.relativePath}`)
    .digest('hex')
    .slice(0, 10);
  return `${sourceName}-${digest}${extension}`;
}

function withLibraryStats(library) {
  const dir = getLibraryDir(library);
  const stats = countIconFiles(dir);
  return {
    ...library,
    path: dir,
    exists: fs.existsSync(dir),
    iconCount: stats.count,
    bytes: stats.bytes
  };
}

function summarizeLibraries(libraries) {
  const withStats = libraries.map(withLibraryStats);
  return {
    libraries: withStats,
    exists: withStats.some((library) => library.exists),
    libraryCount: withStats.length,
    iconCount: withStats.reduce((total, library) => total + library.iconCount, 0),
    bytes: withStats.reduce((total, library) => total + library.bytes, 0)
  };
}

function getConfiguredLibraries(config = {}) {
  return getIconLibrariesFromConfig(config);
}

function getRequestedLibraries(config = {}, libraryId = '') {
  if (!libraryId) {
    return getConfiguredLibraries(config);
  }

  const library = findIconLibrary(config, libraryId);
  if (!library) {
    throw new Error(`Unknown icon library: ${libraryId}`);
  }
  return [library];
}

export function countIconFiles(dir) {
  if (!fs.existsSync(dir)) {
    return { count: 0, bytes: 0 };
  }

  let count = 0;
  let bytes = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const child = countIconFiles(entryPath);
      count += child.count;
      bytes += child.bytes;
    } else if (/\.(png|jpg|jpeg|webp|svg)$/i.test(entry.name)) {
      count += 1;
      bytes += fs.statSync(entryPath).size;
    }
  }
  return { count, bytes };
}

export function getIconLibraryStatus(config, libraryId = '') {
  const library = libraryId
    ? findIconLibrary(config, libraryId)
    : getConfiguredLibraries(config)[0] || DEFAULT_ICON_LIBRARY;
  if (!library) {
    return withLibraryStats(DEFAULT_ICON_LIBRARY);
  }
  return withLibraryStats(library);
}

export function getIconLibraryStatuses(config) {
  return summarizeLibraries(getConfiguredLibraries(config));
}

export function listIconLibraryFiles(config, query = '', limit = 256, libraryId = '') {
  const libraries = getRequestedLibraries(config, libraryId);
  const summary = summarizeLibraries(libraries);
  if (!summary.exists) {
    return {
      ...summary,
      items: []
    };
  }

  const terms = String(query)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const items = [];

  for (const library of libraries) {
    const dir = getLibraryDir(library);
    if (!fs.existsSync(dir)) {
      continue;
    }

    function walk(currentDir) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        if (items.length >= limit) {
          return;
        }
        const entryPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(entryPath);
          continue;
        }
        if (!/\.(png|jpg|jpeg|webp|svg)$/i.test(entry.name)) {
          continue;
        }

        const relativePath = toPosixPath(path.relative(dir, entryPath));
        const haystack = `${library.name} ${library.id} ${entry.name} ${relativePath}`.toLowerCase();
        if (terms.every((term) => haystack.includes(term))) {
          items.push({
            libraryId: library.id,
            libraryName: library.name,
            fileName: entry.name,
            relativePath,
            previewUrl: `/api/icon-library/file/${encodeURIComponent(library.id)}/${relativePath
              .split('/')
              .map((part) => encodeURIComponent(part))
              .join('/')}`
          });
        }
      }
    }

    walk(dir);
    if (items.length >= limit) {
      break;
    }
  }

  return {
    ...summary,
    items
  };
}

export function resolveIconFilePath(config, libraryId, relativePath) {
  const library = findIconLibrary(config, libraryId);
  if (!library) {
    throw new Error('Unknown icon library');
  }

  const libraryDir = getLibraryDir(library);
  const targetPath = path.resolve(libraryDir, relativePath);
  const resolvedLibraryDir = path.resolve(libraryDir);
  if (targetPath !== resolvedLibraryDir && !targetPath.startsWith(`${resolvedLibraryDir}${path.sep}`)) {
    throw new Error('Unsafe icon file path');
  }
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    throw new Error('Icon file not found');
  }
  return targetPath;
}

function describeFetchError(error) {
  const cause = error?.cause;
  const details = [
    cause?.code,
    cause?.hostname,
    cause?.address,
    cause?.port ? `port ${cause.port}` : '',
    cause?.message
  ].filter(Boolean).join(' ');
  return details ? `${error.message}: ${details}` : error.message;
}

async function downloadFile(url, targetPath, onProgress = () => {}) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Icon library download failed: ${describeFetchError(error)}`);
  }
  if (!response.ok || !response.body) {
    throw new Error(`Icon library download failed (${response.status} ${response.statusText || ''})`.trim());
  }

  const totalBytes = Number(response.headers.get('content-length') || 0);
  let receivedBytes = 0;
  const progressStream = new TransformStream({
    transform(chunk, controller) {
      receivedBytes += chunk.byteLength;
      onProgress({
        totalBytes,
        receivedBytes,
        percent: totalBytes ? Math.min(65, Math.round((receivedBytes / totalBytes) * 65)) : 18
      });
      controller.enqueue(chunk);
    }
  });

  await pipeline(response.body.pipeThrough(progressStream), fs.createWriteStream(targetPath));
}

async function expandZip(zipPath, outputDir) {
  await new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError) {
        reject(openError);
        return;
      }

      zipFile.on('error', reject);
      zipFile.on('end', resolve);
      zipFile.readEntry();

      zipFile.on('entry', (entry) => {
        const normalizedName = entry.fileName.replaceAll('\\', '/');
        if (/^([a-z]:)?\//i.test(normalizedName) || normalizedName.split('/').includes('..')) {
          zipFile.close();
          reject(new Error(`Unsafe path in icon library zip: ${entry.fileName}`));
          return;
        }

        const targetPath = resolveInside(outputDir, normalizedName);
        if (/\/$/.test(normalizedName)) {
          fs.mkdirSync(targetPath, { recursive: true });
          zipFile.readEntry();
          return;
        }

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        zipFile.openReadStream(entry, (streamError, readStream) => {
          if (streamError) {
            zipFile.close();
            reject(streamError);
            return;
          }

          const writeStream = fs.createWriteStream(targetPath);
          readStream
            .on('error', (error) => {
              zipFile.close();
              reject(error);
            })
            .pipe(writeStream)
            .on('error', (error) => {
              zipFile.close();
              reject(error);
            })
            .on('finish', () => zipFile.readEntry());
        });
      });
    });
  });
}

function copyDirectoryContents(sourceDir, targetDir) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyDirectoryContents(sourcePath, targetPath);
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

export async function downloadIconLibrary(config, libraryId = '', onProgress = () => {}) {
  const library = libraryId
    ? findIconLibrary(config, libraryId)
    : getConfiguredLibraries(config)[0];
  if (!library) {
    throw new Error('No icon library configured');
  }

  const targetDir = getLibraryDir(library);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unraid-icon-library-'));
  const zipPath = path.join(tempDir, 'library.zip');
  const extractDir = path.join(tempDir, 'extract');

  try {
    fs.mkdirSync(extractDir, { recursive: true });
    onProgress({
      phase: 'downloading',
      message: '正在下载图标库压缩包',
      percent: 5
    });
    await downloadFile(library.zipUrl, zipPath, (progress) => onProgress({
      phase: 'downloading',
      message: progress.totalBytes
        ? `正在下载 ${Math.round(progress.receivedBytes / 1024 / 1024)} MB / ${Math.round(progress.totalBytes / 1024 / 1024)} MB`
        : `正在下载 ${Math.round(progress.receivedBytes / 1024 / 1024)} MB`,
      ...progress
    }));

    onProgress({
      phase: 'extracting',
      message: '正在解压图标库',
      percent: 72
    });
    await expandZip(zipPath, extractDir);

    onProgress({
      phase: 'copying',
      message: '正在整理图标文件',
      percent: 88
    });
    const zipSubdirs = parseZipSubdirs(library.zipSubdir);
    if (!zipSubdirs.length) {
      throw new Error('Icon library subdir not configured');
    }

    fs.mkdirSync(iconLibrariesDir, { recursive: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
    const missingSubdirs = [];
    for (const zipSubdir of zipSubdirs) {
      const sourceDir = resolveInside(extractDir, zipSubdir);
      if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
        missingSubdirs.push(zipSubdir);
        continue;
      }
      copyDirectoryContents(sourceDir, targetDir);
    }

    if (missingSubdirs.length === zipSubdirs.length) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      throw new Error(`Icon library subdir not found in zip: ${missingSubdirs.join(', ')}`);
    }

    const result = {
      downloadedLibraryId: library.id,
      downloaded: getIconLibraryStatus(config, library.id),
      ...getIconLibraryStatuses(config)
    };
    onProgress({
      phase: 'done',
      message: `已下载 ${result.downloaded.iconCount} 个图标`,
      percent: 100,
      result
    });
    return result;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
