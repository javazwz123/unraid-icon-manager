import fs from 'node:fs/promises';
import nativePath from 'node:path';
import path from 'node:path/posix';
import SftpClient from 'ssh2-sftp-client';
import {
  composeProjectPath,
  parseComposeProject,
  updateComposeIcon
} from './composeManager.js';
import {
  buildRemoteIconFileName,
  parseLocalIconReference,
  resolveIconFilePath
} from './iconLibrary.js';
import { DEFAULT_COMPOSE_PROJECT_DIR } from './validation.js';
import { defaultHostIconPath, iconStoreDir } from './paths.js';
import {
  isPathInside,
  mergeContainersWithTemplates,
  parseTemplateXml,
  upsertIconTag
} from './xmlTemplates.js';

const MAX_ICON_PREVIEW_BYTES = 10 * 1024 * 1024;

function createSftpConfig(config) {
  const auth = config.sshPrivateKey
    ? { privateKey: config.sshPrivateKey }
    : { password: config.sshPassword };

  return {
    host: config.sshHost,
    port: config.sshPort,
    username: config.sshUsername,
    readyTimeout: 15000,
    ...auth
  };
}

export function getRestartContainerName(update) {
  const value = String(update.containerName || update.name || '').trim().replace(/^\//, '');
  return value || '';
}

export function shouldRestartContainer(update, changed) {
  if (!changed) {
    return false;
  }
  if (!getRestartContainerName(update)) {
    return false;
  }
  return true;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

async function execSshCommand(client, command, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    let streamRef = null;
    const timer = setTimeout(() => {
      streamRef?.close();
      reject(new Error(`Remote command timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    client.client.exec(command, (error, stream) => {
      if (error) {
        clearTimeout(timer);
        reject(error);
        return;
      }

      streamRef = stream;
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve({ ok: true, stdout: stdout.trim(), stderr: stderr.trim() });
        } else {
          reject(new Error((stderr || stdout || `Remote command failed with exit code ${code}`).trim()));
        }
      });
      stream.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      stream.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    });
  });
}

async function recreateDockerContainer(client, containerName) {
  const command = buildDockerRecreateCommand(containerName);
  const result = await execSshCommand(client, command);
  if (result.stdout.includes('__UNRAID_ICON_NOT_FOUND__')) {
    return {
      ok: false,
      skipped: true,
      containerName,
      reason: '未找到同名 Docker 容器，已跳过重启'
    };
  }
  if (result.stdout.includes('__UNRAID_ICON_REBUILD_NOT_FOUND__')) {
    return {
      ok: false,
      skipped: false,
      containerName,
      error: 'Unraid dockerMan rebuild_container script was not found'
    };
  }
  if (result.stdout.includes('__UNRAID_ICON_REBUILT_STOPPED__')) {
    return {
      ok: true,
      skipped: false,
      containerName,
      output: result.stdout
    };
  }
  if (result.stdout.includes('__UNRAID_ICON_NOT_RUNNING__')) {
    return {
      ok: false,
      skipped: true,
      containerName,
      reason: '容器当前未运行，已跳过重启'
    };
  }

  return {
    ok: true,
    skipped: false,
    containerName,
    output: result.stdout
  };
}

function ensureLocalIconPathInside(localIconStoreDir, localIconPath) {
  const resolvedParent = nativePath.resolve(localIconStoreDir);
  const resolvedChild = nativePath.resolve(localIconPath);
  if (resolvedChild !== resolvedParent && !resolvedChild.startsWith(`${resolvedParent}${nativePath.sep}`)) {
    throw new Error(`Refusing to write outside local icon directory: ${localIconPath}`);
  }
}

export async function resolveSyncIconValue(config, update) {
  const reference = parseLocalIconReference(update.icon);
  if (!reference) {
    return {
      icon: update.icon,
      uploadedIcon: null
    };
  }

  const localIconStoreDir = nativePath.resolve(
    String(config.localIconStoreDir || iconStoreDir).trim() || iconStoreDir
  );
  const hostIconPath = path.normalize(String(config.hostIconPath || defaultHostIconPath).trim());
  if (!hostIconPath) {
    throw new Error('Local icon references require a Unraid host icon path.');
  }
  const fileName = buildRemoteIconFileName(update, reference);
  const localIconPath = nativePath.join(localIconStoreDir, fileName);
  ensureLocalIconPathInside(localIconStoreDir, localIconPath);

  const localFilePath = resolveIconFilePath(config, reference.libraryId, reference.relativePath);
  await fs.mkdir(localIconStoreDir, { recursive: true });
  await fs.copyFile(localFilePath, localIconPath);

  const hostPath = path.join(hostIconPath, fileName);

  return {
    icon: hostPath,
    uploadedIcon: {
      libraryId: reference.libraryId,
      relativePath: reference.relativePath,
      localPath: localIconPath,
      hostPath
    }
  };
}

export function buildDockerRestartCommand(containerName) {
  const quotedName = shellQuote(containerName);
  return [
    `state=$(docker inspect -f '{{.State.Running}}' ${quotedName} 2>/dev/null || true)`,
    `if [ "$state" = "true" ]; then`,
    `  docker restart ${quotedName}`,
    `elif [ -z "$state" ]; then`,
    `  printf '%s\\n' '__UNRAID_ICON_NOT_FOUND__'`,
    `else`,
    `  printf '%s\\n' '__UNRAID_ICON_NOT_RUNNING__'`,
    `fi`
  ].join('\n');
}

export function buildDockerRecreateCommand(containerName) {
  const quotedName = shellQuote(containerName);
  const rebuildScript = '/usr/local/emhttp/plugins/dynamix.docker.manager/scripts/rebuild_container';
  return [
    `state=$(docker inspect -f '{{.State.Running}}' ${quotedName} 2>/dev/null || true)`,
    `if [ -z "$state" ]; then`,
    `  printf '%s\\n' '__UNRAID_ICON_NOT_FOUND__'`,
    `elif [ ! -x ${shellQuote(rebuildScript)} ]; then`,
    `  printf '%s\\n' '__UNRAID_ICON_REBUILD_NOT_FOUND__'`,
    `else`,
    `  ${shellQuote(rebuildScript)} ${quotedName}`,
    `  if [ "$state" = "true" ]; then`,
    `    docker start ${quotedName} >/dev/null 2>&1 || true`,
    `    printf '%s\\n' '__UNRAID_ICON_REBUILT_RUNNING__'`,
    `  else`,
    `    docker stop ${quotedName} >/dev/null 2>&1 || true`,
    `    printf '%s\\n' '__UNRAID_ICON_REBUILT_STOPPED__'`,
    `  fi`,
    `fi`
  ].join('\n');
}

async function recreateComposeService(client, { containerName, projectPath, serviceName }) {
  const command = buildComposeRecreateCommand({ containerName, projectPath, serviceName });
  const result = await execSshCommand(client, command);
  if (result.stdout.includes('__UNRAID_ICON_NOT_FOUND__')) {
    return {
      ok: false,
      skipped: true,
      containerName,
      serviceName,
      reason: '未找到同名 Docker 容器，已跳过 Compose 重建'
    };
  }
  if (result.stdout.includes('__UNRAID_ICON_NOT_RUNNING__')) {
    return {
      ok: false,
      skipped: true,
      containerName,
      serviceName,
      reason: 'Compose 容器当前未运行，已跳过重建'
    };
  }
  if (result.stdout.includes('__UNRAID_ICON_COMPOSE_NOT_FOUND__')) {
    return {
      ok: false,
      skipped: false,
      containerName,
      serviceName,
      error: '远端未找到 docker compose 或 docker-compose 命令'
    };
  }
  if (result.stdout.includes('__UNRAID_ICON_PROJECT_NOT_FOUND__')) {
    return {
      ok: false,
      skipped: false,
      containerName,
      serviceName,
      error: `Compose 项目目录不存在：${projectPath}`
    };
  }

  return {
    ok: true,
    skipped: false,
    containerName,
    serviceName,
    output: result.stdout
  };
}

export function buildComposeRecreateCommand({ containerName, projectPath, serviceName }) {
  const quotedName = shellQuote(containerName);
  return [
    `state=$(docker inspect -f '{{.State.Running}}' ${quotedName} 2>/dev/null || true)`,
    `if [ "$state" = "true" ]; then`,
    `  if docker compose version >/dev/null 2>&1; then`,
    `    compose_cmd='docker compose'`,
    `  elif docker-compose version >/dev/null 2>&1; then`,
    `    compose_cmd='docker-compose'`,
    `  else`,
    `    printf '%s\\n' '__UNRAID_ICON_COMPOSE_NOT_FOUND__'`,
    `    exit 0`,
    `  fi`,
    `  cd ${shellQuote(projectPath)} || { printf '%s\\n' '__UNRAID_ICON_PROJECT_NOT_FOUND__'; exit 0; }`,
    `  $compose_cmd -f docker-compose.yml -f docker-compose.override.yml up -d --force-recreate --no-deps ${shellQuote(serviceName)}`,
    `elif [ -z "$state" ]; then`,
    `  printf '%s\\n' '__UNRAID_ICON_NOT_FOUND__'`,
    `else`,
    `  printf '%s\\n' '__UNRAID_ICON_NOT_RUNNING__'`,
    `fi`
  ].join('\n');
}

export function buildDockerInspectCommand() {
  return [
    `ids=$(docker ps -aq --no-trunc 2>/dev/null || true)`,
    `if [ -z "$ids" ]; then`,
    `  printf '%s\\n' '[]'`,
    `else`,
    `  docker inspect $ids`,
    `fi`
  ].join('\n');
}

function normalizeInspectLabels(labels) {
  return labels && typeof labels === 'object' && !Array.isArray(labels) ? labels : {};
}

export function normalizeDockerInspectContainers(payload) {
  const containers = typeof payload === 'string' ? JSON.parse(payload || '[]') : payload;
  if (!Array.isArray(containers)) {
    throw new Error('Docker inspect response did not include a container array');
  }

  return containers.map((container) => {
    const labels = normalizeInspectLabels(container.Config?.Labels);
    const name = String(container.Name || container.Config?.Hostname || container.Id || '')
      .trim()
      .replace(/^\//, '');
    const stateStatus = String(container.State?.Status || '').trim();
    const state = container.State?.Running ? 'running' : stateStatus;

    return {
      id: container.Id || name,
      name,
      names: name ? [name] : [],
      state,
      status: stateStatus,
      autoStart: false,
      labels,
      repository: container.Config?.Image || '',
      composeProject: labels['com.docker.compose.project'] ?? '',
      composeService: labels['com.docker.compose.service'] ?? '',
      composeWorkingDir: labels['com.docker.compose.project.working_dir'] ?? '',
      composeConfigFiles: labels['com.docker.compose.project.config_files'] ?? ''
    };
  }).filter((container) => container.name);
}

async function withSftp(config, task) {
  const client = new SftpClient();
  try {
    await client.connect(createSftpConfig(config));
    return await task(client);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function getRemoteIconPreviewBuffer(config, remotePath) {
  return withSftp(config, async (client) => {
    const stat = await client.stat(remotePath);
    const size = Number(stat?.size || 0);
    if (size > MAX_ICON_PREVIEW_BYTES) {
      throw new Error('Icon preview file is too large.');
    }
    const payload = await client.get(remotePath);
    return Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  });
}

async function getOptionalText(client, filePath) {
  try {
    return (await client.get(filePath)).toString('utf8');
  } catch {
    return '';
  }
}

async function listDockerContainersFromClient(client) {
  const result = await execSshCommand(client, buildDockerInspectCommand());
  return normalizeDockerInspectContainers(result.stdout);
}

async function listDockerTemplatesFromClient(client, config) {
  const entries = await client.list(config.templateDir);
  const xmlEntries = entries.filter((entry) => entry.type === '-' && entry.name.endsWith('.xml'));
  const templates = [];

  for (const entry of xmlEntries) {
    const filePath = path.join(config.templateDir, entry.name);
    const xml = (await client.get(filePath)).toString('utf8');
    templates.push(parseTemplateXml(xml, filePath));
  }

  return templates;
}

async function listComposeTemplatesFromClient(client, config) {
  const composeRoot = config.composeProjectDir || DEFAULT_COMPOSE_PROJECT_DIR;
  let entries;
  try {
    entries = await client.list(composeRoot);
  } catch {
    return [];
  }

  const projects = entries.filter((entry) => entry.type === 'd');
  const templates = [];
  for (const project of projects) {
    const projectPath = composeProjectPath(composeRoot, project.name);
    const composePath = path.join(projectPath, 'docker-compose.yml');
    const overridePath = path.join(projectPath, 'docker-compose.override.yml');
    const composeYaml = await getOptionalText(client, composePath);
    const overrideYaml = await getOptionalText(client, overridePath);
    if (!composeYaml || !overrideYaml) {
      continue;
    }

    const displayName = (await getOptionalText(client, path.join(projectPath, 'name'))).trim() || project.name;
    const description = (await getOptionalText(client, path.join(projectPath, 'description'))).trim();
    templates.push(...parseComposeProject({
      projectName: displayName,
      projectPath,
      composePath,
      overridePath,
      composeYaml,
      overrideYaml,
      description
    }));
  }

  return templates;
}

export async function listTemplates(config) {
  return withSftp(config, async (client) => {
    return listTemplatesFromClient(client, config);
  });
}

async function listTemplatesFromClient(client, config) {
  const [dockerTemplates, composeTemplates] = await Promise.all([
    listDockerTemplatesFromClient(client, config),
    listComposeTemplatesFromClient(client, config)
  ]);
  return [...dockerTemplates, ...composeTemplates];
}

export async function listContainersWithIcons(config) {
  return withSftp(config, async (client) => {
    const containers = await listDockerContainersFromClient(client);
    const templates = await listTemplatesFromClient(client, config);
    return mergeContainersWithTemplates(containers, templates);
  });
}

export async function testSftp(config) {
  return withSftp(config, async (client) => {
    const dockerTemplates = await listDockerTemplatesFromClient(client, config);
    const composeTemplates = await listComposeTemplatesFromClient(client, config);
    const dockerContainers = await listDockerContainersFromClient(client);
    return {
      ok: true,
      containerCount: dockerContainers.length,
      templateCount: dockerTemplates.length + composeTemplates.length,
      dockerTemplateCount: dockerTemplates.length,
      composeTemplateCount: composeTemplates.length
    };
  });
}

export async function syncIconUpdates(config, updates) {
  return withSftp(config, async (client) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const results = [];

    for (const update of updates) {
      const templatePath = path.normalize(update.templatePath);
      const isCompose = update.sourceType === 'compose';
      const allowedRoot = isCompose
        ? (config.composeProjectDir || DEFAULT_COMPOSE_PROJECT_DIR)
        : config.templateDir;
      const validFile = isCompose
        ? path.basename(templatePath) === 'docker-compose.override.yml'
        : templatePath.endsWith('.xml');
      if (!isPathInside(allowedRoot, templatePath) || !validFile) {
        throw new Error(`Refusing to write outside allowed template directory: ${update.templatePath}`);
      }

      if (isCompose && !update.serviceName) {
        throw new Error(`Compose update is missing serviceName: ${update.name}`);
      }

      const original = (await client.get(templatePath)).toString('utf8');
      const resolvedIcon = await resolveSyncIconValue(config, update, client);
      const nextContent = isCompose
        ? updateComposeIcon(original, update.serviceName, resolvedIcon.icon)
        : upsertIconTag(original, resolvedIcon.icon);
      const backupPath = `${templatePath}.${timestamp}.bak`;
      const changed = original !== nextContent;

      await client.put(Buffer.from(original, 'utf8'), backupPath);
      await client.put(Buffer.from(nextContent, 'utf8'), templatePath);

      const result = {
        name: update.name,
        containerName: getRestartContainerName(update),
        templatePath,
        backupPath,
        sourceType: update.sourceType,
        serviceName: update.serviceName,
        icon: resolvedIcon.icon,
        uploadedIcon: resolvedIcon.uploadedIcon,
        changed,
        restart: {
          ok: false,
          skipped: true,
          reason: shouldRestartContainer(update, changed)
            ? ''
            : changed
              ? '缺少容器名，已跳过重启'
              : '图标内容未变化，已跳过重启'
        }
      };

      if (shouldRestartContainer(update, changed)) {
        try {
          result.restart = isCompose
            ? await recreateComposeService(client, {
              containerName: result.containerName,
              projectPath: path.dirname(templatePath),
              serviceName: update.serviceName
            })
            : await recreateDockerContainer(client, result.containerName);
        } catch (error) {
          result.restart = {
            ok: false,
            skipped: false,
            containerName: result.containerName,
            error: error.message
          };
        }
      }

      results.push(result);
    }

    return results;
  });
}
