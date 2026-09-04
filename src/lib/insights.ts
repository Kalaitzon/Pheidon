// Η μηχανή των "Smart Tips".
//
// Λογική σε δύο βήματα:
//   1. ΕΝΤΟΠΙΣΜΟΣ  — ποια κατηγορία ξέφυγε από τον μέσο όρο της;
//   2. ΑΝΑΚΑΤΑΝΟΜΗ — από ποια ευέλικτη κατηγορία μπορούμε να καλύψουμε τη διαφορά;
//
// Το αποτέλεσμα είναι δομημένο αντικείμενο `Insight` με κλειδιά i18n, όχι έτοιμη
// πρόταση. Έτσι το ίδιο πόρισμα εμφανίζεται σωστά σε EL και EN, και το LLM μπορεί
// αργότερα να αντικαταστήσει μόνο τη διατύπωση, όχι τους αριθμούς.

import type { LlmCategoryFact } from './llm/prompts';
import { sanitizeActions } from './llm/prompts';
import type {
  Category,
  Insight,
  InsightContext,
  InsightEngine,
  SuggestedAction,
} from '../types/finance';

/* ------------------------------------------------------------------ */
/* Ρυθμίσεις κανόνων — ένα σημείο για όλα τα κατώφλια                  */
/* ------------------------------------------------------------------ */

export const RULES = {
  /** Πάνω από +15% απόκλιση θεωρείται υπέρβαση. */
  overspendRatio: 0.15,
  /** Και ταυτόχρονα η υπέρβαση να είναι τουλάχιστον 20€, για να μη γκρινιάζουμε για ψιλά. */
  overspendMinCents: 2000,
  /** Κάτω από 3 μήνες ιστορικού δεν βγάζουμε συμπεράσματα. */
  minMonthsForConfidence: 3,
  /** Το πολύ 40% της ευέλικτης κατηγορίας μπορεί να κοπεί σε έναν μήνα. */
  maxCutRatioPerCategory: 0.4,
  /** Στρογγυλοποίηση προτάσεων στα 5€, ώστε να είναι ανθρώπινες. */
  roundToCents: 500,
  /** Ποσοστό αποταμίευσης κάτω από αυτό ενεργοποιεί προειδοποίηση. */
  healthySavingsRate: 0.1,
} as const;

const roundTo = (cents: number, step: number) => Math.round(cents / step) * step;

const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* Rule-based engine (η βάση, τρέχει τοπικά και offline)               */
/* ------------------------------------------------------------------ */

export class RuleBasedInsightEngine implements InsightEngine {
  readonly name = 'rules';

  async generate(ctx: InsightContext): Promise<Insight[]> {
    const categoryById = new Map(ctx.categories.map((c) => [c.id, c]));
    const insights: Insight[] = [
      ...this.detectOverspend(ctx, categoryById),
      ...this.detectCashflow(ctx),
      ...this.detectWins(ctx, categoryById),
      ...this.detectGoalRisk(ctx, categoryById),
      ...this.detectIncomeCliff(ctx),
    ];
    // Πρώτα τα σοβαρά, και το πολύ τρία στο Dashboard: πάνω από αυτό γίνεται θόρυβος.
    return insights.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }

