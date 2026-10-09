import { totalDose, averageDailyDose, projectedEndDate, progressPercent, dosesOnDate, doseDate, alternatingSuggestion, supplyForecast, supplyStockMg } from './calculations.js';

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fmt = (value, digits = 0) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
const dateLabel = (date, options = { day: 'numeric', month: 'long', year: 'numeric' }) => new Intl.DateTimeFormat('ru-RU', options).format(date);
const dateTimeLocal = (value) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function updateChrome(tab) {
  document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  document.getElementById('top-date').textContent = dateLabel(new Date(), { weekday: 'short', day: 'numeric', month: 'short' });
}

export function renderApp(root, data, tab) {
  updateChrome(tab);
  const renderers = { today: renderToday, history: renderHistory, labs: renderLabs, settings: renderSettings };
  root.innerHTML = `<section class="screen screen-enter">${(renderers[tab] || renderToday)(data)}</section>`;
}

function renderToday(data) {
  const { doses, settings } = data;
  const target = Number(settings.targetMg) || 0;
  const total = totalDose(doses);
  const percent = progressPercent(doses, target);
  const remaining = Math.max(0, target - total);
  const average = averageDailyDose(doses, 14);
  const projected = projectedEndDate(doses, target);
  const circumference = 2 * Math.PI * 88;
  const offset = circumference * (1 - percent / 100);
  const supply = supplyForecast(doses, data.supply);
  const supplyCircumference = 2 * Math.PI * 76;
  const supplyLeftRatio = supply.stockMg > 0 ? Math.min(1, supply.leftMg / supply.stockMg) : 0;
  const supplyOffset = supplyCircumference * (1 - supplyLeftRatio);
  const todayDoses = dosesOnDate(doses);
  const suggestion = settings.alternating ? alternatingSuggestion(doses) : null;
  const installTip = isInstalled() ? '' : `<aside class="install-tip"><span>📲</span><span><strong>Добавьте приложение на экран «Домой»</strong><br>Нажмите «Поделиться» → «На экран Домой».</span><button class="icon-button tip-close" data-action="dismiss-install" aria-label="Скрыть подсказку">×</button></aside>`;
  return `${installTip}
    <div class="page-heading"><div><p class="eyebrow">ТВОЙ СПОКОЙНЫЙ РИТМ</p><h1>Сегодня</h1><p class="muted">${dateLabel(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><span class="heading-emoji">💊</span></div>
    <article class="progress-card card">
      <div class="progress-copy"><span class="eyebrow">НАКОПЛЕННАЯ ДОЗА</span><div class="big-number count-up" data-value="${total}" data-decimals="0">${fmt(total)}</div><div class="muted">из ${fmt(target)} мг · <strong>${fmt(percent, 1)}%</strong></div></div>
      <div class="ring-wrap"><svg class="progress-ring" viewBox="0 0 200 200" role="img" aria-label="Прогресс курса ${fmt(percent, 1)} процентов${supply.stockMg > 0 ? `, запас таблеток ${fmt(supplyLeftRatio * 100, 0)} процентов` : ``}"><defs><linearGradient id="progress-gradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f3b69f"/><stop offset="1" stop-color="#bca7e8"/></linearGradient></defs><circle class="ring-track" cx="100" cy="100" r="88"/><circle class="ring-value" cx="100" cy="100" r="88" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" data-offset="${offset}"/>${supply.stockMg > 0 ? `<circle class="ring-supply" cx="100" cy="100" r="76" stroke-dasharray="${supplyCircumference}" stroke-dashoffset="${supplyCircumference}" data-offset="${supplyOffset}"/>` : ''}<text x="100" y="98" class="ring-percent" text-anchor="middle">${fmt(percent, 0)}%</text><text x="100" y="120" class="ring-label" text-anchor="middle">цель</text></svg></div>
      <div class="progress-foot"><span>🎯 Осталось <strong class="count-up" data-value="${remaining}">${fmt(remaining)}</strong> мг</span><span>🌱 ${percent >= 100 ? 'Курс достиг цели' : 'Шаг за шагом'}</span></div>
    </article>
    <div class="stat-grid"><article class="stat-card"><span class="stat-icon">📊</span><span class="stat-label">Среднее за 14 дней</span><strong>${fmt(average, 1)} <small>мг/день</small></strong></article><article class="stat-card"><span class="stat-icon">🗓️</span><span class="stat-label">Прогноз завершения</span><strong class="stat-date">${projected ? dateLabel(projected, { day: 'numeric', month: 'short', year: 'numeric' }) : 'нужны записи'}</strong></article></div>
    ${supplyCard(supply, data)}
    ${settings.alternating ? `<div class="suggestion-banner">🔁 По схеме чередования сегодня можно ${suggestion} мг <span class="muted">— ориентир, не медицинское назначение</span></div>` : ''}
    <button class="primary-button log-button" data-action="open-dose">＋ Записать приём</button>
    <div class="today-note">${todayDoses.length ? `Сегодня записано приёмов: <strong>${todayDoses.length}</strong>` : 'Небольшая запись сегодня — полезная опора для истории.'}</div>
    <div class="backup-nudge">${backupMessage(data.lastBackupAt)}</div>`;
}

