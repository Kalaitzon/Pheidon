// Πλάνο οικονομικών στόχων.
//
// Η σειρά των ερωτήσεων που απαντά, με αυτή τη σειρά:
//   1. Με βάση όσα ξέρουμε για τα έσοδα, πόσα θα μαζευτούν μέχρι την ημερομηνία;
//   2. Πόσα λείπουν;
//   3. Τι περικοπές είναι ΠΡΑΓΜΑΤΙΚΑ διαθέσιμες; (όχι θεωρητικές: μόνο ευέλικτα έξοδα,
//      με ανώτατο ποσοστό, ποτέ ενοίκιο ή λογαριασμοί)
//   4. Αν ούτε αυτές φτάνουν, ποιες είναι οι εναλλακτικές που θα πρότεινε άνθρωπος;
//      Μετάθεση ημερομηνίας, μείωση ποσού, ή εύρεση επιπλέον εσόδου.
//
// Το βήμα 4 είναι το σημαντικό. Μια εφαρμογή που λέει «κόψε 400€ από τη διασκέδαση»
// όταν η διασκέδαση είναι 90€, χάνει την εμπιστοσύνη του χρήστη μια για πάντα.

import type {
  Category,
  CategoryStats,
  ExpectedEvent,
  FinancialGoal,
  Feasibility,
  GoalAlternatives,
  GoalPlan,
  GoalStrategy,
  IncomeExpectation,
  MonthKey,
  MonthlyForecast,
  SuggestedAction,
} from '../types/finance';
import { buildForecast, detectIncomeCliffs, nextMonthOf } from './forecast';
import { monthKeyOf, monthsBetween, shiftMonth } from './money';

/** Πόσο επιθετικά κόβουμε τα ευέλικτα έξοδα, ανά στρατηγική. */
const CUT_RATIO: Record<GoalStrategy, number> = {
  conservative: 0.15,
  balanced: 0.3,
  aggressive: 0.5,
};

/** Τα ημιευέλικτα (σούπερ μάρκετ, μετακινήσεις) κόβονται πάντα λιγότερο. */
const SEMI_FLEXIBLE_FACTOR = 0.4;

const ROUND_TO = 500; // στρογγυλοποίηση προτάσεων στα 5€

const roundTo = (cents: number, step = ROUND_TO) => Math.round(cents / step) * step;

export interface GoalPlanInput {
  goal: FinancialGoal;
  /** Ο τρέχων μήνας. Η πρόβλεψη ξεκινά από τον επόμενο. */
  referenceMonth: MonthKey;
  categories: Category[];
  categoryStats: CategoryStats[];
  incomeExpectations: IncomeExpectation[];
  events?: ExpectedEvent[];
  fallbackMonthlyIncomeCents: number;
}

/* ------------------------------------------------------------------ */
/* Διαθέσιμες περικοπές                                                */
/* ------------------------------------------------------------------ */

/**
 * Πόσο μπορεί να κοπεί πραγματικά κάθε κατηγορία, ανά μήνα.
 * Επιστρέφει ταξινομημένα από τη μεγαλύτερη δυνατή περικοπή προς τη μικρότερη.
 */
export function availableCuts(
  categories: Category[],
  stats: CategoryStats[],
  strategy: GoalStrategy,
  protectedIds: string[] = [],
): SuggestedAction[] {
  const protectedSet = new Set(protectedIds);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return stats
    .map((s) => {
      const category = categoryById.get(s.categoryId);
      if (!category || category.archived) return null;
      // Δύο πηγές προστασίας: η δήλωση του χρήστη στην κατηγορία και οι
      // προστατευμένες κατηγορίες του συγκεκριμένου στόχου.
      if (category.userProtected) return null;
      if (protectedSet.has(s.categoryId)) return null;
      // Τα πάγια δεν αγγίζονται ποτέ από αυτόν τον αλγόριθμο.
      if (category.flexibility === 'fixed') return null;

      const base = s.monthlyMedianCents || s.monthlyAverageCents;
      const ratio =
        CUT_RATIO[strategy] *
        (category.flexibility === 'semi_flexible' ? SEMI_FLEXIBLE_FACTOR : 1);
      const cut = roundTo(base * ratio);
      if (cut < ROUND_TO) return null;

      return {
        categoryId: s.categoryId,
        deltaCents: cut,
        suggestedMonthlyCents: base - cut,
      } satisfies SuggestedAction;
    })
    .filter((x): x is SuggestedAction => x !== null)
    .sort((a, b) => b.deltaCents - a.deltaCents);
}

