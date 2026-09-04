// Ανάλυση.
//
// Η οθόνη έχει δύο μέρη με σαφή διαχωρισμό, και ο διαχωρισμός είναι το ζητούμενο:
//
//   ΠΑΝΩ  Στατιστικά. Υπολογίζονται τοπικά, είναι ακριβή, δεν περνούν από κανένα
//         μοντέλο. Αυτά είναι τα νούμερα που μπορείς να εμπιστευτείς.
//
//   ΚΑΤΩ  Προτάσεις. Τις γράφει το μοντέλο, πάνω στα ίδια νούμερα. Ερμηνεία, όχι
//         αριθμητική.
//
// Το βάθος προσαρμόζεται στα δεδομένα: με έναν μήνα δεν υπάρχει μέσος όρος να
// συγκρίνεις, οπότε η οθόνη το λέει καθαρά αντί να παριστάνει ότι ξέρει.

import { useMemo, useState } from 'react';
import type {
  Category,
  CurrencyCode,
  Insight,
  MonthlySummary,
  Transaction,
} from '../../types/finance';
import {
  buildMonthlySummaries,
  computeCategoryStats,
} from '../../lib/analytics';
import { categoryName } from '../../lib/categories';
import { createInsightEngine } from '../../lib/insights';
import { DEFAULT_CURRENCY } from '../../lib/currency';
import { currentMonthKey, formatMoney, formatPercent, monthLabel } from '../../lib/money';
import { SmartTipCard } from '../dashboard/SmartTipCard';

/** Κάτω από αυτό, οι συγκρίσεις με «μέσο όρο» δεν έχουν νόημα. */
const MIN_MONTHS_FOR_TRENDS = 3;

const llmEnabled = import.meta.env.VITE_ENABLE_LLM_INSIGHTS === 'true';

interface AnalysisScreenProps {
  transactions: Transaction[];
  categories: Category[];
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: string;
  currency?: CurrencyCode;
}

