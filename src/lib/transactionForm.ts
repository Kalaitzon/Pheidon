// Λογική της φόρμας συναλλαγής.
//
// Χωριστά από το component, γιατί ο έλεγχος εγκυρότητας πρέπει να τρέχει και στο
// mobile και, αργότερα, στον server. Ένας έλεγχος που ζει μέσα σε React component
// είναι έλεγχος που θα ξαναγραφτεί δύο φορές και θα αποκλίνει.

import type {
  CurrencyCode,
  ISODate,
  PaymentMethod,
  Transaction,
  TransactionKind,
} from '../types/finance';
import { minorFactor } from './currency';

/** Ό,τι κρατάει η φόρμα όσο ο χρήστης πληκτρολογεί. Όλα strings, όπως έρχονται. */
export interface TransactionDraft {
  kind: TransactionKind;
  /** Ακατέργαστο κείμενο. Δέχεται και κόμμα και τελεία. */
  amountText: string;
  categoryId: string;
  date: ISODate;
  note: string;
  merchant: string;
  paymentMethod: PaymentMethod | '';
}

export type DraftField = keyof TransactionDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

export const emptyDraft = (kind: TransactionKind = 'expense'): TransactionDraft => ({
  kind,
  amountText: '',
  categoryId: '',
  date: todayIso(),
  note: '',
  merchant: '',
  paymentMethod: '',
});

export function todayIso(now: Date = new Date()): ISODate {
  // Τοπική ημερομηνία, όχι UTC. Με toISOString(), μια καταχώρηση στις 01:30
  // θα πήγαινε στη χθεσινή μέρα για όποιον είναι σε ζώνη +02.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Μετατρέπει το κείμενο του ποσού σε αριθμό.
 *
 * Δέχεται κόμμα, γιατί το ελληνικό πληκτρολόγιο δίνει κόμμα στο αριθμητικό,
 * και τελείες χιλιάδων, γιατί κάποιοι τις γράφουν από συνήθεια. Επιστρέφει
 * null σε ό,τι δεν βγάζει νόημα, αντί για NaN που διαδίδεται σιωπηλά.
 */
export function parseAmountText(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, '');
  if (cleaned === '') return null;

  // «1.234,56» -> «1234.56».  «1234,56» -> «1234.56».  «1234.56» μένει ως έχει.
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(',', '.');

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/* ------------------------------------------------------------------ */
/* Έλεγχος εγκυρότητας                                                 */
/* ------------------------------------------------------------------ */

export interface ValidationOptions {
  currency: CurrencyCode;
  /** Δεν επιτρέπονται μελλοντικές ημερομηνίες πέρα από αυτές τις ημέρες. */
  maxFutureDays?: number;
  today?: ISODate;
}

export function validateDraft(
  draft: TransactionDraft,
  options: ValidationOptions,
): DraftErrors {
  const { currency, maxFutureDays = 365, today = todayIso() } = options;
  const errors: DraftErrors = {};

  const amount = parseAmountText(draft.amountText);
  if (amount === null) {
    errors.amountText = 'transactionForm.errors.amountRequired';
  } else if (amount <= 0) {
    // Το πρόσημο το δίνει το είδος της συναλλαγής, όχι ο χρήστης. Ένα «-20»
    // σε έξοδο θα σήμαινε έσοδο, που δεν είναι ποτέ αυτό που εννοεί.
    errors.amountText = 'transactionForm.errors.amountPositive';
  } else if (amount * minorFactor(currency) > Number.MAX_SAFE_INTEGER / 1000) {
    errors.amountText = 'transactionForm.errors.amountTooLarge';
  }

  if (!draft.categoryId) {
    errors.categoryId = 'transactionForm.errors.categoryRequired';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    errors.date = 'transactionForm.errors.dateInvalid';
  } else if (daysBetween(today, draft.date) > maxFutureDays) {
    errors.date = 'transactionForm.errors.dateTooFar';
  }

  if (draft.note.length > 280) {
    errors.note = 'transactionForm.errors.noteTooLong';
  }

  return errors;
}

export const isValid = (errors: DraftErrors): boolean => Object.keys(errors).length === 0;

function daysBetween(from: ISODate, to: ISODate): number {
  const ms = Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`);
  return Math.round(ms / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Μετατροπή σε συναλλαγή                                              */
/* ------------------------------------------------------------------ */

export interface BuildOptions {
  userId: string;
  currency: CurrencyCode;
  /** Δίνεται σε επεξεργασία υπάρχουσας συναλλαγής, ώστε να διατηρηθεί το id. */
  existing?: Pick<Transaction, 'id' | 'createdAt'>;
}

/** Προϋποθέτει ότι το draft έχει ήδη περάσει από `validateDraft`. */
export function buildTransaction(
  draft: TransactionDraft,
  options: BuildOptions,
): Transaction {
  const amount = parseAmountText(draft.amountText);
  if (amount === null) throw new Error('Μη έγκυρο ποσό: κάλεσε πρώτα το validateDraft.');

  const now = new Date().toISOString();

  return {
    id: options.existing?.id ?? crypto.randomUUID(),
    userId: options.userId,
    kind: draft.kind,
    amountCents: Math.round(amount * minorFactor(options.currency)),
    currency: options.currency,
    categoryId: draft.categoryId,
    date: draft.date,
    note: draft.note.trim() || undefined,
    merchant: draft.merchant.trim() || undefined,
    paymentMethod: draft.paymentMethod || undefined,
    createdAt: options.existing?.createdAt ?? now,
    updatedAt: now,
    syncState: 'pending',
  };
}

/** Το αντίστροφο, για την οθόνη επεξεργασίας. */
export function draftFromTransaction(
  tx: Transaction,
  currency: CurrencyCode = tx.currency,
): TransactionDraft {
  return {
    kind: tx.kind,
    amountText: String(tx.amountCents / minorFactor(currency)),
    categoryId: tx.categoryId,
    date: tx.date,
    note: tx.note ?? '',
    merchant: tx.merchant ?? '',
    paymentMethod: tx.paymentMethod ?? '',
  };
}
