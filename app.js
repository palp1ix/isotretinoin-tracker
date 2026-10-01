import { loadData, saveData, parseImport, createDefaultData } from './storage.js';
import { totalDose, dosesOnDate, milestoneCrossed, alternatingSuggestion, runCalculationTests } from './calculations.js';
import { renderApp, doseSheet, labSheet, animateProgress, showMilestone } from './ui.js';

let data = loadData();
let activeTab = 'today';
const view = document.getElementById('view');
const overlay = document.getElementById('overlay-root');
const toastNode = document.getElementById('toast');
let toastTimer;

function persist(message = '') {
  if (!saveData(data)) toast('Не удалось сохранить. Проверьте свободное место на устройстве.');
  else if (message) toast(message);
}

function refresh() {
  renderApp(view, data, activeTab);
  if (activeTab === 'today') animateProgress();
}

function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('visible'), 2600);
}

function haptic() {
  if (navigator.vibrate) navigator.vibrate(12);
}

function id() {
  return globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openDose(entry = null) {
  overlay.innerHTML = doseSheet(entry, data.settings, alternatingSuggestion(data.doses));
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => overlay.querySelector('.bottom-sheet')?.classList.add('visible'));
  updateFatWarning();
  overlay.querySelector('input[name="doseMg"]')?.focus({ preventScroll: true });
}

function openLab() {
  overlay.innerHTML = labSheet();
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => overlay.querySelector('.bottom-sheet')?.classList.add('visible'));
}

function closeSheet() {
  document.body.classList.remove('sheet-open');
  overlay.innerHTML = '';
}

function updateFatWarning() {
  const field = overlay.querySelector('[name="fatGrams"]');
  const warning = overlay.querySelector('#fat-warning');
  if (!field || !warning) return;
  const value = Number(field.value);
  warning.hidden = field.value === '' || !Number.isFinite(value) || value >= Number(data.settings.fatThreshold);
}

function finiteInput(form, name, { min = 0, required = true } = {}) {
  const field = form.elements.namedItem(name);
  const value = Number(field.value);
  if ((required && field.value.trim() === '') || !Number.isFinite(value) || value < min) {
    field.focus();
    field.setCustomValidity(`Введите число не меньше ${min}.`);
    field.reportValidity();
    field.addEventListener('input', () => field.setCustomValidity(''), { once: true });
    return null;
  }
  return value;
}

function saveDose(form) {
  if (!form.reportValidity()) return;
  const doseMg = finiteInput(form, 'doseMg', { min: 0.1 });
  const fatGrams = finiteInput(form, 'fatGrams', { min: 0 });
  if (doseMg === null || fatGrams === null) return;
  const timestamp = new Date(form.elements.namedItem('timestamp').value);
  if (!Number.isFinite(timestamp.getTime())) {
    form.elements.namedItem('timestamp').focus();
    return;
  }
  const editing = form.dataset.editing === 'true';
  const oldTotal = totalDose(data.doses);
  const candidate = {
    id: form.dataset.id || id(), timestamp: timestamp.toISOString(), doseMg, fatGrams,
    note: form.elements.namedItem('note').value.trim().slice(0, 500)
  };
  const duplicate = dosesOnDate(data.doses.filter((item) => item.id !== candidate.id), timestamp).length > 0;
  if (duplicate && !window.confirm('На эту дату уже есть приём. Всё равно сохранить ещё одну запись?')) return;
  if (editing) data.doses = data.doses.map((item) => item.id === candidate.id ? candidate : item);
  else data.doses.push(candidate);
  data.doses.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const mark = milestoneCrossed(oldTotal, totalDose(data.doses), Number(data.settings.targetMg));
  persist(editing ? 'Изменения сохранены' : 'Приём записан');
  haptic();
  closeSheet();
  refresh();
  if (mark) {
    setTimeout(() => {
      overlay.innerHTML = showMilestone(mark);
      document.body.classList.add('sheet-open');
      requestAnimationFrame(() => overlay.querySelector('.bottom-sheet')?.classList.add('visible'));
      haptic();
    }, 250);
  }
}

