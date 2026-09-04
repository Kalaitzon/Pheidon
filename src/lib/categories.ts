// Προεπιλεγμένες κατηγορίες.
//
// Η ελαστικότητα κάθε κατηγορίας δεν είναι διακοσμητική: καθορίζει τι μπορεί να
// προταθεί για περικοπή και τι μετράει στο «διαθέσιμο για γούστα». Οι αποφάσεις:
//
//   fixed          Δεν κόβεται με απόφαση της στιγμής. Ενοίκιο, ρεύμα, δόση δανείου.
//                  Το ρεύμα μπορεί να μειωθεί με συνήθειες, όχι με μια πρόταση της
//                  εφαρμογής μέσα στον μήνα, οπότε μένει εκτός περικοπών.
//   semi_flexible  Αναγκαίο αλλά ελαστικό. Σούπερ μάρκετ, μετακινήσεις, γυμναστήριο.
//                  Κόβεται λιγότερο επιθετικά και ΔΕΝ μετράει ως γούστο.
//   flexible       Καθαρά επιλογή. Εστίαση, διασκέδαση, συνδρομές ψυχαγωγίας.
//                  Μόνο αυτές συνθέτουν το μηνιαίο όριο για γούστα.
//
// Όλες οι συνδρομές, μαζί και το γυμναστήριο, είναι flexible: καμία δεν είναι
// υποχρεωτική και όλες ακυρώνονται όποτε θελήσει ο χρήστης.
//
// Το ότι μια συνήθεια είναι σημαντική δεν κάνει τη συνδρομή υποχρεωτικό έξοδο.
// Γι' αυτό η προστασία από τις προτάσεις είναι ΞΕΧΩΡΙΣΤΗ σημαία (`userProtected`)
// που τη βάζει ο χρήστης, όχι κάτι που αποφασίζει η εφαρμογή για λογαριασμό του.

import type { Category, CategoryEdit, Flexibility, TransactionKind } from '../types/finance';

type Seed = {
  slug: string;
  kind: TransactionKind | 'both';
  icon: string;
  color: string;
  flexibility: Flexibility;
  parent?: string;
  isGroup?: boolean;
};

