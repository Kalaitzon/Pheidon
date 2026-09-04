// Πάγια έσοδα και έξοδα.
//
// Ένας κανόνας κάνει δύο πράγματα που είναι εύκολο να μπερδευτούν:
//
//   materializeDue()  Δημιουργεί ΠΡΑΓΜΑΤΙΚΕΣ συναλλαγές για μήνες που έχουν ήδη
//                     φτάσει. Αυτές μπαίνουν στη βάση και μετριούνται στα σύνολα.
//
//   projectMonths()   Λέει τι ΠΕΡΙΜΕΝΟΥΜΕ στους επόμενους μήνες. Δεν δημιουργεί
//                     τίποτα. Τροφοδοτεί την πρόβλεψη και τους στόχους.
//
// Ο διαχωρισμός είναι σκόπιμος. Αν δημιουργούσαμε συναλλαγές για το μέλλον, τα
// έξοδα του Δεκεμβρίου θα φαίνονταν σήμερα ως πραγματικά και το υπόλοιπό σου θα
// ήταν λάθος. Αν πάλι δεν προβάλλαμε τίποτα, κάθε πλάνο θα υπέθετε ότι το ενοίκιο
// σταματά σήμερα.

import type {
  MonthKey,
  RecurringRule,
  Transaction,
  TransactionKind,
} from '../types/finance';
import { currentMonthKey, monthKeyOf, monthsBetween, shiftMonth } from './money';

/** Πόσοι μήνες μεσολαβούν ανάλογα με τη συχνότητα. */
const STEP: Record<RecurringRule['frequency'], number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  yearly: 12,
};

/** Ισχύει ο κανόνας τον συγκεκριμένο μήνα; */
export function appliesTo(rule: RecurringRule, month: MonthKey): boolean {
  if (!rule.active) return false;
  if (month < rule.startMonth) return false;
  if (rule.endMonth && month > rule.endMonth) return false;

  // Για τρίμηνα και ετήσια, μετράμε από τον μήνα έναρξης.
  const offset = monthsBetween(rule.startMonth, month);
  return offset % STEP[rule.frequency] === 0;
}

/** Πόσες ημέρες έχει ο συγκεκριμένος μήνας. */
export function daysInMonth(month: MonthKey): number {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 0).getDate();
}

/**
 * Η ημερομηνία της συναλλαγής για τον συγκεκριμένο μήνα.
 *
 * Αν η ημέρα δεν υπάρχει στον μήνα, πέφτει στην τελευταία ημέρα του.
 * Ένα ενοίκιο «κάθε 31η» πληρώνεται 31 Ιανουαρίου, 28 Φεβρουαρίου, 31 Μαρτίου.
 * Αυτό κάνει και η τράπεζα με τις πάγιες εντολές.
 */
export const dateFor = (rule: RecurringRule, month: MonthKey): string => {
  const day = Math.min(Math.max(1, rule.dayOfMonth), daysInMonth(month));
  return `${month}-${String(day).padStart(2, '0')}`;
};

/* ------------------------------------------------------------------ */
/* Δημιουργία συναλλαγών που έχουν λήξει                               */
/* ------------------------------------------------------------------ */

export interface MaterializeResult {
  transactions: Transaction[];
  /** Οι κανόνες με ενημερωμένο `lastGeneratedMonth`, για αποθήκευση. */
  updatedRules: RecurringRule[];
}

/**
 * Δημιουργεί όσες συναλλαγές οφείλονται μέχρι σήμερα και δεν έχουν ήδη γίνει.
 *
 * Καλείται μία φορά στο άνοιγμα της εφαρμογής. Αν λείπεις δύο μήνες, θα
 * δημιουργηθούν και οι δύο μαζί, όχι μόνο ο τελευταίος.
 */
