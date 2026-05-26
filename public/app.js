const form = document.querySelector('#configForm');
const onboardingForm = document.querySelector('#onboardingForm');
const onboardingPanel = document.querySelector('#onboardingPanel');
const onboardingTitle = document.querySelector('#onboardingTitle');
const onboardingSubtitle = document.querySelector('#onboardingSubtitle');
const onboardingStepStrip = document.querySelector('#onboardingStepStrip');
const settingsDrawer = document.querySelector('#settingsDrawer');
const settingsToggleButton = document.querySelector('#settingsToggleButton');
const drawerTabs = [...document.querySelectorAll('.drawer-tabs [data-settings-tab]')];
const mainContent = document.querySelector('#mainContent');
const headerSubtitle = document.querySelector('#headerSubtitle');
const rows = document.querySelector('#containerRows');
const statusPill = document.querySelector('#statusPill');
const toast = document.querySelector('#toast');
const testButton = document.querySelector('#testButton');
const loadButton = document.querySelector('#loadButton');
const syncButton = document.querySelector('#syncButton');
const syncFooterButton = document.querySelector('#syncFooterButton');
const filterInput = document.querySelector('#filterInput');
const stateSegments = document.querySelector('#stateSegments');
const sourceFilter = document.querySelector('#sourceFilter');
const modifiedOnlyButton = document.querySelector('#modifiedOnlyButton');
const dirtyCount = document.querySelector('#dirtyCount');
const listSummary = document.querySelector('#listSummary');
const metricTotal = document.querySelector('#metricTotal');
const metricRunning = document.querySelector('#metricRunning');
const metricCompose = document.querySelector('#metricCompose');
const metricDirty = document.querySelector('#metricDirty');
const downloadLibraryFooterButton = document.querySelector('#downloadLibraryFooterButton');
const iconPicker = document.querySelector('#iconPicker');
const pickerCloseButton = document.querySelector('#pickerCloseButton');
const iconCancelButton = document.querySelector('#iconCancelButton');
const iconSearchInput = document.querySelector('#iconSearchInput');
const iconSearchButton = document.querySelector('#iconSearchButton');
const iconUseButton = document.querySelector('#iconUseButton');
const iconPickerGrid = document.querySelector('#iconPickerGrid');
const pickerHint = document.querySelector('#pickerHint');
const pickerLibraryCount = document.querySelector('#pickerLibraryCount');
const selectedIconPreview = document.querySelector('#selectedIconPreview');
const iconPopover = document.querySelector('#iconPopover');
const iconPopoverTitle = document.querySelector('#iconPopoverTitle');
const iconPopoverHint = document.querySelector('#iconPopoverHint');
const iconPopoverCloseButton = document.querySelector('#iconPopoverCloseButton');
const iconPopoverCurrentValue = document.querySelector('#iconPopoverCurrentValue');
const iconPopoverCopyCurrentButton = document.querySelector('#iconPopoverCopyCurrentButton');
const iconPopoverInput = document.querySelector('#iconPopoverInput');
const iconPopoverApplyButton = document.querySelector('#iconPopoverApplyButton');
const iconPopoverLibraryButton = document.querySelector('#iconPopoverLibraryButton');

const DEFAULT_ICON_LIBRARY = {
  id: 'hd-icons-border-radius',
  name: 'HD Icons',
  zipUrl: 'https://github.com/xushier/HD-Icons/archive/refs/heads/main.zip',
  zipSubdir: 'HD-Icons-main/border-radius',
  publicBaseUrl: ''
};

let onboardingConfigForm = null;
let items = [];
let drafts = new Map();
let activeIconPickerItemId = '';
let activeIconPopoverItemId = '';
let activeIconPopoverAnchor = null;
let activeIconSourceForm = null;
let selectedIcon = null;
let currentLibrarySummary = {
  libraries: [],
  exists: false,
  libraryCount: 0,
  iconCount: 0,
  bytes: 0
};
let iconSearchTimer = null;
let iconSearchRequestSeq = 0;
let hasSavedConfig = false;
let settingsOpen = false;
let activeSettingsTab = 'connection';
let activeOnboardingStep = 'ssh';
let activeStateFilter = 'all';
let modifiedOnly = false;
let activeDownloadJob = null;
let downloadPollTimer = null;

const onboardingSteps = ['ssh', 'library'];
const onboardingStepMeta = {
  ssh: {
    title: '配置 SSH 连接',
    subtitle: '填写 SSH 信息，用于读取 Docker 状态、写入模板、创建备份和刷新容器图标。'
  },
  library: {
    title: '准备本地图标库',
    subtitle: '默认使用 HD Icons，可以先下载，也可以稍后在设置里继续添加。'
  }
};

const downloadPhaseText = {
  queued: '等待下载',
  downloading: '正在下载',
  extracting: '正在解压',
  copying: '正在整理',
  done: '下载完成',
  error: '下载失败'
};

const iconSvg = {
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.1 6.6"></path><path d="M3 12A9 9 0 0 1 18.1 5.4"></path><path d="M3 19v-5h5"></path><path d="M21 5v5h-5"></path></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"></path></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z"></path></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14"></path><path d="M16 5v14"></path></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"></path><path d="M14 2v6h6"></path></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="m21 8-9-5-9 5 9 5 9-5Z"></path><path d="M3 8v8l9 5 9-5V8"></path><path d="M12 13v8"></path></svg>',
  container: '<svg viewBox="0 0 24 24"><path d="M3 9h18"></path><path d="M3 15h18"></path><rect x="3" y="5" width="18" height="14" rx="2"></rect></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="m12 20 7-7"></path><path d="M17 3a2.8 2.8 0 1 1 4 4L7 21l-4 1 1-4Z"></path></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>'
};

function showToast(message, type = 'ok') {
  toast.textContent = message;
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `请求失败：${response.status}`);
  }
  return payload;
}