function saveLab(form) {
  if (!form.reportValidity()) return;
  const date = form.elements.namedItem('date').value;
  if (!date) return;
  const timestamp = new Date(`${date}T12:00:00`).toISOString();
  data.labs.push({ id: id(), timestamp, type: form.elements.namedItem('type').value, values: form.elements.namedItem('values').value.trim(), note: form.elements.namedItem('note').value.trim() });
  data.labs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  persist('Анализ сохранён');
  closeSheet();
  refresh();
}

function saveSettings(form) {
  if (!form.reportValidity()) return;
  const displayedWeight = finiteInput(form, 'weightKg', { min: 0.1 });
  const units = form.elements.namedItem('units').value;
  const weightKg = displayedWeight === null ? null : (units === 'lb' ? displayedWeight / 2.20462 : displayedWeight);
  const targetMgPerKg = finiteInput(form, 'targetMgPerKg', { min: 1 });
  const fatThreshold = finiteInput(form, 'fatThreshold', { min: 0 });
  const labReminderWeeks = finiteInput(form, 'labReminderWeeks', { min: 1 });
  const mode = form.elements.namedItem('targetMode').value;
  const manualTarget = finiteInput(form, 'targetMg', { min: 1 });
  if ([weightKg, targetMgPerKg, fatThreshold, labReminderWeeks, manualTarget].some((value) => value === null)) return;
  data.settings = {
    ...data.settings, weightKg, targetMgPerKg, targetMode: mode,
    targetMg: mode === 'weight' ? Math.round(weightKg * targetMgPerKg) : manualTarget,
    startDate: form.elements.namedItem('startDate').value || data.settings.startDate,
    fatThreshold, labReminderWeeks, alternating: form.elements.namedItem('alternating').checked,
    units
  };
  persist('Настройки сохранены');
  refresh();
}

async function exportData() {
  const exported = { ...data, lastBackupAt: new Date().toISOString() };
  data.lastBackupAt = exported.lastBackupAt;
  persist();
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
  const file = new File([blob], `moj-kurs-backup-${new Date().toLocaleDateString('sv-SE')}.json`, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ title: 'Резервная копия — Мой курс', files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
      toast('Резервная копия скачана');
    }
  } catch (error) {
    if (error.name !== 'AbortError') toast('Не удалось поделиться файлом. Попробуйте экспорт ещё раз.');
  }
  refresh();
}

function importFile() {
  const input = document.getElementById('import-file');
  input.value = '';
  input.click();
}

async function handleImport(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const imported = parseImport(await file.text());
    if (!window.confirm(`В файле ${imported.doses.length} приёмов и ${imported.labs.length} анализов. Заменить текущие данные?`)) return;
    data = imported;
    persist('Данные импортированы');
    refresh();
  } catch (error) {
    console.error(error);
    window.alert(error.message || 'Не удалось прочитать JSON-файл.');
  }
}

function clearAll() {
  if (!window.confirm('Удалить все записи, анализы и настройки? Это действие нельзя отменить.')) return;
  if (!window.confirm('Последнее подтверждение: данные будут удалены без возможности восстановления. Продолжить?')) return;
  data = createDefaultData();
  persist('Все данные удалены');
  activeTab = 'today';
  refresh();
}

