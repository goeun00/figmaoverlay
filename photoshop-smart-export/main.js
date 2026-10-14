'use strict';
const { app, action, core } = require('photoshop');
const { storage, entrypoints, shell } = require('uxp');
entrypoints.setup({ panels: { 'smart-export-panel': { show() {}, hide() {} } } });
const fs = storage.localFileSystem;
const { types } = storage;
const folderEl = document.getElementById('folder');
const buttons = Array.from(document.querySelectorAll('.export-btn'));
const openFolderButton = document.getElementById('open-folder');
let lastFolder = '';
let seededDocId = null;
let lastSuggestedFolder = '';
let exporting = false;
let unsavedFolder = null;
const UNSAVED_TOKEN_KEY = 'smart-export:last-unsaved-folder-token';
const UNSAVED_PATH_KEY = 'smart-export:last-unsaved-folder-path';
function readDocumentPath(doc) {
  try {
    return String((doc && doc.path) || '');
  } catch (_) {
    return '';
  }
}
function isUnsavedDocument(doc) {
  if (!doc) return false;
  return !/\.(psd|psb|png|jpe?g)$/i.test(readDocumentPath(doc));
}
function suggestedUnsavedPath() {
  if (unsavedFolder && unsavedFolder.nativePath) return unsavedFolder.nativePath;
  try {
    return localStorage.getItem(UNSAVED_PATH_KEY) || '';
  } catch (_) {
    return '';
  }
}
async function rememberUnsavedFolder(folder) {
  unsavedFolder = folder;
  try {
    const token = await fs.createPersistentToken(folder);
    localStorage.setItem(UNSAVED_TOKEN_KEY, token);
    localStorage.setItem(UNSAVED_PATH_KEY, folder.nativePath);
  } catch (err) {


  }
}
async function restoreUnsavedFolder() {
  try {
    const token = localStorage.getItem(UNSAVED_TOKEN_KEY);
    if (token) {
      const entry = await fs.getEntryForPersistentToken(token);
      if (entry && entry.isFolder) unsavedFolder = entry;
    }
  } catch (err) {


  }
  scheduleRefresh();
}
async function chooseUnsavedFolder() {
  const entry = await fs.getFolder();
  if (!entry) return null;
  await rememberUnsavedFolder(entry);
  updateFolderValue();
  return entry;
}

