import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeXmlText,
  isPathInside,
  mergeContainersWithTemplates,
  parseTemplateXml,
  upsertIconTag
} from '../src/xmlTemplates.js';

test('parseTemplateXml reads common Unraid Docker template fields', () => {
  const xml = `
<Container version="2">
  <Name>plex</Name>
  <Repository>linuxserver/plex</Repository>
  <Icon>https://example.com/plex.png</Icon>
</Container>`;

  assert.deepEqual(parseTemplateXml(xml, '/boot/config/plugins/dockerMan/templates-user/my-plex.xml'), {
    name: 'plex',
    repository: 'linuxserver/plex',
    icon: 'https://example.com/plex.png',
    overview: '',
    filePath: '/boot/config/plugins/dockerMan/templates-user/my-plex.xml',
    sourceType: 'dockerTemplate',
    sourceLabel: 'Docker 模板',
    matchNames: []
  });
});

test('parseTemplateXml decodes XML entities in template fields', () => {
  const xml = `
<Container version="2">
  <Name>&#x7B7E;&#x5230;</Name>
  <Repository>qdtoday/qd&amp;beta</Repository>
  <Icon>https://example.com/icon.png?x=1&amp;y=2</Icon>
</Container>`;

  assert.deepEqual(parseTemplateXml(xml, '/boot/config/plugins/dockerMan/templates-user/my-sign.xml'), {
    name: '签到',
    repository: 'qdtoday/qd&beta',
    icon: 'https://example.com/icon.png?x=1&y=2',
    overview: '',
    filePath: '/boot/config/plugins/dockerMan/templates-user/my-sign.xml',
    sourceType: 'dockerTemplate',
    sourceLabel: 'Docker 模板',
    matchNames: []
  });
});

test('upsertIconTag replaces existing icon without touching other fields', () => {
  const xml = '<Container><Name>app</Name><Icon>old</Icon><Repository>repo</Repository></Container>';
  assert.equal(
    upsertIconTag(xml, 'https://example.com/a.png?x=1&y=2'),
    '<Container><Name>app</Name><Icon>https://example.com/a.png?x=1&amp;y=2</Icon><Repository>repo</Repository></Container>'
  );
});

test('upsertIconTag inserts icon when the tag is missing', () => {
  const xml = '<Container>\n  <Name>app</Name>\n</Container>';
  assert.equal(
    upsertIconTag(xml, '/mnt/user/app/icon.png'),
    '<Container>\n  <Name>app</Name>\n  <Icon>/mnt/user/app/icon.png</Icon>\n</Container>'
  );
});

test('path checks reject traversal outside template directory', () => {
  assert.equal(
    isPathInside('/boot/config/plugins/dockerMan/templates-user', '/boot/config/plugins/dockerMan/templates-user/app.xml'),
    true
  );
  assert.equal(
    isPathInside('/boot/config/plugins/dockerMan/templates-user', '/boot/config/plugins/dockerMan/other/app.xml'),
    false
  );
});

test('mergeContainersWithTemplates keeps template-only entries', () => {
  const merged = mergeContainersWithTemplates(
    [{ id: '1', name: 'plex', names: ['plex'], state: 'running', status: '', autoStart: true }],
    [
      { name: 'plex', repository: 'repo', icon: 'icon', filePath: '/templates/plex.xml' },
      { name: 'stopped-app', repository: 'repo2', icon: '', filePath: '/templates/stopped.xml' }
    ]
  );

  assert.equal(merged.length, 2);
  assert.equal(merged.find((item) => item.name === 'plex').icon, 'icon');
  assert.equal(merged.find((item) => item.name === 'stopped-app').state, 'template-only');
});

test('mergeContainersWithTemplates matches compose containers by compose labels before name', () => {
  const merged = mergeContainersWithTemplates(
    [{
      id: '1',
      name: 'libretv',
      names: ['libretv'],
      state: 'running',
      status: '',
      autoStart: true,
      composeService: 'libretv',
      composeWorkingDir: '/boot/config/plugins/compose.manager/projects/TUTU_libretv',
      composeConfigFiles: '/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.yml,/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.override.yml'
    }],
    [
      {
        name: 'libretv',
        repository: 'bestzwei/libretv',
        icon: 'wrong',
        filePath: '/boot/config/plugins/compose.manager/projects/Libre_Tv/docker-compose.override.yml',
        sourceType: 'compose',
        sourceLabel: 'Compose Manager',
        serviceName: 'libretv',
        projectName: 'Libre_Tv',
        projectPath: '/boot/config/plugins/compose.manager/projects/Libre_Tv',
        composePath: '/boot/config/plugins/compose.manager/projects/Libre_Tv/docker-compose.yml',
        matchNames: ['libretv']
      },
      {
        name: 'libretv',
        repository: 'danndee1/libretv',
        icon: 'right',
        filePath: '/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.override.yml',
        sourceType: 'compose',
        sourceLabel: 'Compose Manager',
        serviceName: 'libretv',
        projectName: 'TUTU_libretv',
        projectPath: '/boot/config/plugins/compose.manager/projects/TUTU_libretv',
        composePath: '/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.yml',
        matchNames: ['libretv']
      }
    ]
  );

  const running = merged.find((item) => item.id === '1');
  assert.equal(running.icon, 'right');
  assert.equal(running.templatePath, '/boot/config/plugins/compose.manager/projects/TUTU_libretv/docker-compose.override.yml');
  assert.equal(merged.some((item) => (
    item.state === 'template-only' &&
    item.templatePath === '/boot/config/plugins/compose.manager/projects/Libre_Tv/docker-compose.override.yml'
  )), true);
});

test('escapeXmlText escapes XML-sensitive characters', () => {
  assert.equal(escapeXmlText('a&b<c>d'), 'a&amp;b&lt;c&gt;d');
});