const SEEDS: Seed[] = [
  /* --- ΕΣΟΔΑ --- */
  { slug: 'income', kind: 'income', icon: 'wallet', color: 'var(--income)', flexibility: 'fixed', isGroup: true },
  { slug: 'salary', kind: 'income', icon: 'banknote', color: 'var(--income)', flexibility: 'fixed', parent: 'income' },
  { slug: 'side_job', kind: 'income', icon: 'briefcase', color: 'var(--income)', flexibility: 'fixed', parent: 'income' },
  { slug: 'gift_received', kind: 'income', icon: 'gift', color: 'var(--income)', flexibility: 'fixed', parent: 'income' },
  { slug: 'benefits', kind: 'income', icon: 'landmark', color: 'var(--income)', flexibility: 'fixed', parent: 'income' },
  { slug: 'refund', kind: 'income', icon: 'undo-2', color: 'var(--income)', flexibility: 'fixed', parent: 'income' },
  { slug: 'other_income', kind: 'income', icon: 'plus-circle', color: 'var(--income)', flexibility: 'fixed', parent: 'income' },

  /* --- ΣΤΕΓΗ --- */
  { slug: 'housing', kind: 'expense', icon: 'home', color: 'var(--cat-1)', flexibility: 'fixed', isGroup: true },
  { slug: 'rent', kind: 'expense', icon: 'home', color: 'var(--cat-1)', flexibility: 'fixed', parent: 'housing' },
  { slug: 'loan', kind: 'expense', icon: 'landmark', color: 'var(--cat-1)', flexibility: 'fixed', parent: 'housing' },
  { slug: 'building_fees', kind: 'expense', icon: 'building', color: 'var(--cat-1)', flexibility: 'fixed', parent: 'housing' },
  { slug: 'home_maintenance', kind: 'expense', icon: 'wrench', color: 'var(--cat-1)', flexibility: 'semi_flexible', parent: 'housing' },

  /* --- ΛΟΓΑΡΙΑΣΜΟΙ --- */
  { slug: 'bills', kind: 'expense', icon: 'receipt', color: 'var(--cat-2)', flexibility: 'fixed', isGroup: true },
  { slug: 'electricity', kind: 'expense', icon: 'zap', color: 'var(--cat-2)', flexibility: 'fixed', parent: 'bills' },
  { slug: 'water', kind: 'expense', icon: 'droplet', color: 'var(--cat-2)', flexibility: 'fixed', parent: 'bills' },
  { slug: 'heating', kind: 'expense', icon: 'flame', color: 'var(--cat-2)', flexibility: 'fixed', parent: 'bills' },
  { slug: 'internet', kind: 'expense', icon: 'wifi', color: 'var(--cat-2)', flexibility: 'fixed', parent: 'bills' },
  { slug: 'mobile', kind: 'expense', icon: 'smartphone', color: 'var(--cat-2)', flexibility: 'fixed', parent: 'bills' },
  { slug: 'other_bills', kind: 'expense', icon: 'file-text', color: 'var(--cat-2)', flexibility: 'fixed', parent: 'bills' },

  /* --- ΣΥΝΔΡΟΜΕΣ --- */
  { slug: 'subscriptions', kind: 'expense', icon: 'repeat', color: 'var(--cat-6)', flexibility: 'flexible', isGroup: true },
  { slug: 'streaming', kind: 'expense', icon: 'tv', color: 'var(--cat-6)', flexibility: 'flexible', parent: 'subscriptions' },
  { slug: 'gym', kind: 'expense', icon: 'dumbbell', color: 'var(--cat-6)', flexibility: 'flexible', parent: 'subscriptions' },
  { slug: 'software', kind: 'expense', icon: 'monitor', color: 'var(--cat-6)', flexibility: 'flexible', parent: 'subscriptions' },
  { slug: 'other_subscriptions', kind: 'expense', icon: 'repeat', color: 'var(--cat-6)', flexibility: 'flexible', parent: 'subscriptions' },

  /* --- ΚΑΘΗΜΕΡΙΝΑ --- */
  { slug: 'living', kind: 'expense', icon: 'shopping-cart', color: 'var(--cat-3)', flexibility: 'semi_flexible', isGroup: true },
  { slug: 'groceries', kind: 'expense', icon: 'shopping-cart', color: 'var(--cat-3)', flexibility: 'semi_flexible', parent: 'living' },
  { slug: 'household', kind: 'expense', icon: 'package', color: 'var(--cat-3)', flexibility: 'semi_flexible', parent: 'living' },
  { slug: 'transport', kind: 'expense', icon: 'bus', color: 'var(--cat-4)', flexibility: 'semi_flexible', parent: 'living' },
  { slug: 'fuel', kind: 'expense', icon: 'fuel', color: 'var(--cat-4)', flexibility: 'semi_flexible', parent: 'living' },
  { slug: 'health', kind: 'expense', icon: 'heart-pulse', color: 'var(--cat-5)', flexibility: 'semi_flexible', parent: 'living' },
  { slug: 'insurance', kind: 'expense', icon: 'shield', color: 'var(--cat-5)', flexibility: 'fixed', parent: 'living' },
  { slug: 'education', kind: 'expense', icon: 'graduation-cap', color: 'var(--cat-5)', flexibility: 'semi_flexible', parent: 'living' },
  { slug: 'pets', kind: 'expense', icon: 'paw-print', color: 'var(--cat-5)', flexibility: 'semi_flexible', parent: 'living' },

  /* --- ΕΛΕΥΘΕΡΑ --- */
  { slug: 'leisure', kind: 'expense', icon: 'party-popper', color: 'var(--cat-5)', flexibility: 'flexible', isGroup: true },
  { slug: 'dining', kind: 'expense', icon: 'utensils', color: 'var(--cat-5)', flexibility: 'flexible', parent: 'leisure' },
  { slug: 'entertainment', kind: 'expense', icon: 'music', color: 'var(--cat-5)', flexibility: 'flexible', parent: 'leisure' },
  { slug: 'shopping', kind: 'expense', icon: 'shirt', color: 'var(--cat-5)', flexibility: 'flexible', parent: 'leisure' },
  { slug: 'travel', kind: 'expense', icon: 'plane', color: 'var(--cat-5)', flexibility: 'flexible', parent: 'leisure' },
  { slug: 'gifts_given', kind: 'expense', icon: 'gift', color: 'var(--cat-5)', flexibility: 'flexible', parent: 'leisure' },
  { slug: 'hobbies', kind: 'expense', icon: 'palette', color: 'var(--cat-5)', flexibility: 'flexible', parent: 'leisure' },

  /* --- ΥΠΟΧΡΕΩΣΕΙΣ --- */
  { slug: 'obligations', kind: 'expense', icon: 'file-check', color: 'var(--cat-1)', flexibility: 'fixed', isGroup: true },
  { slug: 'taxes', kind: 'expense', icon: 'file-check', color: 'var(--cat-1)', flexibility: 'fixed', parent: 'obligations' },
  { slug: 'other_expense', kind: 'expense', icon: 'circle-ellipsis', color: 'var(--cat-2)', flexibility: 'semi_flexible', parent: 'obligations' },
];

