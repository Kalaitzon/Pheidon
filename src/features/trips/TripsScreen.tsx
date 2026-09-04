// Οθόνη ταξιδιών.
//
// Η γρήγορη καταχώρηση είναι το κέντρο της οθόνης: δύο πεδία, περιγραφή και ποσό,
// και Enter. Καμία κατηγορία, καμία ημερομηνία, κανένα μενού. Αν χρειαζόταν τρία
// πατήματα, θα κατέληγε να μη χρησιμοποιείται, όπως ακριβώς η κανονική φόρμα.

import { useMemo, useState } from 'react';
import type { Category, CurrencyCode, Transaction, Trip, TripEntry } from '../../types/finance';
import { categoryName, selectableCategories, systemCategoryId } from '../../lib/categories';
import { currencyInfo, DEFAULT_CURRENCY } from '../../lib/currency';
import { formatMoney } from '../../lib/money';
import { parseAmountText, todayIso } from '../../lib/transactionForm';
import { closeTrip, createEntry, createTrip, summarizeTrip } from '../../lib/trips';

interface TripsScreenProps {
  trips: Trip[];
  entries: TripEntry[];
  categories: Category[];
  userId: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: string;
  currency?: CurrencyCode;
  onSaveTrip: (trip: Trip) => Promise<void> | void;
  onSaveEntry: (entry: TripEntry) => Promise<void> | void;
  onDeleteEntry: (id: string) => Promise<void> | void;
  onSettle: (transaction: Transaction, trip: Trip) => Promise<void> | void;
  onDeleteTrip: (trip: Trip) => Promise<void> | void;
}

