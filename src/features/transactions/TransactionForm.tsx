// Φόρμα καταχώρησης συναλλαγής.
//
// Ο χρήστης θα την ανοίξει χίλιες φορές, συνήθως όρθιος έξω από ένα ταμείο. Ό,τι
// δεν είναι απαραίτητο, μπαίνει από κάτω ή κρύβεται.
//
// Τρεις αποφάσεις υπέρ της ταχύτητας:
//   - Το ποσό είναι το πρώτο πεδίο και παίρνει αυτόματα το focus.
//   - Η κατηγορία επιλέγεται με κουμπιά, όχι από dropdown: ένα πάτημα αντί για τρία.
//   - Κατάστημα, σημείωση και τρόπος πληρωμής είναι διπλωμένα.
//
// Η ημερομηνία ΔΕΝ είναι διπλωμένη, παρότι έχει προεπιλογή. Είναι αυτή που
// καθορίζει σε ποιον μήνα μετράει η κίνηση, οπότε μια δωρεά που αφορά τον
// επόμενο μήνα πρέπει να μπορεί να μπει εκεί χωρίς να ψάξει ο χρήστης.

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Category,
  CurrencyCode,
  PaymentMethod,
  Transaction,
  TransactionKind,
} from '../../types/finance';
import { categoryName, groupCategories, selectableCategories } from '../../lib/categories';
import { currencyInfo, DEFAULT_CURRENCY } from '../../lib/currency';
import {
  buildTransaction,
  emptyDraft,
  isValid,
  parseAmountText,
  todayIso,
  validateDraft,
  type DraftErrors,
  type TransactionDraft,
} from '../../lib/transactionForm';

const PAYMENT_METHODS: PaymentMethod[] = ['card', 'cash', 'bank', 'other'];

interface TransactionFormProps {
  categories: Category[];
  userId: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: string;
  currency?: CurrencyCode;
  initialDraft?: TransactionDraft;
  existing?: Pick<Transaction, 'id' | 'createdAt'>;
  onSave: (transaction: Transaction) => Promise<void> | void;
  onCancel?: () => void;
}