/** Το id μιας προεπιλεγμένης κατηγορίας παράγεται από το slug, ώστε να είναι σταθερό. */
export const systemCategoryId = (slug: string): string => `sys-${slug}`;

/** Οι κατηγορίες με τις οποίες ξεκινά κάθε νέος χρήστης. */
export function defaultCategories(): Category[] {
  return SEEDS.map((seed, index) => ({
    id: systemCategoryId(seed.slug),
    slug: seed.slug,
    kind: seed.kind,
    parentId: seed.parent ? systemCategoryId(seed.parent) : undefined,
    isGroup: seed.isGroup,
    icon: seed.icon,
    color: seed.color,
    flexibility: seed.flexibility,
    archived: false,
    isSystem: true,
    sortOrder: index,
  }));
}

/* ------------------------------------------------------------------ */
/* Ερωτήματα                                                           */
/* ------------------------------------------------------------------ */

/** Μόνο όσες μπορούν να επιλεγούν σε συναλλαγή: όχι ομάδες, όχι αρχειοθετημένες. */
export const selectableCategories = (categories: Category[], kind?: TransactionKind): Category[] =>
  categories
    .filter((c) => !c.isGroup && !c.archived)
    .filter((c) => !kind || c.kind === kind || c.kind === 'both')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

/** Το όνομα προς εμφάνιση: πρώτα το προσαρμοσμένο, αλλιώς η μετάφραση του slug. */
export const categoryName = (
  category: Category,
  t: (key: string) => string,
): string => category.customName ?? t(`categories.${category.slug}`);

/**
 * Χρειάζεται δική του περιγραφή αυτή η κατηγορία;
 *
 * Το «Ενοίκιο» λέει από μόνο του τι είναι. Το «Άλλοι λογαριασμοί» δεν λέει
 * τίποτα, οπότε εκεί το όνομα γίνεται υποχρεωτικό.
 */
export const requiresLabel = (category: Category): boolean =>
  category.slug === 'custom' || category.slug.startsWith('other_');

export interface CategoryGroup {
  group: Category;
  children: Category[];
}

/** Ομαδοποίηση για το UI και για τα γραφήματα. */
export function groupCategories(categories: Category[]): CategoryGroup[] {
  const groups = categories.filter((c) => c.isGroup);
  return groups.map((group) => ({
    group,
    children: categories
      .filter((c) => c.parentId === group.id && !c.archived)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  }));
}

