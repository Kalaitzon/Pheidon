// Dashboard.
//
// Ρόλος του component: να συνθέτει. Δεν υπολογίζει τίποτα μόνο του, όλα έρχονται
// από το `lib/`. Αν αύριο αλλάξει ο τρόπος υπολογισμού του μέσου όρου, αυτό το
// αρχείο δεν αγγίζεται.
//
// Δομή οθόνης, από πάνω προς τα κάτω:
//   1. Ταινία υπολοίπου  — τα τρία νούμερα που θέλει ο χρήστης σε 2 δευτερόλεπτα
//   2. Έξυπνες προτάσεις — το μόνο σημείο που ζητά ενέργεια, άρα ψηλά
//   3. Γραφήματα         — για όποιον θέλει να σκάψει

import { useEffect, useMemo, useState } from 'react';
import type {
  Category,
  CurrencyCode,
  Insight,
  RecurringRule,
  Transaction,
} from '../../types/finance';
import {
  buildMonthlySummaries,
  projectedSummary,
  computeCategoryStats,
  computeDashboardTotals,
  fillMissingMonths,
} from '../../lib/analytics';
import { computeAllowance } from '../../lib/allowance';
import { monthlyEquivalentByCategory, projectMonths } from '../../lib/recurring';
import { createInsightEngine } from '../../lib/insights';
import { AllowanceCard } from './AllowanceCard';
import { categoryName, rollUpToGroups } from '../../lib/categories';
import { DEFAULT_CURRENCY } from '../../lib/currency';
import {
  currentMonthKey,
  formatMoney,
  formatPercent,
  monthLabel,
  monthRange,
  shiftMonth,
} from '../../lib/money';
import { CategoryDonut, MonthlyBars } from './Charts';
import { SmartTipCard } from './SmartTipCard';

const VISIBLE_MONTHS = 6;

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: 'el-GR' | 'en-US';
  /** Το νόμισμα του χρήστη. Ένα για όλη την εφαρμογή, χωρίς μετατροπές. */
  currency?: CurrencyCode;
  /** Τα πάγια. Υπερισχύουν των μέσων όρων στον υπολογισμό του ορίου. */
  recurringRules?: RecurringRule[];
  /** Ποσό δεσμευμένο σε ανοιχτά ταξίδια, από το `committedInOpenTrips`. */
  committedCents?: number;
  /** Ποσοστό του εισοδήματος που κρατιέται στην άκρη για τα απρόοπτα. */
  bufferRatio?: number;
  referenceMonth?: string;
  onAddTransaction?: () => void;
}