export function TransactionForm({
  categories,
  userId,
  t,
  currency = DEFAULT_CURRENCY,
  initialDraft,
  existing,
  onSave,
  onCancel,
}: TransactionFormProps) {
  const [draft, setDraft] = useState<TransactionDraft>(initialDraft ?? emptyDraft());
  const [errors, setErrors] = useState<DraftErrors>({});
  const [showDetails, setShowDetails] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const set = <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    // Το σφάλμα του πεδίου φεύγει μόλις ο χρήστης το αγγίξει. Να επιμένει
    // ενώ διορθώνει είναι απλώς ενοχλητικό.
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  /* Οι κατηγορίες φιλτράρονται από το είδος: σε έξοδο δεν βλέπεις «Μισθός». */
  const visibleGroups = useMemo(() => {
    const usable = selectableCategories(categories, draft.kind).map((c) => c.id);
    return groupCategories(categories)
      .map((g) => ({ ...g, children: g.children.filter((c) => usable.includes(c.id)) }))
      .filter((g) => g.children.length > 0);
  }, [categories, draft.kind]);

  const switchKind = (kind: TransactionKind) => {
    // Η κατηγορία μηδενίζεται: μια κατηγορία εξόδου δεν έχει νόημα σε έσοδο.
    setDraft((prev) => ({ ...prev, kind, categoryId: '' }));
  };

  const submit = async () => {
    const found = validateDraft(draft, { currency });
    setErrors(found);
    if (!isValid(found)) return;

    setSaving(true);
    try {
      await onSave(buildTransaction(draft, { userId, currency, existing }));
      // Μετά την αποθήκευση, καθαρή φόρμα με το ίδιο είδος: συνήθως ακολουθεί
      // κι άλλη καταχώρηση του ίδιου τύπου.
      setDraft(emptyDraft(draft.kind));
      setShowDetails(false);
      amountRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const symbol = currencyInfo(currency).symbol;
  const amountValue = parseAmountText(draft.amountText);
  const accent = draft.kind === 'income' ? 'var(--income)' : 'var(--expense)';

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-6">
      {/* Είδος συναλλαγής */}
      <div
        className="grid grid-cols-2 gap-1 rounded-lg p-1"
        style={{ background: 'var(--surface-sunken)' }}
        role="radiogroup"
        aria-label={t('transactionForm.kind')}
      >
        {(['expense', 'income'] as TransactionKind[]).map((kind) => {
          const active = draft.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => switchKind(kind)}
              className="rounded-md py-2 text-sm font-medium transition-colors"
              style={{
                background: active ? 'var(--surface)' : 'transparent',
                color: active
                  ? kind === 'income'
                    ? 'var(--income)'
                    : 'var(--expense)'
                  : 'var(--text-muted)',
              }}
            >
              {t(`transactionForm.${kind}`)}
            </button>
          );
        })}
      </div>

      {/* Ποσό */}
      <div>
        <div className="flex items-baseline justify-center gap-2">
          <span className="tnum text-2xl" style={{ color: 'var(--text-muted)' }}>
            {draft.kind === 'income' ? '+' : '−'}
          </span>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={draft.amountText}
            onChange={(e) => set('amountText', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            aria-label={t('transactionForm.amount')}
            className="tnum w-full bg-transparent text-center text-4xl font-semibold outline-none"
            style={{ color: amountValue ? accent : 'var(--text-muted)' }}
          />
          <span className="text-2xl" style={{ color: 'var(--text-muted)' }}>
            {symbol}
          </span>
        </div>
        {errors.amountText && <ErrorText t={t} code={errors.amountText} />}
      </div>

      {/* Κατηγορία */}
      <div>
        <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {t('transactionForm.category')}
        </p>
        <div className="mt-2 space-y-3">
          {visibleGroups.map(({ group, children }) => (
            <div key={group.id}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {categoryName(group, t)}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {children.map((category) => {
                  const active = draft.categoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('categoryId', category.id)}
                      className="rounded-full border px-3 py-1.5 text-sm transition-colors"
                      style={{
                        borderColor: active ? accent : 'var(--border)',
                        background: active ? 'var(--surface-sunken)' : 'transparent',
                        color: active ? accent : 'var(--text)',
                      }}
                    >
                      {categoryName(category, t)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {errors.categoryId && <ErrorText t={t} code={errors.categoryId} />}
      </div>

      {/* Ημερομηνία: πάντα ορατή, με γρήγορες επιλογές για τους συνηθισμένους μήνες */}
      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor="tx-date"
            className="text-[11px] uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('transactionForm.date')}
          </label>
          <div className="flex gap-1.5">
            {[
              { key: 'today', date: todayIso() },
              { key: 'nextMonth', date: firstOfNextMonth() },
            ].map(({ key, date }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  set('date', date);
                  setShowMonthPicker(false);
                }}
                className="rounded-full border px-2.5 py-1 text-[11px]"
                style={{
                  borderColor:
                    draft.date === date && !showMonthPicker ? accent : 'var(--border)',
                  color: draft.date === date && !showMonthPicker ? accent : 'var(--text-muted)',
                }}
              >
                {t(`transactionForm.${key}`)}
              </button>
            ))}

            {/* Οποιοσδήποτε άλλος μήνας, παρελθόντας ή μελλοντικός. */}
            <button
              type="button"
              onClick={() => setShowMonthPicker((v) => !v)}
              aria-expanded={showMonthPicker}
              className="rounded-full border px-2.5 py-1 text-[11px]"
              style={{
                borderColor: showMonthPicker ? accent : 'var(--border)',
                color: showMonthPicker ? accent : 'var(--text-muted)',
              }}
            >
              {t('transactionForm.otherMonth')}
            </button>
          </div>
        </div>

        {showMonthPicker && (
          <div className="mt-1">
            <input
              type="month"
              value={draft.date.slice(0, 7)}
              onChange={(e) => {
                // Διαλέγοντας μήνα, η κίνηση πάει στην 1η του: αυτό που μετράει
                // είναι σε ποιον μήνα ανήκει, όχι η ακριβής ημέρα.
                if (e.target.value) set('date', `${e.target.value}-01`);
              }}
              className="tnum w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              aria-label={t('transactionForm.otherMonth')}
            />
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {t('transactionForm.otherMonthHint')}
            </p>
          </div>
        )}

        <input
          id="tx-date"
          type="date"
          value={draft.date}
          onChange={(e) => set('date', e.target.value)}
          className="tnum mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        {errors.date && <ErrorText t={t} code={errors.date} />}
      </div>

      {/* Λεπτομέρειες, διπλωμένες */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {t(showDetails ? 'transactionForm.hideDetails' : 'transactionForm.showDetails')}
        </button>

        {showDetails && (
          <div className="mt-3 space-y-3">
            <Labeled label={t('transactionForm.merchant')}>
              <input
                type="text"
                value={draft.merchant}
                onChange={(e) => set('merchant', e.target.value)}
                placeholder={t('transactionForm.merchantPlaceholder')}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            </Labeled>

            <Labeled label={t('transactionForm.paymentMethod')}>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((method) => {
                  const active = draft.paymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('paymentMethod', active ? '' : method)}
                      className="rounded-full border px-3 py-1.5 text-xs"
                      style={{
                        borderColor: active ? 'var(--accent)' : 'var(--border)',
                        color: active ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {t(`transactionForm.methods.${method}`)}
                    </button>
                  );
                })}
              </div>
            </Labeled>

            <Labeled label={t('transactionForm.note')}>
              <textarea
                value={draft.note}
                onChange={(e) => set('note', e.target.value)}
                rows={2}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              {errors.note && <ErrorText t={t} code={errors.note} />}
            </Labeled>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2.5 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('transactionForm.cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: accent, color: '#fff' }}
        >
          {saving ? t('transactionForm.saving') : t('transactionForm.save')}
        </button>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ErrorText({ t, code }: { t: TransactionFormProps['t']; code: string }) {
  return (
    <p className="mt-1 text-xs" role="alert" style={{ color: 'var(--expense)' }}>
      {t(code)}
    </p>
  );
}

/** Η πρώτη ημέρα του επόμενου μήνα, για κινήσεις που αφορούν τον επόμενο μήνα. */
function firstOfNextMonth(now: Date = new Date()): string {
  return todayIso(new Date(now.getFullYear(), now.getMonth() + 1, 1));
}
