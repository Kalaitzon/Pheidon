// Ταξίδια.
//
// Το πρόβλημα που λύνει: σε ένα τριήμερο στη Ρώμη κάνεις είκοσι μικροέξοδα. Το να
// διαλέγεις κατηγορία σε κάθε ένα είναι δουλειά που κανείς δεν κάνει, οπότε στην
// πράξη δεν καταγράφονται καθόλου. Εδώ ρίχνεις περιγραφή και ποσό, τέλος.
//
// ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΘΕΛΕΙ ΠΡΟΣΟΧΗ: τα λεφτά ενός ανοιχτού ταξιδιού έχουν ήδη φύγει.
// Αν τα κρύβαμε τελείως μέχρι το κλείσιμο, το υπόλοιπο του μήνα θα έλεγε ψέματα
// για όσο διαρκεί το ταξίδι. Γι' αυτό ένα ανοιχτό ταξίδι:
//   - ΔΕΝ μπαίνει στα μηνιαία σύνολα και στα γραφήματα (θα ήταν διπλομέτρηση με
//     τη συναλλαγή που θα δημιουργηθεί στο κλείσιμο)
//   - ΑΛΛΑ αφαιρείται από το «διαθέσιμο για γούστα», ως δεσμευμένο ποσό
//
// Έτσι δεν ξοδεύεις δύο φορές τα ίδια χρήματα.

import type {
  ISODate,
  Transaction,
  Trip,
  TripEntry,
  TripSummary,
} from '../types/finance';
import { todayIso } from './transactionForm';

/* ------------------------------------------------------------------ */
/* Σύνολα                                                              */
/* ------------------------------------------------------------------ */

export function summarizeTrip(
  trip: Trip,
  entries: TripEntry[],
  today: ISODate = todayIso(),
): TripSummary {
  const mine = entries.filter((entry) => entry.tripId === trip.id);
  const totalCents = mine.reduce((sum, entry) => sum + entry.amountCents, 0);

  // Οι ημέρες μετρώνται από την έναρξη έως σήμερα ή έως τη λήξη, όποιο έρθει
  // πρώτο. Χωρίς αυτό, ένα ταξίδι που τελείωσε θα έδειχνε ολοένα μικρότερο
  // ημερήσιο μέσο όρο όσο περνούν οι μέρες.
  const lastDay = trip.endDate && trip.endDate < today ? trip.endDate : today;
  const daysElapsed = Math.max(1, daysBetween(trip.startDate, lastDay) + 1);

  const remainingCents = trip.budgetCents != null ? trip.budgetCents - totalCents : null;

  return {
    tripId: trip.id,
    totalCents,
    entryCount: mine.length,
    remainingCents,
    budgetRatio: trip.budgetCents ? totalCents / trip.budgetCents : null,
    dailyAverageCents: Math.round(totalCents / daysElapsed),
    daysElapsed,
  };
}

function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000,
  );
}

/**
 * Πόσα είναι δεσμευμένα σε ανοιχτά ταξίδια.
 *
 * Αυτό το ποσό αφαιρείται από το μηνιαίο όριο ελεύθερης κατανάλωσης, ώστε ένα
 * ταξίδι σε εξέλιξη να μη σου αφήνει την εντύπωση ότι έχεις ακόμη περιθώριο.
 */
export function committedInOpenTrips(trips: Trip[], entries: TripEntry[]): number {
  const openIds = new Set(
    trips.filter((trip) => trip.status !== 'closed').map((trip) => trip.id),
  );
  return entries
    .filter((entry) => openIds.has(entry.tripId))
    .reduce((sum, entry) => sum + entry.amountCents, 0);
}

/* ------------------------------------------------------------------ */
/* Κλείσιμο                                                            */
/* ------------------------------------------------------------------ */

export interface CloseTripResult {
  transaction: Transaction;
  trip: Trip;
}

/**
 * Κλείνει το ταξίδι και παράγει ΜΙΑ συγκεντρωτική συναλλαγή.
 *
 * Η ημερομηνία της είναι η λήξη του ταξιδιού, όχι η σημερινή: ένα ταξίδι του
 * Ιουλίου που το κλείνεις τον Σεπτέμβριο ανήκει στα έξοδα του Ιουλίου, αλλιώς
 * χαλάει η σύγκριση των μηνών.
 */
export function closeTrip(
  trip: Trip,
  entries: TripEntry[],
  options: { today?: ISODate; noteBuilder?: (count: number) => string } = {},
): CloseTripResult {
  const { today = todayIso(), noteBuilder } = options;
  const summary = summarizeTrip(trip, entries, today);

  if (summary.totalCents <= 0) {
    throw new Error('Δεν μπορεί να κλείσει ταξίδι χωρίς καμία εγγραφή εξόδου.');
  }

  const now = new Date().toISOString();
  const date = trip.endDate && trip.endDate <= today ? trip.endDate : today;

  const transaction: Transaction = {
    id: crypto.randomUUID(),
    userId: trip.userId,
    kind: 'expense',
    amountCents: summary.totalCents,
    currency: trip.currency,
    categoryId: trip.targetCategoryId,
    date,
    merchant: trip.destination ?? trip.title,
    // Η σημείωση κρατά την ιχνηλασιμότητα: από πόσες εγγραφές προέκυψε το ποσό.
    // Το κείμενο έρχεται μεταφρασμένο από το UI, γιατί το `lib` δεν ξέρει γλώσσες.
    note: noteBuilder
      ? `${trip.title} · ${noteBuilder(summary.entryCount)}`
      : `${trip.title} · ${summary.entryCount}`,
    createdAt: now,
    updatedAt: now,
    syncState: 'pending',
  };

  return {
    transaction,
    trip: { ...trip, status: 'closed', settledTransactionId: transaction.id },
  };
}

/* ------------------------------------------------------------------ */
/* Δημιουργία                                                          */
/* ------------------------------------------------------------------ */

export function createTrip(params: {
  userId: string;
  title: string;
  startDate: ISODate;
  targetCategoryId: string;
  currency: Trip['currency'];
  destination?: string;
  endDate?: ISODate;
  budgetCents?: number;
}): Trip {
  return {
    id: crypto.randomUUID(),
    userId: params.userId,
    title: params.title.trim(),
    destination: params.destination?.trim() || undefined,
    startDate: params.startDate,
    endDate: params.endDate,
    budgetCents: params.budgetCents,
    currency: params.currency,
    targetCategoryId: params.targetCategoryId,
    // Αν ξεκινά σήμερα ή έχει ήδη ξεκινήσει, είναι ενεργό.
    status: params.startDate <= todayIso() ? 'active' : 'planning',
    createdAt: new Date().toISOString(),
  };
}

export function createEntry(params: {
  tripId: string;
  userId: string;
  label: string;
  amountCents: number;
  date?: ISODate;
  note?: string;
}): TripEntry {
  return {
    id: crypto.randomUUID(),
    tripId: params.tripId,
    userId: params.userId,
    label: params.label.trim(),
    amountCents: params.amountCents,
    date: params.date ?? todayIso(),
    note: params.note,
    createdAt: new Date().toISOString(),
  };
}
