// Κάρτα «διαθέσιμο για γούστα».
//
// Ένα νούμερο μεγάλο, τα υπόλοιπα μικρά. Ο χρήστης το κοιτάει στο ταμείο του
// μαγαζιού, όχι στο γραφείο του: αν χρειάζεται να διαβάσει τρεις γραμμές για να
// καταλάβει αν μπορεί να το πάρει, η κάρτα απέτυχε.
//
// Η ανάλυση της αφαίρεσης είναι διαθέσιμη αλλά διπλωμένη, γιατί το «γιατί τόσο;»
// είναι πραγματική ερώτηση που πρέπει να έχει απάντηση.

import { useState } from 'react';
import type { AllowanceStatus, CurrencyCode, SpendingAllowance } from '../../types/finance';
import { DEFAULT_CURRENCY } from '../../lib/currency';
import { formatMoney } from '../../lib/money';

const STATUS_COLOR: Record<AllowanceStatus, string> = {
  comfortable: 'var(--income)',
  tight: 'var(--accent)',
  over: 'var(--expense)',
  impossible: 'var(--expense)',
};

interface AllowanceCardProps {
  allowance: SpendingAllowance;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: string;
  currency?: CurrencyCode;
}

export function AllowanceCard({
  allowance,
  t,
  locale = 'el-GR',
  currency = DEFAULT_CURRENCY,
}: AllowanceCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const money = (cents: number) => formatMoney(cents, locale, currency);
  const color = STATUS_COLOR[allowance.status];

  const usedRatio =
    allowance.allowanceCents > 0
      ? Math.min(1, allowance.spentCents / allowance.allowanceCents)
      : 1;

  const breakdown = [
    { key: 'income', value: allowance.incomeCents, sign: '+' },
    { key: 'fixed', value: allowance.fixedCents, sign: '−' },
    { key: 'essentials', value: allowance.essentialsCents, sign: '−' },
    { key: 'goals', value: allowance.goalContributionCents, sign: '−' },
    { key: 'buffer', value: allowance.bufferCents, sign: '−' },
  ];

  return (
    <section
      className="rounded-xl border p-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <h2
        className="text-xs uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {t('allowance.title')}
      </h2>

      {allowance.status === 'impossible' ? (
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: 'var(--expense)', textAlign: 'justify', hyphens: 'auto' }}
        >
          {t('allowance.impossible')}
        </p>
      ) : (
        <>
          <p className="tnum mt-1 text-3xl font-semibold" style={{ color }}>
            {money(allowance.remainingCents)}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('allowance.ofLimit', { limit: money(allowance.allowanceCents) })}
          </p>

          {/* Μπάρα προόδου: μία ματιά αντί για διαίρεση με το μυαλό */}
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--surface-sunken)' }}
            role="progressbar"
            aria-valuenow={Math.round(usedRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${usedRatio * 100}%`, background: color }}
            />
          </div>

          <p className="tnum mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            {allowance.status === 'over'
              ? t('allowance.over', { amount: money(Math.abs(allowance.remainingCents)) })
              : t('allowance.perDay', {
                  amount: money(allowance.dailyRemainingCents),
                  days: allowance.daysRemaining,
                })}
          </p>
        </>
      )}

      <button
        type="button"
        onClick={() => setShowBreakdown((v) => !v)}
        aria-expanded={showBreakdown}
        className="mt-4 text-xs underline-offset-2 hover:underline"
        style={{ color: 'var(--text-muted)' }}
      >
        {t(showBreakdown ? 'allowance.hideBreakdown' : 'allowance.showBreakdown')}
      </button>

      {showBreakdown && (
        <ul className="mt-3 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {breakdown.map((row) => (
            <li key={row.key} className="flex items-baseline text-sm">
              <span style={{ color: 'var(--text-muted)' }}>{t(`allowance.rows.${row.key}`)}</span>
              <span className="leader" aria-hidden />
              <span className="tnum">
                {row.sign} {money(row.value)}
              </span>
            </li>
          ))}
          <li
            className="flex items-baseline border-t pt-2 text-sm font-medium"
            style={{ borderColor: 'var(--border)' }}
          >
            <span>{t('allowance.rows.result')}</span>
            <span className="leader" aria-hidden />
            <span className="tnum" style={{ color }}>
              {money(allowance.allowanceCents)}
            </span>
          </li>
        </ul>
      )}
    </section>
  );
}
