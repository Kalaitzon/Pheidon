// Πόσα μπορείς να ξοδέψεις για γούστα αυτόν τον μήνα.
//
// Ο υπολογισμός είναι αφαίρεση, με αυτή τη σειρά:
//
//   έσοδα μήνα
//   − πάγια            (ενοίκιο, δάνειο, λογαριασμοί — δεν διαπραγματεύονται)
//   − αναγκαία         (σούπερ μάρκετ, μετακινήσεις — στη διάμεσο, όχι στον μέσο όρο)
//   − δόση στόχων      (όσα πρέπει να μπουν στην άκρη για να βγει το πλάνο)
//   − μαξιλάρι         (ποσοστό για τα απρόβλεπτα)
//   = διαθέσιμο για γούστα
//
// Δύο πράγματα που το κάνουν να δουλεύει στην πράξη:
//
// 1. Τα έσοδα έρχονται από την πρόβλεψη, όχι από το ιστορικό. Όταν λήγει η
//    σύμβαση τον Φεβρουάριο, το όριο του Μαρτίου πέφτει μόνο του, χωρίς να
//    χρειαστεί ο χρήστης να θυμηθεί να το κατεβάσει.
// 2. Οι στόχοι πληρώνονται ΠΡΙΝ από τα γούστα. Αν έμπαιναν τελευταίοι, θα
//    πληρώνονταν με ό,τι περίσσευε, δηλαδή σχεδόν ποτέ.

import type {
  AllowanceStatus,
  Category,
  CategoryStats,
  GoalPlan,
  MonthKey,
  MonthlyForecast,
  MonthlySummary,
  SpendingAllowance,
} from '../types/finance';

/** Προεπιλεγμένο μαξιλάρι: 5% του εισοδήματος για τα απρόβλεπτα. */
export const DEFAULT_BUFFER_RATIO = 0.05;

/** Κάτω από αυτό το ποσοστό υπολοίπου, το όριο θεωρείται σφιχτό. */
const TIGHT_THRESHOLD = 0.2;

/* ------------------------------------------------------------------ */

export interface EssentialBreakdown {
  fixedCents: number;
  essentialsCents: number;
  /** Τα ευέλικτα, δηλαδή αυτά που ΜΕΤΡΑΝΕ στο όριο των γούστων. */
  flexibleCategoryIds: string[];
}

/**
 * Χωρίζει τα μηνιαία έξοδα σε πάγια, αναγκαία και ελεύθερα.
 *
 * Χρησιμοποιεί τη διάμεσο και όχι τον μέσο όρο: μία ακριβή αγορά τον Δεκέμβριο
 * δεν πρέπει να μικραίνει το όριο όλων των επόμενων μηνών.
 */
export function splitEssentials(
  categories: Category[],
  stats: CategoryStats[],
  recurringByCategory: Record<string, number> = {},
): EssentialBreakdown {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  let fixedCents = 0;
  let essentialsCents = 0;
  const flexibleCategoryIds: string[] = [];

  for (const stat of stats) {
    const category = categoryById.get(stat.categoryId);
    if (!category || category.archived) continue;

    // Σειρά προτεραιότητας: πάγιος κανόνας, μετά δηλωμένο πλαφόν, μετά στατιστική.
    // Ο χρήστης ξέρει το ενοίκιό του καλύτερα από τον μέσο όρο έξι μηνών.
    const baseline =
      recurringByCategory[stat.categoryId] ??
      (stat.monthlyMedianCents || stat.monthlyAverageCents);

    if (category.flexibility === 'fixed') {
      fixedCents += recurringByCategory[stat.categoryId] ?? category.monthlyBudgetCents ?? baseline;
    } else if (category.flexibility === 'semi_flexible') {
      essentialsCents += category.monthlyBudgetCents ?? baseline;
    } else {
      flexibleCategoryIds.push(category.id);
    }
  }

  return { fixedCents, essentialsCents, flexibleCategoryIds };
}

/* ------------------------------------------------------------------ */

export interface AllowanceInput {
  month: MonthKey;
  /** Τα προβλεπόμενα έσοδα του μήνα. Από `buildForecast`. */
  incomeCents: number;
  categories: Category[];
  categoryStats: CategoryStats[];
  /** Τα ενεργά πλάνα στόχων. Η δόση τους αφαιρείται πριν από τα γούστα. */
  goalPlans?: GoalPlan[];
  /** Η σύνοψη του τρέχοντος μήνα, για να ξέρουμε τι έχει ήδη ξοδευτεί. */
  currentSummary?: MonthlySummary;
  bufferRatio?: number;
  /** Τα πάγια ανά κατηγορία, από το `monthlyEquivalentByCategory`. */
  recurringByCategory?: Record<string, number>;
  /**
   * Χρήματα που έχουν ήδη ξοδευτεί σε ανοιχτά ταξίδια.
   * Δεν είναι ακόμη συναλλαγές, αλλά έχουν φύγει από το πορτοφόλι.
   */
  committedCents?: number;
  /** Η σημερινή ημερομηνία, για τον υπολογισμό των ημερών που απομένουν. */
  today?: Date;
}

