import { totalDose, averageDailyDose, projectedEndDate, progressPercent, dosesOnDate, doseDate, alternatingSuggestion, supplyForecast, supplyStockMg, recordedDoses, courseDays, averageWindowDays } from './calculations.js?v=5.0.0';

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const fmt = (value, digits = 0) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
const dateLabel = (date, options = { day: 'numeric', month: 'long', year: 'numeric' }) => new Intl.DateTimeFormat('ru-RU', options).format(date);
const dateTimeLocal = (value) => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function icon(name) {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    chart: '<path d="M4 4v16h16M8 15l4-5 4 2 4-7"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2"/>',
    pill: '<path d="m8 5-3 3a6 6 0 0 0 8 8l3-3A6 6 0 0 0 8 5ZM8 8l8 8"/>',
    lab: '<path d="M9 3h6M10 3v7l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 15h8"/>',
    settings: '<path d="M4 7h16M4 17h16"/><rect x="7" y="4" width="4" height="6" rx="1"/><rect x="14" y="14" width="4" height="6" rx="1"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
    box: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7 6l9 5"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
    food: '<path d="M5 3v6c0 3 6 3 6 0V3M8 3v18M19 21V3c-4 1-4 9 0 10"/>',
    file: '<path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 13h8M8 17h6"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${paths[name] || paths.chart}</svg>`;
}

export function updateChrome(tab) {
  document.querySelectorAll('.tab').forEach((button) => { button.classList.toggle('active', button.dataset.tab === tab); button.setAttribute('aria-current', button.dataset.tab === tab ? 'page' : 'false'); });
  document.getElementById('top-date').textContent = dateLabel(new Date(), { weekday: 'short', day: 'numeric', month: 'short' });
}

export function renderApp(root, data, tab) {
  updateChrome(tab);
  const renderers = { today: renderToday, history: renderHistory, labs: renderLabs, settings: renderSettings };
  root.innerHTML = `<section class="screen screen-enter">${(renderers[tab] || renderToday)(data)}</section>`;
}

