// Νομίσματα.
//
// Ο χρήστης διαλέγει ένα νόμισμα και όλη η εφαρμογή δουλεύει σε αυτό. Δεν γίνονται
// μετατροπές και δεν χρειάζεται πουθενά σύνδεση για ισοτιμίες.
//
// Το ένα πράγμα που πρέπει να γίνει σωστά: δεν έχουν όλα τα νομίσματα 100
// υποδιαιρέσεις. Το γιεν δεν έχει καθόλου δεκαδικά, το δηνάριο Κουβέιτ έχει τρία.
// Ο κώδικας που διαιρεί παντού με το 100 εμφανίζει 10.000 γιεν ως «100 ¥».

import type { CurrencyCode } from '../types/finance';
export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  /** Πλήθος δεκαδικών ψηφίων κατά ISO 4217. */
  minorUnits: number;
}

/** Τα νομίσματα που εμφανίζονται στον επιλογέα. Η σειρά είναι η σειρά εμφάνισης. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', symbol: '€', minorUnits: 2 },
  { code: 'USD', symbol: '$', minorUnits: 2 },
  { code: 'GBP', symbol: '£', minorUnits: 2 },
  { code: 'CHF', symbol: 'CHF', minorUnits: 2 },
  { code: 'BGN', symbol: 'лв', minorUnits: 2 },
  { code: 'TRY', symbol: '₺', minorUnits: 2 },
  { code: 'RON', symbol: 'lei', minorUnits: 2 },
  { code: 'SEK', symbol: 'kr', minorUnits: 2 },
  { code: 'CAD', symbol: '$', minorUnits: 2 },
  { code: 'AUD', symbol: '$', minorUnits: 2 },
  { code: 'JPY', symbol: '¥', minorUnits: 0 },
];

export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

const CURRENCY_INDEX = new Map(CURRENCIES.map((c) => [c.code, c]));

export const currencyInfo = (code: CurrencyCode): CurrencyInfo =>
  CURRENCY_INDEX.get(code) ?? { code, symbol: code, minorUnits: 2 };

/** Ο πολλαπλασιαστής υποδιαίρεσης: 100 για ευρώ, 1 για γιεν. */
export const minorFactor = (code: CurrencyCode): number =>
  10 ** currencyInfo(code).minorUnits;

/** Από ανθρώπινο ποσό σε ακέραιες υποδιαιρέσεις. 12,34 EUR -> 1234. */
export const toMinor = (amount: number, code: CurrencyCode): number =>
  Math.round(amount * minorFactor(code));

/** Το αντίστροφο. */
export const fromMinor = (minor: number, code: CurrencyCode): number =>
  minor / minorFactor(code);

/* ------------------------------------------------------------------ */
/* Μορφοποίηση                                                         */
/* ------------------------------------------------------------------ */

export function formatAmount(
  amountMinor: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  locale: string = 'el-GR',
): string {
  const { minorUnits } = currencyInfo(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(amountMinor / minorFactor(currency));
}
