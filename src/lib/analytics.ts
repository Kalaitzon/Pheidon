// Στατιστικά. Καθαρές συναρτήσεις: ίδια είσοδος, ίδια έξοδος, μηδέν παρενέργειες.
// Εδώ γίνεται ΟΛΗ η αριθμητική. Το LLM δεν υπολογίζει ποτέ ποσά.

import type {
  CategoryStats,
  MonthKey,
  MonthlySummary,
  Transaction,
  Trend,
} from '../types/finance';
import { monthKeyOf, monthRange, shiftMonth } from './money';

/* ------------------------------------------------------------------ */
/* Μηνιαία σύνοψη                                                      */
/* ------------------------------------------------------------------ */

/** Ομαδοποιεί τις συναλλαγές ανά μήνα. Επιστρέφει σε αύξουσα χρονική σειρά. */
export function buildMonthlySummaries(transactions: Transaction[]): MonthlySummary[] {
  const byMonth = new Map<MonthKey, MonthlySummary>();

  for (const tx of transactions) {
    const month = monthKeyOf(tx.date);
    let summary = byMonth.get(month);
    if (!summary) {
      summary = {
        month,
        incomeCents: 0,
        expenseCents: 0,
        netCents: 0,
        expenseByCategory: {},
        transactionCount: 0,
      };
      byMonth.set(month, summary);
    }

    if (tx.kind === 'income') {
      summary.incomeCents += tx.amountCents;
    } else {
      summary.expenseCents += tx.amountCents;
      summary.expenseByCategory[tx.categoryId] =
        (summary.expenseByCategory[tx.categoryId] ?? 0) + tx.amountCents;
    }
    summary.transactionCount += 1;
  }

  const list = [...byMonth.values()];
  for (const s of list) s.netCents = s.incomeCents - s.expenseCents;
  return list.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Γεμίζει τα κενά ώστε το bar chart να έχει και τους μήνες χωρίς συναλλαγές.
 * Χωρίς αυτό, ένας άδειος Ιούλιος απλά εξαφανίζεται από το γράφημα.
 */
export function fillMissingMonths(
  summaries: MonthlySummary[],
  endMonth: MonthKey,
  count: number,
): MonthlySummary[] {
  const index = new Map(summaries.map((s) => [s.month, s]));
  return monthRange(endMonth, count).map(
    (month) =>
      index.get(month) ?? {
        month,
        incomeCents: 0,
        expenseCents: 0,
        netCents: 0,
        expenseByCategory: {},
        transactionCount: 0,
      },
  );
}

/* ------------------------------------------------------------------ */
/* Στατιστικά ανά κατηγορία                                            */
/* ------------------------------------------------------------------ */

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
};

/**
 * Τάση: συγκρίνει τους 3 πιο πρόσφατους μήνες με τους προηγούμενους.
 * Κατώφλι 12% ώστε ο θόρυβος να μη μετράει ως τάση.
 */
function detectTrend(series: number[]): Trend {
  if (series.length < 4) return 'stable';
  const recent = series.slice(-3);
  const earlier = series.slice(0, -3);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const recentAvg = avg(recent);
  const earlierAvg = avg(earlier);
  if (earlierAvg === 0) return recentAvg > 0 ? 'rising' : 'stable';
  const change = (recentAvg - earlierAvg) / earlierAvg;
  if (change > 0.12) return 'rising';
  if (change < -0.12) return 'falling';
  return 'stable';
}

export interface StatsOptions {
  /** Ο μήνας που εξετάζουμε. Προεπιλογή: ο τρέχων. */
  referenceMonth: MonthKey;
  /** Πόσους προηγούμενους μήνες λαμβάνουμε υπόψη για τον μέσο όρο. */
  lookbackMonths?: number;
}

/**
 * Υπολογίζει, ανά κατηγορία εξόδων, τον μηνιαίο μέσο όρο του ιστορικού
 * και πόσο αποκλίνει ο τρέχων μήνας από αυτόν.
 *
 * Σημαντικό: ο τρέχων μήνας ΔΕΝ μπαίνει στον μέσο όρο. Αλλιώς η υπέρβαση
 * θα ανέβαζε τον ίδιο τον μέσο όρο και θα κρυβόταν.
 */