export function TripsScreen(props: TripsScreenProps) {
  const { trips, t } = props;
  const [creating, setCreating] = useState(false);

  const open = trips.filter((trip) => trip.status !== 'closed');
  const closed = trips.filter((trip) => trip.status === 'closed');

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-xl font-semibold">{t('trips.title')}</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('trips.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="text-xs font-medium"
          style={{ color: 'var(--accent)' }}
        >
          {t(creating ? 'transactionForm.cancel' : 'trips.add')}
        </button>
      </header>

      {creating && (
        <NewTripForm
          {...props}
          onCreated={() => setCreating(false)}
        />
      )}

      {trips.length === 0 && !creating && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('trips.empty')}
        </p>
      )}

      {open.map((trip) => (
        <TripCard key={trip.id} trip={trip} {...props} />
      ))}

      {closed.length > 0 && (
        <section>
          <p className="mb-2 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            {t('trips.past')}
          </p>
          {closed.map((trip) => (
            <TripCard key={trip.id} trip={trip} {...props} />
          ))}
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TripCard({
  trip,
  entries,
  userId,
  t,
  locale = 'el-GR',
  onSaveEntry,
  onDeleteEntry,
  onSettle,
  onDeleteTrip,
}: TripsScreenProps & { trip: Trip }) {
  const [expanded, setExpanded] = useState(trip.status !== 'closed');
  const [label, setLabel] = useState('');
  const [amountText, setAmountText] = useState('');

  const mine = useMemo(
    () => entries.filter((entry) => entry.tripId === trip.id).sort((a, b) => b.date.localeCompare(a.date)),
    [entries, trip.id],
  );
  const summary = summarizeTrip(trip, entries);
  const money = (cents: number) => formatMoney(cents, locale, trip.currency);
  const isClosed = trip.status === 'closed';

  const overBudget = summary.budgetRatio !== null && summary.budgetRatio > 1;

  const addEntry = async () => {
    const amount = parseAmountText(amountText);
    if (!label.trim() || amount === null || amount <= 0) return;

    await onSaveEntry(
      createEntry({
        tripId: trip.id,
        userId,
        label,
        amountCents: Math.round(amount * 10 ** currencyInfo(trip.currency).minorUnits),
      }),
    );
    setLabel('');
    setAmountText('');
  };

  const settle = async () => {
    if (!window.confirm(t('trips.confirmClose', { amount: money(summary.totalCents) }))) return;
    const result = closeTrip(trip, entries, {
      noteBuilder: (count) => t('trips.entryCount', { count }),
    });
    await onSettle(result.transaction, result.trip);
  };

  return (
    <section
      className="rounded-xl border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', opacity: isClosed ? 0.7 : 1 }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{trip.title}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {trip.destination ? `${trip.destination} · ` : ''}
            {summary.entryCount === 0
              ? t('trips.noEntries')
              : t('trips.entryCount', { count: summary.entryCount })}
            {!isClosed && summary.totalCents > 0 && ` · ${t('trips.perDay', { amount: money(summary.dailyAverageCents) })}`}
          </p>
        </div>
        <span
          className="tnum text-lg font-semibold"
          style={{ color: overBudget ? 'var(--expense)' : 'var(--text)' }}
        >
          {money(summary.totalCents)}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--border)' }}>
          {trip.budgetCents != null && (
            <div>
              <div className="flex items-baseline text-xs">
                <span style={{ color: 'var(--text-muted)' }}>{t('trips.budget')}</span>
                <span className="leader" aria-hidden />
                <span className="tnum" style={{ color: overBudget ? 'var(--expense)' : 'var(--text-muted)' }}>
                  {summary.remainingCents !== null && summary.remainingCents >= 0
                    ? t('trips.remaining', { amount: money(summary.remainingCents) })
                    : t('trips.overBudget', { amount: money(Math.abs(summary.remainingCents ?? 0)) })}
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--surface-sunken)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (summary.budgetRatio ?? 0) * 100)}%`,
                    background: overBudget ? 'var(--expense)' : 'var(--accent)',
                  }}
                />
              </div>
            </div>
          )}

          {!isClosed && (
            <div className="flex gap-2">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addEntry()}
                placeholder={t('trips.entryPlaceholder')}
                className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <input
                type="text"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addEntry()}
                placeholder="0"
                className="tnum w-24 rounded-lg border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              />
              <button
                type="button"
                onClick={addEntry}
                className="rounded-lg px-3 py-2 text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                +
              </button>
            </div>
          )}

          {mine.length > 0 && (
            <ul className="space-y-1">
              {mine.map((entry) => (
                <li key={entry.id} className="flex items-baseline text-sm">
                  <span className="truncate">{entry.label}</span>
                  <span className="leader" aria-hidden />
                  <span className="tnum">{money(entry.amountCents)}</span>
                  {!isClosed && (
                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      aria-label={t('transactionList.delete')}
                      className="ml-2 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!isClosed && summary.totalCents > 0 && (
            <div>
              <button
                type="button"
                onClick={settle}
                className="w-full rounded-lg border px-4 py-2 text-sm font-medium"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                {t('trips.close')}
              </button>
              <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                {t('trips.closeHint')}
              </p>
            </div>
          )}

          {isClosed && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('trips.closedNote')}
            </p>
          )}

          {/* Η διαγραφή είναι διαθέσιμη πάντα, ανοιχτό ή κλειστό. Ένα ταξίδι
              που δεν σβήνεται από πουθενά είναι σκουπίδι στη λίστα για πάντα. */}
          <button
            type="button"
            onClick={() => {
              const message = isClosed
                ? t('trips.confirmDeleteClosed', { amount: money(summary.totalCents) })
                : t('trips.confirmDelete');
              if (window.confirm(message)) void onDeleteTrip(trip);
            }}
            className="text-xs"
            style={{ color: 'var(--expense)' }}
          >
            {t('trips.delete')}
          </button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function NewTripForm({
  categories,
  userId,
  currency = DEFAULT_CURRENCY,
  t,
  onSaveTrip,
  onCreated,
}: TripsScreenProps & { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState('');
  const [budgetText, setBudgetText] = useState('');

  // Προεπιλογή η κατηγορία «Ταξίδια», που ήδη ανήκει στα Ελεύθερα.
  const fallback = selectableCategories(categories, 'expense')[0]?.id ?? '';
  const [categoryId, setCategoryId] = useState(
    categories.find((c) => c.slug === 'travel')?.id ?? systemCategoryId('travel') ?? fallback,
  );

  const budget = parseAmountText(budgetText);
  const inputStyle = { borderColor: 'var(--border)', color: 'var(--text)', background: 'transparent' };

  const submit = async () => {
    if (!title.trim()) return;
    await onSaveTrip(
      createTrip({
        userId,
        title,
        destination,
        startDate,
        endDate: endDate || undefined,
        budgetCents:
          budget && budget > 0
            ? Math.round(budget * 10 ** currencyInfo(currency).minorUnits)
            : undefined,
        currency,
        targetCategoryId: categoryId,
      }),
    );
    onCreated();
  };

  return (
    <div
      className="space-y-3 rounded-xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('trips.titlePlaceholder')}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={inputStyle}
      />
      <input
        type="text"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder={t('trips.destinationPlaceholder')}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={inputStyle}
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="tnum w-full rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="tnum w-full rounded-lg border px-3 py-2 text-sm"
          style={inputStyle}
        />
      </div>

      <input
        type="text"
        inputMode="decimal"
        value={budgetText}
        onChange={(e) => setBudgetText(e.target.value)}
        placeholder={t('trips.budgetPlaceholder')}
        className="tnum w-full rounded-lg border px-3 py-2 text-sm"
        style={inputStyle}
      />

      <label className="block">
        <span className="text-[11px] uppercase" style={{ color: 'var(--text-muted)' }}>
          {t('trips.targetCategory')}
        </span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ ...inputStyle, background: 'var(--surface)' }}
        >
          {selectableCategories(categories, 'expense').map((c) => (
            <option key={c.id} value={c.id}>
              {categoryName(c, t)}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={!title.trim()}
        className="w-full rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {t('trips.create')}
      </button>
    </div>
  );
}
