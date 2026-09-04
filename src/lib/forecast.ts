// Πρόβλεψη ταμειακών ροών.
//
// Η βασική ιδέα: ο χρήστης δηλώνει τι ξέρει ("δουλειά έως τον Φεβρουάριο, 700€"),
// και για ό,τι δεν ξέρει χρησιμοποιούμε το ιστορικό του, σημειώνοντάς το ρητά ως
// εκτίμηση. Χωρίς αυτόν τον διαχωρισμό, ένα πλάνο 2 ετών είναι απλώς μια ευχή.

import type {
  Category,
  CategoryStats,
  ExpectedEvent,
  IncomeConfidence,
  IncomeCliff,
  IncomeExpectation,
  MonthKey,
  MonthlyForecast,
} from '../types/finance';
import { monthRange, monthsBetween, shiftMonth } from './money';

/**
 * Συντελεστές έκπτωσης ανά βεβαιότητα.
 *
 * Ένα «πιθανό» έσοδο δεν μπαίνει στο πλάνο ολόκληρο. Αν το βάζαμε 100%, η εφαρμογή
 * θα σου έλεγε ότι ο στόχος βγαίνει, και τον Μάρτιο θα ανακάλυπτες ότι δεν βγαίνει.
 * Προτιμούμε να υποσχόμαστε λιγότερα.
 */
export const CONFIDENCE_WEIGHT: Record<IncomeConfidence, number> = {
  confirmed: 1,
  likely: 0.8,
  uncertain: 0.5,
};

/** Πτώση εσόδων μεγαλύτερη από αυτό το ποσοστό θεωρείται «γκρεμός» και επισημαίνεται. */
const CLIFF_THRESHOLD = 0.2;

export interface ForecastInput {
  fromMonth: MonthKey;
  toMonth: MonthKey;
  incomeExpectations: IncomeExpectation[];
  events?: ExpectedEvent[];
  /**
   * Μέσο μηνιαίο έσοδο από το ιστορικό. Χρησιμοποιείται μόνο για μήνες που
   * δεν καλύπτονται από καμία δήλωση, και σημαδεύεται ως εκτίμηση.
   */
  fallbackMonthlyIncomeCents: number;
  /** Μέσα μηνιαία έξοδα ανά κατηγορία, από το `computeCategoryStats`. */
  categoryStats: CategoryStats[];
  categories: Category[];
  /** Αν ο χρήστης έχει ήδη αποφασίσει περικοπές, μπαίνουν εδώ (categoryId -> cents/μήνα). */
  plannedCuts?: Record<string, number>;
  /** Τα πάγια, από το `monthlyEquivalentByCategory`. Υπερισχύουν των μέσων όρων. */
  recurringByCategory?: Record<string, number>;
  /** Πάγιο εισόδημα που δεν καλύπτεται από δηλωμένη περίοδο εσόδου. */
  recurringIncomeCents?: number;
}

const isActive = (expectation: IncomeExpectation, month: MonthKey): boolean =>
  month >= expectation.startMonth && (!expectation.endMonth || month <= expectation.endMonth);

/** Σταθμισμένο έσοδο ενός μήνα από τις δηλώσεις. Επιστρέφει και ποιες δηλώσεις μέτρησαν. */
function incomeForMonth(
  expectations: IncomeExpectation[],
  month: MonthKey,
): { cents: number; labels: string[]; declared: boolean } {
  const active = expectations.filter((e) => isActive(e, month));
  const cents = active.reduce(
    (sum, e) => sum + Math.round(e.monthlyAmountCents * CONFIDENCE_WEIGHT[e.confidence]),
    0,
  );
  return { cents, labels: active.map((e) => e.label), declared: active.length > 0 };
}

/**
 * Βασικά μηνιαία έξοδα ανά κατηγορία, μείον τυχόν περικοπές.
 *
 * Όπου υπάρχει πάγιο, το πάγιο ΥΠΕΡΙΣΧΥΕΙ του μέσου όρου. Το ενοίκιο είναι 450€
 * επειδή το λες εσύ, όχι επειδή αυτό βγάζει η στατιστική των τελευταίων μηνών.
 */
