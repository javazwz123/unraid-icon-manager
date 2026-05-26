import crypto from 'node:crypto';
import fs from 'node:fs';
import { configPath, ensureDataDir, secretPath } from './paths.js';
import { withNormalizedIconLibraries } from './iconLibraryConfig.js';

const ALGORITHM = 'aes-256-gcm';

function getOrCreateSecret() {
  if (process.env.UNRAID_ICON_SECRET) {
    return process.env.UNRAID_ICON_SECRET;
  }

  ensureDataDir();
  if (fs.existsSync(secretPath)) {
    return fs.readFileSync(secretPath, 'utf8').trim();
  }

  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretPath, `${secret}\n`, { encoding: 'utf8', mode: 0o600 });
  return secret;
}

function getKey() {
  return crypto.createHash('sha256').update(getOrCreateSecret()).digest();
}

function normalizeConfig(config = {}) {
  const normalized = withNormalizedIconLibraries(config);
  const { remoteIconDir, ...rest } = normalized;
  return rest;
}

export function loadConfig() {
  ensureDataDir();
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const payload = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ]);

  return normalizeConfig(JSON.parse(plaintext.toString('utf8')));
}

export function saveConfig(config) {
  ensureDataDir();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(normalizeConfig(config)), 'utf8'),
    cipher.final()
  ]);
  const payload = {
    version: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64')
  };

  fs.writeFileSync(configPath, JSON.stringify(payload, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  });
}

export function sanitizeConfig(config) {
  if (!config) {
    return { exists: false };
  }

  const normalized = normalizeConfig(config);
  const { sshPassword, sshPrivateKey, webUrl, apiKey, verifyTls, ...safe } = normalized;
  return {
    exists: true,
    ...safe,
    hasSshPassword: Boolean(sshPassword),
    hasSshPrivateKey: Boolean(sshPrivateKey)
  };
}

export function mergeConfigPatch(previous, patch) {
  const merged = normalizeConfig({ ...(previous ?? {}), ...patch });

  if (patch.iconLibraries) {
    merged.iconLibraries = withNormalizedIconLibraries({ iconLibraries: patch.iconLibraries }).iconLibraries;
  }

  for (const key of ['sshPassword', 'sshPrivateKey']) {
    if (patch[key] === '__KEEP__') {
      merged[key] = previous?.[key] ?? '';
    }
  }

  return normalizeConfig(merged);
}