function renderToday(data) {
  const { settings } = data;
  const now = new Date();
  const doses = recordedDoses(data.doses, now);
  const target = Number(settings.targetMg) || 0;
  const total = totalDose(doses);
  const percent = progressPercent(doses, target);
  const remaining = Math.max(0, target - total);
  const average = averageDailyDose(doses, 14, now, settings);
  const windowDays = averageWindowDays(doses, 14, now, settings);
  const projected = projectedEndDate(doses, target, now, 14, settings);
  const supply = supplyForecast(doses, data.supply, settings, now);
  const todayDoses = dosesOnDate(doses, now);
  const todayMg = totalDose(todayDoses);
  const elapsed = courseDays(doses, settings, now);
  const suggestion = settings.alternating ? alternatingSuggestion(doses, now) : null;
  const perKg = settings.weightKg > 0 ? total / settings.weightKg : null;
  const installTip = isInstalled() ? '' : `<aside class="install-tip"><span>${icon('phone')}</span><span><strong>Всегда под рукой</strong><br>В Safari: «Поделиться» → «На экран Домой».</span><button class="icon-button tip-close" data-action="dismiss-install" aria-label="Скрыть подсказку">×</button></aside>`;
  return `<div class="page-heading"><div><p class="eyebrow">ЛИЧНЫЙ ТРЕКЕР / ОБЗОР</p><h1>Мой курс<span class="accent-period">.</span></h1><p class="muted">${dateLabel(now, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><span class="course-day"><strong>${elapsed}</strong><span>день курса</span></span></div>
    <article class="progress-card card">
      <div class="hero-top"><span class="eyebrow">НАКОПЛЕННАЯ ДОЗА</span><span class="hero-status"><i></i>${percent >= 100 ? 'Цель достигнута' : 'Курс в процессе'}</span></div>
      <div class="hero-main"><div><div class="big-number">${fmt(total, 1)}<small>мг</small></div><p class="hero-target">Цель <strong>${fmt(target, 1)} мг</strong></p></div><div class="hero-percent">${fmt(percent, 1)}<small>%</small></div></div>
      <div class="progress-meter" role="progressbar" aria-label="Накопленная доза относительно цели" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>
      <div class="meter-labels"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div>
      <div class="progress-foot"><span>Осталось <strong>${fmt(remaining, 1)} мг</strong></span><span>Накоплено <strong>${perKg === null ? '—' : fmt(perKg, 1)} мг/кг</strong></span></div>
    </article>
    <section class="today-card card"><div><p class="eyebrow">СЕГОДНЯ</p><strong>${todayDoses.length ? `${fmt(todayMg, 1)} мг записано` : 'Приём ещё не записан'}</strong><p class="muted">${todayDoses.length ? `${todayDoses.length} ${plural(todayDoses.length, ['запись', 'записи', 'записей'])} в журнале` : 'Добавьте дозу, время и заметку'}</p></div><button class="primary-button log-button" data-action="open-dose">${icon('plus')}<span>Записать приём</span></button></section>
    <div class="stat-grid"><article class="stat-card"><span class="stat-label">Средняя доза</span><strong>${fmt(average, 1)} <small>мг/день</small></strong><span class="stat-detail">${windowDays ? `За ${windowDays} ${plural(windowDays, ['день', 'дня', 'дней'])}, включая дни без записей` : 'Добавьте первую запись'}</span></article><article class="stat-card"><span class="stat-label">Ориентир завершения</span><strong class="stat-date">${projected ? dateLabel(projected, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</strong><span class="stat-detail">${percent >= 100 ? 'Накопленная цель достигнута' : average > 0 ? `Ещё ≈ ${Math.ceil(remaining / average)} ${plural(Math.ceil(remaining / average), ['день', 'дня', 'дней'])} при текущем темпе` : 'Нужны недавние записи'}</span></article></div>
    ${weekActivity(doses, now)}
    ${supplyCard(supply, data)}
    <details class="forecast-info"><summary>Как считаются прогнозы ${icon('chevron')}</summary><p>Средняя доза — сумма записей за последние 14 календарных дней, делённая на число дней. В начале курса берётся доступный период. Дни без записей учитываются как 0 мг. Прогноз курса и запаса использует одну среднюю. Будущие записи в расчёт не входят. Дата завершения — оценка достижения вашей цели, а не назначение врача.</p></details>
    ${settings.alternating ? `<div class="suggestion-banner">Схема 20/40: ${suggestion ? `по записанному чередованию на сегодня ${suggestion} мг.` : 'нужна запись 20 или 40 мг для ориентира.'} <span class="muted">Следуйте назначенной врачом схеме.</span></div>` : ''}
    ${installTip}<button class="backup-nudge" data-tab="settings">${icon('shield')}<span>${backupMessage(data.lastBackupAt)}</span>${icon('chevron')}</button>`;
}

function weekActivity(doses, now) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - 6 + index);
    return { date, amount: totalDose(dosesOnDate(doses, date)) };
  });
  const max = Math.max(1, ...days.map((day) => day.amount));
  return `<section class="week-card card"><div class="section-title"><h2>Последние 7 дней</h2><span class="muted">${fmt(days.reduce((sum, day) => sum + day.amount, 0), 1)} мг</span></div><div class="week-bars">${days.map(({ date, amount }, index) => `<div class="week-day ${index === 6 ? 'is-today' : ''}"><span class="week-amount">${amount ? fmt(amount, 1) : '—'}</span><div class="week-track"><span style="height:${amount / max * 100}%"></span></div><span>${dateLabel(date, { weekday: 'short' })}</span><small>${date.getDate()}</small></div>`).join('')}</div><div class="week-foot">Доза по дням, мг <span>Сегодня выделено</span></div></section>`;
}

