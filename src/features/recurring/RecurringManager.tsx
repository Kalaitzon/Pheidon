// Πάγια έσοδα και έξοδα.
//
// Εδώ δηλώνεις μία φορά το ενοίκιο και δεν το ξανασκέφτεσαι. Ο κανόνας κάνει δύο
// πράγματα: καταχωρεί τη συναλλαγή όταν φτάσει η μέρα της, και ενημερώνει τις
// προβλέψεις για όλους τους επόμενους μήνες.

import { useState } from 'react';
import type {
  Category,
  CurrencyCode,
  RecurringFrequency,
  RecurringRule,
  TransactionKind,
} from '../../types/finance';
import { categoryName, requiresLabel, selectableCategories } from '../../lib/categories';
import { currencyInfo, DEFAULT_CURRENCY } from '../../lib/currency';
import { currentMonthKey, formatMoney } from '../../lib/money';
import { monthlyEquivalentByCategory } from '../../lib/recurring';
import { parseAmountText } from '../../lib/transactionForm';

const FREQUENCIES: RecurringFrequency[] = ['monthly', 'bimonthly', 'quarterly', 'yearly'];


interface RecurringManagerProps {
  rules: RecurringRule[];
  categories: Category[];
  userId: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: string;
  currency?: CurrencyCode;
  onSave: (rule: RecurringRule) => Promise<void> | void;
  onToggle?: (rule: RecurringRule) => Promise<void> | void;
  onDelete?: (rule: RecurringRule) => Promise<void> | void;
}