/** Επιλέγει τις λιγότερες δυνατές περικοπές που καλύπτουν το ζητούμενο ποσό. */
function selectCuts(pool: SuggestedAction[], neededMonthlyCents: number): SuggestedAction[] {
  const chosen: SuggestedAction[] = [];
  let remaining = neededMonthlyCents;

  for (const candidate of pool) {
    if (remaining <= 0) break;
    const cut = roundTo(Math.min(candidate.deltaCents, remaining));
    if (cut < ROUND_TO) continue;
    chosen.push({
      categoryId: candidate.categoryId,
      deltaCents: cut,
      suggestedMonthlyCents: candidate.suggestedMonthlyCents + (candidate.deltaCents - cut),
    });
    remaining -= cut;
  }
  return chosen;
}

/* ------------------------------------------------------------------ */
/* Το κύριο πλάνο                                                      */
/* ------------------------------------------------------------------ */

export function buildGoalPlan(input: GoalPlanInput): GoalPlan {
  const {
    goal,
    referenceMonth,
    categories,
    categoryStats,
    incomeExpectations,
    events,
    fallbackMonthlyIncomeCents,
  } = input;

  const fromMonth = nextMonthOf(referenceMonth);
  const targetMonth = monthKeyOf(goal.targetDate);
  const monthsRemaining = monthsBetween(fromMonth, targetMonth) + 1;

  const forecast = buildForecast({
    fromMonth,
    toMonth: targetMonth,
    incomeExpectations,
    events,
    fallbackMonthlyIncomeCents,
    categoryStats,
    categories,
  });

  const cliffs = detectIncomeCliffs(forecast, incomeExpectations);

  const remainingToSave = Math.max(0, goal.targetAmountCents - goal.savedAmountCents);
  const requiredMonthlyCents =
    monthsRemaining > 0 ? Math.ceil(remainingToSave / monthsRemaining) : remainingToSave;

  // Προσοχή: τα ελλείμματα μετράνε αρνητικά. Αν τα μηδενίζαμε, η εφαρμογή θα
  // παρουσίαζε έναν ελλειμματικό μήνα ως ουδέτερο και το πλάνο θα ήταν ψεύτικο.
  const projectedTotal = forecast.reduce((sum, m) => sum + m.surplusCents, 0);
  const projectedMonthlyCents =
    monthsRemaining > 0 ? Math.round(projectedTotal / monthsRemaining) : 0;

  const monthlyGapCents = requiredMonthlyCents - projectedMonthlyCents;
  const totalGapCents = Math.max(0, remainingToSave - projectedTotal);

  /* --- Περικοπές: μόνο όσες χρειάζονται, από τις πραγματικά διαθέσιμες --- */
  const pool = availableCuts(categories, categoryStats, goal.strategy, goal.protectedCategoryIds);
  const maxCutsMonthly = pool.reduce((sum, c) => sum + c.deltaCents, 0);
  const reallocations = monthlyGapCents > 0 ? selectCuts(pool, monthlyGapCents) : [];
  const cutsCoverMonthlyCents = reallocations.reduce((sum, c) => sum + c.deltaCents, 0);

  const feasibility = assessFeasibility(monthlyGapCents, requiredMonthlyCents, maxCutsMonthly);

  return {
    goalId: goal.id,
    monthsRemaining,
    requiredMonthlyCents,
    projectedMonthlyCents,
    monthlyGapCents,
    totalGapCents,
    feasibility,
    reallocations,
    cutsCoverMonthlyCents,
    projectedCompletionDate: projectCompletion(
      goal,
      forecast,
      projectedMonthlyCents + maxCutsMonthly,
      targetMonth,
    ),
    forecast,
    cliffs,
    alternatives: buildAlternatives({
      goal,
      monthsRemaining,
      projectedTotal,
      projectedMonthlyCents,
      maxCutsMonthly,
      remainingToSave,
      targetMonth,
    }),
  };
}