export function materializeDue(
  rules: RecurringRule[],
  existing: Transaction[],
  options: { userId: string; today?: Date } ,
): MaterializeResult {
  const { userId, today = new Date() } = options;
  const thisMonth = currentMonthKey(today);
  const todayIso = today.toISOString().slice(0, 10);

  // Διπλή δικλείδα: και το lastGeneratedMonth του κανόνα, και έλεγχος στις
  // υπάρχουσες συναλλαγές. Η δεύτερη πιάνει την περίπτωση όπου ο χρήστης
  // διέγραψε χειροκίνητα μια αυτόματη εγγραφή και δεν τη θέλει πίσω.
  const seen = new Set(
    existing
      .filter((tx) => tx.recurringId)
      .map((tx) => `${tx.recurringId}:${monthKeyOf(tx.date)}`),
  );

  const transactions: Transaction[] = [];
  const updatedRules: RecurringRule[] = [];

  for (const rule of rules) {
    if (!rule.active) continue;

    let generatedUpTo = rule.lastGeneratedMonth;
    let month = rule.lastGeneratedMonth
      ? shiftMonth(rule.lastGeneratedMonth, 1)
      : rule.startMonth;

    while (month <= thisMonth) {
      const key = `${rule.id}:${month}`;
      const date = dateFor(rule, month);

      // Μέσα στον τρέχοντα μήνα, δεν προτρέχουμε: το ενοίκιο της 1ης δεν
      // καταχωρείται στις 25 του προηγούμενου.
      if (appliesTo(rule, month) && !seen.has(key) && date <= todayIso) {
        transactions.push(buildFromRule(rule, month, userId));
        generatedUpTo = month;
      } else if (appliesTo(rule, month) && date > todayIso) {
        break;
      } else if (appliesTo(rule, month)) {
        generatedUpTo = month;
      }
      month = shiftMonth(month, 1);
    }

    if (generatedUpTo !== rule.lastGeneratedMonth) {
      updatedRules.push({ ...rule, lastGeneratedMonth: generatedUpTo });
    }
  }

  return { transactions, updatedRules };
}

function buildFromRule(rule: RecurringRule, month: MonthKey, userId: string): Transaction {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    kind: rule.kind,
    amountCents: rule.amountCents,
    currency: rule.currency,
    categoryId: rule.categoryId,
    date: dateFor(rule, month),
    note: rule.note,
    merchant: rule.label,
    recurringId: rule.id,
    createdAt: now,
    updatedAt: now,
    syncState: 'pending',
  };
}

/* ------------------------------------------------------------------ */
/* Προβολή στο μέλλον                                                  */
/* ------------------------------------------------------------------ */

export interface MonthProjection {
  month: MonthKey;
  incomeCents: number;
  expenseCents: number;
  /** Ανά κατηγορία, για να μη διπλομετρηθούν με τους μέσους όρους. */
  byCategory: Record<string, number>;
}

/** Τι αναμένεται από τα πάγια σε κάθε μήνα ενός διαστήματος. */
export function projectMonths(rules: RecurringRule[], months: MonthKey[]): MonthProjection[] {
  return months.map((month) => {
    const projection: MonthProjection = {
      month,
      incomeCents: 0,
      expenseCents: 0,
      byCategory: {},
    };

    for (const rule of rules) {
      if (!appliesTo(rule, month)) continue;
      if (rule.kind === 'income') projection.incomeCents += rule.amountCents;
      else {
        projection.expenseCents += rule.amountCents;
        projection.byCategory[rule.categoryId] =
          (projection.byCategory[rule.categoryId] ?? 0) + rule.amountCents;
      }
    }
    return projection;
  });
}

/**
 * Το μέσο μηνιαίο κόστος ανά κατηγορία από τα πάγια.
 *
 * Ένας ετήσιος κανόνας 240€ μετράει ως 20€ τον μήνα. Αλλιώς η ασφάλεια
 * αυτοκινήτου θα έδειχνε μηδέν έντεκα μήνες και μια καταστροφή τον δωδέκατο.
 */
export function monthlyEquivalentByCategory(
  rules: RecurringRule[],
  kind: TransactionKind = 'expense',
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const rule of rules) {
    if (!rule.active || rule.kind !== kind) continue;
    const monthly = Math.round(rule.amountCents / STEP[rule.frequency]);
    totals[rule.categoryId] = (totals[rule.categoryId] ?? 0) + monthly;
  }
  return totals;
}

/** Το συνολικό μηνιαίο πάγιο εισόδημα, για την πρόβλεψη ταμείου. */
export const monthlyRecurringIncome = (rules: RecurringRule[]): number =>
  Object.values(monthlyEquivalentByCategory(rules, 'income')).reduce((a, b) => a + b, 0);

/** Οι επόμενες οφειλές, για την ειδοποίηση «τι έρχεται». */
export function upcoming(
  rules: RecurringRule[],
  options: { from?: Date; days?: number } = {},
): Array<{ rule: RecurringRule; date: string }> {
  const { from = new Date(), days = 14 } = options;
  const fromIso = from.toISOString().slice(0, 10);
  const until = new Date(from);
  until.setDate(until.getDate() + days);
  const untilIso = until.toISOString().slice(0, 10);

  const months = [currentMonthKey(from), shiftMonth(currentMonthKey(from), 1)];

  return rules
    .filter((rule) => rule.active)
    .flatMap((rule) =>
      months
        .filter((month) => appliesTo(rule, month))
        .map((month) => ({ rule, date: dateFor(rule, month) })),
    )
    .filter((item) => item.date >= fromIso && item.date <= untilIso)
    .sort((a, b) => a.date.localeCompare(b.date));
}
