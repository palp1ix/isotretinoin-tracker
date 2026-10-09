export const DAY_MS = 24 * 60 * 60 * 1000;

export function totalDose(doses) {
  return doses.reduce((sum, item) => sum + safeNonNegative(item.doseMg), 0);
}

export function safeNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function doseDate(dose) {
  return new Date(dose.timestamp).toLocaleDateString('sv-SE');
}

export function dosesOnDate(doses, date = new Date()) {
  const target = date instanceof Date ? date.toLocaleDateString('sv-SE') : String(date);
  return doses.filter((dose) => doseDate(dose) === target);
}

export function averageDailyDose(doses, days = 14, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const amount = doses.reduce((sum, dose) => {
    const date = new Date(dose.timestamp);
    return date >= cutoff && date <= now ? sum + safeNonNegative(dose.doseMg) : sum;
  }, 0);
  return amount / days;
}

export function projectedEndDate(doses, targetMg, now = new Date(), days = 14) {
  const remaining = Math.max(0, safeNonNegative(targetMg) - totalDose(doses));
  const average = averageDailyDose(doses, days, now);
  if (remaining === 0) return new Date(now);
  if (average <= 0) return null;
  const projected = new Date(now);
  projected.setDate(projected.getDate() + Math.ceil(remaining / average));
  return projected;
}

export function progressPercent(doses, targetMg) {
  if (safeNonNegative(targetMg) === 0) return 0;
  return Math.min(100, (totalDose(doses) / safeNonNegative(targetMg)) * 100);
}

export function supplyStockMg(supply) {
  if (!supply) return 0;
  return Math.max(0, safeNonNegative(supply.packs) * Math.max(1, safeNonNegative(supply.packSize)) * safeNonNegative(supply.tabletMg));
}

export function courseDailyAverage(doses, settings = {}, now = new Date()) {
  const start = settings.startDate ? new Date(`${settings.startDate}T12:00:00`) : null;
  const earliestDose = [...doses].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))[0];
  const effectiveStart = start && !Number.isNaN(start.getTime())
    ? start
    : (earliestDose ? new Date(Date.parse(earliestDose.timestamp)) : null);
  if (!effectiveStart) return 0;
  const days = Math.max(1, Math.ceil((now.getTime() - effectiveStart.getTime()) / DAY_MS));
  return totalDose(doses) / days;
}

export function supplyForecast(doses, supply, settings = {}, now = new Date()) {
  const packMg = Math.max(1, safeNonNegative(supply?.packSize) * safeNonNegative(supply?.tabletMg));
  const stockMg = supplyStockMg(supply);
  const consumedMg = totalDose(doses);
  const leftMg = Math.max(0, stockMg - consumedMg);
  const targetMg = safeNonNegative(settings.targetMg);
  // Кольцо: доля оставшегося курса, покрытая имеющимися таблетками.
  const courseRemaining = Math.max(0, targetMg - consumedMg);
  const coverageRatio = courseRemaining > 0 ? Math.min(1, leftMg / courseRemaining) : 0;
  const daily = courseDailyAverage(doses, settings, now);
  const packsLeft = leftMg / packMg;
  if (daily <= 0) return { stockMg, consumedMg, leftMg, coverageRatio, daysLeft: null, runOutDate: null, packsLeft, packsToBuy: 0, daily };
  const daysLeft = Math.floor(leftMg / daily);
  const runOutDate = new Date(now);
  runOutDate.setDate(runOutDate.getDate() + daysLeft);
  // Докупать так, чтобы таблеток хватило до конца курса.
  const needForCourse = targetMg > 0 ? targetMg - consumedMg - leftMg : 0;
  const packsToBuy = needForCourse > 0 ? Math.ceil(needForCourse / packMg) : 0;
  return { stockMg, consumedMg, leftMg, coverageRatio, daysLeft, runOutDate, packsLeft, packsToBuy, daily };
}

export function milestoneCrossed(previousMg, currentMg, targetMg) {
  if (targetMg <= 0) return null;
  const marks = [25, 50, 75, 100];
  return marks.find((mark) => previousMg < targetMg * mark / 100 && currentMg >= targetMg * mark / 100) || null;
}

export function alternatingSuggestion(doses, date = new Date()) {
  const recent = [...doses].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  if (recent) return safeNonNegative(recent.doseMg) === 20 ? 40 : 20;
  return date.getDate() % 2 === 0 ? 40 : 20;
}

export function runCalculationTests() {
  const doses = [
    { doseMg: 20, timestamp: '2025-01-01T10:00:00.000Z' },
    { doseMg: 30, timestamp: '2025-01-02T10:00:00.000Z' }
  ];
  console.assert(totalDose(doses) === 50, 'totalDose should sum dose entries');
  console.assert(progressPercent(doses, 100) === 50, 'progressPercent should return percentage');
  console.assert(progressPercent(doses, 0) === 0, 'zero target should not produce NaN');
  console.assert(milestoneCrossed(240, 260, 1000) === 25, 'milestoneCrossed should detect milestone');
  console.assert(milestoneCrossed(0, 20, 1000) === null, 'milestoneCrossed should ignore unpassed milestone');
  console.assert(totalDose([{ doseMg: -5 }, { doseMg: 'nope' }]) === 0, 'invalid dose should not affect total');
  console.assert(supplyStockMg({ packs: 2, packSize: 30, tabletMg: 10 }) === 600, 'supplyStockMg should multiply packs');
  const forecast = supplyForecast(doses, { packs: 2, packSize: 30, tabletMg: 10 }, { targetMg: 1000, startDate: '2025-01-01' }, new Date('2025-01-10T12:00:00.000Z'));
  console.assert(forecast.leftMg === 550, 'supplyForecast should subtract consumed dose');
  console.assert(forecast.daysLeft === Math.floor(550 / 5), 'supplyForecast should use course-wide daily average');
  console.assert(Math.abs(forecast.coverageRatio - 550 / 950) < 1e-9, 'coverageRatio should be share of remaining course');
  console.assert(supplyForecast([], { packs: 1, packSize: 30, tabletMg: 10 }, { targetMg: 1000, startDate: '2025-01-01' }, new Date('2025-01-10T12:00:00.000Z')).daysLeft === null, 'no doses -> null daysLeft');
}