function supplyCard(supply, data) {
  if (!data.supply || supplyStockMg(data.supply) <= 0) {
    return `<article class="supply-card card supply-empty"><span class="stat-icon">📦</span><div><strong>Укажите запас таблеток</strong><p class="muted">Сколько пачек сейчас куплено — приложение покажет, на сколько дней их хватит и когда покупать новые. Настраивается в разделе «Настройки».</p></div></article>`;
  }
  const packsTotal = supply.stockMg / Math.max(1, data.supply.packSize * data.supply.tabletMg);
  const leftPacks = fmt(supply.packsLeft, 1);
  const when = supply.runOutDate ? dateLabel(supply.runOutDate, { day: 'numeric', month: 'long' }) : null;
  const status = supply.daysLeft === null
    ? 'Нужны записи приёмов для прогноза'
    : supply.leftMg <= 0 ? 'Таблетки закончились — купите новые' : `Хватит примерно на <strong>${fmt(supply.daysLeft)}</strong> ${plural(supply.daysLeft, ['день', 'дня', 'дней'])}${when ? ` · до ${when}` : ''}`;
  const buy = supply.packsToBuy > 0 ? `<div class="supply-buy">🛒 Совет: купите ещё <strong>${fmt(supply.packsToBuy)}</strong> ${plural(supply.packsToBuy, ['пачку', 'пачки', 'пачек'])} — запас на месяц вперёд</div>` : '';
  return `<article class="supply-card card"><div class="supply-head"><span class="stat-icon">📦</span><div><span class="stat-label">Запас таблеток</span><strong>${leftPacks} из ${fmt(packsTotal, 1)} пачек осталось</strong></div></div><p class="muted supply-status">${status}</p>${buy}</article>`;
}

function isInstalled() {
  try { return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('install-tip-dismissed') === '1'; } catch { return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; }
}

function backupMessage(lastBackupAt) {
  const due = !lastBackupAt || (Date.now() - Date.parse(lastBackupAt)) > 7 * 86400000;
  return due ? '💾 Давно не было резервной копии — загляните в настройки раз в неделю.' : '💾 Резервная копия сохранена недавно.';
}