  /* --- Κανόνας 1: υπέρβαση μέσου όρου + πρόταση ανακατανομής --- */
  private detectOverspend(
    ctx: InsightContext,
    categoryById: Map<string, Category>,
  ): Insight[] {
    const candidates = ctx.stats.filter((s) => {
      const category = categoryById.get(s.categoryId);
      if (!category || category.archived) return false;
      if (s.monthsObserved < RULES.minMonthsForConfidence) return false;
      const overspend = s.currentMonthCents - s.monthlyAverageCents;
      return s.deviationRatio >= RULES.overspendRatio && overspend >= RULES.overspendMinCents;
    });

    // Μία πρόταση τη φορά: αυτή με τη μεγαλύτερη απόλυτη υπέρβαση.
    const worst = candidates.sort(
      (a, b) =>
        b.currentMonthCents - b.monthlyAverageCents - (a.currentMonthCents - a.monthlyAverageCents),
    )[0];
    if (!worst) return [];

    const category = categoryById.get(worst.categoryId)!;
    const overspendCents = worst.currentMonthCents - worst.monthlyAverageCents;
    const donors = this.findDonorCategories(ctx, categoryById, worst.categoryId, overspendCents);
    // Στο κείμενο αναφέρουμε μόνο τον πρώτο δότη. Οι υπόλοιποι εμφανίζονται
    // αναλυτικά στη λίστα ενεργειών, ώστε η πρόταση να παραμένει μία φράση.
    const primaryCut = donors[0]?.deltaCents ?? 0;

    return [
      {
        id: `overspend-${worst.categoryId}-${ctx.referenceMonth}`,
        type: donors.length > 0 ? 'reallocation' : 'category_overspend',
        severity: worst.deviationRatio > 0.5 ? 'critical' : 'warning',
        titleKey: 'insights.overspend.title',
        bodyKey: donors.length > 0 ? 'insights.overspend.withDonor' : 'insights.overspend.plain',
        params: {
          category: category.slug,
          overspendCents,
          averageCents: worst.monthlyAverageCents,
          currentCents: worst.currentMonthCents,
          deviationPercent: Math.round(worst.deviationRatio * 100),
          donorCategory: donors[0] ? categoryById.get(donors[0].categoryId)!.slug : '',
          donorCutCents: primaryCut,
        },
        actions: donors,
        priority: 80 + Math.min(15, Math.round(worst.deviationRatio * 20)),
        source: 'rules',
        confidence: Math.min(1, worst.monthsObserved / 6),
        generatedAt: nowIso(),
      },
    ];
  }

  /**
   * Βρίσκει από πού κόβουμε. Οι κανόνες, με σειρά προτεραιότητας:
   *   - ποτέ από 'fixed' κατηγορίες (ενοίκιο, δάνειο, λογαριασμοί)
   *   - ποτέ από κατηγορίες που ο χρήστης δήλωσε απαραίτητες
   *   - ποτέ από την ίδια την κατηγορία που ξέφυγε
   *   - ποτέ από κατηγορίες που ο χρήστης έχει δηλώσει προστατευμένες σε στόχο
   *   - πρώτα οι πιο ευέλικτες με το μεγαλύτερο περιθώριο
   */
  private findDonorCategories(
    ctx: InsightContext,
    categoryById: Map<string, Category>,
    excludeCategoryId: string,
    neededCents: number,
  ): SuggestedAction[] {
    const protectedIds = new Set(ctx.goals.flatMap((g) => g.protectedCategoryIds ?? []));

    const pool = ctx.stats
      .filter((s) => {
        const c = categoryById.get(s.categoryId);
        return (
          c &&
          !c.archived &&
          c.flexibility === 'flexible' &&
          // Ο χρήστης έχει δηλώσει ότι αυτή δεν αγγίζεται.
          !c.userProtected &&
          s.categoryId !== excludeCategoryId &&
          !protectedIds.has(s.categoryId) &&
          s.currentMonthCents > RULES.roundToCents
        );
      })
      // Ξεκινάμε από εκεί που ξοδεύονται τα περισσότερα: εκεί πονάει λιγότερο μια περικοπή.
      .sort((a, b) => b.currentMonthCents - a.currentMonthCents);

    const actions: SuggestedAction[] = [];
    let remaining = neededCents;

    for (const donor of pool) {
      if (remaining <= 0) break;
      const maxCut = Math.floor(donor.currentMonthCents * RULES.maxCutRatioPerCategory);
      const cut = roundTo(Math.min(maxCut, remaining), RULES.roundToCents);
      if (cut <= 0) continue;
      actions.push({
        categoryId: donor.categoryId,
        deltaCents: cut,
        suggestedMonthlyCents: donor.currentMonthCents - cut,
      });
      remaining -= cut;
    }
    return actions;
  }

