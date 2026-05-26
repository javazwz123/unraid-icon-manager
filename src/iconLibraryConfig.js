export const DEFAULT_ICON_LIBRARY = {
  id: 'hd-icons-border-radius',
  name: 'HD Icons',
  zipUrl: 'https://github.com/xushier/HD-Icons/archive/refs/heads/main.zip',
  zipSubdir: 'HD-Icons-main/border-radius',
  publicBaseUrl: ''
};

export function safeLibraryId(value) {
  return String(value || DEFAULT_ICON_LIBRARY.id)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || DEFAULT_ICON_LIBRARY.id;
}

function defaultLibraryName(id) {
  if (id === DEFAULT_ICON_LIBRARY.id) {
    return DEFAULT_ICON_LIBRARY.name;
  }
  return id;
}

function normalizeLegacyLibrary(library = {}) {
  const legacyName = String(library.name || '').trim();
  const id = safeLibraryId(legacyName || DEFAULT_ICON_LIBRARY.id);
  const name = legacyName && legacyName !== DEFAULT_ICON_LIBRARY.id
    ? legacyName
    : defaultLibraryName(id);
  return {
    id,
    name,
    zipUrl: String(library.zipUrl || DEFAULT_ICON_LIBRARY.zipUrl).trim(),
    zipSubdir: String(library.zipSubdir || DEFAULT_ICON_LIBRARY.zipSubdir).trim(),
    publicBaseUrl: String(library.publicBaseUrl || DEFAULT_ICON_LIBRARY.publicBaseUrl).trim()
  };
}

export function normalizeIconLibraryEntry(library = {}, fallbackId = DEFAULT_ICON_LIBRARY.id) {
  const requestedId = String(library.id || '').trim();
  const requestedName = String(library.name || '').trim();
  const id = safeLibraryId(requestedId || requestedName || fallbackId);
  return {
    id,
    name: requestedName || defaultLibraryName(id),
    zipUrl: String(library.zipUrl || DEFAULT_ICON_LIBRARY.zipUrl).trim(),
    zipSubdir: String(library.zipSubdir || DEFAULT_ICON_LIBRARY.zipSubdir).trim(),
    publicBaseUrl: String(library.publicBaseUrl || DEFAULT_ICON_LIBRARY.publicBaseUrl).trim()
  };
}

export function getIconLibrariesFromConfig(config = {}) {
  const sourceLibraries = Array.isArray(config.iconLibraries) && config.iconLibraries.length
    ? config.iconLibraries
    : config.iconLibrary
      ? [normalizeLegacyLibrary(config.iconLibrary)]
      : [DEFAULT_ICON_LIBRARY];

  const usedIds = new Set();
  return sourceLibraries.map((library, index) => {
    const fallbackId = index === 0 ? DEFAULT_ICON_LIBRARY.id : `icon-library-${index + 1}`;
    const normalized = normalizeIconLibraryEntry(library, fallbackId);
    let uniqueId = normalized.id;
    let suffix = 2;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${normalized.id}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(uniqueId);
    return {
      ...normalized,
      id: uniqueId
    };
  });
}

export function withNormalizedIconLibraries(config = {}) {
  const { iconLibrary, ...rest } = config;
  return {
    ...rest,
    iconLibraries: getIconLibrariesFromConfig(config)
  };
}

export function findIconLibrary(config = {}, libraryId = '') {
  const safeId = safeLibraryId(libraryId);
  return getIconLibrariesFromConfig(config)
    .find((library) => library.id === safeId) || null;
}
