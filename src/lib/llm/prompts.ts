// Το prompt, χωριστά από τον κώδικα που κάνει την κλήση.
//
// Δύο κανόνες που καθορίζουν τον σχεδιασμό:
//
// 1. ΤΟ ΜΟΝΤΕΛΟ ΔΕΝ ΚΑΝΕΙ ΑΡΙΘΜΗΤΙΚΗ. Όλοι οι υπολογισμοί έχουν ήδη γίνει στο
//    `analytics.ts` και στο `goals.ts`. Το μοντέλο παίρνει έτοιμα νούμερα και
//    γράφει το κείμενο. Έτσι δεν σου βγάζει ποτέ λάθος ποσά, που είναι το πιο
//    συνηθισμένο πρόβλημα σε οικονομικές εφαρμογές με LLM.
//
// 2. ΔΕΝ ΦΕΥΓΟΥΝ ΠΡΟΣΩΠΙΚΑ ΣΤΟΙΧΕΙΑ. Στέλνουμε συγκεντρωτικά ανά κατηγορία:
//    ποτέ μεμονωμένες συναλλαγές, ονόματα καταστημάτων, σημειώσεις ή email.

export interface LlmCategoryFact {
  slug: string;
  flexibility: 'fixed' | 'semi_flexible' | 'flexible';
  userProtected: boolean;
  averageCents: number;
  currentCents: number;
  deviationRatio: number;
  trend: 'rising' | 'stable' | 'falling';
}

export interface LlmPayload {
  month: string;
  locale: 'el' | 'en';
  currency: string;
  incomeCents: number;
  expenseCents: number;
  savingsRate: number;
  allowanceCents: number;
  categories: LlmCategoryFact[];
  goals: Array<{
    title: string;
    targetAmountCents: number;
    savedAmountCents: number;
    targetDate: string;
    requiredMonthlyCents: number;
    projectedMonthlyCents: number;
    feasibility: string;
  }>;
  incomeHorizon: Array<{ label: string; monthlyAmountCents: number; endMonth?: string }>;
}

export const SYSTEM_PROMPT = `Είσαι οικονομικός σύμβουλος μέσα σε εφαρμογή προσωπικών οικονομικών.

ΚΑΝΟΝΕΣ:
1. ΜΗΝ κάνεις υπολογισμούς. Όλα τα ποσά σου δίνονται έτοιμα σε cents. Χρησιμοποίησέ τα αυτούσια.
2. Γράψε ΜΟΝΟ έγκυρο JSON, χωρίς markdown, χωρίς backticks, χωρίς εισαγωγικό κείμενο.
3. Το πολύ 3 προτάσεις. Λιγότερες είναι καλύτερα από αδύναμες.
4. Κάθε πρόταση πρέπει να αναφέρει συγκεκριμένη κατηγορία και συγκεκριμένο ποσό.
5. ΠΟΤΕ μην προτείνεις περικοπή σε κατηγορία με flexibility "fixed" ή userProtected true.
6. Μην δίνεις επενδυτικές συμβουλές, μην προτείνεις δάνεια, μην κρίνεις τον χρήστη.
7. Γράψε στη γλώσσα του πεδίου locale. Τόνος ήρεμος και πρακτικός, όχι ενθουσιώδης.
8. Αν τα δεδομένα δεν αρκούν για ασφαλές συμπέρασμα, γύρνα άδειο πίνακα insights.

ΣΧΗΜΑ ΑΠΑΝΤΗΣΗΣ:
{
  "insights": [
    {
      "type": "category_overspend" | "reallocation" | "positive_trend" | "goal_at_risk" | "cashflow_warning",
      "severity": "info" | "success" | "warning" | "critical",
      "title": "σύντομος τίτλος, έως 8 λέξεις",
      "body": "1-3 προτάσεις με συγκεκριμένα ποσά",
      "actions": [{ "categorySlug": "...", "deltaCents": 0 }],
      "confidence": 0.0
    }
  ]
}`;

/** Το μήνυμα του χρήστη: σκέτα δεδομένα, χωρίς οδηγίες. */
export function buildUserMessage(payload: LlmPayload): string {
  return JSON.stringify(payload);
}

/**
 * Έλεγχος της απάντησης πριν φτάσει στο UI.
 *
 * Ένα μοντέλο μπορεί να αγνοήσει τον κανόνα 5 και να προτείνει περικοπή στο
 * ενοίκιο. Ο έλεγχος γίνεται εδώ, στον κώδικα, όχι με ευχή μέσα στο prompt.
 */
export function sanitizeActions(
  actions: Array<{ categorySlug: string; deltaCents: number }>,
  categories: LlmCategoryFact[],
): Array<{ categorySlug: string; deltaCents: number }> {
  const allowed = new Map(categories.map((c) => [c.slug, c]));

  return actions.filter((action) => {
    const category = allowed.get(action.categorySlug);
    if (!category) return false;
    if (category.flexibility === 'fixed') return false;
    if (category.userProtected) return false;
    // Περικοπή μεγαλύτερη από όσα ξοδεύτηκαν είναι παράλογη πρόταση.
    return action.deltaCents > 0 && action.deltaCents <= category.currentCents;
  });
}