let selectionSignature = '';
function documentInfo(doc) {
  if (!doc) return { docId: null, isPsd: false, suggestion: '' };
  // A document's file path may be temporarily unavailable during a switch.
  // Its name remains suitable for both the UI label and document type.
  const name = String(doc.name || '');
  const extension = (name.match(/\.([^.]+)$/) || [])[1] || '';
  return { docId: doc.id, isPsd: /^(psd|psb)$/i.test(extension), suggestion: name.replace(/\.[^.]+$/, '') };
}
function clearExportResult() {
  lastFolder = '';
  if (statusEl) statusEl.textContent = '';
  if (stateEl) stateEl.className = 'feedback';
  if (logEl) logEl.hidden = true;
  if (detailsEl) {
    detailsEl.hidden = true;
    detailsEl.textContent = '';
  }
}
function updateFolderValue() {
  const doc = app.activeDocument;
  const info = documentInfo(doc);
  const field = document.getElementById('folder-section');
  const unsaved = isUnsavedDocument(doc);
  if (field) field.hidden = !!doc && !unsaved && !info.isPsd;
  if (seededDocId !== info.docId) {
    seededDocId = info.docId;
    lastSuggestedFolder = info.suggestion;
    clearExportResult();
    selectionSignature = '';
  }
  if (unsaved) {
    folderEl.readOnly = true;
    folderEl.value = suggestedUnsavedPath();
    folderEl.placeholder = '폴더 아이콘을 눌러 위치 선택';
    openFolderButton.setAttribute('aria-label', '내보낼 위치 선택');
    openFolderButton.setAttribute('title', '내보낼 위치 선택');
  } else {
    folderEl.readOnly = false;
    if (folderEl.dataset.docId !== String(info.docId)) folderEl.value = info.suggestion;
    folderEl.placeholder = info.docId ? '폴더 이름' : '문서를 열어주세요';
    openFolderButton.setAttribute('aria-label', '저장 폴더 열기');
    openFolderButton.setAttribute('title', '저장 폴더 열기');
  }
  folderEl.dataset.docId = String(info.docId);
}
const stateEl = document.getElementById('feedback');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const detailsEl = document.getElementById('details');
function setStatus(message, mode = '') {
  statusEl.textContent = message;
  stateEl.className = mode;
}
function safeStem(name) {
  let s = String(name || '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!s || s === '.' || s === '..') s = 'layer';
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(s)) s = '_' + s;
  return s.slice(0, 160).replace(/[. ]+$/g, '') || 'layer';
}
function outputNames(items, format) {
  const stems = items.map((x) => safeStem(x.name));
  const key = (s) => s.normalize('NFC').toLowerCase();
  const reserved = new Set(stems.map(key));
  const used = new Set();
  return stems.map((stem) => {
    let value = stem;
    if (used.has(key(value))) {
      let n = 2;
      do {
        const suf = '_' + String(n++).padStart(2, '0');
        value = stem.slice(0, 160 - suf.length) + suf;
      } while (used.has(key(value)) || reserved.has(key(value)));
    }
    used.add(key(value));
    return `${value}.${format}`;
  });
}
// Photoshop layer stack is listed top-to-bottom; reverse it for bottom-to-top numbering.
// Read the document hierarchy rather than relying on activeLayers selection order.
function selectedBottomToTop(doc) {
  // The selected group is an atomic export item. NEVER enqueue its descendants,
  // even when Photoshop exposes the group's children in activeLayers.
  const selected = Array.from(doc.activeLayers || []);
  const byId = new Map(selected.map((layer) => [layer.id, { id: layer.id, name: layer.name }]));
  const ordered = [];
  const visited = new Set();
  function walk(collection, insideSelectedGroup) {
    for (const layer of Array.from(collection || [])) {
      const selectedHere = byId.has(layer.id);
      if (selectedHere && !insideSelectedGroup) {
        ordered.push(byId.get(layer.id));
      }
      visited.add(layer.id);
      // All descendants of selected groups are part of that group's ONE image.
      // Traverse only for checking selection ancestry; do not add them as outputs.
      if (layer.layers) walk(layer.layers, insideSelectedGroup || selectedHere);
    }
  }
  walk(doc.layers, false);
  // Fallback for selected layers not exposed in the document tree.
  for (const layer of selected) {
    if (!visited.has(layer.id)) ordered.push(byId.get(layer.id));
  }
  return ordered.reverse();
}
const useLayerNameEl = document.getElementById('use-layer-name');
const prefixFieldEl = document.getElementById('prefix-field');
const prefixEl = document.getElementById('prefix');
const jpgQualityEl = document.getElementById('jpg-quality');
const pngDepthEl = document.getElementById('png-depth');
const previewToggle = document.getElementById('preview-toggle');
const previewList = document.getElementById('preview-list');
const previewCount = document.getElementById('preview-count');
const previewArrow = document.getElementById('preview-arrow');
let previewOpen = false;
function generatedNames(items, format) {
  if (useLayerNameEl.checked) return outputNames(items, format);
  const prefix = prefixEl.value.trim();
  if (!prefix) throw new Error('파일명 접두사를 입력해 주세요.');
  if (safeStem(prefix) !== prefix || /[. ]$/.test(prefix)) throw new Error('접두사에 사용할 수 없는 문자가 있어요.');
  return items.map((_, i) => `${safeStem(prefix + String(i + 1).padStart(2, '0'))}.${format}`);
}
function renderPreview() {
  prefixFieldEl.hidden = useLayerNameEl.checked;
  const doc = app.activeDocument;
  const items = doc ? selectedBottomToTop(doc) : [];
  previewCount.textContent = `${items.length}개`;
  previewList.hidden = !previewOpen;
  previewToggle.setAttribute('aria-expanded', String(previewOpen));
  previewArrow.setAttribute('name', previewOpen ? 'ui:ChevronUpSmall' : 'ui:ChevronDownSmall');
  previewList.textContent = '';
  if (!previewOpen) return;
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'preview-empty';
    empty.textContent = '레이어 또는 그룹을 선택해 주세요.';
    previewList.appendChild(empty);
    return;
  }
  let names;
  try {
    names = generatedNames(items, 'png');
  } catch (e) {
    const error = document.createElement('div');
    error.className = 'preview-empty';
    error.textContent = e.message;
    previewList.appendChild(error);
    return;
  }
  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'preview-row';
    const from = document.createElement('span');
    from.className = 'preview-source';
    from.textContent = item.name;
    const to = document.createElement('span');
    to.className = 'preview-target';
    to.textContent = names[i].replace(/\.(png|jpe?g)$/i, '');
    row.appendChild(from);
    row.appendChild(to);
    previewList.appendChild(row);
  });
}
useLayerNameEl.addEventListener('change', renderPreview);
prefixEl.addEventListener('input', renderPreview);
previewToggle.addEventListener('click', () => {
  previewOpen = !previewOpen;
  renderPreview();
});
previewToggle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    previewOpen = !previewOpen;
    renderPreview();
  }
});
function currentSelectionSignature() {
  const doc = app.activeDocument;
  if (!doc) return 'none';
  const ids = Array.from(doc.activeLayers || [], (layer) => layer.id + ':' + layer.name);
  return `${doc.id}|${ids.join('|')}`;
}
function refreshFromPhotoshop(force = false) {
  if (exporting) return;
  const beforeId = seededDocId;
  updateFolderValue();
  const current = currentSelectionSignature();
  if (force || current !== selectionSignature || beforeId !== seededDocId) {
    selectionSignature = current;
    // Closed preview only updates its count: avoid expensive hierarchy traversal.
    if (!previewOpen) {
      const doc = app.activeDocument;
      previewCount.textContent = `${doc ? Array.from(doc.activeLayers || []).length : 0}개`;
    } else renderPreview();
  }
}
let refreshTimer = null;
function scheduleRefresh() {
  if (exporting || refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    try {
      refreshFromPhotoshop();
    } catch (e) {


    }
  }, 120);
}
// Live updates for document switches and layer/group selection changes.
// Keep UI event registration independent from Photoshop notification initialization.
function initializeDocumentWatching() {
  try {
    Promise.resolve(action.addNotificationListener(['select', 'open', 'close', 'make', 'delete'], () => scheduleRefresh())).catch((e) =>
      console.warn('[Smart Export] Notification listener unavailable', e)
    );
  } catch (e) {


  }
  try {
    document.addEventListener('focus', scheduleRefresh, true);
  } catch (e) {


  }
  try {
    setInterval(() => {
      if (!exporting) scheduleRefresh();
    }, 1200);
  } catch (e) {


  }
  try {
    refreshFromPhotoshop(true);
  } catch (e) {


  }
}
async function sourceFolder(doc) {
  if (doc.cloudDocument) throw new Error('클라우드 문서는 지원하지 않아요. 로컬 디스크에 저장해 주세요.');
  // Retry a few times: doc.path can lag behind active-document changes.
  let p = '';
  for (let i = 0; i < 5; i++) {
    if (!app.activeDocument || app.activeDocument.id !== doc.id) {
      throw new Error('내보내기 중 활성 문서가 변경됐어요. 다시 시도해 주세요.');
    }
    p = String(doc.path || '');
    if (/\.(psd|psb|png|jpe?g)$/i.test(p)) break;
    if (p && /\.[^\/\\]+$/.test(p)) {
      throw new Error('PSD, PSB, PNG, JPG 문서에서만 사용할 수 있어요.');
    }
    if (i < 4) await new Promise((resolve) => setTimeout(resolve, 180));
  }
  if (!/\.(psd|psb|png|jpe?g)$/i.test(p)) {
    throw new Error('현재 문서의 저장 경로를 읽지 못했어요. 문서를 저장한 후 다시 시도해 주세요.');
  }
  const index = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  if (index < 0) throw new Error('문서 경로를 찾을 수 없어요.');
  return { directory: p.slice(0, index + 1), isPsd: /\.(psd|psb)$/i.test(p) };
}
function fsUrl(path) {
  const p = String(path).replace(/\\/g, '/');
  return 'file:/' + p.replace(/^\/+/, '');
}
function layerSelect(id, add = false) {
  const d = { _obj: 'select', _target: [{ _ref: 'layer', _id: id }], makeVisible: false, _options: { dialogOptions: 'dontDisplay' } };
  if (add) d.selectionModifier = { _enum: 'selectionModifierType', _value: 'addToSelection' };
  return d;
}
async function restoreSelection(items) {
  if (!items.length) return;
  await action.batchPlay(
    items.map((x, i) => layerSelect(x.id, i > 0)),
    { synchronousExecution: false }
  );
}
function exportDescriptor(format, destFolder) {
  return {
    _obj: 'exportSelectionAsFileTypePressed',
    _target: { _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' },
    fileType: format,
    quality: format === 'png' ? 32 : Number(jpgQualityEl.value || 80),
    metadata: 0,
    destFolder,
    sRGB: true,
    openWindow: false,
    _options: { dialogOptions: 'dontDisplay' }
  };
}
// Validate actual PNG pixel format, not merely the batchPlay return value.
// PNG IHDR: byte 24 is bit depth, byte 25 is color type.
// Indexed-color (3, 8 bits/pixel) => PNG-8; truecolor (2, 24 bits/pixel) => PNG-24.
// RGBA (6) is PNG-32 and should never be silently mislabeled PNG-24.
async function inspectPngBitDepth(file) {
  const data = await file.read({ format: storage.formats.binary });
  const bytes = new Uint8Array(data);
  if (bytes.length < 26 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) {
    throw new Error('생성된 파일이 올바른 PNG가 아니에요.');
  }
  const depth = bytes[24];
  const type = bytes[25];
  if (type === 3 && depth === 8) return 8;
  if (type === 2 && depth === 8) return 24;
  if (type === 6 && depth === 8) return 32;
  return null;
}

async function createdImage(folder, ext) {
  // Some Photoshop builds complete export after the batchPlay promise resolves.
  for (let i = 0; i < 9; i++) {
    const entries = (await folder.getEntries()).filter((x) => x.isFile && (ext === 'jpg' ? /\.jpe?g$/i : /\.png$/i).test(x.name));
    if (entries.length === 1) {
      const meta = await entries[0].getMetadata();
      if (meta && meta.size > 0) return entries[0];
    }
    if (entries.length > 1) throw new Error('예상보다 많은 출력 파일이 생성됐어요.');
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return null;
}
async function targetFolder(doc, requested) {
  if (isUnsavedDocument(doc)) {
    // A newly created unsaved document has no source directory.
    // Never create a PSD-named subfolder for this mode.
    let chosen = unsavedFolder;
    if (!chosen || !chosen.isFolder) chosen = await chooseUnsavedFolder();
    if (!chosen) throw new Error('내보낼 폴더를 선택해 주세요.');
    await verifyWritable(chosen);
    return chosen;
  }
  const source = await sourceFolder(doc);
  const sourceDir = source.directory;
  const isPsd = source.isPsd;
  let folder;
  if (!isPsd) {
    // JPEG/PNG documents always export directly alongside the source file.
    folder = await fs.getEntryWithUrl(fsUrl(sourceDir));
  } else {
    const name = requested || doc.name.replace(/\.(psd|psb)$/i, '');
    if (!name || name === '.' || name === '..' || /[\\/:*?"<>|\x00-\x1f]/.test(name) || /[. ]$/.test(name)) throw new Error('저장 폴더 이름에 사용할 수 없는 문자가 있어요.');
    const path = sourceDir + name;
    try {
      folder = await fs.getEntryWithUrl(fsUrl(path));
    } catch (err) {
      if (!/not.?found|does not exist|enoent|could not find/i.test(String(err))) throw err;
      folder = await fs.createEntryWithUrl(fsUrl(path), { type: types.folder });
    }
  }
  if (!folder.isFolder) throw new Error('저장 위치가 폴더가 아니에요.');
  await verifyWritable(folder);
  return folder;
}
async function verifyWritable(folder) {
  const probe = await folder.createFile(`.smart-export-${Date.now()}.tmp`, { overwrite: false });
  try {
    await probe.write('ok');
  } finally {
    await probe.delete();
  }
}
async function runExport(format) {
  const doc = app.activeDocument;
  if (!doc) throw new Error('열린 문서가 없어요.');
  const items = selectedBottomToTop(doc);
  if (!items.length) throw new Error('레이어나 그룹을 선택해 주세요.');
  const names = generatedNames(items, format);
  const folder = await targetFolder(doc, folderEl.value.trim());
  const existing = new Map((await folder.getEntries()).map((x) => [x.name.normalize('NFC').toLowerCase(), x]));
  // Same-name PNG/JPG outputs are permitted and overwrite the source file on export.
  for (const name of names) {
    const old = existing.get(name.normalize('NFC').toLowerCase());
    if (old && (!old.isFile || old.name !== name)) throw new Error(`기존 항목과 이름이 충돌해요: ${name}`);
  }
  const root = await fs.getTemporaryFolder();
  const stage = await root.createFolder(`smart-export-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
  const prepared = [],
    failures = [];
  let doneRestore = false;
  try {
    await core.executeAsModal(
      async (ctx) => {
        try {
          for (let i = 0; i < items.length; i++) {
            if (ctx.isCancelled) {
              failures.push('사용자가 내보내기를 취소했어요.');
              break;
            }
            const item = items[i];
            ctx.reportProgress({ value: i / items.length, commandName: `${i + 1}/${items.length} ${item.name}` });
            setStatus(`내보내는 중 ${i + 1}/${items.length} · ${item.name}`);
            try {
              const sub = await stage.createFolder(`item-${i}`);
              // Use the proven Quick Export sequence: select layer/group, then targetEnum export.
              // Session tokens are not used for destFolder: the command expects a native path.
              // Two separate calls guarantee that Quick Export sees just the
              // selected parent group, not the previous multi-selection.
              const selectionResult = await action.batchPlay([layerSelect(item.id)], { synchronousExecution: false, modalBehavior: 'execute' });
              if (selectionResult.some((r) => r && r._obj === 'error')) throw new Error(`그룹 단독 선택 실패: ${JSON.stringify(selectionResult)}`);
              const exportResult = await action.batchPlay([exportDescriptor(format, sub.nativePath)], { synchronousExecution: false, modalBehavior: 'execute' });
              if (exportResult.some((r) => r && r._obj === 'error')) throw new Error(`빠른 내보내기 실패: ${JSON.stringify(exportResult)}`);
              const file = await createdImage(sub, format);
              if (!file) throw new Error('Photoshop 빠른 내보내기에서 파일이 생성되지 않았어요.');
              if (format === 'png') {
                const requested = Number(pngDepthEl.value || 24);
                const actual = await inspectPngBitDepth(file);
                if (actual !== requested) {
                  throw new Error('선택한 PNG 형식으로 저장하지 못했어요.');
                }
              }
              prepared.push({ file, name: names[i], source: item.name });
            } catch (e) {
              failures.push(`${item.name}: 내보내기 실패`);


            }
          }
        } finally {
          await restoreSelection(items);
          doneRestore = true;
        }
      },
      { commandName: 'Smart Export Quick Export', interactive: false }
    );
    let saved = 0,
      replaced = 0;
    for (const item of prepared) {
      try {
        await item.file.moveTo(folder, { overwrite: true, newName: item.name });
        saved++;
        if (existing.has(item.name.normalize('NFC').toLowerCase())) replaced++;
      } catch (e) {
        failures.push(`${item.source}: 저장 실패`);
      }
    }
    return { saved, replaced, count: items.length, folder: folder.nativePath, failures };
  } finally {
    if (!doneRestore) {
      try {
        await core.executeAsModal(() => restoreSelection(items), { commandName: 'Restore Selection' });
      } catch (e) {


      }
    }
    try {
      for (const sub of await stage.getEntries()) {
        if (sub.isFolder)
          for (const file of await sub.getEntries())
            try {
              await file.delete();
            } catch (_) {}
        try {
          await sub.delete();
        } catch (_) {}
      }
      await stage.delete();
    } catch (e) {


    }
  }
}
async function handleExport(format) {
  const startingDocId = app.activeDocument ? app.activeDocument.id : null;
  exporting = true;
  for (const b of buttons) {
    b.dataset.disabled = 'true';
    b.setAttribute('aria-disabled', 'true');
  }
  lastFolder = '';
  renderPreview();
  logEl.hidden = true;
  detailsEl.textContent = '';
  detailsEl.hidden = true;
  setStatus('내보내는 중…');
  try {
    const r = await runExport(format);
    if ((app.activeDocument ? app.activeDocument.id : null) !== startingDocId) return;
    setStatus(
      `${r.saved}/${r.count}개 저장${r.replaced ? ` · ${r.replaced}개 덮어쓰기` : ''}${r.failures.length ? ` · ${r.failures.length}개 실패` : ''}`,
      r.failures.length ? 'error' : 'ok'
    );
    if (r.saved > 0) lastFolder = r.folder;

  } catch (err) {
    if ((app.activeDocument ? app.activeDocument.id : null) === startingDocId) setStatus('내보내기에 실패했어요.', 'error');


  } finally {
    exporting = false;
    for (const b of buttons) {
      b.dataset.disabled = 'false';
      b.setAttribute('aria-disabled', 'false');
    }
    scheduleRefresh();
  }
}
function bindActivation(el, fn) {
  el.addEventListener('click', () => {
    if (el.dataset.disabled !== 'true') fn();
  });
  el.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && el.dataset.disabled !== 'true') {
      event.preventDefault();
      fn();
    }
  });
}
for (const b of buttons) bindActivation(b, () => handleExport(b.dataset.format));
bindActivation(openFolderButton, async () => {
  try {
    const doc = app.activeDocument;
    if (!doc) throw new Error('열린 문서가 없어요.');
    if (isUnsavedDocument(doc)) {
      const chosen = await chooseUnsavedFolder();
      if (chosen) setStatus('내보낼 위치를 선택했어요.');
      return;
    }
    const source = await sourceFolder(doc);
    // A saved PNG/JPG exports next to the source. A PSD exports to its named folder.
    let path = source.directory;
    if (source.isPsd) {
      const name = folderEl.value.trim() || doc.name.replace(/\.(psd|psb)$/i, '');
      if (!name || name === '.' || name === '..' || /[\\/:*?"<>|\x00-\x1f]/.test(name) || /[. ]$/.test(name)) {
        throw new Error('저장 폴더 이름을 확인해 주세요.');
      }
      const destination = source.directory + name;
      try {
        const entry = await fs.getEntryWithUrl(fsUrl(destination));
        if (!entry.isFolder) throw new Error('대상 위치에 같은 이름의 파일이 있어요.');
        path = entry.nativePath;
      } catch (err) {
        if (!/not.?found|does not exist|enoent|could not find/i.test(String(err))) throw err;
        // No output folder yet: open the parent location, without making an empty folder.
      }
    }
    const error = await shell.openPath(path, 'Smart Export에서 저장 폴더를 열려고 합니다.');
    if (error) throw new Error(error);
  } catch (err) {
    setStatus(`폴더를 열지 못했어요: ${err.message || err}`, 'error');
  }
});

// Bind export controls before any document watchers can fail.
initializeDocumentWatching();

// Restore last chosen export directory without blocking export button wiring.
restoreUnsavedFolder().catch((err) => console.warn('[Smart Export] Folder restore failed', err));