function setBusy(button, busy, label) {
  if (!button) {
    return;
  }
  button.disabled = busy;
  if (button.classList.contains('icon-button')) {
    button.classList.toggle('is-busy', busy);
    button.setAttribute('aria-busy', String(busy));
    if (label && busy) {
      button.dataset.busyTitle = button.title || '';
      button.title = label;
    } else if (!busy && button.dataset.busyTitle !== undefined) {
      button.title = button.dataset.busyTitle;
      delete button.dataset.busyTitle;
    }
    return;
  }
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.textContent = label;
  } else if (button.dataset.label) {
    button.innerHTML = button.dataset.label;
    delete button.dataset.label;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatBytes(bytes) {
  if (!bytes) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function safeLibraryId(value) {
  return String(value || DEFAULT_ICON_LIBRARY.id)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || DEFAULT_ICON_LIBRARY.id;
}

function normalizeLibraryEntry(library = {}, fallbackId = DEFAULT_ICON_LIBRARY.id) {
  const requestedId = String(library.id || '').trim();
  const requestedName = String(library.name || '').trim();
  const id = safeLibraryId(requestedId || requestedName || fallbackId);
  return {
    id,
    name: requestedName || (id === DEFAULT_ICON_LIBRARY.id ? DEFAULT_ICON_LIBRARY.name : id),
    zipUrl: String(library.zipUrl || DEFAULT_ICON_LIBRARY.zipUrl).trim(),
    zipSubdir: String(library.zipSubdir || DEFAULT_ICON_LIBRARY.zipSubdir).trim(),
    publicBaseUrl: String(library.publicBaseUrl || DEFAULT_ICON_LIBRARY.publicBaseUrl).trim()
  };
}

function normalizeLibraries(libraries = []) {
  const source = Array.isArray(libraries) && libraries.length ? libraries : [DEFAULT_ICON_LIBRARY];
  const usedIds = new Set();
  return source.map((library, index) => {
    const fallbackId = index === 0 ? DEFAULT_ICON_LIBRARY.id : `icon-library-${index + 1}`;
    const normalized = normalizeLibraryEntry(library, fallbackId);
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

function createLibraryEntry(existingLibraries = []) {
  const count = existingLibraries.length + 1;
  const baseName = count === 1 ? DEFAULT_ICON_LIBRARY.name : `图标库 ${count}`;
  let id = safeLibraryId(count === 1 ? DEFAULT_ICON_LIBRARY.id : `icon-library-${count}`);
  let suffix = 2;
  while (existingLibraries.some((library) => library.id === id)) {
    id = `icon-library-${count}-${suffix}`;
    suffix += 1;
  }
  return {
    id,
    name: baseName,
    zipUrl: DEFAULT_ICON_LIBRARY.zipUrl,
    zipSubdir: DEFAULT_ICON_LIBRARY.zipSubdir,
    publicBaseUrl: ''
  };
}

function getAllForms() {
  return [form, onboardingConfigForm].filter(Boolean);
}

function getVisibleForm() {
  return hasSavedConfig ? form : (onboardingConfigForm || form);
}

function getNamedField(targetForm, name) {
  return targetForm?.elements?.namedItem(name) || null;
}

function setNamedValue(targetForm, name, value) {
  const field = getNamedField(targetForm, name);
  if (field) {
    field.value = value;
  }
}

function setNamedChecked(targetForm, name, checked) {
  const field = getNamedField(targetForm, name);
  if (field) {
    field.checked = Boolean(checked);
  }
}

function getConnectionFlags(sourceForm = getVisibleForm()) {
  const sshHost = getNamedField(sourceForm, 'sshHost')?.value?.trim() || '';
  const sshUsername = getNamedField(sourceForm, 'sshUsername')?.value?.trim() || '';
  const sshPassword = getNamedField(sourceForm, 'sshPassword')?.value || '';
  return {
    hasSsh: Boolean(sshHost && sshUsername && sshPassword),
    hasAnySsh: Boolean(sshHost || sshUsername || sshPassword)
  };
}

function updateOnboardingView() {
  if (!onboardingConfigForm) {
    return;
  }
  const currentIndex = onboardingSteps.indexOf(activeOnboardingStep);
  const meta = onboardingStepMeta[activeOnboardingStep] || onboardingStepMeta.ssh;
  if (onboardingTitle) {
    onboardingTitle.textContent = meta.title;
  }
  if (onboardingSubtitle) {
    onboardingSubtitle.textContent = meta.subtitle;
  }
  onboardingConfigForm.dataset.onboardingStep = activeOnboardingStep;

  for (const stepEl of onboardingStepStrip?.querySelectorAll('[data-onboarding-step]') || []) {
    const stepIndex = onboardingSteps.indexOf(stepEl.dataset.onboardingStep);
    const isCurrent = stepEl.dataset.onboardingStep === activeOnboardingStep;
    stepEl.classList.toggle('active', stepIndex <= currentIndex);
    stepEl.classList.toggle('current', isCurrent);
  }

  for (const section of onboardingConfigForm.querySelectorAll('[data-settings-section]')) {
    const sectionName = section.dataset.settingsSection;
    const shouldHide = activeOnboardingStep === 'library'
      ? sectionName !== 'library'
      : sectionName !== 'connection';
    section.hidden = shouldHide;
    section.classList.toggle('onboarding-hidden', shouldHide);
  }

  for (const field of onboardingConfigForm.querySelectorAll('[data-onboarding-step-field]')) {
    const shouldHide = field.dataset.onboardingStepField === 'web' ||
      field.dataset.onboardingStepField !== activeOnboardingStep;
    field.hidden = shouldHide;
    field.classList.toggle('onboarding-hidden', shouldHide);
  }

  const permissionNote = onboardingConfigForm.querySelector('.permission-note');
  if (permissionNote) {
    const shouldHide = activeOnboardingStep === 'library';
    permissionNote.hidden = shouldHide;
    permissionNote.classList.toggle('onboarding-hidden', shouldHide);
  }
  const advancedSection = onboardingConfigForm.querySelector('[data-settings-section="advanced"]');
  if (advancedSection) {
    advancedSection.hidden = true;
    advancedSection.classList.add('onboarding-hidden');
  }

  const prevButton = onboardingConfigForm.querySelector('[data-onboarding-action="prev"]');
  const testButtonEl = onboardingConfigForm.querySelector('[data-onboarding-action="test"]');
  const skipButton = onboardingConfigForm.querySelector('[data-onboarding-action="skip"]');
  const nextButton = onboardingConfigForm.querySelector('[data-onboarding-action="next"]');
  const finishButton = onboardingConfigForm.querySelector('[data-onboarding-action="finish"]');
  if (prevButton) {
    prevButton.hidden = currentIndex === 0;
  }
  if (testButtonEl) {
    testButtonEl.hidden = activeOnboardingStep === 'library';
  }
  if (skipButton) {
    skipButton.hidden = activeOnboardingStep === 'library';
  }
  if (nextButton) {
    nextButton.hidden = activeOnboardingStep === 'library';
  }
  if (finishButton) {
    finishButton.hidden = activeOnboardingStep !== 'library';
  }
}

function cloneSettingsFormToOnboarding() {
  const clone = form.cloneNode(true);
  clone.id = 'onboardingConfigForm';
  for (const node of clone.querySelectorAll('[id]')) {
    node.removeAttribute('id');
  }
  clone.querySelector('.settings-actions')?.remove();
  clone.insertAdjacentHTML('beforeend', `
    <div class="settings-actions onboarding-actions">
      <button type="button" class="secondary-button" data-onboarding-action="prev">上一步</button>
      <button type="button" class="secondary-button" data-onboarding-action="test">测试并继续</button>
      <button type="button" class="ghost-button" data-onboarding-action="skip">跳过</button>
      <button type="button" class="primary-button" data-onboarding-action="next">
        <span>下一步</span>
      </button>
      <button type="button" class="primary-button" data-onboarding-action="finish">
        <span>保存并进入</span>
      </button>
    </div>
  `);
  onboardingForm.replaceWith(clone);
  onboardingConfigForm = clone;
  wireSettingsForm(onboardingConfigForm);
  wireOnboardingForm(onboardingConfigForm);
  updateOnboardingView();
  return onboardingConfigForm;
}

function getFormLibraries(targetForm = form) {
  const cards = [...targetForm.querySelectorAll('[data-library-card]')];
  if (!cards.length) {
    return normalizeLibraries([DEFAULT_ICON_LIBRARY]);
  }

  return normalizeLibraries(cards.map((card, index) => {
    const field = (name) => card.querySelector(`[data-library-field="${name}"]`)?.value || '';
    return normalizeLibraryEntry({
      id: field('id'),
      name: field('name'),
      zipUrl: field('zipUrl'),
      zipSubdir: field('zipSubdir'),
      publicBaseUrl: field('publicBaseUrl')
    }, index === 0 ? DEFAULT_ICON_LIBRARY.id : `icon-library-${index + 1}`);
  }));
}

function getLibraryStatusMap(summary = currentLibrarySummary) {
  return new Map((summary?.libraries || []).map((library) => [library.id, library]));
}

function buildLibraryOverviewText(libraries, summary = currentLibrarySummary) {
  const statusMap = getLibraryStatusMap(summary);
  const downloadedCount = libraries.filter((library) => statusMap.get(library.id)?.exists).length;
  const iconCount = libraries.reduce((total, library) => total + (statusMap.get(library.id)?.iconCount || 0), 0);
  const bytes = libraries.reduce((total, library) => total + (statusMap.get(library.id)?.bytes || 0), 0);
  const parts = [
    `已配置 ${libraries.length} 个图标库`,
    `已下载 ${downloadedCount} 个`
  ];
  if (iconCount) {
    parts.push(`共 ${iconCount} 个图标`);
  }
  if (bytes) {
    parts.push(formatBytes(bytes));
  }
  return parts.join(' · ');
}

function renderLibraryManager(targetForm, libraries = getFormLibraries(targetForm), summary = currentLibrarySummary) {
  if (!targetForm) {
    return;
  }
  const summaryEl = targetForm.querySelector('[data-library-summary]');
  const listEl = targetForm.querySelector('[data-library-list]');
  if (!summaryEl || !listEl) {
    return;
  }

  const normalized = normalizeLibraries(libraries);
  let expandedId = targetForm.dataset.expandedLibraryId || '';
  if (expandedId && !normalized.some((library) => library.id === expandedId)) {
    expandedId = '';
  }
  targetForm.dataset.expandedLibraryId = expandedId;

  const statusMap = getLibraryStatusMap(summary);
  summaryEl.textContent = buildLibraryOverviewText(normalized, summary);

  listEl.innerHTML = normalized.map((library) => {
    const status = statusMap.get(library.id);
    const isExpanded = expandedId === library.id;
    const statusText = status?.exists
      ? `${status.iconCount} 个图标 · ${formatBytes(status.bytes)}`
      : '尚未下载到本地';
    const publicBaseText = library.publicBaseUrl || '未设置';
    const defaultLabel = library.id === DEFAULT_ICON_LIBRARY.id ? '<span class="library-default-badge">默认</span>' : '';
    const downloadJob = activeDownloadJob?.libraryId === library.id ? activeDownloadJob : null;
    const progressPercent = Math.max(0, Math.min(100, Number(downloadJob?.percent || 0)));

    return `
      <article class="library-config-card ${isExpanded ? 'is-expanded' : ''}" data-library-card data-library-id="${escapeHtml(library.id)}">
        <input type="hidden" data-library-field="id" value="${escapeHtml(library.id)}">
        <div class="library-config-head">
          <div class="library-config-meta">
            <div class="library-config-title">
              <strong>${escapeHtml(library.name || '未命名图标库')}</strong>
              ${defaultLabel}
              <span class="library-id-badge" title="内部稳定 ID">ID ${escapeHtml(library.id)}</span>
              <span class="library-state-badge ${status?.exists ? 'downloaded' : 'pending'}">${status?.exists ? '已下载' : '未下载'}</span>
            </div>
            <div class="library-summary-grid">
              <span>本地状态</span>
              <strong>${escapeHtml(statusText)}</strong>
              <span>备用访问地址</span>
              <strong title="${escapeHtml(publicBaseText)}">${escapeHtml(publicBaseText)}</strong>
              <span>Zip 地址</span>
              <strong title="${escapeHtml(library.zipUrl)}">${escapeHtml(library.zipUrl)}</strong>
            </div>
          </div>
          <div class="library-actions">
            <button type="button" class="icon-button" data-library-action="toggle" data-library-id="${escapeHtml(library.id)}" title="${isExpanded ? '收起编辑' : '编辑图标库'}" aria-label="${isExpanded ? '收起编辑' : '编辑图标库'}">
              ${iconSvg.edit}
            </button>
            <button type="button" class="icon-button" data-library-action="download" data-library-id="${escapeHtml(library.id)}" title="下载/更新图标库" aria-label="下载/更新图标库">
              ${iconSvg.download}
            </button>
            ${normalized.length > 1 ? `
              <button type="button" class="icon-button" data-library-action="remove" data-library-id="${escapeHtml(library.id)}" title="删除图标库" aria-label="删除图标库">
                ${iconSvg.trash}
              </button>
            ` : ''}
          </div>
        </div>
        ${downloadJob ? `
          <div class="library-download-progress ${downloadJob.phase === 'error' ? 'error' : ''}" data-library-progress="${escapeHtml(library.id)}">
            <div class="library-progress-head">
              <strong>${escapeHtml(downloadPhaseText[downloadJob.phase] || '处理中')}</strong>
              <span>${progressPercent}%</span>
            </div>
            <div class="library-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent}">
              <span style="width: ${progressPercent}%"></span>
            </div>
            <p>${escapeHtml(downloadJob.message || '正在处理图标库')}</p>
          </div>
        ` : ''}
        <div class="library-config-body">
          <div class="form-grid">
            <label>
              <span>图标库名称</span>
              <input data-library-field="name" type="text" value="${escapeHtml(library.name)}" placeholder="例如 HD Icons">
            </label>
            <label>
              <span>备用 URL 地址（可选）</span>
              <input data-library-field="publicBaseUrl" type="url" value="${escapeHtml(library.publicBaseUrl)}" placeholder="http://192.168.31.2:3149">
            </label>
            <label class="wide-field">
              <span>图标库 Zip 地址</span>
              <input data-library-field="zipUrl" type="url" value="${escapeHtml(library.zipUrl)}" placeholder="https://example.com/icons.zip">
            </label>
            <label class="wide-field">
              <span>Zip 内图标目录</span>
              <input data-library-field="zipSubdir" type="text" value="${escapeHtml(library.zipSubdir)}" placeholder="icons/border-radius">
            </label>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderLibraryStatus(summary) {
  currentLibrarySummary = {
    libraries: summary?.libraries || [],
    exists: Boolean(summary?.exists),
    libraryCount: Number(summary?.libraryCount || 0),
    iconCount: Number(summary?.iconCount || 0),
    bytes: Number(summary?.bytes || 0)
  };
  pickerLibraryCount.textContent = `${currentLibrarySummary.libraryCount || 0} 库 / ${currentLibrarySummary.iconCount || 0} 图标`;
  for (const targetForm of getAllForms()) {
    renderLibraryManager(targetForm, getFormLibraries(targetForm), currentLibrarySummary);
  }
  updateOnboardingView();
}

function getFormPayload(sourceForm = form) {
  const data = new FormData(sourceForm);
  return {
    sshHost: String(data.get('sshHost') || '').trim(),
    sshPort: Number(data.get('sshPort') || 22),
    sshUsername: String(data.get('sshUsername') || '').trim(),
    sshPassword: data.get('sshPassword') || '__KEEP__',
    sshPrivateKey: '__KEEP__',
    templateDir: String(data.get('templateDir') || '').trim(),
    composeProjectDir: String(data.get('composeProjectDir') || '').trim(),
    localIconStoreDir: String(data.get('localIconStoreDir') || '').trim(),
    hostIconPath: String(data.get('hostIconPath') || '').trim(),
    previewAllowedPaths: String(data.get('previewAllowedPaths') || '').trim(),
    iconLibraries: getFormLibraries(sourceForm)
  };
}

function getSshOnlyPayload(sourceForm = getVisibleForm()) {
  return getFormPayload(sourceForm);
}

function getOnboardingFinalPayload(sourceForm = onboardingConfigForm) {
  const flags = getConnectionFlags(sourceForm);
  const payload = getFormPayload(sourceForm);
  if (!flags.hasSsh) {
    payload.sshHost = '';
    payload.sshUsername = '';
    payload.sshPassword = '';
    payload.sshPrivateKey = '';
  }
  return payload;
}

function getIconLibraryPayload(sourceForm = form, libraryId = '') {
  return {
    iconLibraries: getFormLibraries(sourceForm),
    libraryId
  };
}

function setFormValues(targetForm, config = {}) {
  setNamedValue(targetForm, 'sshHost', config.sshHost || '');
  setNamedValue(targetForm, 'sshPort', config.sshPort || 22);
  setNamedValue(targetForm, 'sshUsername', config.sshUsername || '');
  setNamedValue(targetForm, 'sshPassword', '');
  setNamedValue(targetForm, 'templateDir', config.templateDir || '/boot/config/plugins/dockerMan/templates-user');
  setNamedValue(targetForm, 'composeProjectDir', config.composeProjectDir || '/boot/config/plugins/compose.manager/projects');
  setNamedValue(targetForm, 'localIconStoreDir', config.localIconStoreDir || '/app/icons');
  setNamedValue(targetForm, 'hostIconPath', config.hostIconPath || '/mnt/user/appdata/unraid-icon-manager/icons');
  setNamedValue(targetForm, 'previewAllowedPaths', Array.isArray(config.previewAllowedPaths)
    ? config.previewAllowedPaths.join('\n')
    : (config.previewAllowedPaths || ''));
  renderLibraryManager(targetForm, config.iconLibraries || [DEFAULT_ICON_LIBRARY], currentLibrarySummary);
  if (targetForm === onboardingConfigForm) {
    updateOnboardingView();
  }
}

function setSettingsTab(tab) {
  const nextTab = drawerTabs.some((button) => button.dataset.settingsTab === tab)
    ? tab
    : 'connection';
  activeSettingsTab = nextTab;
  settingsDrawer.dataset.activeTab = nextTab;
  for (const button of drawerTabs) {
    const active = button.dataset.settingsTab === nextTab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  }
}

function setDrawerOpen(open) {
  settingsOpen = open;
  settingsDrawer.hidden = !open;
}

function openSettingsDrawer(tab = activeSettingsTab) {
  setSettingsTab(tab);
  setDrawerOpen(true);
}

function renderAppMode() {
  const onboarding = !hasSavedConfig;
  onboardingPanel.hidden = !onboarding;
  mainContent.hidden = onboarding;
  settingsToggleButton.hidden = onboarding;
  setDrawerOpen(!onboarding && settingsOpen);
  headerSubtitle.textContent = hasSavedConfig
    ? `连接到 ${getNamedField(form, 'sshHost')?.value || 'Unraid'}`
    : '图标管理控制台';
  if (onboarding) {
    updateOnboardingView();
  }
}

function applyConfig(config) {
  if (!config.exists) {
    hasSavedConfig = false;
    settingsOpen = false;
    statusPill.textContent = '未连接';
    statusPill.classList.remove('ok');
    setFormValues(form, { iconLibraries: [DEFAULT_ICON_LIBRARY] });
    if (onboardingConfigForm) {
      setFormValues(onboardingConfigForm, { iconLibraries: [DEFAULT_ICON_LIBRARY] });
    }
    renderAppMode();
    return;
  }

  hasSavedConfig = true;
  setFormValues(form, config);
  if (onboardingConfigForm) {
    setFormValues(onboardingConfigForm, config);
  }
  statusPill.textContent = '已连接';
  statusPill.classList.add('ok');
  renderAppMode();
}

function getLibraryById(targetForm, libraryId) {
  return getFormLibraries(targetForm).find((library) => library.id === libraryId) || null;
}

function buildLocalIconReference(libraryId, relativePath) {
  const encodedPath = String(relativePath || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `local-icon://${encodeURIComponent(libraryId)}/${encodedPath}`;
}

function parseLocalIconReference(value) {
  const source = String(value || '').trim();
  if (!source.toLowerCase().startsWith('local-icon://')) {
    return null;
  }
  const reference = source.slice('local-icon://'.length);
  const slashIndex = reference.indexOf('/');
  if (slashIndex <= 0 || slashIndex === reference.length - 1) {
    return null;
  }
  try {
    return {
      libraryId: decodeURIComponent(reference.slice(0, slashIndex)),
      relativePath: reference
        .slice(slashIndex + 1)
        .split('/')
        .map((part) => decodeURIComponent(part))
        .join('/')
    };
  } catch {
    return null;
  }
}

function buildIconFilePreviewUrl(libraryId, relativePath) {
  return `/api/icon-library/file/${encodeURIComponent(libraryId)}/${String(relativePath || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function findItemById(itemId) {
  return items.find((item) => item.id === itemId) || null;
}

function setDraftIcon(item, value) {
  const icon = String(value || '').trim();
  if (icon === (item.icon || '')) {
    drafts.delete(item.id);
    return;
  }

  drafts.set(item.id, {
    name: item.name,
    containerName: item.containerName || item.name,
    state: item.state || '',
    templatePath: item.templatePath,
    sourceType: item.sourceType || 'dockerTemplate',
    serviceName: item.serviceName || '',
    icon,
    changed: true
  });
}

function clearDraftIcon(item) {
  drafts.delete(item.id);
}

function applyDraftIcon(item, value) {
  setDraftIcon(item, value);
  renderRows();
  updateDirtyState();
}

function resetDraftForItem(item) {
  clearDraftIcon(item);
  renderRows();
  updateDirtyState();
}

function getPendingIconValue(item) {
  return drafts.get(item.id)?.icon || '';
}

function isUrlIcon(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function isHostPathIcon(value) {
  const icon = String(value || '').trim();
  return icon.startsWith('/') || /^[a-z]:[\\/]/i.test(icon);
}

function buildHostPathPreviewUrl(value) {
  return `/api/icon-preview?path=${encodeURIComponent(String(value || '').trim())}`;
}

function isLocalIconReference(value) {
  return Boolean(parseLocalIconReference(value));
}

function getIconValueLabel(value) {
  if (!value) {
    return '未设置';
  }
  const localIcon = parseLocalIconReference(value);
  if (localIcon) {
    return localIcon.relativePath.split('/').filter(Boolean).pop() || '本地图标';
  }
  if (isUrlIcon(value)) {
    try {
      const url = new URL(value);
      const fileName = url.pathname.split('/').filter(Boolean).pop();
      return fileName || url.hostname;
    } catch {
      return value.replace(/^https?:\/\//i, '');
    }
  }
  return value.split(/[\\/]/).filter(Boolean).pop() || value;
}

function getIconValueMeta(value, emptyLabel = '点击添加新图标') {
  if (!value) {
    return emptyLabel;
  }
  const localIcon = parseLocalIconReference(value);
  if (localIcon) {
    return `本地图标库 · ${localIcon.libraryId}`;
  }
  if (isUrlIcon(value)) {
    try {
      return `网络 URL · ${new URL(value).host}`;
    } catch {
      return '网络 URL';
    }
  }
  return '本地路径';
}

async function copyText(value, successMessage = '已复制') {
  if (!value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    showToast(successMessage);
  } catch {
    showToast('复制失败，可以直接选中内容复制', 'error');
  }
}

function buildHostIconPreviewPath(reference, sourceForm = getVisibleForm(), item = null) {
  const hostIconPath = getNamedField(sourceForm, 'hostIconPath')?.value?.trim() ||
    '/mnt/user/appdata/unraid-icon-manager/icons';
  const cleanBase = hostIconPath.replace(/[\\/]+$/, '');
  const extension = (String(reference?.relativePath || '').match(/\.[a-z0-9]+$/i)?.[0] || '.png').toLowerCase();
  const sourceName = String(item?.containerName || item?.name || 'container')
    .trim()
    .replace(/^\//, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'container';
  return `${cleanBase}/${sourceName}-<hash>${extension}`;
}

function clearIconSelection() {
  selectedIcon = null;
  iconUseButton.disabled = true;
  selectedIconPreview.hidden = true;
  selectedIconPreview.innerHTML = '';
}

async function fetchIconChoices(query = '') {
  return requestJson(`/api/icon-library/icons?q=${encodeURIComponent(query)}&limit=all`);
}

function renderSelectedIconPreview(icon) {
  const infoText = icon.hostPath || icon.url || '同步后会写入 Unraid 本地图标路径';
  selectedIconPreview.hidden = false;
  selectedIconPreview.innerHTML = `
    <div class="icon-tile"><img src="${escapeHtml(icon.previewUrl)}" alt=""></div>
    <div>
      <strong>${escapeHtml(icon.libraryName)}</strong>
      <code title="${escapeHtml(infoText)}">${escapeHtml(infoText)}</code>
    </div>
  `;
}

async function loadIconChoices(query = '') {
  const requestSeq = ++iconSearchRequestSeq;
  const cleanQuery = query.trim();
  let payload = await fetchIconChoices(cleanQuery);
  if (requestSeq !== iconSearchRequestSeq) {
    return;
  }

  const noMatchedQuery = Boolean(cleanQuery && payload.exists && payload.items.length === 0);
  if (noMatchedQuery) {
    payload = await fetchIconChoices('');
    if (requestSeq !== iconSearchRequestSeq) {
      return;
    }
  }

  renderLibraryStatus(payload);
  clearIconSelection();

  if (!payload.exists) {
    iconPickerGrid.innerHTML = '<div class="empty-state">图标库还没有下载</div>';
    pickerHint.textContent = '先在设置里下载至少一个本地图标库。';
    return;
  }

  if (!payload.items.length) {
    iconPickerGrid.innerHTML = '<div class="empty-state">没有可用图标</div>';
    pickerHint.textContent = '当前图标库里没有可用的图标文件。';
    return;
  }

  pickerHint.textContent = noMatchedQuery
    ? `没有匹配“${cleanQuery}”的图标，已显示全部 ${payload.items.length} 个结果。`
    : `${payload.libraryCount || 0} 个图标库，共 ${payload.iconCount || 0} 个图标，当前显示 ${payload.items.length} 个。`;

  iconPickerGrid.innerHTML = payload.items.map((icon) => `
    <button
      type="button"
      class="icon-choice"
      data-library-id="${escapeHtml(icon.libraryId)}"
      data-library-name="${escapeHtml(icon.libraryName)}"
      data-path="${escapeHtml(icon.relativePath)}"
      data-preview="${escapeHtml(icon.previewUrl)}"
      title="${escapeHtml(icon.fileName)}"
    >
      <img src="${escapeHtml(icon.previewUrl)}" alt="">
      <span class="icon-choice-name">${escapeHtml(icon.fileName)}</span>
      <span class="icon-choice-source">${escapeHtml(icon.libraryName)}</span>
    </button>
  `).join('');

  for (const button of iconPickerGrid.querySelectorAll('.icon-choice')) {
    button.addEventListener('click', () => {
      const url = buildLocalIconReference(button.dataset.libraryId, button.dataset.path);
      selectedIcon = {
        libraryId: button.dataset.libraryId,
        libraryName: button.dataset.libraryName,
        relativePath: button.dataset.path,
        previewUrl: button.dataset.preview,
        url,
        hostPath: buildHostIconPreviewPath({
          libraryId: button.dataset.libraryId,
          relativePath: button.dataset.path
        }, activeIconSourceForm || getVisibleForm(), findItemById(activeIconPickerItemId))
      };
      for (const item of iconPickerGrid.querySelectorAll('.icon-choice.selected')) {
        item.classList.remove('selected');
      }
      button.classList.add('selected');
      iconUseButton.disabled = !selectedIcon.url;
      renderSelectedIconPreview(selectedIcon);
    });
  }
}

async function openIconPicker(item) {
  activeIconPickerItemId = item.id;
  activeIconSourceForm = getVisibleForm();
  clearIconSelection();
  iconSearchInput.value = item.name || '';
  iconPickerGrid.innerHTML = '<div class="empty-state">加载中...</div>';
  closeIconPopover();
  iconPicker.showModal();
  await loadIconChoices(iconSearchInput.value);
}

function scheduleIconSearch() {
  window.clearTimeout(iconSearchTimer);
  pickerHint.textContent = '正在搜索...';
  clearIconSelection();
  iconSearchTimer = window.setTimeout(() => {
    loadIconChoices(iconSearchInput.value).catch((error) => showToast(error.message, 'error'));
  }, 220);
}

function updateIconPopoverActions() {
  const item = findItemById(activeIconPopoverItemId);
  const canEdit = Boolean(item?.templateFound);
  iconPopoverInput.disabled = !canEdit;
  iconPopoverApplyButton.disabled = !canEdit || !iconPopoverInput.value.trim();
  iconPopoverLibraryButton.disabled = !canEdit;
}

function positionIconPopover() {
  if (iconPopover.hidden || !activeIconPopoverAnchor) {
    return;
  }

  const margin = 16;
  const rect = activeIconPopoverAnchor.getBoundingClientRect();
  const popoverWidth = iconPopover.offsetWidth;
  const popoverHeight = iconPopover.offsetHeight;
  let left = rect.left + (rect.width / 2) - (popoverWidth / 2);
  let top = rect.bottom + 12;

  left = Math.max(margin, Math.min(window.innerWidth - popoverWidth - margin, left));
  if (top + popoverHeight > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - popoverHeight - 12);
  }

  iconPopover.style.left = `${Math.round(left)}px`;
  iconPopover.style.top = `${Math.round(top)}px`;
}

function closeIconPopover() {
  iconPopover.hidden = true;
  activeIconPopoverItemId = '';
  activeIconPopoverAnchor = null;
}

function openIconPopover(item, anchor) {
  if (!item || !anchor) {
    return;
  }
  activeIconPopoverItemId = item.id;
  activeIconPopoverAnchor = anchor;
  activeIconSourceForm = getVisibleForm();

  const pendingIcon = getPendingIconValue(item);
  const currentIcon = item.icon || '';
  iconPopoverTitle.textContent = `为 ${item.name} 设置新图标`;
  iconPopoverHint.textContent = item.templateFound
    ? '支持网络 URL，也可以直接从本地图标库选择。'
    : '当前项目未匹配可写入模板，暂时只能查看。';
  iconPopoverCurrentValue.textContent = currentIcon || '未设置';
  iconPopoverCurrentValue.title = currentIcon || '未设置';
  iconPopoverCopyCurrentButton.dataset.copy = currentIcon;
  iconPopoverCopyCurrentButton.disabled = !currentIcon;
  iconPopoverInput.value = pendingIcon;
  iconPopoverInput.placeholder = item.templateFound
    ? 'https://example.com/icon.png'
    : '当前条目暂不可编辑';

  iconPopover.hidden = false;
  updateIconPopoverActions();
  positionIconPopover();

  if (item.templateFound) {
    window.setTimeout(() => {
      iconPopoverInput.focus({ preventScroll: true });
      iconPopoverInput.select();
    }, 0);
  }
}

async function loadLibraryStatus() {
  const status = await requestJson('/api/icon-library');
  renderLibraryStatus(status);
  return status;
}

async function saveIconLibrarySettings(sourceForm = form) {
  const status = await requestJson('/api/icon-library', {
    method: 'PUT',
    body: JSON.stringify(getIconLibraryPayload(sourceForm))
  });
  renderLibraryStatus(status);
  return status;
}

async function checkLibraryStatus(sourceForm = form) {
  const status = await saveIconLibrarySettings(sourceForm);
  showToast(buildLibraryOverviewText(getFormLibraries(sourceForm), status));
}

async function downloadLibrary(sourceForm = form, libraryId = '', button = null) {
  setBusy(button, true, '下载中');
  try {
    await saveIconLibrarySettings(sourceForm);
    const job = await requestJson('/api/icon-library/download', {
      method: 'POST',
      body: JSON.stringify(getIconLibraryPayload(sourceForm, libraryId))
    });
    activeDownloadJob = job;
    renderLibraryStatus(currentLibrarySummary);
    showToast('图标库下载已开始');
    pollDownloadJob(job.id, sourceForm, button);
  } catch (error) {
    showToast(error.message, 'error');
    setBusy(button, false);
  }
}

async function pollDownloadJob(jobId, sourceForm = form, button = null) {
  window.clearTimeout(downloadPollTimer);
  try {
    const job = await requestJson(`/api/icon-library/download/${encodeURIComponent(jobId)}`);
    activeDownloadJob = job;
    renderLibraryStatus(currentLibrarySummary);

    if (job.phase === 'done') {
      const status = job.result || await loadLibraryStatus();
      renderLibraryStatus(status);
      showToast(job.message || '图标库已下载');
      setBusy(button, false);
      return;
    }

    if (job.phase === 'error') {
      showToast(job.message || '图标库下载失败', 'error');
      setBusy(button, false);
      return;
    }

    downloadPollTimer = window.setTimeout(() => {
      pollDownloadJob(jobId, sourceForm, button);
    }, 800);
  } catch (error) {
    showToast(error.message, 'error');
    setBusy(button, false);
  }
}

function getStateKey(state) {
  const value = String(state || '').toLowerCase();
  if (value.includes('running')) {
    return 'running';
  }
  if (value.includes('exited') || value.includes('stopped') || value.includes('created')) {
    return 'stopped';
  }
  if (value.includes('template')) {
    return 'template';
  }
  return value || 'unknown';
}

function getStateLabel(state) {
  const key = getStateKey(state);
  const labels = {
    running: '运行中',
    stopped: '已停止',
    template: '仅模板',
    unknown: '未知'
  };
  return labels[key] || state || '未知';
}

function getStateIcon(stateKey) {
  if (stateKey === 'running') {
    return iconSvg.play;
  }
  if (stateKey === 'stopped') {
    return iconSvg.pause;
  }
  if (stateKey === 'template') {
    return iconSvg.file;
  }
  return '';
}

function getSourceLabel(item) {
  if (!item.templateFound) {
    return '未匹配';
  }
  return item.sourceLabel || (item.sourceType === 'compose' ? 'Compose' : 'Docker');
}

function getSourceKey(item) {
  if (!item.templateFound) {
    return 'missing';
  }
  return item.sourceType || 'dockerTemplate';
}

function getSourceIcon(item) {
  return getSourceKey(item) === 'compose' ? iconSvg.box : iconSvg.container;
}

function getStateOptions() {
  const options = new Map([
    ['all', '全部'],
    ['running', '运行中'],
    ['stopped', '已停止'],
    ['template', '仅模板']
  ]);
  for (const item of items) {
    const key = getStateKey(item.state);
    options.set(key, getStateLabel(item.state));
  }
  return [...options.entries()];
}

function renderStateOptions() {
  const available = getStateOptions();
  if (!available.some(([value]) => value === activeStateFilter)) {
    activeStateFilter = 'all';
  }
  stateSegments.innerHTML = available.map(([value, label]) => `
    <button type="button" class="${value === activeStateFilter ? 'active' : ''}" data-state="${escapeHtml(value)}">${escapeHtml(label)}</button>
  `).join('');
  for (const button of stateSegments.querySelectorAll('button')) {
    button.addEventListener('click', () => {
      activeStateFilter = button.dataset.state;
      renderStateOptions();
      renderRows();
    });
  }
}

function matchesFilter(item) {
  const draft = drafts.get(item.id);
  const needle = filterInput.value.trim().toLowerCase();
  if (modifiedOnly && !draft?.changed) {
    return false;
  }
  if (activeStateFilter !== 'all' && getStateKey(item.state) !== activeStateFilter) {
    return false;
  }
  if (sourceFilter.value !== 'all' && getSourceKey(item) !== sourceFilter.value) {
    return false;
  }
  if (!needle) {
    return true;
  }
  return [item.name, item.repository, item.icon, item.templatePath, getStateLabel(item.state), getSourceLabel(item)]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(needle));
}

function updateMetrics() {
  const running = items.filter((item) => getStateKey(item.state) === 'running').length;
  const compose = items.filter((item) => getSourceKey(item) === 'compose').length;
  const dirty = [...drafts.values()].filter((draft) => draft.changed && draft.templatePath).length;
  metricTotal.textContent = String(items.length);
  metricRunning.textContent = String(running);
  metricCompose.textContent = String(compose);
  metricDirty.textContent = String(dirty);
}

function updateDirtyState() {
  const dirty = [...drafts.values()].filter((draft) => draft.changed && draft.templatePath);
  dirtyCount.textContent = `${dirty.length} 项已修改`;
  syncButton.disabled = dirty.length === 0;
  syncFooterButton.disabled = dirty.length === 0;
  modifiedOnlyButton.setAttribute('aria-pressed', String(modifiedOnly));
  updateMetrics();
}

function getIconInitials(name) {
  const clean = String(name || 'icon').replace(/[^a-z0-9]+/gi, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || 'IC';
}

function renderIconTile(icon, name) {
  if (!icon) {
    return `<div class="icon-tile">${escapeHtml(getIconInitials(name))}</div>`;
  }
  const localIcon = parseLocalIconReference(icon);
  if (localIcon) {
    return `<div class="icon-tile"><img src="${escapeHtml(buildIconFilePreviewUrl(localIcon.libraryId, localIcon.relativePath))}" alt="" loading="lazy" onerror="this.closest('.icon-tile').replaceWith(createIconFallback())"></div>`;
  }
  if (/^https?:\/\//i.test(icon)) {
    return `<div class="icon-tile"><img src="${escapeHtml(icon)}" alt="" loading="lazy" onerror="this.closest('.icon-tile').replaceWith(createIconFallback())"></div>`;
  }
  if (isHostPathIcon(icon)) {
    return `<div class="icon-tile"><img src="${escapeHtml(buildHostPathPreviewUrl(icon))}" alt="" loading="lazy" onerror="this.closest('.icon-tile').replaceWith(createIconFallback())"></div>`;
  }
  return '<div class="icon-tile path">PATH</div>';
}

function renderCompareIcon(icon, name, mode = 'current') {
  if (icon) {
    return renderIconTile(icon, name);
  }
  if (mode === 'new') {
    return '<div class="icon-placeholder" aria-hidden="true"><span>+</span></div>';
  }
  return `<div class="icon-placeholder passive" aria-hidden="true">${iconSvg.image}</div>`;
}

window.createIconFallback = function createIconFallback() {
  const fallback = document.createElement('div');
  fallback.className = 'icon-tile broken icon-fallback';
  fallback.innerHTML = iconSvg.image;
  fallback.setAttribute('aria-label', '图标加载失败');
  return fallback;
};

function getSyncUpdatesFromDraftEntries(entries = []) {
  return entries
    .filter(([, draft]) => draft?.changed && draft.templatePath)
    .map(([, draft]) => ({
      name: draft.name,
      containerName: draft.containerName,
      state: draft.state,
      templatePath: draft.templatePath,
      sourceType: draft.sourceType,
      serviceName: draft.serviceName,
      icon: draft.icon
    }));
}

function buildSyncToastParts(payload) {
  const restarted = payload.results.filter((result) => result.restart?.ok).length;
  const restartFailed = payload.results.filter((result) => result.restart && !result.restart.ok && !result.restart.skipped).length;
  const restartSkipped = payload.results.filter((result) => result.restart?.skipped).length;
  const parts = [`已同步 ${payload.results.length} 项并创建备份`];

  if (restarted) {
    parts.push(`已刷新 ${restarted} 个容器`);
  }
  if (restartSkipped) {
    parts.push(`${restartSkipped} 个未运行/仅模板已跳过`);
  }
  if (restartFailed) {
    const failures = payload.results.filter((result) => (
      result.restart && !result.restart.ok && !result.restart.skipped
    ));
    const firstError = failures[0]?.restart?.error || '未知错误';
    parts.push(`${restartFailed} 个刷新失败：${firstError}`);
    console.warn('Docker refresh failures', failures);
  }

  return {
    parts,
    restartFailed
  };
}

function renderRows() {
  closeIconPopover();
  const visible = items.filter(matchesFilter);
  listSummary.textContent = items.length
    ? `已读取 ${items.length} 项，当前显示 ${visible.length} 项`
    : '未读取 Docker 列表';
  if (!visible.length) {
    rows.innerHTML = '<div class="empty-state">没有匹配项</div>';
    return;
  }

  rows.innerHTML = visible.map((item) => {
    const pendingIcon = getPendingIconValue(item);
    const changed = Boolean(pendingIcon || drafts.has(item.id));
    const stateKey = getStateKey(item.state);
    const stateLabel = getStateLabel(item.state);
    const currentIcon = item.icon || '';
    const sourceKey = getSourceKey(item);
    const templateState = !item.templateFound
      ? '<span class="row-note-badge readonly">未匹配模板</span>'
      : (changed ? '<span class="row-note-badge changed">待同步</span>' : '');

    return `
      <article class="container-row ${changed ? 'changed' : ''}" data-id="${escapeHtml(item.id)}">
        <div class="container-row-inner">
          <div class="entity-summary">
            <div class="entity-cell">
              ${renderIconTile(item.icon, item.name)}
              <div class="entity-main" title="${escapeHtml(item.name)}">
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.repository || item.projectName || '未提供镜像信息')}</span>
              </div>
            </div>
            <div class="entity-badges">
              <span class="state-badge ${escapeHtml(stateKey)}">${getStateIcon(stateKey)}${escapeHtml(stateLabel)}</span>
              <span class="source-badge ${escapeHtml(sourceKey)}">${getSourceIcon(item)}${escapeHtml(getSourceLabel(item))}</span>
              ${templateState}
            </div>
          </div>
          <div class="compare-cell">
            <div class="icon-compare-flow">
              <div class="icon-compare-card current">
                <div class="compare-card-head">
                  <span class="compare-card-label">当前图标</span>
                  <button type="button" class="copy-action copy-current-action" data-copy="${escapeHtml(currentIcon)}" title="复制当前地址" aria-label="复制当前地址" ${currentIcon ? '' : 'disabled'}>${iconSvg.copy}</button>
                </div>
                <div class="compare-card-art">
                  ${renderCompareIcon(currentIcon, item.name, 'current')}
                </div>
                <strong class="compare-card-name">${escapeHtml(getIconValueLabel(currentIcon))}</strong>
                <span class="compare-card-meta" title="${escapeHtml(currentIcon || '未设置')}">${escapeHtml(getIconValueMeta(currentIcon, '未设置'))}</span>
              </div>
              <div class="compare-arrow" aria-hidden="true">→</div>
              <button type="button" class="icon-compare-card next new-icon-trigger ${pendingIcon ? 'has-value' : 'is-empty'}" title="设置新图标" aria-label="设置新图标" ${item.templateFound ? '' : 'disabled'}>
                <div class="compare-card-head">
                  <span class="compare-card-label">新图标</span>
                  <span class="draft-pill ${pendingIcon ? 'changed' : 'muted'}">${pendingIcon ? '待同步' : '点击设置'}</span>
                </div>
                <div class="compare-card-art">
                  ${renderCompareIcon(pendingIcon, item.name, 'new')}
                </div>
                <strong class="compare-card-name">${escapeHtml(pendingIcon ? getIconValueLabel(pendingIcon) : '点击添加新图标')}</strong>
                <span class="compare-card-meta" title="${escapeHtml(pendingIcon || '')}">${escapeHtml(getIconValueMeta(pendingIcon, item.templateFound ? '支持网络 URL 或本地图标库' : '当前条目未匹配模板，无法写入'))}</span>
              </button>
            </div>
          </div>
          <div class="row-actions-cell">
            <button type="button" class="primary-button compact-action sync-current-action" ${item.templateFound && changed ? '' : 'disabled'}>
              <span>同步当前</span>
            </button>
            <button type="button" class="secondary-button compact-action reset-icon-action" title="恢复当前图标" aria-label="恢复当前图标" ${item.templateFound && changed ? '' : 'disabled'}>
              ${iconSvg.reset}
              <span>恢复</span>
            </button>
            ${pendingIcon ? `
              <button type="button" class="icon-button copy-new-action" data-copy="${escapeHtml(pendingIcon)}" title="复制新图标地址" aria-label="复制新图标地址">
                ${iconSvg.copy}
              </button>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  for (const button of rows.querySelectorAll('.new-icon-trigger')) {
    button.addEventListener('click', () => {
      const row = button.closest('.container-row');
      const item = findItemById(row.dataset.id);
      openIconPopover(item, button);
    });
  }

  for (const button of rows.querySelectorAll('.sync-current-action')) {
    button.addEventListener('click', () => {
      const row = button.closest('.container-row');
      syncCurrentItem(row.dataset.id, button).catch((error) => showToast(error.message, 'error'));
    });
  }

  for (const button of rows.querySelectorAll('.reset-icon-action')) {
    button.addEventListener('click', () => {
      const row = button.closest('.container-row');
      const item = findItemById(row.dataset.id);
      resetDraftForItem(item);
    });
  }

  for (const button of rows.querySelectorAll('.copy-current-action, .copy-new-action')) {
    button.addEventListener('click', () => {
      copyText(button.dataset.copy, '图标地址已复制');
    });
  }
}

function wireSettingsForm(targetForm) {
  if (!targetForm || targetForm.dataset.wired === 'true') {
    return;
  }
  targetForm.dataset.wired = 'true';

  targetForm.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-library-add]');
    if (addButton) {
      const libraries = getFormLibraries(targetForm);
      const next = createLibraryEntry(libraries);
      targetForm.dataset.expandedLibraryId = next.id;
      renderLibraryManager(targetForm, [...libraries, next], currentLibrarySummary);
      return;
    }

    const actionButton = event.target.closest('[data-library-action]');
    if (!actionButton) {
      return;
    }

    const { libraryAction, libraryId } = actionButton.dataset;
    const libraries = getFormLibraries(targetForm);

    if (libraryAction === 'toggle') {
      targetForm.dataset.expandedLibraryId = targetForm.dataset.expandedLibraryId === libraryId ? '' : libraryId;
      renderLibraryManager(targetForm, libraries, currentLibrarySummary);
      return;
    }

    if (libraryAction === 'remove') {
      const nextLibraries = libraries.filter((library) => library.id !== libraryId);
      targetForm.dataset.expandedLibraryId = nextLibraries[0]?.id || '';
      renderLibraryManager(targetForm, nextLibraries, currentLibrarySummary);
      return;
    }

    if (libraryAction === 'download') {
      downloadLibrary(targetForm, libraryId, actionButton).catch((error) => showToast(error.message, 'error'));
    }
  });

  const testAction = targetForm.querySelector('[data-test-connection-action]');
  if (testAction) {
    testAction.addEventListener('click', () => testConnection({ sourceForm: targetForm, button: testAction }));
  }

  const libraryStatusAction = targetForm.querySelector('[data-library-status-action]');
  if (libraryStatusAction) {
    libraryStatusAction.addEventListener('click', () => {
      checkLibraryStatus(targetForm).catch((error) => showToast(error.message, 'error'));
    });
  }
}

async function loadConfig() {
  const config = await requestJson('/api/config');
  applyConfig(config);
}

async function saveConfig(event) {
  event?.preventDefault();
  const sourceForm = event?.currentTarget || form;
  const submitButton = sourceForm.querySelector('button[type="submit"]');
  setBusy(submitButton, true, '保存中');
  try {
    const saved = await requestJson('/api/config', {
      method: 'PUT',
      body: JSON.stringify(getFormPayload(sourceForm))
    });
    applyConfig(saved);
    showToast('配置已加密保存');
    hasSavedConfig = true;
    settingsOpen = false;
    renderAppMode();
    await loadLibraryStatus().catch(() => {});
    await loadContainers();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setBusy(submitButton, false);
  }
}

async function saveOnboardingConfig(sourceForm = onboardingConfigForm, button = null) {
  const flags = getConnectionFlags(sourceForm);
  if (!flags.hasSsh) {
    showToast('请先填写 SSH 地址、用户名和密码', 'error');
    return false;
  }

  setBusy(button, true, '保存中');
  try {
    const saved = await requestJson('/api/config', {
      method: 'PUT',
      body: JSON.stringify(getOnboardingFinalPayload(sourceForm))
    });
    applyConfig(saved);
    showToast('配置已加密保存');
    settingsOpen = false;
    await loadLibraryStatus().catch(() => {});
    await loadContainers();
    return true;
  } catch (error) {
    showToast(error.message, 'error');
    return false;
  } finally {
    setBusy(button, false);
  }
}

async function saveTemporaryStepConfig(sourceForm, step) {
  const flags = getConnectionFlags(sourceForm);
  if (step === 'ssh') {
    if (!flags.hasSsh) {
      showToast('请填写 SSH 地址、用户名和密码', 'error');
      return false;
    }
    const saved = await requestJson('/api/config', {
      method: 'PUT',
      body: JSON.stringify(getSshOnlyPayload(sourceForm))
    });
    setFormValues(form, saved);
    return true;
  }
  return false;
}

function buildConnectionTestMessage(result, step = '') {
  const messages = [];
  if (result.ssh && (!step || step === 'ssh')) {
    messages.push(result.ssh.ok
      ? `SSH 可用：${result.ssh.containerCount || 0} 个容器，${result.ssh.templateCount} 个模板`
      : `SSH 失败：${result.ssh.error || '未通过'}`);
  }
  return messages.join('； ') || (result.ok ? 'SSH 连接测试通过' : 'SSH 连接测试未通过');
}

async function testConnection(options = {}) {
  const {
    sourceForm = form,
    step = '',
    button = testButton,
    advanceOnSuccess = false
  } = options;
  setBusy(testButton, true, '测试中');
  const drawerButtons = getAllForms()
    .map((targetForm) => targetForm.querySelector('[data-test-connection-action], [data-onboarding-action="test"]'))
    .filter(Boolean);
  for (const targetButton of drawerButtons) {
    setBusy(targetButton, true, '测试中');
  }
  setBusy(button, true, '测试中');
  try {
    if (step && !(await saveTemporaryStepConfig(sourceForm, step))) {
      return false;
    }
    const result = await requestJson('/api/test', { method: 'POST' });
    showToast(buildConnectionTestMessage(result, step));
    statusPill.textContent = '连接可用';
    statusPill.classList.add('ok');
    if (advanceOnSuccess) {
      goToOnboardingStep('library');
    }
    return true;
  } catch (error) {
    showToast(error.message, 'error');
    return false;
  } finally {
    setBusy(testButton, false);
    for (const targetButton of drawerButtons) {
      setBusy(targetButton, false);
    }
    setBusy(button, false);
  }
}

function goToOnboardingStep(step) {
  if (!onboardingSteps.includes(step)) {
    return;
  }
  activeOnboardingStep = step;
  updateOnboardingView();
}

function moveOnboardingStep(delta) {
  const currentIndex = onboardingSteps.indexOf(activeOnboardingStep);
  const nextIndex = Math.min(onboardingSteps.length - 1, Math.max(0, currentIndex + delta));
  goToOnboardingStep(onboardingSteps[nextIndex]);
}

function wireOnboardingForm(targetForm) {
  targetForm.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-onboarding-action]');
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.onboardingAction;
    if (action === 'prev') {
      moveOnboardingStep(-1);
      return;
    }
    if (action === 'skip' || action === 'next') {
      moveOnboardingStep(1);
      return;
    }
    if (action === 'test') {
      testConnection({
        sourceForm: targetForm,
        step: activeOnboardingStep,
        button: actionButton,
        advanceOnSuccess: true
      });
      return;
    }
    if (action === 'finish') {
      saveOnboardingConfig(targetForm, actionButton);
    }
  });
}

async function loadContainers(options = {}) {
  const {
    preservedDrafts = null,
    excludeDraftIds = new Set(),
    silent = false
  } = options;
  setBusy(loadButton, true, '读取中');
  try {
    const payload = await requestJson('/api/containers');
    items = payload.items;
    drafts = new Map();
    if (preservedDrafts instanceof Map && preservedDrafts.size) {
      for (const [itemId, draft] of preservedDrafts.entries()) {
        if (!draft?.changed || excludeDraftIds.has(itemId)) {
          continue;
        }
        const item = findItemById(itemId);
        if (!item?.templatePath) {
          continue;
        }
        setDraftIcon(item, draft.icon || '');
      }
    }
    renderStateOptions();
    renderRows();
    updateDirtyState();
    if (!silent) {
      showToast(payload.warning || `已读取 ${items.length} 项`);
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setBusy(loadButton, false);
  }
}

async function syncDraftEntries(draftEntries, options = {}) {
  const {
    busyButtons = [],
    preserveOtherDrafts = false,
    excludeDraftIds = new Set()
  } = options;
  const updates = getSyncUpdatesFromDraftEntries(draftEntries);
  if (!updates.length) {
    return;
  }

  for (const button of busyButtons) {
    setBusy(button, true, '同步中');
  }
  try {
    const payload = await requestJson('/api/sync', {
      method: 'POST',
      body: JSON.stringify({ updates })
    });
    const { parts, restartFailed } = buildSyncToastParts(payload);
    const preservedDrafts = preserveOtherDrafts ? new Map(drafts) : null;
    showToast(
      restartFailed ? `${parts.join('； ')}，请打开浏览器控制台查看详情` : parts.join('； '),
      restartFailed ? 'error' : 'ok'
    );
    await loadContainers({
      preservedDrafts,
      excludeDraftIds,
      silent: true
    });
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    for (const button of busyButtons) {
      setBusy(button, false);
    }
    updateDirtyState();
  }
}

async function syncIcons() {
  await syncDraftEntries([...drafts.entries()], {
    busyButtons: [syncButton, syncFooterButton]
  });
}

async function syncCurrentItem(itemId, button) {
  const draft = drafts.get(itemId);
  if (!draft?.changed || !draft.templatePath) {
    return;
  }

  await syncDraftEntries([[itemId, draft]], {
    busyButtons: [button],
    preserveOtherDrafts: true,
    excludeDraftIds: new Set([itemId])
  });
}

onboardingConfigForm = cloneSettingsFormToOnboarding();
form.addEventListener('submit', saveConfig);
wireSettingsForm(form);
testButton.addEventListener('click', () => testConnection());
loadButton.addEventListener('click', loadContainers);
syncButton.addEventListener('click', syncIcons);
syncFooterButton.addEventListener('click', syncIcons);
settingsToggleButton.addEventListener('click', () => openSettingsDrawer());
downloadLibraryFooterButton.addEventListener('click', () => openSettingsDrawer('library'));
for (const closeTarget of document.querySelectorAll('[data-close-settings]')) {
  closeTarget.addEventListener('click', () => setDrawerOpen(false));
}
for (const button of drawerTabs) {
  button.addEventListener('click', () => setSettingsTab(button.dataset.settingsTab));
}
pickerCloseButton.addEventListener('click', () => iconPicker.close());
iconCancelButton.addEventListener('click', () => iconPicker.close());
iconPicker.addEventListener('close', () => {
  activeIconPickerItemId = '';
  clearIconSelection();
});
iconSearchButton.addEventListener('click', () => {
  loadIconChoices(iconSearchInput.value).catch((error) => showToast(error.message, 'error'));
});
iconSearchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadIconChoices(iconSearchInput.value).catch((error) => showToast(error.message, 'error'));
  }
});
iconSearchInput.addEventListener('input', scheduleIconSearch);
iconUseButton.addEventListener('click', () => {
  const item = findItemById(activeIconPickerItemId);
  if (!item || !selectedIcon?.url) {
    return;
  }
  applyDraftIcon(item, selectedIcon.url);
  activeIconPickerItemId = '';
  iconPicker.close();
  showToast('已选择本地图标');
});
iconPopoverCloseButton.addEventListener('click', closeIconPopover);
iconPopoverInput.addEventListener('input', updateIconPopoverActions);
iconPopoverInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !iconPopoverApplyButton.disabled) {
    event.preventDefault();
    iconPopoverApplyButton.click();
  }
});
iconPopoverCopyCurrentButton.addEventListener('click', () => {
  copyText(iconPopoverCopyCurrentButton.dataset.copy, '当前地址已复制');
});
iconPopoverApplyButton.addEventListener('click', () => {
  const item = findItemById(activeIconPopoverItemId);
  if (!item) {
    return;
  }
  const icon = iconPopoverInput.value.trim();
  if (!icon) {
    showToast('先输入一个网络 URL', 'error');
    return;
  }
  applyDraftIcon(item, icon);
  closeIconPopover();
  showToast('已更新待同步图标');
});
iconPopoverLibraryButton.addEventListener('click', () => {
  const item = findItemById(activeIconPopoverItemId);
  if (!item) {
    return;
  }
  openIconPicker(item).catch((error) => showToast(error.message, 'error'));
});
document.addEventListener('click', (event) => {
  if (iconPopover.hidden) {
    return;
  }
  const target = event.target;
  if (iconPopover.contains(target) || activeIconPopoverAnchor?.contains(target)) {
    return;
  }
  closeIconPopover();
});
window.addEventListener('resize', () => {
  if (!iconPopover.hidden) {
    positionIconPopover();
  }
});
window.addEventListener('scroll', () => {
  if (!iconPopover.hidden) {
    closeIconPopover();
  }
}, true);
filterInput.addEventListener('input', renderRows);
sourceFilter.addEventListener('change', renderRows);
modifiedOnlyButton.addEventListener('click', () => {
  modifiedOnly = !modifiedOnly;
  updateDirtyState();
  renderRows();
});

async function init() {
  renderLibraryManager(form, [DEFAULT_ICON_LIBRARY], currentLibrarySummary);
  renderLibraryManager(onboardingConfigForm, [DEFAULT_ICON_LIBRARY], currentLibrarySummary);
  setSettingsTab(activeSettingsTab);
  renderStateOptions();
  await loadConfig();
  await loadLibraryStatus().catch(() => {});
  updateOnboardingView();
  if (hasSavedConfig) {
    loadContainers().catch((error) => showToast(error.message, 'error'));
  }
}

init().catch((error) => showToast(error.message, 'error'));
