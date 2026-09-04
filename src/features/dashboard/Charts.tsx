// Γραφήματα Dashboard.
//
// Επιλογές που ακολουθούν την πρακτική των καλών εφαρμογών του είδους:
//  - Donut αντί για γεμάτη πίτα: το κέντρο δείχνει το σύνολο, άρα το γράφημα
//    απαντά σε δύο ερωτήσεις αντί για μία.
//  - Το πολύ 6 φέτες, οι υπόλοιπες συγχωνεύονται σε «Άλλα». Πάνω από αυτό
//    ο άνθρωπος δεν συγκρίνει, απλά κοιτάζει χρώματα.
//  - Στο bar chart τα έσοδα και τα έξοδα δίπλα δίπλα, με μία γραμμή μέσου όρου
//    εξόδων ως σημείο αναφοράς.

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Category, CurrencyCode, MonthlySummary } from '../../types/finance';
import { DEFAULT_CURRENCY } from '../../lib/currency';
import { formatCompact, formatMoney, monthLabel } from '../../lib/money';

const CATEGORY_PALETTE = [
  'var(--cat-1)',
  'var(--cat-2)',
  'var(--cat-3)',
  'var(--cat-4)',
  'var(--cat-5)',
  'var(--cat-6)',
];

interface Labeler {
  (category: Category): string;
}

/* ------------------------------------------------------------------ */

function ChartTooltip({ active, payload, locale, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm shadow-lg"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
    >
      <p className="mb-1 font-medium">{payload[0].payload.label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="tnum flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          {entry.name}: {formatMoney(entry.value, locale, currency)}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut: κατανομή εξόδων ανά κατηγορία                                */
/* ------------------------------------------------------------------ */

interface CategoryDonutProps {
  expenseByCategory: Record<string, number>;
  categories: Category[];
  labelOf: Labeler;
  /** Μεταφρασμένα κείμενα του γραφήματος: «Σύνολο» και «Άλλα». */
  totalLabel: string;
  otherLabel: string;
  locale?: string;
  currency?: CurrencyCode;
  maxSlices?: number;
}

export function CategoryDonut({
  expenseByCategory,
  categories,
  labelOf,
  totalLabel,
  otherLabel,
  locale = 'el-GR',
  currency = DEFAULT_CURRENCY,
  maxSlices = 6,
}: CategoryDonutProps) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const all = Object.entries(expenseByCategory)
    .map(([categoryId, value]) => {
      const category = categoryById.get(categoryId);
      return { id: categoryId, label: category ? labelOf(category) : categoryId, value };
    })
    .sort((a, b) => b.value - a.value);

  const visible = all.slice(0, maxSlices);
  const rest = all.slice(maxSlices);
  if (rest.length > 0) {
    visible.push({
      id: 'other',
      label: otherLabel,
      value: rest.reduce((sum, r) => sum + r.value, 0),
    });
  }

  const total = all.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="relative h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={visible}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {visible.map((entry, index) => (
              <Cell key={entry.id} fill={CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip locale={locale} currency={currency} />} />
          <Legend
            verticalAlign="bottom"
            height={48}
            formatter={(value) => (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Το σύνολο στο κέντρο του donut */}
      <div className="pointer-events-none absolute inset-x-0 top-[38%] -translate-y-1/2 text-center">
        <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {totalLabel}
        </p>
        <p className="tnum text-xl font-semibold">{formatCompact(total, locale, currency)}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bars: έσοδα έναντι εξόδων ανά μήνα                                  */
/* ------------------------------------------------------------------ */

interface MonthlyBarsProps {
  summaries: MonthlySummary[];
  locale?: string;
  currency?: CurrencyCode;
  incomeLabel: string;
  expenseLabel: string;
  averageLabel: string;
}

export function MonthlyBars({
  summaries,
  locale = 'el-GR',
  currency = DEFAULT_CURRENCY,
  incomeLabel,
  expenseLabel,
  averageLabel,
}: MonthlyBarsProps) {
  const data = summaries.map((s) => ({
    label: monthLabel(s.month, locale),
    income: s.incomeCents,
    expense: s.expenseCents,
  }));

  // Ο μέσος όρος υπολογίζεται μόνο από τους μήνες που έχουν κίνηση. Οι άδειοι
  // μήνες πριν αρχίσεις να καταγράφεις θα τον τραβούσαν τεχνητά προς τα κάτω.
  const withData = data.filter((d) => d.income > 0 || d.expense > 0);
  const monthsWithData = withData.length;
  const averageExpense =
    monthsWithData > 0 ? withData.reduce((sum, d) => sum + d.expense, 0) / monthsWithData : 0;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        {/* Το πάνω περιθώριο αφήνει χώρο για την ετικέτα του μέσου όρου, ώστε
            να μην πέφτει πάνω στις στήλες ή στα ονόματα των μηνών. */}
        <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: -8 }} barGap={4}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={(v) => formatCompact(Number(v), locale, currency)}
          />
          <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={<ChartTooltip locale={locale} currency={currency} />} />
          {/* Η γραμμή του μέσου όρου μπαίνει μόνο όταν υπάρχουν αρκετοί μήνες
              με δεδομένα. Με έναν μήνα, ο «μέσος όρος» είναι ο ίδιος ο μήνας
              και η γραμμή δεν λέει τίποτα. */}
          {monthsWithData >= 3 && (
            <ReferenceLine
              y={averageExpense}
              stroke="var(--accent)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{
                value: averageLabel,
                position: 'top',
                offset: 8,
                fill: 'var(--accent)',
                fontSize: 11,
                textAnchor: 'start',
                dx: 4,
              }}
            />
          )}
          <Bar dataKey="income" name={incomeLabel} fill="var(--income)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name={expenseLabel} fill="var(--expense)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
