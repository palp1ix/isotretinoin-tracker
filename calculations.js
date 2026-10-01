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
}