function supplyCard(supply, data) {
  if (!data.supply || supplyStockMg(data.supply) <= 0) {
    return `<article class="supply-card card supply-empty"><span class="stat-icon">${icon('box')}</span><div><strong>Укажите запас таблеток</strong><p class="muted">Укажите все пачки, купленные с начала курса. Записанные дозы автоматически вычитаются из запаса.</p></div></article>`;
  }
  const packsTotal = supply.stockMg / Math.max(1, data.supply.packSize * data.supply.tabletMg);
  const leftPacks = fmt(supply.packsLeft, 1);
  const when = supply.runOutDate ? dateLabel(supply.runOutDate, { day: 'numeric', month: 'long' }) : null;
  const status = supply.daysLeft === null
    ? 'Нужны записи приёмов для прогноза'
    : supply.leftMg <= 0 ? 'Таблетки закончились — купите новые' : `Хватит примерно на <strong>${fmt(supply.daysLeft)}</strong> ${plural(supply.daysLeft, ['день', 'дня', 'дней'])}${when ? ` · до ${when}` : ''}`;
  const buy = supply.packsToBuy > 0 ? `<div class="supply-buy">До цели нужно докупить <strong>${fmt(supply.packsToBuy)}</strong> ${plural(supply.packsToBuy, ['пачку', 'пачки', 'пачек'])}</div>` : '';
  return `<article class="supply-card card"><div class="supply-head"><span class="stat-icon">${icon('box')}</span><div><span class="stat-label">Запас таблеток</span><strong>${leftPacks} из ${fmt(packsTotal, 1)} пачек осталось</strong><small class="muted">Всего куплено с начала курса · по ${fmt(data.supply.packSize)} таб. × ${fmt(data.supply.tabletMg)} мг = ${fmt(data.supply.packSize * data.supply.tabletMg)} мг в пачке</small></div></div><p class="muted supply-status">${status}</p><div class="supply-meter"><span style="width:${supply.coverageRatio * 100}%"></span></div><p class="supply-caption">${supply.consumedMg >= Number(data.settings.targetMg) && Number(data.settings.targetMg) > 0 ? 'Накопленная цель достигнута' : `Запас покрывает ${fmt(supply.coverageRatio * 100)}% оставшейся цели`} · ${fmt(supply.leftMg, 1)} мг</p>${buy}</article>`;
}

function isInstalled() {
  try { return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches || localStorage.getItem('install-tip-dismissed') === '1'; } catch { return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; }
}

function backupMessage(lastBackupAt) {
  const due = !lastBackupAt || (Date.now() - Date.parse(lastBackupAt)) > 7 * 86400000;
  return due ? 'Сохраните резервную копию ваших записей' : 'Резервная копия сохранена недавно';
}

