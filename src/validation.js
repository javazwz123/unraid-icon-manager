import { z } from 'zod';
import {
  DEFAULT_ICON_LIBRARY,
  getIconLibrariesFromConfig,
  normalizeIconLibraryEntry,
  normalizeZipSubdir,
  safeLibraryId
} from './iconLibraryConfig.js';
import { defaultHostIconPath, iconStoreDir } from './paths.js';

export const DEFAULT_TEMPLATE_DIR = '/boot/config/plugins/dockerMan/templates-user';
export const DEFAULT_COMPOSE_PROJECT_DIR = '/boot/config/plugins/compose.manager/projects';
export const DEFAULT_LOCAL_ICON_STORE_DIR = iconStoreDir;
export const DEFAULT_HOST_ICON_PATH = defaultHostIconPath;
export { DEFAULT_ICON_LIBRARY };

const optionalString = z.string().optional().default('');

export function parsePreviewAllowedPaths(value = []) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,]+/);
  const paths = source
    .map((item) => String(item || '').trim().replaceAll('\\', '/').replace(/\/+$/, ''))
    .filter((item) => item.startsWith('/'));
  return [...new Set(paths)];
}

const previewAllowedPathsInputSchema = z.union([z.string(), z.array(z.string())]);

const previewAllowedPathsSchema = previewAllowedPathsInputSchema
  .optional()
  .default([])
  .transform((value) => parsePreviewAllowedPaths(value));

const previewAllowedPathsPatchSchema = previewAllowedPathsInputSchema
  .optional()
  .transform((value) => (value === undefined ? undefined : parsePreviewAllowedPaths(value)));

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function hasSshConfig(config) {
  return Boolean(
    config.sshHost &&
    config.sshUsername &&
    (config.sshPassword || config.sshPrivateKey)
  );
}

const iconLibraryInputSchema = z.object({
  id: optionalString.transform((value) => safeLibraryId(value || DEFAULT_ICON_LIBRARY.id)),
  name: optionalString.transform((value) => value.trim()),
  zipUrl: optionalString.transform((value) => value.trim() || DEFAULT_ICON_LIBRARY.zipUrl),
  zipSubdir: optionalString.transform((value) => normalizeZipSubdir(value)),
  publicBaseUrl: optionalString.transform((value) => value.trim())
}).superRefine((library, context) => {
  if (!isValidUrl(library.zipUrl)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['zipUrl'],
      message: '图标库 Zip 地址必须是有效 URL'
    });
  }
  if (library.publicBaseUrl && !isValidUrl(library.publicBaseUrl)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['publicBaseUrl'],
      message: '图标兼容访问地址必须是有效 URL'
    });
  }
}).transform((library) => normalizeIconLibraryEntry(library));

const iconLibrariesSchema = z.array(iconLibraryInputSchema)
  .min(1, '至少需要一个图标库')
  .optional()
  .default([DEFAULT_ICON_LIBRARY])
  .transform((libraries) => getIconLibrariesFromConfig({ iconLibraries: libraries }));

export const configSchema = z.object({
  sshHost: optionalString.transform((value) => value.trim()),
  sshPort: z.coerce.number().int().min(1).max(65535).optional().default(22),
  sshUsername: optionalString.transform((value) => value.trim()),
  sshPassword: z.string().optional().default(''),
  sshPrivateKey: z.string().optional().default(''),
  templateDir: optionalString.transform((value) => value.trim() || DEFAULT_TEMPLATE_DIR),
  composeProjectDir: optionalString.transform((value) => value.trim() || DEFAULT_COMPOSE_PROJECT_DIR),
  localIconStoreDir: optionalString.transform((value) => value.trim() || DEFAULT_LOCAL_ICON_STORE_DIR),
  hostIconPath: optionalString.transform((value) => value.trim() || DEFAULT_HOST_ICON_PATH),
  previewAllowedPaths: previewAllowedPathsSchema,
  iconLibraries: iconLibrariesSchema
}).superRefine((config, context) => {
  const hasAnySshField = Boolean(
    config.sshHost ||
    config.sshUsername ||
    config.sshPassword ||
    config.sshPrivateKey
  );

  if (hasAnySshField && !hasSshConfig(config)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sshHost'],
      message: 'SSH 连接至少需要主机、用户，以及密码或私钥'
    });
  }

  if (!hasSshConfig(config)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: '请填写 SSH/SFTP 连接信息'
    });
  }
});

export const configPatchSchema = z.object({
  sshHost: z.string().trim().optional(),
  sshPort: z.coerce.number().int().min(1).max(65535).optional(),
  sshUsername: z.string().trim().optional(),
  sshPassword: z.string().optional(),
  sshPrivateKey: z.string().optional(),
  templateDir: z.string().trim().optional(),
  composeProjectDir: z.string().trim().optional(),
  localIconStoreDir: z.string().trim().optional(),
  hostIconPath: z.string().trim().optional(),
  previewAllowedPaths: previewAllowedPathsPatchSchema,
  iconLibraries: z.array(iconLibraryInputSchema).min(1).optional()
});

export const iconLibraryRequestSchema = z.object({
  iconLibraries: iconLibrariesSchema,
  libraryId: z.string()
    .trim()
    .optional()
    .transform((value) => (value ? safeLibraryId(value) : ''))
});

export const iconUpdateSchema = z.object({
  name: z.string().min(1),
  containerName: z.string().optional().default(''),
  state: z.string().optional().default(''),
  templatePath: z.string().min(1),
  sourceType: z.enum(['dockerTemplate', 'compose']).optional().default('dockerTemplate'),
  serviceName: z.string().optional().default(''),
  icon: z.string().trim()
});

export const syncRequestSchema = z.object({
  updates: z.array(iconUpdateSchema).min(1)
});

export function formatZodError(error) {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`)
    .join('; ');
}
