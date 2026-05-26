import path from 'node:path/posix';
import { normalizeName } from './xmlTemplates.js';

const ICON_LABEL = 'net.unraid.docker.icon';

function splitLines(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return { lines: text.split(/\r?\n/), eol };
}

function indentOf(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function stripQuotes(value) {
  const trimmed = String(value ?? '').trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    const inner = trimmed.slice(1, -1);
    return trimmed.startsWith("'") ? inner.replaceAll("''", "'") : inner;
  }
  return trimmed;
}

function formatYamlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function readSimpleYamlValue(line, key) {
  const match = line.match(new RegExp(`^\\s*${key}\\s*:\\s*(.*?)\\s*(?:#.*)?$`));
  return match ? stripQuotes(match[1]) : '';
}

function parseServiceSection(yaml, visitor) {
  const { lines } = splitLines(yaml);
  let inServices = false;
  let servicesIndent = -1;
  let serviceIndent = null;
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const indent = indentOf(line);
    if (!inServices) {
      if (/^services\s*:/.test(trimmed)) {
        inServices = true;
        servicesIndent = indent;
      }
      continue;
    }

    if (indent <= servicesIndent) {
      break;
    }

    const keyMatch = line.match(/^(\s*)(["']?[^"':]+["']?)\s*:\s*(?:#.*)?$/);
    if (keyMatch && (serviceIndent == null || indent === serviceIndent)) {
      serviceIndent = indent;
      current = {
        name: stripQuotes(keyMatch[2]),
        lineIndex: index,
        indent
      };
      visitor({ type: 'service', line, index, service: current });
      continue;
    }

    if (current && indent > current.indent) {
      visitor({ type: 'line', line, index, service: current, indent });
    }
  }
}

export function parseComposeServices(composeYaml) {
  const services = new Map();
  parseServiceSection(composeYaml, (entry) => {
    if (entry.type === 'service') {
      services.set(entry.service.name, {
        serviceName: entry.service.name,
        containerName: '',
        image: ''
      });
      return;
    }

    const service = services.get(entry.service.name);
    if (!service) {
      return;
    }

    service.containerName ||= readSimpleYamlValue(entry.line, 'container_name');
    service.image ||= readSimpleYamlValue(entry.line, 'image');
  });
  return services;
}

export function parseComposeOverrideLabels(overrideYaml) {
  const labels = new Map();
  const labelBlocks = new Map();
  parseServiceSection(overrideYaml, (entry) => {
    if (entry.type === 'service') {
      labels.set(entry.service.name, {
        serviceName: entry.service.name,
        icon: '',
        iconLineIndex: -1,
        labelsLineIndex: -1,
        labelIndent: entry.service.indent + 4
      });
      return;
    }

    const label = labels.get(entry.service.name);
    if (!label) {
      return;
    }

    if (/^\s*labels\s*:/.test(entry.line)) {
      label.labelsLineIndex = entry.index;
      label.labelIndent = entry.indent + 2;
      labelBlocks.set(entry.service.name, true);
      return;
    }

    if (!labelBlocks.has(entry.service.name)) {
      return;
    }

    const iconMatch = entry.line.match(/^\s*net\.unraid\.docker\.icon\s*:\s*(.*?)\s*(?:#.*)?$/);
    if (iconMatch) {
      label.icon = stripQuotes(iconMatch[1]);
      label.iconLineIndex = entry.index;
    }
  });

  return labels;
}

export function parseComposeProject({
  projectName,
  projectPath,
  composePath,
  overridePath,
  composeYaml,
  overrideYaml,
  description = ''
}) {
  const services = parseComposeServices(composeYaml);
  const labels = parseComposeOverrideLabels(overrideYaml);
  const templates = [];

  for (const label of labels.values()) {
    const service = services.get(label.serviceName) ?? {
      serviceName: label.serviceName,
      containerName: '',
      image: ''
    };
    const displayName = service.containerName || label.serviceName;
    const matchNames = [
      displayName,
      service.containerName,
      label.serviceName,
      `${projectName}-${label.serviceName}-1`,
      `${projectName}_${label.serviceName}_1`,
      `${projectName}-${label.serviceName}`,
      `${projectName}_${label.serviceName}`
    ].filter(Boolean);

    templates.push({
      name: displayName,
      repository: service.image,
      icon: label.icon,
      overview: description,
      filePath: overridePath,
      composePath,
      projectPath,
      projectName,
      serviceName: label.serviceName,
      sourceType: 'compose',
      sourceLabel: 'Compose Manager',
      matchNames: [...new Set(matchNames.map((name) => name.trim()).filter(Boolean))]
    });
  }

  return templates;
}

export function updateComposeIcon(overrideYaml, serviceName, icon) {
  const { lines, eol } = splitLines(overrideYaml);
  const labels = parseComposeOverrideLabels(overrideYaml);
  const label = labels.get(serviceName);
  if (!label) {
    throw new Error(`Compose service not found in override labels: ${serviceName}`);
  }

  const iconLine = `${' '.repeat(label.labelIndent)}${ICON_LABEL}: ${formatYamlString(icon)}`;
  if (label.iconLineIndex >= 0) {
    lines[label.iconLineIndex] = iconLine;
    return lines.join(eol);
  }

  if (label.labelsLineIndex >= 0) {
    lines.splice(label.labelsLineIndex + 1, 0, iconLine);
    return lines.join(eol);
  }

  throw new Error(`Compose service has no labels block: ${serviceName}`);
}

export function composeTemplateId(template) {
  return `compose:${normalizeName(template.projectName)}:${normalizeName(template.serviceName)}`;
}

export function composeProjectPath(rootDir, projectName) {
  return path.join(rootDir, projectName);
}