  /* --- Κανόνας 2: τα έξοδα τρώνε τα έσοδα --- */
  private detectCashflow(ctx: InsightContext): Insight[] {
    const current = ctx.summaries.find((s) => s.month === ctx.referenceMonth);
    if (!current || current.incomeCents === 0) return [];
    const rate = current.netCents / current.incomeCents;
    if (rate >= RULES.healthySavingsRate) return [];

    return [
      {
        id: `cashflow-${ctx.referenceMonth}`,
        type: 'cashflow_warning',
        severity: current.netCents < 0 ? 'critical' : 'warning',
        titleKey: current.netCents < 0 ? 'insights.cashflow.deficit' : 'insights.cashflow.thin',
        bodyKey: 'insights.cashflow.body',
        params: {
          netCents: current.netCents,
          savingsPercent: Math.round(rate * 100),
          targetPercent: Math.round(RULES.healthySavingsRate * 100),
        },
        actions: [],
        priority: current.netCents < 0 ? 100 : 70,
        source: 'rules',
        confidence: 1,
        generatedAt: nowIso(),
      },
    ];
  }

  /* --- Κανόνας 3: επιβράβευση. Μια εφαρμογή που μόνο γκρινιάζει, κλείνει. --- */
  private detectWins(ctx: InsightContext, categoryById: Map<string, Category>): Insight[] {
    const best = ctx.stats
      .filter(
        (s) =>
          s.monthsObserved >= RULES.minMonthsForConfidence &&
          s.deviationRatio <= -RULES.overspendRatio &&
          s.monthlyAverageCents - s.currentMonthCents >= RULES.overspendMinCents,
      )
      .sort((a, b) => a.deviationRatio - b.deviationRatio)[0];
    if (!best) return [];

    return [
      {
        id: `win-${best.categoryId}-${ctx.referenceMonth}`,
        type: 'positive_trend',
        severity: 'success',
        titleKey: 'insights.win.title',
        bodyKey: 'insights.win.body',
        params: {
          category: categoryById.get(best.categoryId)?.slug ?? '',
          savedCents: best.monthlyAverageCents - best.currentMonthCents,
          deviationPercent: Math.abs(Math.round(best.deviationRatio * 100)),
        },
        actions: [],
        priority: 40,
        source: 'rules',
        confidence: Math.min(1, best.monthsObserved / 6),
        generatedAt: nowIso(),
      },
    ];
  }

  /* --- Κανόνας 4: ο στόχος δεν βγαίνει με τα σημερινά δεδομένα --- */
  private detectGoalRisk(
    ctx: InsightContext,
    categoryById: Map<string, Category>,
  ): Insight[] {
    const plans = ctx.goalPlans ?? [];
    if (plans.length === 0) return [];

    // Ο πιο «σφιχτός» στόχος πρώτα.
    const plan = [...plans]
      .filter((p) => p.feasibility === 'tight' || p.feasibility === 'unrealistic')
      .sort((a, b) => b.monthlyGapCents - a.monthlyGapCents)[0];
    if (!plan) return [];

    const goal = ctx.goals.find((g) => g.id === plan.goalId);
    if (!goal) return [];

    const unrealistic = plan.feasibility === 'unrealistic';

    return [
      {
        id: `goal-${plan.goalId}-${ctx.referenceMonth}`,
        type: 'goal_at_risk',
        severity: unrealistic ? 'critical' : 'warning',
        titleKey: unrealistic ? 'insights.goal.unrealistic' : 'insights.goal.tight',
        // Όταν ο στόχος είναι ανέφικτος, δεν επιμένουμε στις περικοπές:
        // προτείνουμε μετάθεση ημερομηνίας ή μείωση ποσού.
        bodyKey:
          plan.projectedMonthlyCents < 0
            ? 'insights.goal.deficit'
            : unrealistic
              ? 'insights.goal.alternatives'
              : 'insights.goal.withCuts',
        params: {
          goal: goal.title,
          gapCents: plan.monthlyGapCents,
          totalGapCents: plan.totalGapCents,
          requiredCents: plan.requiredMonthlyCents,
          projectedCents: plan.projectedMonthlyCents,
          cutsCoverCents: plan.cutsCoverMonthlyCents,
          achievableCents: plan.alternatives.achievableByTargetDateCents,
          extraMonths: plan.alternatives.extraMonthsNeeded,
          extraIncomeCents: plan.alternatives.extraIncomeNeededMonthlyCents,
          months: plan.monthsRemaining,
          donorCategory: plan.reallocations[0]
            ? (categoryById.get(plan.reallocations[0].categoryId)?.slug ?? '')
            : '',
        },
        actions: plan.reallocations,
        priority: unrealistic ? 95 : 85,
        source: 'rules',
        confidence: 0.9,
        generatedAt: nowIso(),
      },
    ];
  }

