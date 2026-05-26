import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseComposeProject,
  parseComposeServices,
  updateComposeIcon
} from '../src/composeManager.js';

const composeYaml = `services:
  app:
    image: example/app:latest
    container_name: my-app
  db:
    image: mariadb:lts
`;

const overrideYaml = `services:
  app:
    labels:
      net.unraid.docker.managed: 'composeman'
      net.unraid.docker.icon: 'https://example.com/app.png'
      net.unraid.docker.webui: ''
  db:
    labels:
      net.unraid.docker.managed: 'composeman'
      net.unraid.docker.icon: ''
`;

test('parseComposeServices reads service image and container name', () => {
  const services = parseComposeServices(composeYaml);
  assert.equal(services.get('app').containerName, 'my-app');
  assert.equal(services.get('app').image, 'example/app:latest');
  assert.equal(services.get('db').image, 'mariadb:lts');
});

test('parseComposeProject creates compose templates with match names', () => {
  const templates = parseComposeProject({
    projectName: 'stack',
    projectPath: '/projects/stack',
    composePath: '/projects/stack/docker-compose.yml',
    overridePath: '/projects/stack/docker-compose.override.yml',
    composeYaml,
    overrideYaml
  });

  assert.equal(templates.length, 2);
  const app = templates.find((item) => item.serviceName === 'app');
  assert.equal(app.name, 'my-app');
  assert.equal(app.icon, 'https://example.com/app.png');
  assert.equal(app.sourceType, 'compose');
  assert.equal(app.filePath, '/projects/stack/docker-compose.override.yml');
  assert.equal(app.matchNames.includes('stack-app-1'), true);
});

test('updateComposeIcon replaces only the target service icon label', () => {
  const updated = updateComposeIcon(overrideYaml, 'app', "https://example.com/a'b.png");
  assert.match(updated, /net\.unraid\.docker\.icon: 'https:\/\/example\.com\/a''b\.png'/);
  assert.match(updated, /db:[\s\S]*net\.unraid\.docker\.icon: ''/);
});