export function AnalysisScreen({
  transactions,
  categories,
  t,
  locale = 'el-GR',
  currency = DEFAULT_CURRENCY,
}: AnalysisScreenProps) {
  const month = currentMonthKey();
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'rules' | 'llm' | null>(null);

  const summaries = useMemo(() => buildMonthlySummaries(transactions), [transactions]);
  const stats = useMemo(
    () => computeCategoryStats(transactions, { referenceMonth: month, lookbackMonths: 12 }),
    [transactions, month],
  );

  const monthsOfData = summaries.filter((s) => s.transactionCount > 0).length;
  const money = (cents: number) => formatMoney(cents, locale, currency);

  const lifetime = useMemo(() => aggregate(summaries), [summaries]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const topCategories = [...stats]
    .filter((s) => s.monthlyAverageCents > 0 || s.currentMonthCents > 0)
    .sort((a, b) => b.monthlyAverageCents - a.monthlyAverageCents)
    .slice(0, 8);

  const run = async () => {
    setLoading(true);
    try {
      const engine = createInsightEngine();
      const result = await engine.generate({
        referenceMonth: month,
        categories,
        stats,
        summaries,
        goals: [],
        locale: locale.startsWith('el') ? 'el' : 'en',
        currency,
      });
      setInsights(result);
      setSource(result[0]?.source ?? 'rules');
    } finally {
      setLoading(false);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('analysis.needData')}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="font-[var(--font-display)] text-xl font-semibold">
          {t('analysis.title')}
        </h1>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('analysis.basedOn', { count: monthsOfData })}
        </p>
      </header>

      {/* --- Στατιστικά: υπολογισμένα τοπικά --- */}
      <section
        className="rounded-xl border p-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h2 className="font-[var(--font-display)] text-base font-semibold">
          {t('analysis.statsTitle')}
        </h2>

        <dl className="mt-3 space-y-1.5">
          <Row label={t('analysis.totalIncome')} value={money(lifetime.incomeCents)} />
          <Row label={t('analysis.totalExpense')} value={money(lifetime.expenseCents)} />
          <Row
            label={t('analysis.avgMonthlyIncome')}
            value={money(Math.round(lifetime.incomeCents / Math.max(1, monthsOfData)))}
          />
          <Row
            label={t('analysis.avgMonthlyExpense')}
            value={money(Math.round(lifetime.expenseCents / Math.max(1, monthsOfData)))}
          />
          <Row
            label={t('analysis.avgSavingsRate')}
            value={
              lifetime.incomeCents > 0
                ? formatPercent(
                    (lifetime.incomeCents - lifetime.expenseCents) / lifetime.incomeCents,
                    locale,
                  )
                : '—'
            }
          />
          {lifetime.bestMonth && (
            <Row
              label={t('analysis.bestMonth')}
              value={`${monthLabel(lifetime.bestMonth.month, locale)} · ${money(lifetime.bestMonth.netCents)}`}
            />
          )}
          {lifetime.worstMonth && (
            <Row
              label={t('analysis.worstMonth')}
              value={`${monthLabel(lifetime.worstMonth.month, locale)} · ${money(lifetime.worstMonth.netCents)}`}
            />
          )}
        </dl>

        <h3 className="mt-5 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {t('analysis.byCategory')}
        </h3>
        <ul className="mt-2 space-y-1.5">
          {topCategories.map((stat) => {
            const category = categoryById.get(stat.categoryId);
            const showTrend = monthsOfData >= MIN_MONTHS_FOR_TRENDS && stat.monthsObserved >= 2;
            return (
              <li key={stat.categoryId} className="flex items-baseline text-sm">
                <span>{category ? categoryName(category, t) : stat.categoryId}</span>
                <span className="leader" aria-hidden />
                <span className="tnum">{money(stat.monthlyAverageCents)}</span>
                {showTrend && stat.deviationRatio !== 0 && (
                  <span
                    className="tnum ml-2 text-xs"
                    style={{
                      color: stat.deviationRatio > 0 ? 'var(--expense)' : 'var(--income)',
                    }}
                  >
                    {formatPercent(stat.deviationRatio, locale)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {monthsOfData < MIN_MONTHS_FOR_TRENDS && (
          <p
            className="mt-4 text-xs leading-relaxed"
            style={{ color: 'var(--accent)', textAlign: 'justify', hyphens: 'auto' }}
          >
            {t('analysis.notEnoughMonths', { have: monthsOfData, need: MIN_MONTHS_FOR_TRENDS })}
          </p>
        )}
      </section>

      {/* --- Προτάσεις: γραμμένες από το μοντέλο --- */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 className="font-[var(--font-display)] text-base font-semibold">
              {t('analysis.adviceTitle')}
            </h2>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-muted)', textAlign: 'justify', hyphens: 'auto' }}
            >
              {t(llmEnabled ? 'analysis.adviceNote' : 'analysis.adviceNoteLocal')}
            </p>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {loading ? t('analysis.working') : t('analysis.run')}
          </button>
        </div>

        {insights?.map((insight) => (
          <SmartTipCard
            key={insight.id}
            insight={insight}
            categories={categories}
            t={t}
            locale={locale}
            currency={currency}
          />
        ))}

        {insights?.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('analysis.nothingToSay')}
          </p>
        )}

        {/*
          Η προέλευση αναφέρεται μόνο όταν έχει νόημα η διάκριση.
          Με το γλωσσικό μοντέλο σκόπιμα απενεργοποιημένο, το «δεν είναι ενεργό»
          ακούγεται σαν βλάβη ενώ είναι επιλογή.
        */}
        {source && (llmEnabled || source === 'llm') && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t(source === 'llm' ? 'analysis.sourceLlm' : 'analysis.sourceRules')}
          </p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline text-sm">
      <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <span className="leader" aria-hidden />
      <dd className="tnum">{value}</dd>
    </div>
  );
}

function aggregate(summaries: MonthlySummary[]) {
  const active = summaries.filter((s) => s.transactionCount > 0);
  const incomeCents = active.reduce((sum, s) => sum + s.incomeCents, 0);
  const expenseCents = active.reduce((sum, s) => sum + s.expenseCents, 0);

  const sorted = [...active].sort((a, b) => b.netCents - a.netCents);

  return {
    incomeCents,
    expenseCents,
    // Με έναν μόνο μήνα, «καλύτερος» και «χειρότερος» θα ήταν ο ίδιος.
    bestMonth: active.length >= 2 ? sorted[0] : null,
    worstMonth: active.length >= 2 ? sorted[sorted.length - 1] : null,
  };
}
