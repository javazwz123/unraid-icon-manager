import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = path.join(rootDir, 'data');
export const configPath = path.join(dataDir, 'config.enc');
export const secretPath = path.join(dataDir, 'secret.key');
export const iconLibrariesDir = path.join(dataDir, 'icon-libraries');
export const iconStoreDir = process.env.UNRAID_ICON_STORE_DIR || '/app/icons';
export const defaultHostIconPath = process.env.UNRAID_HOST_ICON_PATH || '/mnt/user/appdata/unraid-icon-manager/icons';

export function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function ensureIconStoreDir() {
  fs.mkdirSync(iconStoreDir, { recursive: true });
}
