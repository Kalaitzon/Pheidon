// Παρουσίαση ενός Insight.
//
// Η κάρτα δεν ξέρει τίποτα από στατιστικά: παίρνει έτοιμο Insight και μεταφράζει
// τα κλειδιά του. Αυτός ο διαχωρισμός είναι που επιτρέπει να αλλάξει αργότερα
// η πηγή (κανόνες ή LLM) χωρίς να πειραχτεί το UI.

import type { Category, CurrencyCode, Insight } from '../../types/finance';
import { DEFAULT_CURRENCY } from '../../lib/currency';
import { formatMoney } from '../../lib/money';

const SEVERITY_STYLES: Record<Insight['severity'], { bar: string; chip: string; text: string }> = {
  info: { bar: 'var(--cat-2)', chip: 'var(--surface-sunken)', text: 'var(--text-muted)' },
  success: { bar: 'var(--income)', chip: 'var(--income-soft)', text: 'var(--income)' },
  warning: { bar: 'var(--accent)', chip: 'var(--accent-soft)', text: 'var(--accent)' },
  critical: { bar: 'var(--expense)', chip: 'var(--expense-soft)', text: 'var(--expense)' },
};

interface SmartTipCardProps {
  insight: Insight;
  categories: Category[];
  /** Συνάρτηση μετάφρασης, συνήθως το `t` του i18next. */
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: string;
  currency?: CurrencyCode;
  onApply?: (insight: Insight) => void;
  onDismiss?: (insightId: string) => void;
}

export function SmartTipCard({
  insight,
  categories,
  t,
  locale = 'el-GR',
  currency = DEFAULT_CURRENCY,
  onApply,
  onDismiss,
}: SmartTipCardProps) {
  const style = SEVERITY_STYLES[insight.severity];
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const nameOfSlug = (slug: string) => (slug ? t(`categories.${slug}`) : '');

  // Τα params έρχονται ως ωμά cents και slugs. Εδώ γίνονται αναγνώσιμα,
  // στη γλώσσα και στο νόμισμα του χρήστη.
  // Κάθε παράμετρος που λήγει σε "Cents" γίνεται αυτόματα διαθέσιμη και ως
  // μορφοποιημένο ποσό χωρίς την κατάληξη: overspendCents -> {{overspend}}.
  // Έτσι, όταν προστεθεί νέος κανόνας, δεν χρειάζεται να πειραχτεί αυτό το αρχείο.
  const params: Record<string, string | number> = { ...insight.params };

  for (const [key, value] of Object.entries(insight.params)) {
    if (key.endsWith('Cents')) {
      params[key.slice(0, -'Cents'.length)] = formatMoney(Number(value), locale, currency);
    }
  }
  params.category = nameOfSlug(String(insight.params.category ?? ''));
  params.donorCategory = nameOfSlug(String(insight.params.donorCategory ?? ''));

  const showConfidence = insight.confidence < 0.75;

  return (
    <article
      className="flex gap-4 rounded-xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <span className="w-1 shrink-0 rounded-full" style={{ background: style.bar }} aria-hidden />

      <div className="min-w-0 flex-1">
        <h3
          className="font-[var(--font-display)] text-[15px] font-semibold leading-snug"
          style={{ color: 'var(--text)' }}
        >
          {t(insight.titleKey, params)}
        </h3>

        <p
          className="mt-1 text-sm leading-relaxed"
          style={{ color: 'var(--text-muted)', textAlign: 'justify', hyphens: 'auto' }}
        >
          {t(insight.bodyKey, params)}
        </p>

        {insight.actions.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {insight.actions.map((action) => {
              const category = categoryById.get(action.categoryId);
              return (
                <li key={action.categoryId} className="flex items-baseline text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>
                    {category ? nameOfSlug(category.slug) : action.categoryId}
                  </span>
                  <span className="leader" aria-hidden />
                  <span className="tnum" style={{ color: 'var(--expense)' }}>
                    -{formatMoney(action.deltaCents, locale, currency)}
                  </span>
                  <span className="tnum ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    ({formatMoney(action.suggestedMonthlyCents, locale, currency)})
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {insight.actions.length > 0 && onApply && (
            <button
              type="button"
              onClick={() => onApply(insight)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-85"
              style={{ background: style.chip, color: style.text }}
            >
              {t('insights.applyAction')}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(insight.id)}
              className="rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-85"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('insights.dismiss')}
            </button>
          )}
          {showConfidence && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('insights.lowConfidence', { months: Math.round(insight.confidence * 6) })}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