export function computeCategoryStats(
  transactions: Transaction[],
  options: StatsOptions,
): CategoryStats[] {
  const { referenceMonth, lookbackMonths = 6 } = options;
  const summaries = buildMonthlySummaries(transactions);

  const current = summaries.find((s) => s.month === referenceMonth);
  const currentTotal = current?.expenseCents ?? 0;

  const firstHistoricalMonth = shiftMonth(referenceMonth, -lookbackMonths);
  const history = summaries.filter(
    (s) => s.month >= firstHistoricalMonth && s.month < referenceMonth,
  );

  const categoryIds = new Set<string>();
  for (const s of [...history, ...(current ? [current] : [])]) {
    Object.keys(s.expenseByCategory).forEach((id) => categoryIds.add(id));
  }

  return [...categoryIds].map((categoryId) => {
    // Οι μήνες με μηδέν σε αυτή την κατηγορία μετράνε ως 0, δεν παραλείπονται:
    // αν δεν ψώνισες τον Μάιο, ο μέσος όρος οφείλει να το δείξει.
    const series = history.map((s) => s.expenseByCategory[categoryId] ?? 0);
    const monthsObserved = series.length;
    const average =
      monthsObserved > 0
        ? Math.round(series.reduce((a, b) => a + b, 0) / monthsObserved)
        : 0;
    const currentMonthCents = current?.expenseByCategory[categoryId] ?? 0;

    return {
      categoryId,
      monthlyAverageCents: average,
      monthlyMedianCents: median(series),
      currentMonthCents,
      deviationRatio: average > 0 ? (currentMonthCents - average) / average : 0,
      monthsObserved,
      trend: detectTrend([...series, currentMonthCents]),
      shareOfMonth: currentTotal > 0 ? currentMonthCents / currentTotal : 0,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Συγκεντρωτικά για το Dashboard                                      */
/* ------------------------------------------------------------------ */

export interface DashboardTotals {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  /** Ποσοστό αποταμίευσης: net / income. Το βασικό νούμερο υγείας. */
  savingsRate: number;
  /** Μεταβολή εξόδων σε σχέση με τον προηγούμενο μήνα (0.1 = +10%). */
  expenseChangeVsPrevious: number;
}

export function computeDashboardTotals(
  summaries: MonthlySummary[],
  referenceMonth: MonthKey,
): DashboardTotals {
  const current = summaries.find((s) => s.month === referenceMonth);
  const previous = summaries.find((s) => s.month === shiftMonth(referenceMonth, -1));

  const incomeCents = current?.incomeCents ?? 0;
  const expenseCents = current?.expenseCents ?? 0;
  const prevExpense = previous?.expenseCents ?? 0;

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    savingsRate: incomeCents > 0 ? (incomeCents - expenseCents) / incomeCents : 0,
    expenseChangeVsPrevious: prevExpense > 0 ? (expenseCents - prevExpense) / prevExpense : 0,
  };
}

/**
 * Φτιάχνει σύνοψη για μήνα που δεν έχει ακόμη συναλλαγές, από τα πάγια.
 *
 * Έτσι μπορείς να δεις τον Οκτώβριο μέσα στον Σεπτέμβριο: τι θα μπει, τι θα
 * βγει και τι θα μείνει. Δεν είναι πρόβλεψη με στατιστική, είναι απλή άθροιση
 * όσων έχεις δηλώσει ότι επαναλαμβάνονται.
 */
export function projectedSummary(
  month: MonthKey,
  recurring: { incomeCents: number; expenseCents: number; byCategory: Record<string, number> },
): MonthlySummary {
  return {
    month,
    incomeCents: recurring.incomeCents,
    expenseCents: recurring.expenseCents,
    netCents: recurring.incomeCents - recurring.expenseCents,
    expenseByCategory: { ...recurring.byCategory },
    transactionCount: 0,
  };
}

/** Μέσο μηνιαίο πλεόνασμα των τελευταίων μηνών. Τροφοδοτεί την πρόβλεψη στόχων. */
export function averageMonthlySurplus(
  summaries: MonthlySummary[],
  referenceMonth: MonthKey,
  lookbackMonths = 6,
): number {
  const from = shiftMonth(referenceMonth, -lookbackMonths);
  const window = summaries.filter((s) => s.month >= from && s.month <= referenceMonth);
  if (window.length === 0) return 0;
  return Math.round(window.reduce((sum, s) => sum + s.netCents, 0) / window.length);
}