export function computeAllowance(input: AllowanceInput): SpendingAllowance {
  const {
    month,
    incomeCents,
    categories,
    categoryStats,
    goalPlans = [],
    currentSummary,
    bufferRatio = DEFAULT_BUFFER_RATIO,
    recurringByCategory = {},
    committedCents = 0,
    today = new Date(),
  } = input;

  const { fixedCents, essentialsCents, flexibleCategoryIds } = splitEssentials(
    categories,
    categoryStats,
    recurringByCategory,
  );

  const goalContributionCents = goalPlans.reduce(
    (sum, plan) => sum + Math.max(0, plan.requiredMonthlyCents),
    0,
  );

  const bufferCents = Math.round(Math.max(0, incomeCents) * bufferRatio);

  const allowanceCents =
    incomeCents - fixedCents - essentialsCents - goalContributionCents - bufferCents;

  /* --- Τι έχει ήδη ξοδευτεί σε ευέλικτες κατηγορίες --- */
  const flexible = new Set(flexibleCategoryIds);
  const spentCents = Object.entries(currentSummary?.expenseByCategory ?? {})
    .filter(([categoryId]) => flexible.has(categoryId))
    .reduce((sum, [, value]) => sum + value, 0);

  // Τα δεσμευμένα μετράνε ως ξοδεμένα: αλλιώς, όσο τρέχει ένα ταξίδι, η
  // εφαρμογή θα σου έλεγε ότι έχεις ακόμη περιθώριο για γούστα.
  const spentIncludingCommitted = spentCents + committedCents;
  const remainingCents = allowanceCents - spentIncludingCommitted;
  const daysRemaining = daysLeftInMonth(month, today);

  return {
    month,
    incomeCents,
    fixedCents,
    essentialsCents,
    goalContributionCents,
    bufferCents,
    // Το όριο δεν εμφανίζεται ποτέ αρνητικό: αν βγαίνει αρνητικό, το πρόβλημα
    // δεν είναι τα γούστα και το λέει το status.
    allowanceCents: Math.max(0, allowanceCents),
    spentCents: spentIncludingCommitted,
    remainingCents,
    dailyRemainingCents:
      daysRemaining > 0 ? Math.floor(Math.max(0, remainingCents) / daysRemaining) : 0,
    daysRemaining,
    status: assessStatus(allowanceCents, remainingCents),
  };
}

function assessStatus(allowance: number, remaining: number): AllowanceStatus {
  // Αρνητικό όριο σημαίνει ότι δεν βγαίνουν ούτε τα αναγκαία μαζί με τους στόχους.
  if (allowance <= 0) return 'impossible';
  if (remaining < 0) return 'over';
  if (remaining < allowance * TIGHT_THRESHOLD) return 'tight';
  return 'comfortable';
}

/** Ημέρες που απομένουν στον μήνα. Για μελλοντικούς μήνες, όλος ο μήνας. */
function daysLeftInMonth(month: MonthKey, today: Date): number {
  const [year, m] = month.split('-').map(Number);
  const totalDays = new Date(year, m, 0).getDate();

  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === m;
  if (!isCurrent) {
    const isPast =
      year < today.getFullYear() ||
      (year === today.getFullYear() && m < today.getMonth() + 1);
    return isPast ? 0 : totalDays;
  }
  return totalDays - today.getDate() + 1;
}

/* ------------------------------------------------------------------ */
/* Πρόβλεψη ορίου για τους επόμενους μήνες                             */
/* ------------------------------------------------------------------ */

/**
 * Το ίδιο όριο, υπολογισμένο για κάθε μήνα της πρόβλεψης.
 *
 * Εδώ φαίνεται η αξία: ο χρήστης βλέπει από τον Οκτώβριο ότι τον Μάρτιο το
 * διαθέσιμό του πέφτει, και προλαβαίνει να προσαρμοστεί αντί να το ανακαλύψει.
 */
export function forecastAllowances(
  forecast: MonthlyForecast[],
  base: Omit<AllowanceInput, 'month' | 'incomeCents' | 'currentSummary'>,
): SpendingAllowance[] {
  return forecast.map((entry) =>
    computeAllowance({ ...base, month: entry.month, incomeCents: entry.incomeCents }),
  );
}

/** Ο πρώτος μήνας όπου το όριο πέφτει αισθητά. Τροφοδοτεί την προειδοποίηση. */
export function findAllowanceDrop(
  allowances: SpendingAllowance[],
  threshold = 0.25,
): { month: MonthKey; beforeCents: number; afterCents: number } | null {
  for (let i = 1; i < allowances.length; i++) {
    const before = allowances[i - 1].allowanceCents;
    const after = allowances[i].allowanceCents;
    if (before > 0 && (before - after) / before >= threshold) {
      return { month: allowances[i].month, beforeCents: before, afterCents: after };
    }
  }
  return null;
}
