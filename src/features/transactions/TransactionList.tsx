// Λίστα συναλλαγών.
//
// Ομαδοποίηση ανά ημέρα με ημερήσιο σύνολο, γιατί έτσι κοιτάζει κανείς το
// ιστορικό του: «τι ξόδεψα την Τρίτη», όχι «η 47η συναλλαγή».

import { useMemo } from 'react';
import type { Category, CurrencyCode, Transaction } from '../../types/finance';
import { categoryName } from '../../lib/categories';
import { DEFAULT_CURRENCY } from '../../lib/currency';
import { formatMoney } from '../../lib/money';
import { todayIso } from '../../lib/transactionForm';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: string;
  currency?: CurrencyCode;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
}

export function TransactionList({
  transactions,
  categories,
  t,
  locale = 'el-GR',
  currency = DEFAULT_CURRENCY,
  onEdit,
  onDelete,
}: TransactionListProps) {
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const days = useMemo(() => {
    const grouped = new Map<string, Transaction[]>();
    for (const tx of [...transactions].sort((a, b) => b.date.localeCompare(a.date))) {
      const list = grouped.get(tx.date) ?? [];
      list.push(tx);
      grouped.set(tx.date, list);
    }
    return [...grouped.entries()];
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('transactionList.empty')}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4">
      {days.map(([date, items]) => {
        const net = items.reduce(
          (sum, tx) => sum + (tx.kind === 'income' ? tx.amountCents : -tx.amountCents),
          0,
        );

        return (
          <section key={date} className="mb-5">
            <header className="flex items-baseline pb-1">
              <h3 className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {dayLabel(date, locale, t)}
              </h3>
              <span className="leader" aria-hidden />
              <span className="tnum text-xs" style={{ color: 'var(--text-muted)' }}>
                {formatMoney(net, locale, currency)}
              </span>
            </header>

            <ul
              className="divide-y overflow-hidden rounded-xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {items.map((tx) => {
                const category = categoryById.get(tx.categoryId);
                return (
                  <li key={tx.id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {category ? categoryName(category, t) : tx.categoryId}
                      </p>
                      {(tx.merchant || tx.note) && (
                        <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                          {tx.merchant || tx.note}
                        </p>
                      )}
                    </div>

                    <span
                      className="tnum text-sm font-medium"
                      style={{ color: tx.kind === 'income' ? 'var(--income)' : 'var(--text)' }}
                    >
                      {tx.kind === 'income' ? '+' : '−'}
                      {formatMoney(tx.amountCents, locale, currency)}
                    </span>

                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(tx)}
                        className="text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {t('transactionList.edit')}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('transactionList.confirmDelete'))) onDelete(tx.id);
                        }}
                        className="text-xs"
                        style={{ color: 'var(--expense)' }}
                      >
                        {t('transactionList.delete')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** «Σήμερα», «Χθες», αλλιώς πλήρης ημερομηνία. */
function dayLabel(
  date: string,
  locale: string,
  t: TransactionListProps['t'],
): string {
  const today = todayIso();
  if (date === today) return t('transactionList.today');

  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === todayIso(yesterday)) return t('transactionList.yesterday');

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T00:00:00`));
}