export function Dashboard({
  transactions,
  categories,
  t,
  locale = 'el-GR',
  currency = DEFAULT_CURRENCY,
  recurringRules = [],
  committedCents = 0,
  bufferRatio,
  referenceMonth,
  onAddTransaction,
}: DashboardProps) {
  // Ο μήνας που βλέπεις είναι κατάσταση του Dashboard: μπορείς να γυρίσεις
  // μπρος και πίσω χωρίς να επηρεαστεί τίποτα άλλο στην εφαρμογή.
  const [month, setMonth] = useState(referenceMonth ?? currentMonthKey());
  const thisMonth = currentMonthKey();
  const isFuture = month > thisMonth;
  /* --- Παράγωγα δεδομένα. useMemo γιατί τα summaries ξαναχτίζονται σε κάθε render. --- */
  const actualSummaries = useMemo(() => buildMonthlySummaries(transactions), [transactions]);

  /*
   * Οι μελλοντικοί μήνες γεμίζουν από τα πάγια. Ένας μήνας που έχει ήδη
   * πραγματικές συναλλαγές κρατά αυτές: τα πάγια για εκείνον τον μήνα έχουν
   * ήδη καταχωρηθεί ως κανονικές κινήσεις και θα διπλομετρούσαν.
   */
  const summaries = useMemo(() => {
    /*
     * Οι μελλοντικοί μήνες γεμίζουν από τα πάγια.
     *
     * Προσοχή στη συγχώνευση: ένας μελλοντικός μήνας μπορεί να έχει ΚΑΙ
     * πραγματικές κινήσεις που καταχώρησες χειροκίνητα. Τα δύο ΠΡΟΣΤΙΘΕΝΤΑΙ,
     * δεν αντικαθιστά το ένα το άλλο.
     *
     * Δεν υπάρχει κίνδυνος διπλομέτρησης: τα πάγια μετατρέπονται σε πραγματικές
     * συναλλαγές μόνο όταν φτάσει η ημερομηνία τους, οπότε για μήνα που δεν έχει
     * έρθει ακόμη δεν υπάρχει αντίστοιχη καταχώρηση.
     */
    const merged = new Map(actualSummaries.map((summary) => [summary.month, summary]));

    const horizon = monthRange(shiftMonth(thisMonth, 24), 30);

    for (const projection of projectMonths(recurringRules, horizon)) {
      if (projection.month <= thisMonth) continue;

      const actual = merged.get(projection.month);
      const projected = projectedSummary(projection.month, projection);

      if (!actual) {
        merged.set(projection.month, projected);
        continue;
      }

      merged.set(projection.month, {
        ...actual,
        incomeCents: actual.incomeCents + projected.incomeCents,
        expenseCents: actual.expenseCents + projected.expenseCents,
        netCents: actual.netCents + projected.netCents,
        expenseByCategory: mergeAmounts(actual.expenseByCategory, projected.expenseByCategory),
      });
    }

    return [...merged.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [actualSummaries, recurringRules, thisMonth]);

  const visibleSummaries = useMemo(
    () => fillMissingMonths(summaries, month, VISIBLE_MONTHS),
    [summaries, month],
  );

  const totals = useMemo(
    () => computeDashboardTotals(summaries, month),
    [summaries, month],
  );

  const stats = useMemo(
    () => computeCategoryStats(transactions, { referenceMonth: month, lookbackMonths: 6 }),
    [transactions, month],
  );

  const currentSummary = summaries.find((s) => s.month === month);

  const allowance = useMemo(
    () =>
      computeAllowance({
        month,
        incomeCents: totals.incomeCents,
        categories,
        categoryStats: stats,
        currentSummary,
        recurringByCategory: monthlyEquivalentByCategory(recurringRules),
        committedCents,
        bufferRatio,
      }),
    [
      month,
      totals.incomeCents,
      categories,
      stats,
      currentSummary,
      recurringRules,
      committedCents,
      bufferRatio,
    ],
  );

  /* --- Insights: ασύγχρονα, γιατί η LLM υλοποίηση περνά από δίκτυο. --- */
  const [insights, setInsights] = useState<Insight[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const engine = createInsightEngine();

    engine
      .generate({
        referenceMonth: month,
        categories,
        stats,
        summaries,
        goals: [],
        locale: locale.startsWith('el') ? 'el' : 'en',
        currency,
      })
      .then((result) => {
        if (!cancelled) setInsights(result);
      });

    return () => {
      cancelled = true;
    };
  }, [stats, summaries, categories, month, locale, currency]);

  const visibleInsights = insights.filter((i) => !dismissed.has(i.id));

  if (transactions.length === 0 && recurringRules.length === 0) {
    return <EmptyState t={t} onAddTransaction={onAddTransaction} />;
  }

  const monthName = monthLabel(month, locale);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1
            className="font-[var(--font-display)] text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            {t('dashboard.title')}
          </h1>

          <div className="mt-1 flex items-center gap-2">
            <MonthStep label="‹" onClick={() => setMonth(shiftMonth(month, -1))} />
            <span className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>
              {monthName} {month.slice(0, 4)}
            </span>
            <MonthStep label="›" onClick={() => setMonth(shiftMonth(month, 1))} />

            {month !== thisMonth && (
              <button
                type="button"
                onClick={() => setMonth(thisMonth)}
                className="ml-1 text-xs"
                style={{ color: 'var(--accent)' }}
              >
                {t('dashboard.backToCurrent')}
              </button>
            )}
          </div>

          {isFuture && (
            <p className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
              {t('dashboard.projectedMonth')}
            </p>
          )}
        </div>
        {onAddTransaction && (
          <button
            type="button"
            onClick={onAddTransaction}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('dashboard.addTransaction')}
          </button>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <BalanceTape totals={totals} t={t} locale={locale} currency={currency} />
        <AllowanceCard allowance={allowance} t={t} locale={locale} currency={currency} />
      </div>

      {visibleInsights.length > 0 && (
        <section className="space-y-3">
          <h2
            className="font-[var(--font-display)] text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('insights.heading')}
          </h2>
          {visibleInsights.map((insight) => (
            <SmartTipCard
              key={insight.id}
              insight={insight}
              categories={categories}
              t={t}
              locale={locale}
              currency={currency}
              onDismiss={(id) => setDismissed((prev) => new Set(prev).add(id))}
            />
          ))}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t('dashboard.categoryBreakdown')}
          subtitle={t('dashboard.categorySubtitle', { month: monthName })}
        >
          <CategoryDonut
            expenseByCategory={rollUpToGroups(
              currentSummary?.expenseByCategory ?? {},
              categories,
            )}
            categories={categories}
            labelOf={(category) => categoryName(category, t)}
            totalLabel={t('dashboard.total')}
            otherLabel={t('categories.other_expense')}
            locale={locale}
            currency={currency}
          />
        </Panel>

        <Panel
          title={t('dashboard.monthlyComparison')}
          subtitle={t('dashboard.monthlySubtitle', { count: VISIBLE_MONTHS })}
        >
          <MonthlyBars
            summaries={visibleSummaries}
            locale={locale}
            currency={currency}
            incomeLabel={t('dashboard.income')}
            expenseLabel={t('dashboard.expenses')}
            averageLabel={t('dashboard.averageLabel')}
          />
        </Panel>
      </div>
    </main>
  );
}

/** Άθροισμα δύο πινάκων ποσών ανά κατηγορία. */
function mergeAmounts(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const result = { ...a };
  for (const [categoryId, amount] of Object.entries(b)) {
    result[categoryId] = (result[categoryId] ?? 0) + amount;
  }
  return result;
}

function MonthStep({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-0.5 text-base leading-none transition-opacity hover:opacity-70"
      style={{ color: 'var(--text-muted)', background: 'var(--surface-sunken)' }}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Η ταινία υπολοίπου: τα βασικά νούμερα σε μορφή απόδειξης            */
/* ------------------------------------------------------------------ */

function BalanceTape({
  totals,
  t,
  locale,
  currency,
}: {
  totals: ReturnType<typeof computeDashboardTotals>;
  t: DashboardProps['t'];
  locale: string;
  currency: CurrencyCode;
}) {
  const rows = [
    { label: t('dashboard.income'), value: totals.incomeCents, color: 'var(--income)' },
    { label: t('dashboard.expenses'), value: -totals.expenseCents, color: 'var(--expense)' },
  ];

  return (
    <section
      className="rounded-xl border p-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline text-sm">
            <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            <span className="leader" aria-hidden />
            <span className="tnum font-medium" style={{ color: row.color }}>
              {formatMoney(row.value, locale, currency)}
            </span>
          </div>
        ))}
      </div>

      <div
        className="mt-4 flex items-end justify-between border-t pt-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {t('dashboard.balance')}
          </p>
          <p
            className="tnum text-3xl font-semibold"
            style={{ color: totals.netCents >= 0 ? 'var(--income)' : 'var(--expense)' }}
          >
            {formatMoney(totals.netCents, locale, currency)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('dashboard.savingsRate')}
          </p>
          <p className="tnum text-lg font-medium">
            {Math.round(totals.savingsRate * 100)}%
          </p>
          {/* Ο τύπος γραμμένος, γιατί «28%» χωρίς εξήγηση δεν λέει τίποτα. */}
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('dashboard.savingsFormula')}
          </p>
          <p className="tnum text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatPercent(totals.expenseChangeVsPrevious, locale)}{' '}
            {t('dashboard.vsPreviousMonth')}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <h2 className="font-[var(--font-display)] text-base font-semibold">{title}</h2>
      {subtitle && (
        <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}

function EmptyState({
  t,
  onAddTransaction,
}: {
  t: DashboardProps['t'];
  onAddTransaction?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-[var(--font-display)] text-xl font-semibold">
        {t('dashboard.emptyTitle')}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('dashboard.emptyBody')}
      </p>
      {onAddTransaction && (
        <button
          type="button"
          onClick={onAddTransaction}
          className="mt-5 rounded-lg px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {t('dashboard.addTransaction')}
        </button>
      )}
    </main>
  );
}