export function RecurringManager({
  rules,
  categories,
  userId,
  t,
  locale = 'el-GR',
  currency = DEFAULT_CURRENCY,
  onSave,
  onToggle,
  onDelete,
}: RecurringManagerProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const income = rules.filter((r) => r.kind === 'income');
  const expense = rules.filter((r) => r.kind === 'expense');

  // Το ετήσιο των 240€ εμφανίζεται και ως 20€/μήνα, αλλιώς ο χρήστης δεν μπορεί
  // να συγκρίνει ένα ετήσιο με ένα μηνιαίο πάγιο.
  const monthlyExpense = Object.values(monthlyEquivalentByCategory(rules, 'expense')).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2 className="font-[var(--font-display)] text-base font-semibold">
          {t('recurring.title')}
        </h2>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setAdding((v) => !v);
          }}
          className="text-xs font-medium"
          style={{ color: 'var(--accent)' }}
        >
          {t(adding ? 'transactionForm.cancel' : 'recurring.add')}
        </button>
      </header>

      {adding && (
        <RecurringForm
          categories={categories}
          userId={userId}
          t={t}
          currency={currency}
          onSave={async (rule) => {
            await onSave(rule);
            setAdding(false);
          }}
        />
      )}

      {rules.length === 0 && !adding && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('recurring.empty')}
        </p>
      )}

      {[
        { key: 'income' as const, list: income },
        { key: 'expense' as const, list: expense },
      ]
        .filter((section) => section.list.length > 0)
        .map((section) => (
          <div key={section.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {t(`transactionForm.${section.key}`)}
              </p>

              {/* Το μηνιαίο σύνολο ανήκει εδώ, κάτω από την επικεφαλίδα των
                  εξόδων: στα έσοδα θα ήταν παραπλανητικό. */}
              {section.key === 'expense' && (
                <p className="tnum text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {t('recurring.monthlyTotal', {
                    amount: formatMoney(monthlyExpense, locale, currency),
                  })}
                </p>
              )}
            </div>
            <ul
              className="divide-y overflow-hidden rounded-xl border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {section.list.map((rule) => {
                const category = categories.find((c) => c.id === rule.categoryId);
                const displayName =
                  rule.label || (category ? categoryName(category, t) : rule.categoryId);

                if (editingId === rule.id) {
                  return (
                    <li key={rule.id} className="px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                      <InlineEdit
                        rule={rule}
                        categories={categories}
                        t={t}
                        onCancel={() => setEditingId(null)}
                        onSave={async (updated) => {
                          await onSave(updated);
                          setEditingId(null);
                        }}
                      />
                    </li>
                  );
                }

                return (
                  <li
                    key={rule.id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderColor: 'var(--border)', opacity: rule.active ? 1 : 0.5 }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{displayName}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {category ? categoryName(category, t) : rule.categoryId}
                        {' · '}
                        {t(`recurring.frequencies.${rule.frequency}`)}
                        {' · '}
                        {t('recurring.onDay', { day: rule.dayOfMonth })}
                        {` · ${t('recurring.from', { month: rule.startMonth })}`}
                        {rule.endMonth && ` · ${t('recurring.until', { month: rule.endMonth })}`}
                      </p>
                    </div>

                    <span className="tnum text-sm font-medium">
                      {formatMoney(rule.amountCents, locale, currency)}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        // Κλείνει τη φόρμα προσθήκης, ώστε να μην είναι ανοιχτές
                        // δύο φόρμες ταυτόχρονα στην ίδια οθόνη.
                        setAdding(false);
                        setEditingId(rule.id);
                      }}
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {t('recurring.edit')}
                    </button>

                    {onToggle && (
                      <button
                        type="button"
                        onClick={() => onToggle({ ...rule, active: !rule.active })}
                        className="text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {t(rule.active ? 'recurring.pause' : 'recurring.resume')}
                      </button>
                    )}

                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('recurring.confirmDelete', { label: rule.label }))) {
                            void onDelete(rule);
                          }
                        }}
                        className="text-xs"
                        style={{ color: 'var(--expense)' }}
                      >
                        {t('recurring.delete')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function RecurringForm({
  categories,
  userId,
  t,
  currency,
  existing,
  onSave,
  onCancel,
}: {
  categories: Category[];
  userId: string;
  t: RecurringManagerProps['t'];
  currency: CurrencyCode;
  /** Όταν δίνεται, η φόρμα επεξεργάζεται υπάρχον πάγιο αντί να φτιάχνει νέο. */
  existing?: RecurringRule;
  onSave: (rule: RecurringRule) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<TransactionKind>(existing?.kind ?? 'expense');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [amountText, setAmountText] = useState(
    existing ? String(existing.amountCents / 10 ** currencyInfo(currency).minorUnits) : '',
  );
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    existing?.frequency ?? 'monthly',
  );
  const [dayOfMonth, setDayOfMonth] = useState(existing?.dayOfMonth ?? 1);
  // Προεπιλογή ο τρέχων μήνας, αλλά αλλάζει: ένα πάγιο μπορεί να ξεκινά
  // τον επόμενο μήνα ή να καταχωρείται αναδρομικά για προηγούμενους.
  const [startMonth, setStartMonth] = useState(existing?.startMonth ?? currentMonthKey());
  const [endMonth, setEndMonth] = useState(existing?.endMonth ?? '');

  const amount = parseAmountText(amountText);
  // Η λήξη δεν μπορεί να προηγείται της έναρξης: θα ήταν κανόνας που δεν
  // ενεργοποιείται ποτέ και ο χρήστης θα αναρωτιόταν γιατί δεν καταχωρείται.
  const rangeValid = !endMonth || endMonth >= startMonth;

  const chosen = categories.find((c) => c.id === categoryId);

  // Το όνομα είναι προαιρετικό: αν λείπει, χρησιμοποιείται η κατηγορία.
  // Εξαίρεση οι γενικές κατηγορίες, όπου χωρίς περιγραφή δεν ξεχωρίζει τίποτα.
  const labelRequired = chosen ? requiresLabel(chosen) : false;
  const labelValid = !labelRequired || label.trim() !== '';

  const valid =
    amount !== null && amount > 0 && categoryId !== '' && rangeValid && labelValid;

  const submit = async () => {
    if (!valid) return;
    await onSave({
      // Στην επεξεργασία κρατάμε το ίδιο id, ώστε να ενημερωθεί η υπάρχουσα
      // γραμμή και να μη δημιουργηθεί διπλότυπο.
      id: existing?.id ?? crypto.randomUUID(),
      userId,
      // Πέφτουμε στο όνομα της κατηγορίας όταν ο χρήστης δεν έγραψε τίποτα.
      label: label.trim() || (chosen ? categoryName(chosen, t) : ''),
      kind,
      amountCents: Math.round(amount * 10 ** currencyInfo(currency).minorUnits),
      currency,
      categoryId,
      frequency,
      dayOfMonth,
      startMonth,
      endMonth: endMonth || undefined,
      active: existing?.active ?? true,
      lastGeneratedMonth: existing?.lastGeneratedMonth,
    });
  };

  const inputStyle = {
    borderColor: 'var(--border)',
    color: 'var(--text)',
    background: 'transparent',
  };

  return (
    <div
      className="space-y-3 rounded-xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="grid grid-cols-2 gap-1 rounded-lg p-1" style={{ background: 'var(--surface-sunken)' }}>
        {(['expense', 'income'] as TransactionKind[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              if (option === kind) return;
              setKind(option);
              // Μια κατηγορία εξόδου δεν έχει νόημα σε έσοδο.
              setCategoryId('');
            }}
            className="rounded-md py-1.5 text-sm"
            style={{
              background: kind === option ? 'var(--surface)' : 'transparent',
              color: kind === option ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            {t(`transactionForm.${option}`)}
          </button>
        ))}
      </div>

      <div>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={
            labelRequired
              ? t('recurring.labelRequired')
              : chosen
                ? t('recurring.labelOptionalWith', { category: categoryName(chosen, t) })
                : t('recurring.labelOptional')
          }
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{
            ...inputStyle,
            borderColor: labelRequired && !labelValid ? 'var(--expense)' : 'var(--border)',
          }}
        />
        {labelRequired && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {t('recurring.labelRequiredHint')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          placeholder={t('transactionForm.amount')}
          className="tnum w-full rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ ...inputStyle, background: 'var(--surface)' }}
        >
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {t(`recurring.frequencies.${f}`)}
            </option>
          ))}
        </select>
      </div>

      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ ...inputStyle, background: 'var(--surface)' }}
      >
        <option value="">{t('transactionForm.category')}</option>
        {selectableCategories(categories, kind).map((c) => (
          <option key={c.id} value={c.id}>
            {categoryName(c, t)}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] uppercase" style={{ color: 'var(--text-muted)' }}>
            {t('recurring.startMonth')}
          </span>
          <input
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value || currentMonthKey())}
            className="tnum mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase" style={{ color: 'var(--text-muted)' }}>
            {t('recurring.endMonth')}
          </span>
          <input
            type="month"
            value={endMonth}
            min={startMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="tnum mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] uppercase" style={{ color: 'var(--text-muted)' }}>
            {t('recurring.dayOfMonth')}
          </span>
          <input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(Number(e.target.value))}
            className="tnum mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </label>
      </div>

      {/* Το όριο των 28 δεν είναι αυθαίρετο: η 30ή δεν υπάρχει τον Φεβρουάριο. */}
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {t('recurring.dayHint')}
      </p>

      {!rangeValid && (
        <p className="text-[11px]" style={{ color: 'var(--expense)' }}>
          {t('recurring.rangeError')}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('transactionForm.cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {t('transactionForm.save')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Επεξεργασία υπάρχοντος παγίου, επιτόπου στη λίστα.
 *
 * Αλλάζουν όνομα και κατηγορία. Το ποσό, η συχνότητα και οι ημερομηνίες μένουν
 * ως έχουν: αλλαγή τους θα επηρέαζε αναδρομικά συναλλαγές που έχουν ήδη
 * καταχωρηθεί, οπότε σε αυτή την περίπτωση η καθαρή κίνηση είναι να λήξει ο
 * παλιός κανόνας και να δημιουργηθεί νέος.
 */
function InlineEdit({
  rule,
  categories,
  t,
  onSave,
  onCancel,
}: {
  rule: RecurringRule;
  categories: Category[];
  t: RecurringManagerProps['t'];
  onSave: (rule: RecurringRule) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(rule.label);
  const [categoryId, setCategoryId] = useState(rule.categoryId);

  const category = categories.find((c) => c.id === categoryId);
  const labelNeeded = category ? requiresLabel(category) : false;
  const valid = (!labelNeeded || label.trim() !== '') && categoryId !== '';

  const inputStyle = {
    borderColor: 'var(--border)',
    color: 'var(--text)',
    background: 'transparent',
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t(labelNeeded ? 'recurring.labelRequired' : 'recurring.labelOptional')}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={inputStyle}
        autoFocus
      />

      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ ...inputStyle, background: 'var(--surface)' }}
      >
        {selectableCategories(categories, rule.kind).map((c) => (
          <option key={c.id} value={c.id}>
            {categoryName(c, t)}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('transactionForm.cancel')}
        </button>
        <button
          type="button"
          onClick={() => valid && void onSave({ ...rule, label: label.trim(), categoryId })}
          disabled={!valid}
          className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {t('transactionForm.save')}
        </button>
      </div>
    </div>
  );
}
