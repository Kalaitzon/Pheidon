// Προσωρινά δεδομένα, ώστε το Dashboard να δουλεύει πριν στηθεί η αποθήκευση.
// Χρησιμοποιεί τις κανονικές προεπιλεγμένες κατηγορίες, όχι δικές του.

import type { Transaction } from '../../types/finance';
import { defaultCategories, systemCategoryId } from '../../lib/categories';
import { currentMonthKey, shiftMonth, toCents } from '../../lib/money';

export const MOCK_CATEGORIES = defaultCategories();

const id = systemCategoryId;

/** 7 μήνες ιστορικού, με σκόπιμη υπέρβαση στο σούπερ μάρκετ τον τρέχοντα μήνα. */
export function buildMockTransactions(): Transaction[] {
  const months = Array.from({ length: 7 }, (_, i) => shiftMonth(currentMonthKey(), i - 6));
  const txs: Transaction[] = [];
  let n = 0;

  const push = (
    month: string,
    day: number,
    categoryId: string,
    kind: 'income' | 'expense',
    euros: number,
  ) => {
    if (euros <= 0) return;
    const date = `${month}-${String(day).padStart(2, '0')}`;
    txs.push({
      id: `tx-${++n}`,
      userId: 'demo',
      kind,
      amountCents: toCents(euros),
      currency: 'EUR',
      categoryId,
      date,
      createdAt: `${date}T09:00:00Z`,
      updatedAt: `${date}T09:00:00Z`,
      syncState: 'synced',
    });
  };

  months.forEach((month, index) => {
    const isCurrent = index === months.length - 1;
    const jitter = (base: number, spread: number) =>
      base + Math.round(Math.sin(index * 3.7 + base) * spread);

    /* Έσοδα */
    push(month, 1, id('salary'), 'income', 1450);
    if (index % 3 === 0) push(month, 18, id('side_job'), 'income', 220);
    if (index === 3) push(month, 24, id('gift_received'), 'income', 150);

    /* Στέγη */
    push(month, 3, id('rent'), 'expense', 450);
    push(month, 5, id('building_fees'), 'expense', 35);

    /* Λογαριασμοί, χωριστά ο καθένας */
    push(month, 8, id('electricity'), 'expense', jitter(62, 14));
    push(month, 9, id('water'), 'expense', jitter(18, 4));
    push(month, 10, id('internet'), 'expense', 29);
    push(month, 10, id('mobile'), 'expense', 15);
    push(month, 12, id('heating'), 'expense', jitter(85, 25));

    /* Συνδρομές */
    push(month, 2, id('streaming'), 'expense', 18);
    push(month, 2, id('gym'), 'expense', 35);

    /* Καθημερινά */
    push(month, 6, id('groceries'), 'expense', isCurrent ? 210 : jitter(150, 20));
    push(month, 16, id('groceries'), 'expense', isCurrent ? 165 : jitter(140, 18));
    push(month, 19, id('household'), 'expense', jitter(28, 10));
    push(month, 11, id('transport'), 'expense', jitter(45, 10));
    push(month, 13, id('fuel'), 'expense', jitter(55, 15));

    /* Ελεύθερα */
    push(month, 14, id('entertainment'), 'expense', jitter(55, 18));
    push(month, 22, id('dining'), 'expense', jitter(95, 25));
    if (index % 2 === 0) push(month, 26, id('shopping'), 'expense', jitter(60, 25));
  });

  return txs;
}