function assessFeasibility(
  monthlyGap: number,
  required: number,
  maxCuts: number,
): Feasibility {
  if (monthlyGap <= 0) {
    // Πλεόνασμα πάνω από 15% του απαιτούμενου σημαίνει ότι είμαστε μπροστά.
    return Math.abs(monthlyGap) > required * 0.15 ? 'ahead' : 'on_track';
  }
  if (monthlyGap <= maxCuts * 0.7) return 'tight';
  if (monthlyGap <= maxCuts) return 'tight';
  return 'unrealistic';
}

/* ------------------------------------------------------------------ */
/* Εναλλακτικές: τι λέμε όταν ο στόχος δεν βγαίνει                     */
/* ------------------------------------------------------------------ */

function buildAlternatives(args: {
  goal: FinancialGoal;
  monthsRemaining: number;
  projectedTotal: number;
  projectedMonthlyCents: number;
  maxCutsMonthly: number;
  remainingToSave: number;
  targetMonth: MonthKey;
}): GoalAlternatives {
  const {
    goal,
    monthsRemaining,
    projectedTotal,
    projectedMonthlyCents,
    maxCutsMonthly,
    remainingToSave,
    targetMonth,
  } = args;

  // Το ρεαλιστικό μηνιαίο: ό,τι περισσεύει, συν ό,τι μπορεί να κοπεί χωρίς να πονέσει πολύ.
  const realisticMonthly = projectedMonthlyCents + maxCutsMonthly;

  const achievableByTargetDateCents = Math.max(
    0,
    goal.savedAmountCents + projectedTotal + maxCutsMonthly * monthsRemaining,
  );

  const stillMissing = Math.max(0, remainingToSave - (projectedTotal + maxCutsMonthly * monthsRemaining));

  const extraMonthsNeeded =
    realisticMonthly > 0 ? Math.ceil(stillMissing / realisticMonthly) : 0;

  // Πάνω από 3 χρόνια μετάθεση δεν είναι πρόταση, είναι κοροϊδία.
  // Σε αυτή την περίπτωση το UI δείχνει μόνο τις άλλες δύο επιλογές.
  const MAX_REASONABLE_SHIFT = 36;
  const realisticTargetDate =
    stillMissing > 0 && realisticMonthly > 0 && extraMonthsNeeded <= MAX_REASONABLE_SHIFT
      ? `${shiftMonth(targetMonth, extraMonthsNeeded)}-01`
      : null;

  const extraIncomeNeededMonthlyCents =
    monthsRemaining > 0 ? roundTo(Math.ceil(stillMissing / monthsRemaining)) : 0;

  return {
    achievableByTargetDateCents,
    extraMonthsNeeded,
    realisticTargetDate,
    extraIncomeNeededMonthlyCents,
  };
}

/** Πότε πιάνεται ο στόχος αν εφαρμοστούν όλες οι περικοπές και συνεχιστεί ο ρυθμός. */
function projectCompletion(
  goal: FinancialGoal,
  forecast: MonthlyForecast[],
  monthlyRate: number,
  targetMonth: MonthKey,
): string | null {
  let saved = goal.savedAmountCents;

  for (const month of forecast) {
    saved += month.surplusCents;
    if (saved >= goal.targetAmountCents) return `${month.month}-01`;
  }
  if (monthlyRate <= 0) return null;

  const missing = goal.targetAmountCents - saved;
  const extra = Math.ceil(missing / monthlyRate);
  return `${shiftMonth(targetMonth, extra)}-01`;
}
