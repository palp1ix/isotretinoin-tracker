const STORAGE_KEY = 'my-course-data-v1';

export function createDefaultData() {
  return {
    version: 1,
    settings: {
      weightKg: 62,
      targetMgPerKg: 126,
      targetMg: 7800,
      targetMode: 'manual',
      startDate: new Date().toLocaleDateString('sv-SE'),
      fatThreshold: 15,
      units: 'kg',
      alternating: false,
      labReminderWeeks: 12
    },
    doses: [],
    labs: [],
    lastBackupAt: null
  };
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `import-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sanitizeData(value) {
  if (!value || typeof value !== 'object') throw new Error('Файл не похож на резервную копию приложения.');
  const defaults = createDefaultData();
  const settings = { ...defaults.settings, ...(value.settings || {}) };
  const positiveOrDefault = (candidate, fallback) => Number.isFinite(Number(candidate)) && Number(candidate) >= 0 ? Number(candidate) : fallback;
  settings.weightKg = positiveOrDefault(settings.weightKg, 62);
  settings.targetMgPerKg = positiveOrDefault(settings.targetMgPerKg, 126);
  settings.targetMg = positiveOrDefault(settings.targetMg, 7800);
  settings.fatThreshold = positiveOrDefault(settings.fatThreshold, 15);
  settings.labReminderWeeks = Math.max(1, positiveOrDefault(settings.labReminderWeeks, 12));
  settings.targetMode = settings.targetMode === 'weight' ? 'weight' : 'manual';
  settings.alternating = Boolean(settings.alternating);
  settings.units = settings.units === 'lb' ? 'lb' : 'kg';
  const doses = Array.isArray(value.doses) ? value.doses.filter((item) => item && typeof item === 'object').map((item) => ({
    id: String(item.id || makeId()), timestamp: validTimestamp(item.timestamp),
    doseMg: positiveOrDefault(item.doseMg, 0), fatGrams: positiveOrDefault(item.fatGrams, 0),
    note: String(item.note || '').slice(0, 500)
  })).filter((item) => item.timestamp) : [];
  const labs = Array.isArray(value.labs) ? value.labs.filter((item) => item && typeof item === 'object').map((item) => {
    const attachment = item.attachment && typeof item.attachment === 'object' ? {
      id: String(item.attachment.id || makeId()),
      name: String(item.attachment.name || 'analiz.pdf').slice(0, 200),
      size: positiveOrDefault(item.attachment.size, 0),
      type: 'application/pdf',
      ...(typeof item.attachment.base64 === 'string' ? { base64: item.attachment.base64 } : {})
    } : null;
    return {
      id: String(item.id || makeId()), timestamp: validTimestamp(item.timestamp),
      type: ['Липиды', 'АЛТ/АСТ', 'Другое'].includes(item.type) ? item.type : 'Другое',
      values: String(item.values || '').slice(0, 1000), note: String(item.note || '').slice(0, 500),
      ...(attachment ? { attachment } : {})
    };
  }).filter((item) => item.timestamp) : [];
  return { version: 1, settings, doses, labs, lastBackupAt: validTimestamp(value.lastBackupAt) || null };
}

function validTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeData(JSON.parse(raw)) : createDefaultData();
  } catch (error) {
    console.error('Не удалось прочитать локальные данные:', error);
    return createDefaultData();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Не удалось сохранить данные:', error);
    return false;
  }
}

export function parseImport(text) {
  return sanitizeData(JSON.parse(text));
}