  /* --- Κανόνας 5: έρχεται πτώση εσόδων (π.χ. λήγει η σύμβαση) --- */
  private detectIncomeCliff(ctx: InsightContext): Insight[] {
    const cliff = (ctx.goalPlans ?? []).flatMap((p) => p.cliffs)[0];
    if (!cliff) return [];

    return [
      {
        id: `cliff-${cliff.month}`,
        type: 'goal_at_risk',
        severity: 'warning',
        titleKey: 'insights.cliff.title',
        bodyKey: 'insights.cliff.body',
        params: {
          month: cliff.month,
          label: cliff.label,
          beforeCents: cliff.beforeCents,
          afterCents: cliff.afterCents,
          dropCents: cliff.beforeCents - cliff.afterCents,
        },
        actions: [],
        priority: 90,
        source: 'rules',
        confidence: 1,
        generatedAt: nowIso(),
      },
    ];
  }
}

/* ------------------------------------------------------------------ */
/* LLM engine — ίδιο interface, διαφορετική πηγή                       */
/* ------------------------------------------------------------------ */

/**
 * Στέλνει τα ΗΔΗ ΥΠΟΛΟΓΙΣΜΕΝΑ στατιστικά σε endpoint που κρατά το API key
 * server-side, και περιμένει πίσω insights στο ίδιο σχήμα.
 *
 * Αν κάτι πάει στραβά (offline, timeout, κακό JSON), γυρνάει σιωπηλά στους
 * κανόνες. Ο χρήστης δεν βλέπει ποτέ άδειο Dashboard εξαιτίας του LLM.
 */
export class LlmInsightEngine implements InsightEngine {
  readonly name = 'llm';

  constructor(
    private readonly endpoint = '/api/insights',
    private readonly fallback: InsightEngine = new RuleBasedInsightEngine(),
    private readonly timeoutMs = 12000,
  ) {}

  async generate(ctx: InsightContext): Promise<Insight[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const token = await accessToken();
      if (!token) return this.fallback.generate(ctx);

      const facts = buildCategoryFacts(ctx);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        // Μόνο συγκεντρωτικά ανά κατηγορία. Ποτέ μεμονωμένες συναλλαγές,
        // ονόματα καταστημάτων ή σημειώσεις.
        body: JSON.stringify({
          month: ctx.referenceMonth,
          locale: ctx.locale,
          currency: ctx.currency,
          categories: facts,
          goals: (ctx.goalPlans ?? []).map((plan) => ({
            title: ctx.goals.find((g) => g.id === plan.goalId)?.title ?? '',
            requiredMonthlyCents: plan.requiredMonthlyCents,
            projectedMonthlyCents: plan.projectedMonthlyCents,
            feasibility: plan.feasibility,
          })),
        }),
      });

      if (!response.ok) throw new Error(`insights endpoint ${response.status}`);

      const payload = (await response.json()) as { insights?: LlmInsight[] };
      const mapped = (payload.insights ?? [])
        .map((raw, index) => toInsight(raw, ctx, facts, index))
        .filter((insight): insight is Insight => insight !== null);

      // Άδεια απάντηση δεν είναι σφάλμα: σημαίνει ότι το μοντέλο δεν βρήκε κάτι
      // αξιόλογο. Οι κανόνες όμως έχουν πάντα κάτι χρήσιμο, οπότε τους κρατάμε.
      return mapped.length > 0 ? mapped : this.fallback.generate(ctx);
    } catch (error) {
      console.warn('[insights] Επιστροφή στους τοπικούς κανόνες:', error);
      return this.fallback.generate(ctx);
    } finally {
      clearTimeout(timer);
    }
  }
}