function renderHistory(data) {
  const { doses } = data;
  if (!doses.length) return `<div class="page-heading"><div><p class="eyebrow">ХРОНОЛОГИЯ КУРСА</p><h1>История</h1><p class="muted">Все записи курса в одном месте</p></div><span class="heading-emoji">${icon('calendar')}</span></div><article class="empty-card card"><svg class="empty-illustration" viewBox="0 0 240 170" role="img" aria-label="Таблетка укрылась одеялом"><ellipse cx="120" cy="146" rx="77" ry="10" fill="currentColor" opacity=".08"/><path d="M62 105c0-24 26-42 58-42s58 18 58 42v32H62v-32Z" fill="#d8f36a"/><path d="M62 111c18-18 35-18 58 0s40 18 58 0v31H62v-31Z" fill="#38433a"/><g transform="rotate(-28 119 79)"><rect x="91" y="65" width="57" height="28" rx="14" fill="#fff"/><path d="M119 66v26" stroke="#849a41" stroke-width="3"/><path d="M94 79a11 11 0 0 1 11-11h14v22h-14a11 11 0 0 1-11-11Z" fill="#eef1df"/></g><path d="M76 67c4-15 17-23 31-22" fill="none" stroke="#849a41" stroke-width="3" stroke-linecap="round"/><text x="158" y="54" font-size="20">z</text><text x="176" y="37" font-size="14">z</text></svg><h2>Пока тихо</h2><p class="muted">Первая запись появится здесь. Маленькие шаги тоже считаются.</p><button class="secondary-button" data-action="open-dose">＋ Записать первый приём</button></article>`;
  const points = chartPoints(doses);
  const grouped = groupByDay(doses);
  return `<div class="page-heading"><div><p class="eyebrow">ХРОНОЛОГИЯ КУРСА</p><h1>История</h1><p class="muted">${doses.length} ${plural(doses.length, ['запись', 'записи', 'записей'])}</p></div><span class="heading-emoji">${icon('calendar')}</span></div>
    <article class="chart-card card"><div class="section-title"><div><h2>${icon('chart')} Динамика</h2><p class="muted">Последние 14 дней · дни без записей = 0 мг</p></div></div><div class="chart-legend"><span><i class="legend-dot dose-dot"></i> за день</span><span><i class="legend-dot total-dot"></i> накоплено</span></div><svg class="dose-chart" viewBox="0 0 360 170" role="img" aria-label="Дозы за последние 14 календарных дней: столбцы — мг за день по левой шкале, линия — накопленные мг по правой шкале">${points.svg}</svg></article>
    <div class="section-heading"><h2>Записи по дням</h2><button class="text-button" data-action="open-dose">＋ Добавить</button></div>
    <div class="history-list">${[...grouped.entries()].sort((a,b) => b[0].localeCompare(a[0])).map(([day, entries]) => `<section class="day-group"><div class="day-heading"><strong>${dateLabel(new Date(`${day}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' })}</strong><span>${fmt(entries.reduce((sum, item) => sum + item.doseMg, 0))} мг</span></div>${entries.sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map((entry) => `<article class="dose-row swipe-row" data-id="${esc(entry.id)}"><button class="swipe-delete" data-action="delete-dose" aria-label="Удалить приём">Удалить</button><button class="dose-row-main" data-action="edit-dose" data-id="${esc(entry.id)}"><span class="dose-pill">${icon('pill')}</span><span class="dose-description"><strong>${fmt(entry.doseMg)} мг</strong><small>${icon('food')} ${fmt(entry.fatGrams)} г жира · ${new Date(entry.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}${entry.note ? ` · ${esc(entry.note)}` : ''}</small></span><span class="row-chevron">›</span></button></article>`).join('')}</section>`).join('')}</div>`;
}

function chartPoints(doses) {
  const now = new Date();
  const recorded = recordedDoses(doses, now);
  const byDay = groupByDay(recorded);
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - 13 + index);
    return date.toLocaleDateString('sv-SE');
  });
  let running = totalDose(recorded.filter((item) => doseDate(item) < days[0]));
  const daily = days.map((day) => totalDose(byDay.get(day) || []));
  const cumulative = daily.map((value) => (running += value));
  const maxDaily = Math.max(40, ...daily);
  const maxCum = Math.max(40, ...cumulative);
  const x = (index) => 34 + index * (292 / 13);
  const yd = (value) => 132 - value / maxDaily * 94;
  const yc = (value) => 132 - value / maxCum * 94;
  const bars = daily.map((value, i) => `<rect x="${x(i)-5}" y="${yd(value)}" width="10" height="${132-yd(value)}" class="daily-bar"/>`).join('');
  const line = cumulative.map((value, i) => `${i ? 'L' : 'M'}${x(i)} ${yc(value)}`).join(' ');
  const labels = days.map((day, i) => (i % 3 === 0 && i < 12) || i === 13 ? `<text x="${x(i)}" y="154" text-anchor="middle">${new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })}</text>` : '').join('');
  return { svg: `<text x="18" y="16">за день, мг</text><text x="342" y="16" text-anchor="end">итог, мг</text>${[0, .5, 1].map((part) => `<line x1="34" y1="${132-part*94}" x2="326" y2="${132-part*94}" class="chart-axis"/><text x="28" y="${135-part*94}" text-anchor="end">${fmt(maxDaily*part)}</text><text x="332" y="${135-part*94}">${fmt(maxCum*part)}</text>`).join('')}${bars}<path d="${line}" class="cumulative-line"/>${labels}` };
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
  const reminder = weeks >= Number(settings.labReminderWeeks) ? `<div class="reminder-banner">${icon('lab')} ${latest ? 'Давно не было анализов.' : 'Пока нет записей об анализах.'} Можно добавить результат или настроить интервал в настройках.</div>` : '';
  return `<div class="page-heading"><div><p class="eyebrow">ЛАБОРАТОРНЫЙ ЖУРНАЛ</p><h1>Анализы</h1><p class="muted">Личный журнал результатов</p></div><span class="heading-emoji">${icon('lab')}</span></div>${reminder}<button class="primary-button" data-action="open-lab">＋ Добавить анализ</button>
    ${labs.length ? `<div class="lab-list">${[...labs].sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map((lab) => `<article class="lab-card card"><div class="lab-card-top"><div><span class="lab-type">${esc(lab.type)}</span><h3>${dateLabel(new Date(lab.timestamp), { day: 'numeric', month: 'long', year: 'numeric' })}</h3></div><button class="icon-button" data-action="delete-lab" data-id="${esc(lab.id)}" aria-label="Удалить запись">×</button></div><p>${esc(lab.values) || 'Значения не указаны'}</p>${lab.note ? `<p class="muted">${esc(lab.note)}</p>` : ''}${lab.attachment ? `<button class="secondary-button pdf-link" data-action="open-lab-pdf" data-file-id="${esc(lab.attachment.id)}">${icon('file')} ${esc(lab.attachment.name)} · ${fmt(lab.attachment.size / 1024)} КБ</button>` : ''}</article>`).join('')}</div>` : `<article class="empty-inline card"><span>${icon('lab')}</span><div><strong>Записей пока нет</strong><p class="muted">Здесь можно хранить результаты анализов локально.</p></div></article>`}`;
}

function renderSettings(data) {
  const { settings, lastBackupAt } = data;
  const supply = data.supply || { packs: 0, packSize: 30, tabletMg: 10 };
  return `<div class="page-heading"><div><p class="eyebrow">ПАРАМЕТРЫ КУРСА</p><h1>Настройки</h1><p class="muted">Данные остаются только на этом устройстве</p></div><span class="heading-emoji">${icon('settings')}</span></div>
    <form id="settings-form" class="settings-form">
      <section class="settings-section card"><h2>${icon('target')} Цель курса</h2><div class="form-grid"><label class="field"><span>Вес, ${settings.units === 'lb' ? 'фунты' : 'кг'}</span><input name="weightKg" inputmode="decimal" type="number" min="0.1" step="0.1" value="${esc(settings.units === 'lb' ? (settings.weightKg * 2.20462).toFixed(1) : settings.weightKg)}" required></label><label class="field"><span>Цель, мг/кг</span><input name="targetMgPerKg" inputmode="decimal" type="number" min="1" step="1" value="${esc(settings.targetMgPerKg)}" required></label></div><div class="target-mode"><label><input type="radio" name="targetMode" value="weight" ${settings.targetMode === 'weight' ? 'checked' : ''}> Рассчитывать по весу</label><label><input type="radio" name="targetMode" value="manual" ${settings.targetMode === 'manual' ? 'checked' : ''}> Задать вручную</label></div><label class="field"><span>Целевая доза, мг</span><input name="targetMg" inputmode="decimal" type="number" min="1" step="1" value="${esc(settings.targetMg)}" required></label><p class="formula-note">Формула: <strong>${fmt(settings.weightKg, 1)} кг × ${fmt(settings.targetMgPerKg)} мг/кг = ${fmt(settings.weightKg * settings.targetMgPerKg)} мг</strong>. ${settings.targetMode === 'manual' ? 'Сейчас используется введённая вручную цель.' : 'Цель пересчитывается автоматически по весу.'}</p><label class="field"><span>Дата старта курса</span><input name="startDate" type="date" value="${esc(settings.startDate)}"></label></section>
      <section class="settings-section card"><h2>${icon('pill')} Приём, напоминания и запас таблеток</h2><div class="form-grid"><label class="field"><span>Личный ориентир жиров, г</span><input name="fatThreshold" inputmode="decimal" type="number" min="0" step="1" value="${esc(settings.fatThreshold)}"></label><label class="field"><span>Напоминать об анализах, недель</span><input name="labReminderWeeks" inputmode="numeric" type="number" min="1" step="1" value="${esc(settings.labReminderWeeks)}"></label></div><label class="toggle-row"><span><strong>Схема 20/40</strong><small>Показывать ориентир по записанному чередованию</small></span><input type="checkbox" name="alternating" ${settings.alternating ? 'checked' : ''}><i></i></label><div class="form-grid"><label class="field"><span>Всего пачек куплено за курс</span><input name="packs" inputmode="numeric" type="number" min="0" step="1" value="${esc(supply.packs)}"></label><label class="field"><span>Таблеток в пачке</span><input name="packSize" inputmode="numeric" type="number" min="1" step="1" value="${esc(supply.packSize)}"></label><label class="field"><span>мг в таблетке</span><input name="tabletMg" inputmode="numeric" type="number" min="1" step="1" value="${esc(supply.tabletMg)}"></label></div><p class="formula-note">Укажите суммарно все купленные пачки с начала курса, включая уже использованные. Остаток = весь запас − записанные дозы.<br>Пачка = ${fmt(supply.packSize)} таб. × ${fmt(supply.tabletMg)} мг = <strong>${fmt(supply.packSize * supply.tabletMg)} мг</strong> запаса.</p><label class="field"><span>Единицы веса</span><select name="units"><option value="kg" ${settings.units !== 'lb' ? 'selected' : ''}>Килограммы (кг)</option><option value="lb" ${settings.units === 'lb' ? 'selected' : ''}>Фунты (lb)</option></select></label></section>
      <button class="primary-button" type="submit">Сохранить настройки</button>
    </form>
    <section class="settings-section card data-section"><h2>${icon('shield')} Данные и резервная копия</h2><p class="muted">Экспортируйте JSON раз в неделю. Файл содержит персональные записи — храните его безопасно.</p><p class="backup-status">${lastBackupAt ? `Последняя отметка бэкапа: ${dateLabel(new Date(lastBackupAt))}` : 'Резервные копии ещё не создавались'}</p><div class="button-row"><button class="secondary-button" data-action="export">Экспорт JSON</button><button class="secondary-button" data-action="import">Импорт JSON</button></div><input id="import-file" type="file" accept="application/json,.json" hidden><button class="danger-button" data-action="clear-data">Удалить все данные</button></section>
    <p class="app-version">МОЙ КУРС / V5.0.0</p><p class="medical-disclaimer">Трекер помогает вести записи и не заменяет рекомендации вашего врача. Дозировку и анализы согласуйте со специалистом.</p>`;
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
  const doseChips = [10, 20, 30, 40].map((value) => `<button type="button" class="chip ${Number(current.doseMg) === value ? 'selected' : ''}" aria-label="${value} мг" data-chip="dose" data-value="${value}">${value} мг</button>`).join('');
  const fatChips = [10, 20, 30].map((value) => `<button type="button" class="chip ${Number(current.fatGrams) === value ? 'selected' : ''}" aria-label="${value} г" data-chip="fat" data-value="${value}">${value} г</button>`).join('');
  return `<div class="sheet-backdrop" data-action="close-sheet"><section class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="dose-sheet-title"><div class="sheet-handle"></div><div class="sheet-heading"><div><p class="eyebrow">${editing ? 'ИЗМЕНИТЬ ЗАПИСЬ' : 'НОВАЯ ЗАПИСЬ'}</p><h2 id="dose-sheet-title">${icon('pill')} ${editing ? 'Приём' : 'Записать приём'}</h2></div><button type="button" class="icon-button" data-action="close-sheet" aria-label="Закрыть">×</button></div>
    <form id="dose-form" data-id="${esc(current.id || '')}" data-editing="${editing}"><label class="field"><span>Доза, мг</span><div class="chip-row">${doseChips}${settings.alternating && suggestedDose && !editing ? `<button type="button" class="chip suggestion-chip" data-chip="dose" data-value="${suggestedDose}">По схеме ${suggestedDose}</button>` : ''}</div><input name="doseMg" inputmode="decimal" type="number" min="0.1" step="0.1" placeholder="Своя доза" value="${esc(current.doseMg ?? '')}" required></label>
    <label class="field"><span>Дата и время</span><input name="timestamp" type="datetime-local" value="${dateTimeLocal(current.timestamp)}" required></label>
    <label class="field"><span>Жиры в приёме пищи, г <span>${icon('food')}</span></span><div class="chip-row">${fatChips}</div><input name="fatGrams" inputmode="decimal" type="number" min="0" step="0.1" placeholder="Сколько примерно было" value="${esc(current.fatGrams ?? '')}" required></label><div class="fat-warning" id="fat-warning" hidden>Ниже вашего личного ориентира — ${fmt(settings.fatThreshold)} г. Это отметка в журнале, а не оценка усвоения.</div>
    <label class="field"><span>Заметка <small class="muted">необязательно</small></span><textarea name="note" rows="2" maxlength="500" placeholder="Например, самочувствие или детали">${esc(current.note || '')}</textarea></label>
    ${editing ? `<button class="danger-button" type="button" data-action="delete-entry" data-id="${esc(current.id)}">Удалить приём</button>` : ''}<button class="primary-button" type="submit">${editing ? 'Сохранить изменения' : 'Сохранить приём'}</button></form></section></div>`;
}

export function labSheet() {
  return `<div class="sheet-backdrop" data-action="close-sheet"><section class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="lab-sheet-title"><div class="sheet-handle"></div><div class="sheet-heading"><div><p class="eyebrow">ЛИЧНЫЙ ЖУРНАЛ</p><h2 id="lab-sheet-title">${icon('lab')} Новый анализ</h2></div><button type="button" class="icon-button" data-action="close-sheet" aria-label="Закрыть">×</button></div><form id="lab-form"><label class="field"><span>Дата</span><input name="date" type="date" value="${new Date().toLocaleDateString('sv-SE')}" required></label><label class="field"><span>Тип</span><select name="type"><option>Липиды</option><option>АЛТ/АСТ</option><option>Другое</option></select></label><label class="field"><span>Значения</span><textarea name="values" rows="3" maxlength="1000" placeholder="Свободный текст, например: АЛТ 32, АСТ 28"></textarea></label><label class="field"><span>Заметка</span><textarea name="note" rows="2" maxlength="500" placeholder="Необязательно"></textarea></label><label class="field"><span>PDF результата <small class="muted">необязательно · до 25 МБ · хранится на устройстве</small></span><input name="pdf" type="file" accept="application/pdf,.pdf"></label><button class="primary-button" type="submit">Сохранить анализ</button></form></section></div>`;
}

export function showMilestone(mark) {
  const titles = { 25: 'Четверть пути!', 50: 'Половина курса!', 75: 'Уже три четверти!', 100: 'Цель достигнута!' };
  return `<div class="sheet-backdrop milestone-backdrop" data-action="close-sheet"><section class="bottom-sheet milestone-sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div><div class="milestone-art"><svg viewBox="0 0 180 140" aria-hidden="true"><path d="M90 15 103 52l39-12-24 33 34 22-41 2-11 39-14-38-40 13 24-33-31-26 40 5Z" fill="#d8f36a"/><circle cx="90" cy="75" r="30" fill="#333d35"/><path d="M78 75a12 12 0 0 1 17-17l8 8a12 12 0 0 1-17 17l-8-8Z" fill="white"/><path d="m85 77 14-14" stroke="#849a41" stroke-width="3"/></svg></div><p class="eyebrow">ТВОЙ ПРОГРЕСС</p><h2>${titles[mark]}</h2><p class="muted">Накоплено ${mark}% вашей целевой дозы. Ещё один этап курса пройден.</p><button class="primary-button" data-action="close-sheet">Продолжить</button></section></div>`;
}