document.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) {
    activeTab = tab.dataset.tab;
    haptic();
    refresh();
    return;
  }
  const chip = event.target.closest('[data-chip]');
  if (chip) {
    const form = chip.closest('form');
    const name = chip.dataset.chip === 'dose' ? 'doseMg' : 'fatGrams';
    form.elements.namedItem(name).value = chip.dataset.value;
    chip.parentElement.querySelectorAll('.chip').forEach((item) => item.classList.toggle('selected', item === chip));
    if (name === 'fatGrams') updateFatWarning();
    haptic();
    return;
  }
  const actionNode = event.target.closest('[data-action]');
  if (!actionNode) return;
  const action = actionNode.dataset.action;
  if (action === 'dismiss-install') {
    try { localStorage.setItem('install-tip-dismissed', '1'); } catch { /* dismissal is optional */ }
    actionNode.remove();
    actionNode.closest('.install-tip')?.remove();
  } else if (action === 'open-dose') openDose();
  else if (action === 'edit-dose') {
    const entry = data.doses.find((item) => item.id === actionNode.dataset.id);
    if (entry) openDose(entry);
  } else if (action === 'open-lab') openLab();
  else if (action === 'close-sheet' && (actionNode === event.target || actionNode.tagName === 'BUTTON')) closeSheet();
  else if (action === 'delete-lab') {
    if (window.confirm('Удалить эту запись анализа?')) {
      data.labs = data.labs.filter((lab) => lab.id !== actionNode.dataset.id);
      persist('Запись удалена'); refresh();
    }
  } else if (action === 'export') exportData();
  else if (action === 'import') importFile();
  else if (action === 'clear-data') clearAll();
  else if (action === 'delete-dose') {
    if (window.confirm('Удалить этот приём?')) {
      data.doses = data.doses.filter((item) => item.id !== actionNode.closest('.swipe-row').dataset.id);
      persist('Приём удалён'); refresh();
    }
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'dose-form') { event.preventDefault(); saveDose(event.target); }
  if (event.target.id === 'lab-form') { event.preventDefault(); saveLab(event.target); }
  if (event.target.id === 'settings-form') { event.preventDefault(); saveSettings(event.target); }
});

document.addEventListener('input', (event) => {
  if (event.target.name === 'fatGrams') updateFatWarning();
  if (event.target.name === 'weightKg' || event.target.name === 'targetMgPerKg') {
    const form = event.target.form;
    const mode = form.elements.namedItem('targetMode').value;
    const weight = Number(form.elements.namedItem('weightKg').value);
    const weightKg = form.elements.namedItem('units').value === 'lb' ? weight / 2.20462 : weight;
    if (mode === 'weight') form.elements.namedItem('targetMg').value = Math.round(weightKg * Number(form.elements.namedItem('targetMgPerKg').value)) || '';
  }
});

document.addEventListener('change', (event) => {
  if (event.target.name === 'units') {
    const form = event.target.form;
    const weightField = form.elements.namedItem('weightKg');
    const previousUnits = event.target.dataset.previous || (event.target.value === 'lb' ? 'kg' : 'lb');
    const weight = Number(weightField.value);
    weightField.value = (event.target.value === 'lb' && previousUnits === 'kg' ? weight * 2.20462 : event.target.value === 'kg' && previousUnits === 'lb' ? weight / 2.20462 : weight).toFixed(1);
    event.target.dataset.previous = event.target.value;
    weightField.closest('.field').querySelector('span').textContent = `Вес, ${event.target.value === 'lb' ? 'фунты' : 'кг'}`;
  }
  if (event.target.name === 'targetMode' && event.target.value === 'weight' || event.target.name === 'units') {
    const form = event.target.form;
    const weight = Number(form.elements.namedItem('weightKg').value);
    const weightKg = form.elements.namedItem('units').value === 'lb' ? weight / 2.20462 : weight;
    if (form.elements.namedItem('targetMode').value === 'weight') form.elements.namedItem('targetMg').value = Math.round(weightKg * Number(form.elements.namedItem('targetMgPerKg').value)) || '';
  }
  if (event.target.id === 'import-file') handleImport(event.target);
});

let touchStartX = 0;
let touchStartY = 0;
document.addEventListener('touchstart', (event) => {
  const row = event.target.closest('.swipe-row');
  if (!row) return;
  touchStartX = event.changedTouches[0].clientX;
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', (event) => {
  const row = event.target.closest('.swipe-row');
  if (!row) return;
  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;
  if (dx < -45 && Math.abs(dx) > Math.abs(dy)) row.classList.add('revealed');
  else if (dx > 45 && Math.abs(dx) > Math.abs(dy)) row.classList.remove('revealed');
}, { passive: true });

// First visit: cache the static shell for offline use. No network calls beyond same-origin app files.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker не зарегистрирован:', error)));
}

runCalculationTests();
refresh();