interface LlmInsight {
  type?: Insight['type'];
  severity?: Insight['severity'];
  title?: string;
  body?: string;
  actions?: Array<{ categorySlug: string; deltaCents: number }>;
  confidence?: number;
}

/** Το token της τρέχουσας συνεδρίας, για να ταυτοποιηθεί το αίτημα στο endpoint. */
async function accessToken(): Promise<string | null> {
  try {
    const { getSupabase, isSupabaseConfigured } = await import('./supabase');
    if (!isSupabaseConfigured) return null;
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function buildCategoryFacts(ctx: InsightContext): LlmCategoryFact[] {
  const byId = new Map(ctx.categories.map((c) => [c.id, c]));

  return ctx.stats
    .map((stat) => {
      const category = byId.get(stat.categoryId);
      if (!category || category.isGroup) return null;
      return {
        slug: category.slug,
        flexibility: category.flexibility,
        userProtected: category.userProtected ?? false,
        averageCents: stat.monthlyAverageCents,
        currentCents: stat.currentMonthCents,
        deviationRatio: Number(stat.deviationRatio.toFixed(2)),
        trend: stat.trend,
      } satisfies LlmCategoryFact;
    })
    .filter((fact): fact is LlmCategoryFact => fact !== null);
}

/**
 * Μετατρέπει την απάντηση του μοντέλου σε `Insight`.
 *
 * Το κείμενο έρχεται ήδη στη γλώσσα του χρήστη, οπότε μπαίνει αυτούσιο στο
 * `titleKey`. Το i18next επιστρέφει το ίδιο το κλειδί όταν δεν βρίσκει
 * μετάφραση, άρα η κάρτα το εμφανίζει σωστά χωρίς ειδική μεταχείριση.
 */
function toInsight(
  raw: LlmInsight,
  ctx: InsightContext,
  facts: LlmCategoryFact[],
  index: number,
): Insight | null {
  if (!raw.title || !raw.body) return null;

  const slugToId = new Map(ctx.categories.map((c) => [c.slug, c.id]));

  const actions = sanitizeActions(raw.actions ?? [], facts)
    .map((action) => {
      const categoryId = slugToId.get(action.categorySlug);
      if (!categoryId) return null;
      const fact = facts.find((f) => f.slug === action.categorySlug)!;
      return {
        categoryId,
        deltaCents: action.deltaCents,
        suggestedMonthlyCents: Math.max(0, fact.currentCents - action.deltaCents),
      };
    })
    .filter((action): action is NonNullable<typeof action> => action !== null);

  return {
    id: `llm-${ctx.referenceMonth}-${index}`,
    type: raw.type ?? 'category_overspend',
    severity: raw.severity ?? 'info',
    titleKey: raw.title,
    bodyKey: raw.body,
    params: {},
    actions,
    priority: 75 - index,
    source: 'llm',
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.7,
    generatedAt: nowIso(),
  };
}

/** Ένα σημείο επιλογής. Άλλαξε τη μεταβλητή περιβάλλοντος, όχι τα components. */
export function createInsightEngine(): InsightEngine {
  return import.meta.env.VITE_ENABLE_LLM_INSIGHTS === 'true'
    ? new LlmInsightEngine()
    : new RuleBasedInsightEngine();
}
