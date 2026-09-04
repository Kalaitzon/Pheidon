// Αποθήκευση δεδομένων.
//
// Ένα interface, δύο υλοποιήσεις. Τα components δεν ξέρουν ποια τρέχει, οπότε
// μπορείς να δουλεύεις τοπικά χωρίς λογαριασμό και να περάσεις σε Supabase
// αλλάζοντας μία γραμμή. Το ίδιο interface δουλεύει και σε React Native, με
// AsyncStorage αντί για localStorage.

import type {
  Category,
  FinancialGoal,
  IncomeExpectation,
  RecurringRule,
  Transaction,
  Trip,
  TripEntry,
} from '../types/finance';
import { defaultCategories } from '../lib/categories';
import { getSupabase } from '../lib/supabase';

export interface Repository {
  listCategories(): Promise<Category[]>;
  saveCategory(category: Category): Promise<void>;
  listTransactions(): Promise<Transaction[]>;
  saveTransaction(tx: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  listGoals(): Promise<FinancialGoal[]>;
  saveGoal(goal: FinancialGoal): Promise<void>;
  listIncomeExpectations(): Promise<IncomeExpectation[]>;
  saveIncomeExpectation(expectation: IncomeExpectation): Promise<void>;
  listRecurring(): Promise<RecurringRule[]>;
  saveRecurring(rule: RecurringRule): Promise<void>;
  deleteRecurring(id: string): Promise<void>;
  listTrips(): Promise<Trip[]>;
  saveTrip(trip: Trip): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  listTripEntries(): Promise<TripEntry[]>;
  saveTripEntry(entry: TripEntry): Promise<void>;
  deleteTripEntry(id: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Τοπική αποθήκευση, για ανάπτυξη χωρίς λογαριασμό                    */
/* ------------------------------------------------------------------ */

export class LocalRepository implements Repository {
  private read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`ft.${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private write<T>(key: string, value: T): void {
    localStorage.setItem(`ft.${key}`, JSON.stringify(value));
  }

  private upsert<T extends { id: string }>(key: string, item: T): void {
    const items = this.read<T[]>(key, []);
    const index = items.findIndex((existing) => existing.id === item.id);
    if (index >= 0) items[index] = item;
    else items.push(item);
    this.write(key, items);
  }

  async listCategories() {
    const stored = this.read<Category[]>('categories', []);
    if (stored.length > 0) return stored;
    const seeded = defaultCategories();
    this.write('categories', seeded);
    return seeded;
  }

  async saveCategory(category: Category) {
    this.upsert('categories', category);
  }

  async listTransactions() {
    return this.read<Transaction[]>('transactions', []);
  }

  async saveTransaction(tx: Transaction) {
    this.upsert('transactions', tx);
  }

  async deleteTransaction(id: string) {
    this.write(
      'transactions',
      this.read<Transaction[]>('transactions', []).filter((tx) => tx.id !== id),
    );
  }

  async listGoals() {
    return this.read<FinancialGoal[]>('goals', []);
  }

  async saveGoal(goal: FinancialGoal) {
    this.upsert('goals', goal);
  }

  async listIncomeExpectations() {
    return this.read<IncomeExpectation[]>('income', []);
  }

  async saveIncomeExpectation(expectation: IncomeExpectation) {
    this.upsert('income', expectation);
  }

  async listRecurring() {
    return this.read<RecurringRule[]>('recurring', []);
  }

  async saveRecurring(rule: RecurringRule) {
    this.upsert('recurring', rule);
  }

  async deleteRecurring(id: string) {
    this.write(
      'recurring',
      this.read<RecurringRule[]>('recurring', []).filter((rule) => rule.id !== id),
    );
  }

  async listTrips() {
    return this.read<Trip[]>('trips', []);
  }

  async saveTrip(trip: Trip) {
    this.upsert('trips', trip);
  }

  async deleteTrip(id: string) {
    this.write('trips', this.read<Trip[]>('trips', []).filter((trip) => trip.id !== id));
    // Οι εγγραφές του ταξιδιού φεύγουν μαζί, αλλιώς μένουν ορφανές και
    // συνεχίζουν να μετράνε ως δεσμευμένα ποσά.
    this.write(
      'tripEntries',
      this.read<TripEntry[]>('tripEntries', []).filter((entry) => entry.tripId !== id),
    );
  }

  async listTripEntries() {
    return this.read<TripEntry[]>('tripEntries', []);
  }

  async saveTripEntry(entry: TripEntry) {
    this.upsert('tripEntries', entry);
  }

  async deleteTripEntry(id: string) {
    this.write(
      'tripEntries',
      this.read<TripEntry[]>('tripEntries', []).filter((entry) => entry.id !== id),
    );
  }
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

/**
 * Το `user_id` δεν στέλνεται από εδώ σε κάθε ερώτημα φιλτραρίσματος: τα RLS
 * policies το επιβάλλουν στη βάση. Στέλνεται μόνο στις εγγραφές, γιατί η στήλη
 * είναι υποχρεωτική.
 */
export class SupabaseRepository implements Repository {
  constructor(private readonly userId: string) {}

  async listCategories(): Promise<Category[]> {
    const { data, error } = await getSupabase().from('categories').select('*').order('sort_order');
    if (error) throw error;

    // Πρώτη σύνδεση: ο χρήστης παίρνει το δικό του αντίγραφο των προεπιλογών,
    // ώστε να μπορεί να τις μετονομάσει χωρίς να επηρεάσει κανέναν άλλον.
    if (!data || data.length === 0) return this.seedCategories();

    return data.map(fromCategoryRow);
  }

  private async seedCategories(): Promise<Category[]> {
    const seeds = defaultCategories();

    // Αν προηγούμενη προσπάθεια είχε αποτύχει στη μέση, μπορεί να έχουν μείνει
    // μισές γραμμές. Τις καθαρίζουμε: χωρίς συναλλαγές πάνω τους δεν χάνεται
    // τίποτα, και το μοναδικό ευρετήριο (user_id, slug) θα εμπόδιζε την
    // επανεισαγωγή.
    await getSupabase().from('categories').delete().eq('user_id', this.userId);

    // Δύο περάσματα: πρώτα οι ομάδες, μετά τα παιδιά, γιατί το parent_id
    // αναφέρεται σε γραμμή που πρέπει να υπάρχει ήδη.
    const groups = seeds.filter((c) => c.isGroup);
    const children = seeds.filter((c) => !c.isGroup);

    const { data: insertedGroups, error: groupError } = await getSupabase()
      .from('categories')
      // Οι ομάδες δεν έχουν γονέα. Το parent_id μηδενίζεται ρητά, γιατί το
      // τοπικό αντικείμενο μπορεί να κουβαλά τοπικό id που δεν υπάρχει ακόμη.
      .insert(groups.map((c) => ({ ...toCategoryRow(c, this.userId), parent_id: null })))
      .select();
    if (groupError) throw groupError;

    const groupIdBySlug = new Map(
      (insertedGroups ?? []).map((row: any) => [row.slug as string, row.id as string]),
    );
    const slugById = new Map(seeds.map((c) => [c.id, c.slug]));

    const { data: insertedChildren, error: childError } = await getSupabase()
      .from('categories')
      .insert(
        children.map((c) => ({
          ...toCategoryRow(c, this.userId),
          parent_id: groupIdBySlug.get(slugById.get(c.parentId ?? '') ?? '') ?? null,
        })),
      )
      .select();
    if (childError) throw childError;

    return [...(insertedGroups ?? []), ...(insertedChildren ?? [])].map(fromCategoryRow);
  }

  async saveCategory(category: Category): Promise<void> {
    const { error } = await getSupabase()
      .from('categories')
      .upsert(toCategoryRow(category, this.userId));
    if (error) throw error;
  }

  async listTransactions(): Promise<Transaction[]> {
    const { data, error } = await getSupabase()
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromTransactionRow);
  }

  async saveTransaction(tx: Transaction): Promise<void> {
    const { error } = await getSupabase().from('transactions').upsert({
      id: tx.id,
      user_id: this.userId,
      kind: tx.kind,
      amount_cents: tx.amountCents,
      currency: tx.currency,
      category_id: tx.categoryId,
      date: tx.date,
      note: tx.note ?? null,
      merchant: tx.merchant ?? null,
      payment_method: tx.paymentMethod ?? null,
      tags: tx.tags ?? null,
    });
    if (error) throw error;
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await getSupabase().from('transactions').delete().eq('id', id);
    if (error) throw error;
  }

  async listGoals(): Promise<FinancialGoal[]> {
    const { data, error } = await getSupabase().from('goals').select('*').eq('archived', false);
    if (error) throw error;
    return (data ?? []).map(fromGoalRow);
  }

  async saveGoal(goal: FinancialGoal): Promise<void> {
    const { error } = await getSupabase().from('goals').upsert({
      id: goal.id,
      user_id: this.userId,
      title: goal.title,
      target_amount_cents: goal.targetAmountCents,
      saved_amount_cents: goal.savedAmountCents,
      start_date: goal.startDate,
      target_date: goal.targetDate,
      priority: goal.priority,
      strategy: goal.strategy,
      protected_category_ids: goal.protectedCategoryIds ?? null,
      archived: goal.archived,
    });
    if (error) throw error;
  }

  async listIncomeExpectations(): Promise<IncomeExpectation[]> {
    const { data, error } = await getSupabase().from('income_expectations').select('*');
    if (error) throw error;
    return (data ?? []).map(fromIncomeRow);
  }

  async saveIncomeExpectation(expectation: IncomeExpectation): Promise<void> {
    const { error } = await getSupabase().from('income_expectations').upsert({
      id: expectation.id,
      user_id: this.userId,
      label: expectation.label,
      monthly_amount_cents: expectation.monthlyAmountCents,
      start_month: expectation.startMonth,
      end_month: expectation.endMonth ?? null,
      confidence: expectation.confidence,
      source: expectation.source,
    });
    if (error) throw error;
  }

  async listRecurring(): Promise<RecurringRule[]> {
    const { data, error } = await getSupabase().from('recurring_rules').select('*');
    if (error) throw error;
    return (data ?? []).map(fromRecurringRow);
  }

  async saveRecurring(rule: RecurringRule): Promise<void> {
    const { error } = await getSupabase().from('recurring_rules').upsert({
      id: rule.id,
      user_id: this.userId,
      label: rule.label,
      kind: rule.kind,
      amount_cents: rule.amountCents,
      currency: rule.currency,
      category_id: rule.categoryId,
      frequency: rule.frequency,
      day_of_month: rule.dayOfMonth,
      start_month: rule.startMonth,
      end_month: rule.endMonth ?? null,
      note: rule.note ?? null,
      active: rule.active,
      last_generated_month: rule.lastGeneratedMonth ?? null,
    });
    if (error) throw error;
  }

  async deleteRecurring(id: string): Promise<void> {
    // Σβήνεται μόνο ο κανόνας. Οι συναλλαγές που έχει ήδη δημιουργήσει είναι
    // πραγματικά έξοδα που έγιναν και παραμένουν στο ιστορικό.
    const { error } = await getSupabase().from('recurring_rules').delete().eq('id', id);
    if (error) throw error;
  }

  async listTrips(): Promise<Trip[]> {
    const { data, error } = await getSupabase().from('trips').select('*');
    if (error) throw error;
    return (data ?? []).map(fromTripRow);
  }

  async saveTrip(trip: Trip): Promise<void> {
    const { error } = await getSupabase().from('trips').upsert({
      id: trip.id,
      user_id: this.userId,
      title: trip.title,
      destination: trip.destination ?? null,
      start_date: trip.startDate,
      end_date: trip.endDate ?? null,
      budget_cents: trip.budgetCents ?? null,
      currency: trip.currency,
      target_category_id: trip.targetCategoryId,
      status: trip.status,
      settled_transaction_id: trip.settledTransactionId ?? null,
    });
    if (error) throw error;
  }

  async deleteTrip(id: string): Promise<void> {
    // Το ON DELETE CASCADE στη βάση καθαρίζει μόνο του τις εγγραφές.
    const { error } = await getSupabase().from('trips').delete().eq('id', id);
    if (error) throw error;
  }

  async listTripEntries(): Promise<TripEntry[]> {
    const { data, error } = await getSupabase().from('trip_entries').select('*');
    if (error) throw error;
    return (data ?? []).map(fromTripEntryRow);
  }

  async saveTripEntry(entry: TripEntry): Promise<void> {
    const { error } = await getSupabase().from('trip_entries').upsert({
      id: entry.id,
      trip_id: entry.tripId,
      user_id: this.userId,
      label: entry.label,
      amount_cents: entry.amountCents,
      date: entry.date,
      note: entry.note ?? null,
    });
    if (error) throw error;
  }

  async deleteTripEntry(id: string): Promise<void> {
    const { error } = await getSupabase().from('trip_entries').delete().eq('id', id);
    if (error) throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Μετάφραση ανάμεσα σε snake_case (Postgres) και camelCase (TypeScript) */
/* ------------------------------------------------------------------ */

/**
 * Μετατροπή κατηγορίας σε γραμμή πίνακα.
 *
 * Το `id` παραλείπεται ΕΝΤΕΛΩΣ όταν είναι τοπικό (`sys-` ή `usr-`), ώστε να το
 * παραγάγει η βάση. Προσοχή: δεν αρκεί `id: undefined`. Ο client της Supabase
 * το στέλνει ως `null`, και η στήλη είναι not null, οπότε η εισαγωγή σκάει με
 * σφάλμα 23502. Το κλειδί πρέπει να λείπει από το αντικείμενο.
 */
const toCategoryRow = (c: Category, userId: string): Record<string, unknown> => {
  const row: Record<string, unknown> = {
    user_id: userId,
    slug: c.slug,
    custom_name: c.customName ?? null,
    kind: c.kind,
    parent_id: c.parentId ?? null,
    is_group: c.isGroup ?? false,
    icon: c.icon,
    color: c.color,
    flexibility: c.flexibility,
    user_protected: c.userProtected ?? false,
    monthly_budget_cents: c.monthlyBudgetCents ?? null,
    archived: c.archived,
    is_system: c.isSystem,
    sort_order: c.sortOrder ?? 0,
  };

  const isLocalId = c.id.startsWith('sys-') || c.id.startsWith('usr-');
  if (!isLocalId) row.id = c.id;

  return row;
};

const fromCategoryRow = (row: any): Category => ({
  id: row.id,
  slug: row.slug,
  customName: row.custom_name ?? undefined,
  kind: row.kind,
  parentId: row.parent_id ?? undefined,
  isGroup: row.is_group,
  icon: row.icon,
  color: row.color,
  flexibility: row.flexibility,
  userProtected: row.user_protected,
  monthlyBudgetCents: row.monthly_budget_cents ?? undefined,
  archived: row.archived,
  isSystem: row.is_system,
  sortOrder: row.sort_order,
});

const fromTransactionRow = (row: any): Transaction => ({
  id: row.id,
  userId: row.user_id,
  kind: row.kind,
  amountCents: row.amount_cents,
  currency: row.currency,
  categoryId: row.category_id,
  date: row.date,
  note: row.note ?? undefined,
  merchant: row.merchant ?? undefined,
  paymentMethod: row.payment_method ?? undefined,
  tags: row.tags ?? undefined,
  recurringId: row.recurring_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  syncState: 'synced',
});

const fromGoalRow = (row: any): FinancialGoal => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  targetAmountCents: row.target_amount_cents,
  savedAmountCents: row.saved_amount_cents,
  startDate: row.start_date,
  targetDate: row.target_date,
  priority: row.priority,
  strategy: row.strategy,
  protectedCategoryIds: row.protected_category_ids ?? undefined,
  archived: row.archived,
});

const fromRecurringRow = (row: any): RecurringRule => ({
  id: row.id,
  userId: row.user_id,
  label: row.label,
  kind: row.kind,
  amountCents: row.amount_cents,
  currency: row.currency,
  categoryId: row.category_id,
  frequency: row.frequency,
  dayOfMonth: row.day_of_month,
  startMonth: row.start_month,
  endMonth: row.end_month ?? undefined,
  note: row.note ?? undefined,
  active: row.active,
  lastGeneratedMonth: row.last_generated_month ?? undefined,
});

const fromTripRow = (row: any): Trip => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  destination: row.destination ?? undefined,
  startDate: row.start_date,
  endDate: row.end_date ?? undefined,
  budgetCents: row.budget_cents ?? undefined,
  currency: row.currency,
  targetCategoryId: row.target_category_id,
  status: row.status,
  settledTransactionId: row.settled_transaction_id ?? undefined,
  createdAt: row.created_at,
});

const fromTripEntryRow = (row: any): TripEntry => ({
  id: row.id,
  tripId: row.trip_id,
  userId: row.user_id,
  label: row.label,
  amountCents: row.amount_cents,
  date: row.date,
  note: row.note ?? undefined,
  createdAt: row.created_at,
});

const fromIncomeRow = (row: any): IncomeExpectation => ({
  id: row.id,
  userId: row.user_id,
  label: row.label,
  monthlyAmountCents: row.monthly_amount_cents,
  startMonth: row.start_month,
  endMonth: row.end_month ?? undefined,
  confidence: row.confidence,
  source: row.source,
});

/* ------------------------------------------------------------------ */

/** Η μία γραμμή που αλλάζει όταν περνάς από τοπική αποθήκευση σε λογαριασμούς. */
export function createRepository(userId?: string): Repository {
  return userId ? new SupabaseRepository(userId) : new LocalRepository();
}
