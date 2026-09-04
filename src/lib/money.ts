// Χειρισμός ποσών. Όλα τα ποσά κυκλοφορούν ως ακέραια cents.

import type { CurrencyCode, ISODate, MonthKey } from '../types/finance';
import { DEFAULT_CURRENCY, minorFactor, currencyInfo } from './currency';

export const toCents = (amount: number): number => Math.round(amount * 100);
export const toUnits = (cents: number): number => cents / 100;

/**
 * Μορφοποίηση για εμφάνιση, π.χ. 8000 -> "80,00 €".
 * Τα δεκαδικά έρχονται από το μητρώο νομισμάτων, όχι σταθερά δύο:
 * το ίδιο νούμερο σε γιεν είναι "8.000 ¥", όχι "80,00 ¥".
 */
export function formatMoney(
  cents: number,
  locale: string = 'el-GR',
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  const { minorUnits } = currencyInfo(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(cents / minorFactor(currency));
}

/** Συμπαγής μορφή για άξονες γραφημάτων: 128000 -> "1.280 €". */
export function formatCompact(
  cents: number,
  locale: string = 'el-GR',
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / minorFactor(currency));
}

export function formatPercent(ratio: number, locale: string = 'el-GR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(ratio);
}

/* --- Ημερομηνίες: δουλεύουμε με strings, χωρίς Date, για να μη μας χαλάσουν οι ζώνες ώρας --- */

export const monthKeyOf = (date: ISODate): MonthKey => date.slice(0, 7);

export function currentMonthKey(now: Date = new Date()): MonthKey {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Προσθέτει (ή αφαιρεί) μήνες σε ένα κλειδί μήνα. */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${year}-${String(mm).padStart(2, '0')}`;
}

/** Πλήθος μηνών από το `from` έως το `to`. Ποτέ αρνητικό. */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

/** Λίστα διαδοχικών μηνών, π.χ. τελευταίοι 6 μήνες πριν από τον τρέχοντα. */
export function monthRange(endMonth: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - count + 1));
}

/** Σύντομο όνομα μήνα για τους άξονες: '2026-03' -> 'Μάρ'. */
export function monthLabel(month: MonthKey, locale: string = 'el-GR'): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(y, m - 1, 1));
}