export function baselineMonthlyExpenses(
  categoryStats: CategoryStats[],
  plannedCuts: Record<string, number> = {},
  recurringByCategory: Record<string, number> = {},
): number {
  const seen = new Set<string>();

  const fromStats = categoryStats.reduce((sum, s) => {
    seen.add(s.categoryId);
    // Χρησιμοποιούμε τη διάμεσο, όχι τον μέσο όρο: μία ακριβή αγορά τον Δεκέμβριο
    // δεν πρέπει να ανεβάζει την πρόβλεψη όλων των επόμενων μηνών.
    const base = recurringByCategory[s.categoryId] ?? (s.monthlyMedianCents || s.monthlyAverageCents);
    return sum + Math.max(0, base - (plannedCuts[s.categoryId] ?? 0));
  }, 0);

  // Πάγια σε κατηγορίες χωρίς ιστορικό: ένα νέο ενοίκιο μετράει από τον πρώτο μήνα.
  const fromNewRules = Object.entries(recurringByCategory)
    .filter(([categoryId]) => !seen.has(categoryId))
    .reduce((sum, [, amount]) => sum + amount, 0);

  return fromStats + fromNewRules;
}

/** Χτίζει τη μηνιαία πρόβλεψη για όλο τον ορίζοντα. */
export function buildForecast(input: ForecastInput): MonthlyForecast[] {
  const {
    fromMonth,
    toMonth,
    incomeExpectations,
    events = [],
    fallbackMonthlyIncomeCents,
    categoryStats,
    plannedCuts = {},
    recurringByCategory = {},
    recurringIncomeCents = 0,
  } = input;

  const count = monthsBetween(fromMonth, toMonth) + 1;
  const months = monthRange(toMonth, count);
  const baseExpense = baselineMonthlyExpenses(categoryStats, plannedCuts, recurringByCategory);

  let cumulative = 0;

  return months.map((month) => {
    const declared = incomeForMonth(incomeExpectations, month);
    const notes: string[] = [];

    let incomeCents = declared.cents;
    if (!declared.declared) {
      // Προτεραιότητα στο πάγιο εισόδημα: είναι δήλωση του χρήστη, ενώ ο μέσος
      // όρος του ιστορικού είναι απλώς εικασία.
      incomeCents = recurringIncomeCents || fallbackMonthlyIncomeCents;
      notes.push(recurringIncomeCents ? 'income.fromRecurring' : 'income.assumedFromHistory');
    } else {
      notes.push(...declared.labels);
    }

    let expenseCents = baseExpense;

    for (const event of events.filter((e) => e.month === month)) {
      const weighted = Math.round(event.amountCents * CONFIDENCE_WEIGHT[event.confidence]);
      if (event.kind === 'income') incomeCents += weighted;
      else expenseCents += weighted;
      notes.push(event.label);
    }

    const surplusCents = incomeCents - expenseCents;
    cumulative += surplusCents;

    return {
      month,
      incomeCents,
      expenseCents,
      surplusCents,
      incomeIsAssumed: !declared.declared,
      cumulativeCents: cumulative,
      notes,
    };
  });
}

/**
 * Εντοπίζει τις απότομες πτώσεις εσόδων μέσα στον ορίζοντα.
 * Αυτό είναι που μετατρέπει το «δουλειά έως Φεβρουάριο» σε προειδοποίηση τον Νοέμβριο.
 */
export function detectIncomeCliffs(
  forecast: MonthlyForecast[],
  expectations: IncomeExpectation[],
): IncomeCliff[] {
  const cliffs: IncomeCliff[] = [];

  for (let i = 1; i < forecast.length; i++) {
    const before = forecast[i - 1];
    const after = forecast[i];
    if (before.incomeCents === 0) continue;
    const drop = (before.incomeCents - after.incomeCents) / before.incomeCents;
    if (drop < CLIFF_THRESHOLD) continue;

    // Ποια δήλωση έληξε ακριβώς τον προηγούμενο μήνα;
    const ended = expectations.find((e) => e.endMonth === before.month);

    cliffs.push({
      month: after.month,
      beforeCents: before.incomeCents,
      afterCents: after.incomeCents,
      label: ended?.label ?? 'income.unspecifiedDrop',
    });
  }
  return cliffs;
}

/** Ο πρώτος μήνας μετά τον τρέχοντα. Η πρόβλεψη ξεκινά πάντα από εκεί. */
export const nextMonthOf = (month: MonthKey): MonthKey => shiftMonth(month, 1);