function renderHistory(data) {
  const { doses } = data;
  if (!doses.length) return `<div class="page-heading"><div><p class="eyebrow">ТВОЙ ПУТЬ</p><h1>История</h1><p class="muted">Все записи курса в одном месте</p></div><span class="heading-emoji">🗓️</span></div><article class="empty-card card"><svg class="empty-illustration" viewBox="0 0 240 170" role="img" aria-label="Таблетка укрылась одеялом"><ellipse cx="120" cy="146" rx="77" ry="10" fill="currentColor" opacity=".08"/><path d="M62 105c0-24 26-42 58-42s58 18 58 42v32H62v-32Z" fill="#d9c9ef"/><path d="M62 111c18-18 35-18 58 0s40 18 58 0v31H62v-31Z" fill="#f1c1ad"/><g transform="rotate(-28 119 79)"><rect x="91" y="65" width="57" height="28" rx="14" fill="#fff"/><path d="M119 66v26" stroke="#d7c6e7" stroke-width="3"/><path d="M94 79a11 11 0 0 1 11-11h14v22h-14a11 11 0 0 1-11-11Z" fill="#fff0e9"/></g><path d="M76 67c4-15 17-23 31-22" fill="none" stroke="#b9a4d9" stroke-width="3" stroke-linecap="round"/><text x="158" y="54" font-size="20">z</text><text x="176" y="37" font-size="14">z</text></svg><h2>Пока тихо</h2><p class="muted">Первая запись появится здесь. Маленькие шаги тоже считаются.</p><button class="secondary-button" data-action="open-dose">＋ Записать первый приём</button></article>`;
  const points = chartPoints(doses);
  const grouped = groupByDay(doses);
  return `<div class="page-heading"><div><p class="eyebrow">ТВОЙ ПУТЬ</p><h1>История</h1><p class="muted">${doses.length} ${plural(doses.length, ['запись', 'записи', 'записей'])}</p></div><span class="heading-emoji">🗓️</span></div>
    <article class="chart-card card"><div class="section-title"><div><h2>📈 Динамика</h2><p class="muted">Доза за день и накопительный итог</p></div></div><div class="chart-legend"><span><i class="legend-dot dose-dot"></i> за день</span><span><i class="legend-dot total-dot"></i> накоплено</span></div><svg class="dose-chart" viewBox="0 0 360 170" role="img" aria-label="График доз по дням">${points.svg}</svg></article>
    <div class="section-heading"><h2>Записи по дням</h2><span class="muted">Свайп влево — удалить</span></div>
    <div class="history-list">${[...grouped.entries()].sort((a,b) => b[0].localeCompare(a[0])).map(([day, entries]) => `<section class="day-group"><div class="day-heading"><strong>${dateLabel(new Date(`${day}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' })}</strong><span>${fmt(entries.reduce((sum, item) => sum + item.doseMg, 0))} мг</span></div>${entries.sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map((entry) => `<article class="dose-row swipe-row" data-id="${esc(entry.id)}"><button class="swipe-delete" data-action="delete-dose" aria-label="Удалить приём">Удалить</button><button class="dose-row-main" data-action="edit-dose" data-id="${esc(entry.id)}"><span class="dose-pill">💊</span><span class="dose-description"><strong>${fmt(entry.doseMg)} мг</strong><small>🥑 ${fmt(entry.fatGrams)} г жира · ${new Date(entry.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}${entry.note ? ` · ${esc(entry.note)}` : ''}</small></span><span class="row-chevron">›</span></button></article>`).join('')}</section>`).join('')}</div>`;
}

function chartPoints(doses) {
  const byDay = groupByDay(doses);
  const days = [...byDay.keys()].sort().slice(-12);
  let running = totalDose(doses.filter((item) => !days.includes(doseDate(item))));
  const daily = days.map((day) => byDay.get(day).reduce((sum, item) => sum + item.doseMg, 0));
  const cumulative = daily.map((value) => (running += value));
  const maxDaily = Math.max(40, ...daily);
  const maxCum = Math.max(40, ...cumulative);
  const x = (index) => 24 + index * (312 / Math.max(days.length - 1, 1));
  const yd = (value) => 132 - value / maxDaily * 92;
  const yc = (value) => 132 - value / maxCum * 92;
  const circles = daily.map((value, i) => `<circle cx="${x(i)}" cy="${yd(value)}" r="4" class="daily-point"/>`).join('');
  const bars = daily.map((value, i) => `<rect x="${x(i)-7}" y="${yd(value)}" width="14" height="${132-yd(value)}" rx="7" class="daily-bar"/>`).join('');
  const line = cumulative.map((value, i) => `${i ? 'L' : 'M'}${x(i)} ${yc(value)}`).join(' ');
  const labels = days.map((day, i) => `<text x="${x(i)}" y="156" text-anchor="middle">${new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })}</text>`).join('');
  return { svg: `<line x1="18" y1="132" x2="342" y2="132" class="chart-axis"/><path d="${line}" class="cumulative-line"/><path d="${line}" class="cumulative-glow"/>${bars}${circles}${labels}` };
}

function groupByDay(doses) {
  const grouped = new Map();
  doses.forEach((dose) => {
    const key = doseDate(dose);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(dose);
  });
  return grouped;
}

function renderLabs(data) {
  const { labs, settings } = data;
  const latest = [...labs].sort((a,b) => b.timestamp.localeCompare(a.timestamp))[0];
  const weeks = latest ? (Date.now() - Date.parse(latest.timestamp)) / (7 * 86400000) : Infinity;
  const reminder = weeks >= Number(settings.labReminderWeeks) ? `<div class="reminder-banner">🧪 ${latest ? 'Давно не было анализов.' : 'Пока нет записей об анализах.'} Можно добавить результат или настроить интервал в настройках.</div>` : '';
  return `<div class="page-heading"><div><p class="eyebrow">ЗАБОТА О СЕБЕ</p><h1>Анализы</h1><p class="muted">Личный журнал результатов</p></div><span class="heading-emoji">🧪</span></div>${reminder}<button class="primary-button" data-action="open-lab">＋ Добавить анализ</button>
    ${labs.length ? `<div class="lab-list">${[...labs].sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map((lab) => `<article class="lab-card card"><div class="lab-card-top"><div><span class="lab-type">${esc(lab.type)}</span><h3>${dateLabel(new Date(lab.timestamp), { day: 'numeric', month: 'long', year: 'numeric' })}</h3></div><button class="icon-button" data-action="delete-lab" data-id="${esc(lab.id)}" aria-label="Удалить запись">×</button></div><p>${esc(lab.values) || 'Значения не указаны'}</p>${lab.note ? `<p class="muted">${esc(lab.note)}</p>` : ''}${lab.attachment ? `<button class="secondary-button pdf-link" data-action="open-lab-pdf" data-file-id="${esc(lab.attachment.id)}">📎 ${esc(lab.attachment.name)} · ${fmt(lab.attachment.size / 1024)} КБ</button>` : ''}</article>`).join('')}</div>` : `<article class="empty-inline card"><span>🧪</span><div><strong>Записей пока нет</strong><p class="muted">Здесь можно хранить результаты анализов локально.</p></div></article>`}`;
}

function renderSettings(data) {
  const { settings, lastBackupAt } = data;
  const supply = data.supply || { packs: 0, packSize: 30, tabletMg: 10 };
  return `<div class="page-heading"><div><p class="eyebrow">ПОД ТВОЙ КУРС</p><h1>Настройки</h1><p class="muted">Данные остаются только на этом устройстве</p></div><span class="heading-emoji">⚙️</span></div>
    <form id="settings-form" class="settings-form">
      <section class="settings-section card"><h2>🎯 Цель курса</h2><div class="form-grid"><label class="field"><span>Вес, ${settings.units === 'lb' ? 'фунты' : 'кг'}</span><input name="weightKg" inputmode="decimal" type="number" min="0.1" step="0.1" value="${esc(settings.units === 'lb' ? (settings.weightKg * 2.20462).toFixed(1) : settings.weightKg)}" required></label><label class="field"><span>Цель, мг/кг</span><input name="targetMgPerKg" inputmode="decimal" type="number" min="1" step="1" value="${esc(settings.targetMgPerKg)}" required></label></div><div class="target-mode"><label><input type="radio" name="targetMode" value="weight" ${settings.targetMode === 'weight' ? 'checked' : ''}> Рассчитывать по весу</label><label><input type="radio" name="targetMode" value="manual" ${settings.targetMode === 'manual' ? 'checked' : ''}> Задать вручную</label></div><label class="field"><span>Целевая доза, мг</span><input name="targetMg" inputmode="decimal" type="number" min="1" step="1" value="${esc(settings.targetMg)}" required></label><p class="formula-note">Формула: <strong>${fmt(settings.weightKg, 1)} кг × ${fmt(settings.targetMgPerKg)} мг/кг = ${fmt(settings.weightKg * settings.targetMgPerKg)} мг</strong>. ${settings.targetMode === 'manual' ? 'Сейчас используется введённая вручную цель.' : 'Цель пересчитывается автоматически по весу.'}</p><label class="field"><span>Дата старта курса</span><input name="startDate" type="date" value="${esc(settings.startDate)}"></label></section>
      <section class="settings-section card"><h2>💊 Приём, напоминания и запас таблеток</h2><div class="form-grid"><label class="field"><span>Порог жиров, г</span><input name="fatThreshold" inputmode="decimal" type="number" min="0" step="1" value="${esc(settings.fatThreshold)}"></label><label class="field"><span>Напоминать об анализах, недель</span><input name="labReminderWeeks" inputmode="numeric" type="number" min="1" step="1" value="${esc(settings.labReminderWeeks)}"></label></div><label class="toggle-row"><span><strong>Схема 20/40</strong><small>Предлагать чередующуюся дозу как подсказку</small></span><input type="checkbox" name="alternating" ${settings.alternating ? 'checked' : ''}><i></i></label><div class="form-grid"><label class="field"><span>Пачек куплено</span><input name="packs" inputmode="numeric" type="number" min="0" step="1" value="${esc(supply.packs)}"></label><label class="field"><span>Таблеток в пачке</span><input name="packSize" inputmode="numeric" type="number" min="1" step="1" value="${esc(supply.packSize)}"></label><label class="field"><span>мг в таблетке</span><input name="tabletMg" inputmode="numeric" type="number" min="1" step="1" value="${esc(supply.tabletMg)}"></label></div><p class="formula-note">Обычно 30 таблеток по 10 мг — это <strong>${fmt(supply.packSize * supply.tabletMg)} мг</strong> запаса на пачку.</p><label class="field"><span>Единицы веса</span><select name="units"><option value="kg" ${settings.units !== 'lb' ? 'selected' : ''}>Килограммы (кг)</option><option value="lb" ${settings.units === 'lb' ? 'selected' : ''}>Фунты (lb)</option></select></label></section>
      <button class="primary-button" type="submit">Сохранить настройки</button>
    </form>
    <section class="settings-section card data-section"><h2>🔐 Данные и резервная копия</h2><p class="muted">Экспортируйте JSON раз в неделю. Файл содержит персональные записи — храните его безопасно.</p><p class="backup-status">${lastBackupAt ? `Последняя отметка бэкапа: ${dateLabel(new Date(lastBackupAt))}` : 'Резервные копии ещё не создавались'}</p><div class="button-row"><button class="secondary-button" data-action="export">Экспорт JSON</button><button class="secondary-button" data-action="import">Импорт JSON</button></div><input id="import-file" type="file" accept="application/json,.json" hidden><button class="danger-button" data-action="clear-data">Удалить все данные</button></section>
    <p class="medical-disclaimer">Трекер помогает вести записи и не заменяет рекомендации вашего врача. Дозировку и анализы согласуйте со специалистом.</p>`;
}

function plural(number, words) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return words[2];
  if (n1 > 1 && n1 < 5) return words[1];
  if (n1 === 1) return words[0];
  return words[2];
}

export function doseSheet(entry, settings, suggestedDose) {
  const editing = Boolean(entry);
  const current = entry || {};
  const doseChips = [10, 20, 30, 40].map((value) => `<button type="button" class="chip ${Number(current.doseMg) === value ? 'selected' : ''}" data-chip="dose" data-value="${value}">${value} мг</button>`).join('');
  const fatChips = [10, 20, 30].map((value) => `<button type="button" class="chip ${Number(current.fatGrams) === value ? 'selected' : ''}" data-chip="fat" data-value="${value}">${value} г</button>`).join('');
  return `<div class="sheet-backdrop" data-action="close-sheet"><section class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="dose-sheet-title"><div class="sheet-handle"></div><div class="sheet-heading"><div><p class="eyebrow">${editing ? 'ИЗМЕНИТЬ ЗАПИСЬ' : 'НОВАЯ ЗАПИСЬ'}</p><h2 id="dose-sheet-title">💊 ${editing ? 'Приём' : 'Записать приём'}</h2></div><button type="button" class="icon-button" data-action="close-sheet" aria-label="Закрыть">×</button></div>
    <form id="dose-form" data-id="${esc(current.id || '')}" data-editing="${editing}"><label class="field"><span>Доза, мг</span><div class="chip-row">${doseChips}${settings.alternating && !editing ? `<button type="button" class="chip suggestion-chip" data-chip="dose" data-value="${suggestedDose}">Сегодня ${suggestedDose}</button>` : ''}</div><input name="doseMg" inputmode="decimal" type="number" min="0.1" step="0.1" placeholder="Своя доза" value="${esc(current.doseMg ?? '')}" required></label>
    <label class="field"><span>Дата и время</span><input name="timestamp" type="datetime-local" value="${dateTimeLocal(current.timestamp)}" required></label>
    <label class="field"><span>Жиры в приёме пищи, г <span>🥑</span></span><div class="chip-row">${fatChips}</div><input name="fatGrams" inputmode="decimal" type="number" min="0" step="0.1" placeholder="Сколько примерно было" value="${esc(current.fatGrams ?? '')}" required></label><div class="fat-warning" id="fat-warning" hidden>🥑 Маловато жира для усвоения. Порог сейчас — ${fmt(settings.fatThreshold)} г.</div>
    <label class="field"><span>Заметка <small class="muted">необязательно</small></span><textarea name="note" rows="2" maxlength="500" placeholder="Например, самочувствие или детали">${esc(current.note || '')}</textarea></label>
    <button class="primary-button" type="submit">${editing ? 'Сохранить изменения' : 'Сохранить приём'}</button></form></section></div>`;
}

export function labSheet() {
  return `<div class="sheet-backdrop" data-action="close-sheet"><section class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="lab-sheet-title"><div class="sheet-handle"></div><div class="sheet-heading"><div><p class="eyebrow">ЛИЧНЫЙ ЖУРНАЛ</p><h2 id="lab-sheet-title">🧪 Новый анализ</h2></div><button type="button" class="icon-button" data-action="close-sheet" aria-label="Закрыть">×</button></div><form id="lab-form"><label class="field"><span>Дата</span><input name="date" type="date" value="${new Date().toLocaleDateString('sv-SE')}" required></label><label class="field"><span>Тип</span><select name="type"><option>Липиды</option><option>АЛТ/АСТ</option><option>Другое</option></select></label><label class="field"><span>Значения</span><textarea name="values" rows="3" maxlength="1000" placeholder="Свободный текст, например: АЛТ 32, АСТ 28"></textarea></label><label class="field"><span>Заметка</span><textarea name="note" rows="2" maxlength="500" placeholder="Необязательно"></textarea></label><label class="field"><span>PDF результата <small class="muted">необязательно · до 25 МБ · хранится на устройстве</small></span><input name="pdf" type="file" accept="application/pdf,.pdf"></label><button class="primary-button" type="submit">Сохранить анализ</button></form></section></div>`;
}

export function animateProgress() {
  requestAnimationFrame(() => document.querySelectorAll('.ring-value').forEach((ring) => { ring.style.strokeDashoffset = ring.dataset.offset; }));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.count-up').forEach((node) => {
    const target = Number(node.dataset.value);
    if (!Number.isFinite(target) || target === 0) return;
    const start = performance.now();
    const duration = 650;
    const decimals = Number(node.dataset.decimals || 0);
    const render = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = fmt(target * eased, decimals);
      if (progress < 1) requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  });
}

export function showMilestone(mark) {
  const titles = { 25: 'Четверть пути!', 50: 'Половина курса!', 75: 'Уже три четверти!', 100: 'Цель достигнута!' };
  return `<div class="sheet-backdrop milestone-backdrop" data-action="close-sheet"><section class="bottom-sheet milestone-sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><div class="milestone-art"><svg viewBox="0 0 180 140" aria-hidden="true"><path d="M90 15 103 52l39-12-24 33 34 22-41 2-11 39-14-38-40 13 24-33-31-26 40 5Z" fill="#f3c4ad"/><circle cx="90" cy="75" r="30" fill="#c8b6e9"/><path d="M78 75a12 12 0 0 1 17-17l8 8a12 12 0 0 1-17 17l-8-8Z" fill="white"/><path d="m85 77 14-14" stroke="#d9c8e8" stroke-width="3"/></svg></div><p class="eyebrow">ТВОЙ ПРОГРЕСС</p><h2>🎉 ${titles[mark]}</h2><p class="muted">Ты прошёл(ла) ${mark}% целевой накопленной дозы. Отметь этот шаг — ты молодец!</p><button class="primary-button" data-action="close-sheet">Продолжить</button></section></div>`;
}
