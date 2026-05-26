import path from 'node:path/posix';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true
});

const XML_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
};

function decodeXmlEntities(value) {
  return String(value).replaceAll(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, token) => {
    const normalized = token.toLowerCase();
    if (normalized in XML_ENTITIES) {
      return XML_ENTITIES[normalized];
    }

    const numeric = normalized.startsWith('#x')
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);

    if (!Number.isInteger(numeric) || numeric < 0 || numeric > 0x10ffff) {
      return entity;
    }

    try {
      return String.fromCodePoint(numeric);
    } catch {
      return entity;
    }
  });
}

function asText(value) {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return decodeXmlEntities(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object' && '#text' in value) {
    return asText(value['#text']);
  }
  return '';
}

export function escapeXmlText(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function normalizeName(value) {
  return value.trim().replace(/^\//, '').toLowerCase();
}

function normalizePath(value) {
  return String(value || '').replace(/\/+$/, '');
}

function splitLabelList(value) {
  return String(value || '')
    .split(',')
    .map((item) => normalizePath(item.trim()))
    .filter(Boolean);
}

export function parseTemplateXml(xml, filePath = '') {
  const parsed = parser.parse(xml);
  const root = parsed.Container ?? parsed.Template ?? parsed;
  const fallbackName = filePath ? path.basename(filePath, '.xml') : '';

  return {
    name: asText(root.Name) || fallbackName,
    repository: asText(root.Repository),
    icon: asText(root.Icon),
    overview: asText(root.Overview),
    filePath,
    sourceType: 'dockerTemplate',
    sourceLabel: 'Docker 模板',
    matchNames: []
  };
}

export function upsertIconTag(xml, icon) {
  const escaped = escapeXmlText(icon);
  if (/<Icon\b[^>]*>[\s\S]*?<\/Icon>/i.test(xml)) {
    return xml.replace(/<Icon\b[^>]*>[\s\S]*?<\/Icon>/i, `<Icon>${escaped}</Icon>`);
  }

  if (/<\/Container>/i.test(xml)) {
    return xml.replace(/<\/Container>/i, `  <Icon>${escaped}</Icon>\n</Container>`);
  }

  return `${xml.trimEnd()}\n<Icon>${escaped}</Icon>\n`;
}

export function isPathInside(parentDir, candidatePath) {
  const normalizedParent = path.normalize(parentDir);
  const normalizedCandidate = path.normalize(candidatePath);
  return (
    normalizedCandidate === normalizedParent ||
    normalizedCandidate.startsWith(`${normalizedParent.replace(/\/$/, '')}/`)
  );
}

export function mergeContainersWithTemplates(containers, templates) {
  const templatesByName = new Map();
  for (const template of templates) {
    const names = [template.name, ...(template.matchNames ?? [])]
      .filter(Boolean)
      .map((name) => normalizeName(name));
    for (const name of names) {
      if (!templatesByName.has(name)) {
        templatesByName.set(name, []);
      }
      templatesByName.get(name).push(template);
    }
  }
  const matchedTemplates = new Set();

  function matchesComposeMetadata(template, container) {
    if (template.sourceType !== 'compose') {
      return false;
    }

    const serviceMatches = normalizeName(template.serviceName || '') === normalizeName(container.composeService || '');
    if (!serviceMatches) {
      return false;
    }

    const templateProjectPath = normalizePath(template.projectPath);
    const containerWorkingDir = normalizePath(container.composeWorkingDir);
    if (templateProjectPath && containerWorkingDir && templateProjectPath === containerWorkingDir) {
      return true;
    }

    const configFiles = splitLabelList(container.composeConfigFiles);
    return Boolean(template.composePath && configFiles.includes(normalizePath(template.composePath)));
  }

  function findTemplate(container) {
    const exactComposeTemplate = templates.find((template) => matchesComposeMetadata(template, container));
    if (exactComposeTemplate) {
      return exactComposeTemplate;
    }

    const namedTemplates = templatesByName.get(normalizeName(container.name)) ?? [];
    if (container.composeService || container.composeWorkingDir || container.composeConfigFiles) {
      return namedTemplates.find((template) => template.sourceType !== 'compose');
    }

    return namedTemplates[0];
  }

  const merged = containers.map((container) => {
    const template = findTemplate(container);
    if (template) {
      matchedTemplates.add(template);
    }
    return {
      ...container,
      icon: template?.icon ?? '',
      repository: template?.repository ?? '',
      templatePath: template?.filePath ?? '',
      templateFound: Boolean(template),
      sourceType: template?.sourceType ?? '',
      sourceLabel: template?.sourceLabel ?? '',
      serviceName: template?.serviceName ?? '',
      projectName: template?.projectName ?? ''
    };
  });

  const knownNames = new Set(containers.map((container) => normalizeName(container.name)));
  for (const template of templates) {
    const templateNames = [template.name, ...(template.matchNames ?? [])]
      .filter(Boolean)
      .map((name) => normalizeName(name));
    const shouldShowTemplateOnly = template.sourceType === 'compose'
      ? !matchedTemplates.has(template)
      : !matchedTemplates.has(template) && !templateNames.some((name) => knownNames.has(name));

    if (shouldShowTemplateOnly) {
      merged.push({
        id: `template:${template.filePath}`,
        name: template.name,
        names: [template.name],
        state: 'template-only',
        status: '',
        autoStart: false,
        icon: template.icon,
        repository: template.repository,
        templatePath: template.filePath,
        templateFound: true,
        sourceType: template.sourceType ?? 'dockerTemplate',
        sourceLabel: template.sourceLabel ?? 'Docker 模板',
        serviceName: template.serviceName ?? '',
        projectName: template.projectName ?? ''
      });
    }
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}