/**
 * Αθροίζει τα ποσά των παιδιών στην ομάδα τους.
 * Το γράφημα δείχνει «Λογαριασμοί 210€» και ανοίγει σε ρεύμα, νερό, ίντερνετ.
 */
export function rollUpToGroups(
  amountsByCategory: Record<string, number>,
  categories: Category[],
): Record<string, number> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals: Record<string, number> = {};

  for (const [categoryId, amount] of Object.entries(amountsByCategory)) {
    const category = byId.get(categoryId);
    const key = category?.parentId ?? categoryId;
    totals[key] = (totals[key] ?? 0) + amount;
  }
  return totals;
}

/* ------------------------------------------------------------------ */
/* Επεξεργασία                                                         */
/* ------------------------------------------------------------------ */

/** Νέα κατηγορία φτιαγμένη από τον χρήστη. */
export function createCustomCategory(params: {
  name: string;
  kind: TransactionKind;
  flexibility: Flexibility;
  /** Υποχρεωτικό: κάθε κατηγορία πρέπει να ανήκει κάπου, αλλιώς χάνεται από τα σύνολα. */
  parentId: string;
  icon?: string;
  color?: string;
  monthlyBudgetCents?: number;
}): Category {
  return {
    id: `usr-${crypto.randomUUID()}`,
    // Το slug των προσαρμοσμένων δεν μεταφράζεται, το όνομα το δίνει ο χρήστης.
    slug: 'custom',
    customName: params.name.trim(),
    kind: params.kind,
    parentId: params.parentId,
    icon: params.icon ?? 'circle',
    color: params.color ?? 'var(--cat-2)',
    flexibility: params.flexibility,
    monthlyBudgetCents: params.monthlyBudgetCents,
    archived: false,
    isSystem: false,
  };
}

/**
 * Έλεγχος πριν την αποθήκευση.
 *
 * Το όνομα και η ομάδα είναι και τα δύο υποχρεωτικά. Μια κατηγορία χωρίς ομάδα
 * δεν εμφανίζεται πουθενά στα συγκεντρωτικά και ο χρήστης βλέπει έξοδα που δεν
 * αθροίζονται με τίποτα.
 */
export function validateCategory(
  category: Pick<Category, 'customName' | 'slug' | 'parentId' | 'kind'>,
): { valid: boolean; errors: Record<'name' | 'parent', string | null> } {
  const nameMissing = category.slug === 'custom' && !category.customName?.trim();
  const parentMissing = !category.parentId;

  return {
    valid: !nameMissing && !parentMissing,
    errors: {
      name: nameMissing ? 'categoryEditor.errors.nameRequired' : null,
      parent: parentMissing ? 'categoryEditor.errors.parentRequired' : null,
    },
  };
}

/** Οι ομάδες που δέχονται κατηγορία του συγκεκριμένου τύπου (έσοδο ή έξοδο). */
export const groupsForKind = (categories: Category[], kind: TransactionKind): Category[] =>
  categories
    .filter((c) => c.isGroup && (c.kind === kind || c.kind === 'both'))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

/**
 * Εφαρμόζει αλλαγές. Οι προεπιλεγμένες κατηγορίες επεξεργάζονται κανονικά,
 * απλά δεν διαγράφονται (βλ. `canDelete`).
 */
export function applyCategoryEdit(category: Category, edit: CategoryEdit): Category {
  return {
    ...category,
    ...edit,
    customName: edit.customName?.trim() || category.customName,
  };
}

/**
 * Διαγραφή επιτρέπεται μόνο σε προσαρμοσμένη κατηγορία χωρίς συναλλαγές.
 * Αλλιώς η σωστή κίνηση είναι αρχειοθέτηση: κρύβεται από τις λίστες αλλά το
 * ιστορικό παραμένει σωστό.
 */
export function canDelete(category: Category, transactionCount: number): boolean {
  return !category.isSystem && transactionCount === 0;
}
