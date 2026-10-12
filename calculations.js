export const DAY_MS = 86400000;

export function safeNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function totalDose(doses) {
  return doses.reduce((sum, item) => sum + safeNonNegative(item.doseMg), 0);
}

export function doseDate(dose) {
  return new Date(dose.timestamp).toLocaleDateString('sv-SE');
}

// Local calendar dates represented as UTC ordinals: DST cannot change day counts.
export function calendarDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

export function recordedDoses(doses, now = new Date()) {
  return doses.filter((dose) => Number.isFinite(Date.parse(dose.timestamp)) && Date.parse(dose.timestamp) <= now.getTime());
}

export function dosesOnDate(doses, date = new Date()) {
  const target = date instanceof Date ? date.toLocaleDateString('sv-SE') : String(date);
  return doses.filter((dose) => doseDate(dose) === target);
}

export function courseDays(doses, settings = {}, now = new Date()) {
  const recorded = recordedDoses(doses, now);
  const starts = recorded.map((dose) => calendarDay(new Date(dose.timestamp)));
  if (settings.startDate) {
    const start = new Date(`${settings.startDate}T12:00:00`);
    if (Number.isFinite(start.getTime())) starts.push(calendarDay(start));
  }
  if (!starts.length) return 0;
  // Earlier recorded doses still belong to the total, so also belong to its denominator.
  return Math.max(0, calendarDay(now) - Math.min(...starts) + 1);
}

export function averageWindowDays(doses, days = 14, now = new Date(), settings = {}) {
  return Math.min(Math.max(1, Math.floor(safeNonNegative(days))), courseDays(doses, settings, now));
}

export function averageDailyDose(doses, days = 14, now = new Date(), settings = {}) {
  const windowDays = averageWindowDays(doses, days, now, settings);
  if (!windowDays) return 0;
  const cutoff = calendarDay(now) - windowDays + 1;
  return totalDose(recordedDoses(doses, now).filter((dose) => calendarDay(new Date(dose.timestamp)) >= cutoff)) / windowDays;
}

export function projectedEndDate(doses, targetMg, now = new Date(), days = 14, settings = {}) {
  const target = safeNonNegative(targetMg);
  if (!target) return null;
  const remaining = Math.max(0, target - totalDose(recordedDoses(doses, now)));
  if (!remaining) return new Date(now);
  const average = averageDailyDose(doses, days, now, settings);
  if (average <= 0) return null;
  const projected = new Date(now);
  projected.setDate(projected.getDate() + Math.ceil(remaining / average));
  return Number.isFinite(projected.getTime()) ? projected : null;
}

export function progressPercent(doses, targetMg) {
  const target = safeNonNegative(targetMg);
  return target ? Math.min(100, totalDose(doses) / target * 100) : 0;
}

export function supplyStockMg(supply) {
  return supply ? safeNonNegative(supply.packs) * safeNonNegative(supply.packSize) * safeNonNegative(supply.tabletMg) : 0;
}

export function courseDailyAverage(doses, settings = {}, now = new Date()) {
  const days = courseDays(doses, settings, now);
  return days ? totalDose(recordedDoses(doses, now)) / days : 0;
}

export function supplyForecast(doses, supply, settings = {}, now = new Date()) {
  const packMg = safeNonNegative(supply?.packSize) * safeNonNegative(supply?.tabletMg);
  const stockMg = supplyStockMg(supply);
  const consumedMg = totalDose(recordedDoses(doses, now));
  const leftMg = Math.max(0, stockMg - consumedMg);
  const courseRemaining = Math.max(0, safeNonNegative(settings.targetMg) - consumedMg);
  const coverageRatio = courseRemaining > 0 ? Math.min(1, leftMg / courseRemaining) : 0;
  const daily = averageDailyDose(doses, 14, now, settings);
  const packsLeft = packMg > 0 ? leftMg / packMg : 0;
  // Quantity required does not depend on whether a daily forecast is available.
  const packsToBuy = packMg > 0 ? Math.ceil(Math.max(0, courseRemaining - leftMg) / packMg) : null;
  const daysLeft = daily > 0 ? Math.floor(leftMg / daily) : null;
  const runOutDate = daysLeft === null ? null : new Date(now);
  if (runOutDate) runOutDate.setDate(runOutDate.getDate() + daysLeft);
  return { stockMg, consumedMg, leftMg, coverageRatio, daysLeft, runOutDate, packsLeft, packsToBuy, daily };
}

export function milestoneCrossed(previousMg, currentMg, targetMg) {
  if (targetMg <= 0) return null;
  return [100, 75, 50, 25].find((mark) => previousMg < targetMg * mark / 100 && currentMg >= targetMg * mark / 100) || null;
}

export function alternatingSuggestion(doses, date = new Date()) {
  const recent = recordedDoses(doses, date).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  if (!recent || ![20, 40].includes(Number(recent.doseMg))) return null;
  const elapsed = calendarDay(date) - calendarDay(new Date(recent.timestamp));
  return elapsed % 2 === 0 ? Number(recent.doseMg) : Number(recent.doseMg) === 20 ? 40 : 20;
}
