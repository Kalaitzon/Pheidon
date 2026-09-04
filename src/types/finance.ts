// Finance Tracker — Κεντρικό μοντέλο δεδομένων
// Καθαρή TypeScript, χωρίς εξαρτήσεις: μεταφέρεται αυτούσιο σε React Native.

/* ------------------------------------------------------------------ */
/* Βασικοί τύποι                                                       */
/* ------------------------------------------------------------------ */

/** Ημερομηνία σε μορφή 'YYYY-MM-DD'. */
export type ISODate = string;

/** Μήνας σε μορφή 'YYYY-MM'. Το κλειδί ομαδοποίησης παντού. */
export type MonthKey = string;

/** Χρονική σήμανση ISO 8601 με ζώνη ώρας. */
export type Timestamp = string;

/**
 * Κωδικός ISO 4217. Η λίστα ζει στο `lib/currency.ts` και επεκτείνεται εκεί,
 * ώστε να μη χρειάζεται αλλαγή τύπων για κάθε νέο νόμισμα.
 */
export type CurrencyCode = string;

export type TransactionKind = 'income' | 'expense';

/**
 * Πόσο εύκολα περικόπτεται μια κατηγορία. Είναι το κλειδί για τις προτάσεις:
 * ποτέ δεν προτείνουμε περικοπή σε 'fixed' (ενοίκιο, δάνειο, ρεύμα).
 */
export type Flexibility = 'fixed' | 'semi_flexible' | 'flexible';

/* ------------------------------------------------------------------ */
/* Κατηγορίες                                                          */
/* ------------------------------------------------------------------ */

export interface Category {
  id: string;
  /** Σταθερό κλειδί i18n, π.χ. 'groceries'. Δεν αλλάζει ποτέ, ούτε με αλλαγή γλώσσας. */
  slug: string;
  kind: TransactionKind | 'both';
  /** Ομάδα στην οποία ανήκει, π.χ. τα «Ρεύμα» και «Νερό» κάτω από «Λογαριασμοί». */
  parentId?: string;
  /**
   * true για τις ομάδες. Οι ομάδες δεν επιλέγονται σε συναλλαγή, χρησιμεύουν
   * μόνο για να μη γίνει το γράφημα είκοσι φέτες.
   */
  isGroup?: boolean;
  /** Όνομα που έδωσε ο χρήστης. Αν υπάρχει, υπερισχύει της μετάφρασης του slug. */
  customName?: string;
  /** Σειρά εμφάνισης μέσα στην ομάδα. */
  sortOrder?: number;
  /** Όνομα εικονιδίου lucide, π.χ. 'shopping-cart'. */
  icon: string;
  /** Hex χρώμα για τα γραφήματα. */
  color: string;
  flexibility: Flexibility;
  /**
   * Ο χρήστης δήλωσε ότι αυτή η κατηγορία δεν αγγίζεται.
   *
   * Είναι ξεχωριστό από την ελαστικότητα και επίτηδες. Η ελαστικότητα λέει τι
   * είδους έξοδο είναι (πάγιο, αναγκαίο, ελεύθερο). Αυτή η σημαία λέει τι
   * προτεραιότητα του δίνει ο χρήστης. Η συνδρομή γυμναστηρίου είναι ελεύθερο
   * έξοδο, αλλά αν ο χρήστης τη θεωρεί απαραίτητη, η εφαρμογή δεν έχει λόγο να
   * του προτείνει να την κόψει.
   */
  userProtected?: boolean;
  /** Προαιρετικό μηνιαίο πλαφόν σε cents. Αν λείπει, χρησιμοποιείται ο μέσος όρος. */
  monthlyBudgetCents?: number;
  archived: boolean;
  /**
   * true για τις προεπιλεγμένες κατηγορίες. Δεν διαγράφονται, για να μη μείνουν
   * ορφανές παλιές συναλλαγές, αλλά μετονομάζονται, αρχειοθετούνται και
   * αλλάζουν ελαστικότητα ελεύθερα.
   */
  isSystem: boolean;
}

/** Τα πεδία που επιτρέπεται να αλλάξει ο χρήστης σε κατηγορία συστήματος. */
export type CategoryEdit = Partial<
  Pick<
    Category,
    | 'customName'
    | 'icon'
    | 'color'
    | 'flexibility'
    | 'userProtected'
    | 'monthlyBudgetCents'
    | 'archived'
    | 'parentId'
  >
>;

/* ------------------------------------------------------------------ */
/* Συναλλαγές                                                          */
/* ------------------------------------------------------------------ */

export type PaymentMethod = 'cash' | 'card' | 'bank' | 'other';

/** Κατάσταση συγχρονισμού. Υποδομή για offline-first χρήση στο mobile. */
export type SyncState = 'synced' | 'pending' | 'conflict';

export interface Transaction {
  id: string;
  userId: string;
  kind: TransactionKind;
  /**
   * ΠΑΝΤΑ σε υποδιαιρέσεις (cents), πάντα θετικό, πάντα στο νόμισμα του χρήστη.
   * Το πρόσημο το δίνει το `kind`.
   */
  amountCents: number;
  currency: CurrencyCode;
  categoryId: string;
  date: ISODate;
  note?: string;
  /** Κατάστημα ή πηγή εσόδου, χρήσιμο για μελλοντική αυτόματη κατηγοριοποίηση. */
  merchant?: string;
  paymentMethod?: PaymentMethod;
  tags?: string[];
  /** Αν προήλθε από πάγια εγγραφή, το id του κανόνα. */
  recurringId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  syncState?: SyncState;
}

export type RecurringFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'yearly';

/**
 * Πάγιο έσοδο ή έξοδο: ενοίκιο, μισθός, συνδρομή, ασφάλεια.
 *
 * Ο κανόνας κάνει δύο δουλειές ταυτόχρονα:
 *   1. Δημιουργεί πραγματικές συναλλαγές όταν φτάνει η ημερομηνία τους.
 *   2. Τροφοδοτεί την πρόβλεψη των επόμενων μηνών, χωρίς να δημιουργεί τίποτα.
 *
 * Χωρίς το δεύτερο, ένα πλάνο δύο ετών θα υπέθετε ότι το ενοίκιο σταματά
 * σήμερα το βράδυ.
 */
export interface RecurringRule {
  id: string;
  userId: string;
  label: string;
  kind: TransactionKind;
  amountCents: number;
  currency: CurrencyCode;
  categoryId: string;
  frequency: RecurringFrequency;
  /** Ημέρα του μήνα, 1 έως 28. Πάνω από 28 σπάει τον Φεβρουάριο. */
  dayOfMonth: number;
  /** Ο πρώτος μήνας που ισχύει. */
  startMonth: MonthKey;
  /** Ο τελευταίος μήνας. Αν λείπει, ισχύει επ' αόριστον. */
  endMonth?: MonthKey;
  note?: string;
  active: boolean;
  /**
   * Ο τελευταίος μήνας για τον οποίο έχει ήδη δημιουργηθεί συναλλαγή.
   * Εμποδίζει τη διπλοεγγραφή όταν ανοίγεις την εφαρμογή δύο φορές την ίδια μέρα.
   */
  lastGeneratedMonth?: MonthKey;
}

/* ------------------------------------------------------------------ */
/* Αναμενόμενα έσοδα — ο χρονικός ορίζοντας                            */
/* ------------------------------------------------------------------ */

/**
 * Πόσο σίγουρο είναι ένα μελλοντικό έσοδο. Επηρεάζει τους υπολογισμούς:
 * τα αβέβαια έσοδα υπολογίζονται με έκπτωση, ώστε το πλάνο να μην είναι ευσεβής πόθος.
 */
export type IncomeConfidence = 'confirmed' | 'likely' | 'uncertain';

/**
 * Δηλωμένη περίοδος εσόδου, π.χ. «σύμβαση έως τον Φεβρουάριο, 700€ τον μήνα».
 * Αν λείπει το `endMonth`, θεωρείται αόριστης διάρκειας.
 */
export interface IncomeExpectation {
  id: string;
  userId: string;
  label: string;
  monthlyAmountCents: number;
  startMonth: MonthKey;
  endMonth?: MonthKey;
  confidence: IncomeConfidence;
  source: 'salary' | 'contract' | 'freelance' | 'benefit' | 'other';
}

/** Έκτακτο γεγονός σε συγκεκριμένο μήνα: δώρο, ΕΝΦΙΑ, ασφάλεια αυτοκινήτου. */
export interface ExpectedEvent {
  id: string;
  label: string;
  month: MonthKey;
  amountCents: number;
  kind: TransactionKind;
  confidence: IncomeConfidence;
}

/** Μία γραμμή της πρόβλεψης ταμειακών ροών. */
export interface MonthlyForecast {
  month: MonthKey;
  incomeCents: number;
  expenseCents: number;
  surplusCents: number;
  /** true όταν το έσοδο δεν είναι δηλωμένο αλλά εκτιμήθηκε από το ιστορικό. */
  incomeIsAssumed: boolean;
  /** Σωρευτικό διαθέσιμο από την αρχή της πρόβλεψης. */
  cumulativeCents: number;
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Στατιστικά                                                          */
/* ------------------------------------------------------------------ */

export interface MonthlySummary {
  month: MonthKey;
  incomeCents: number;
  expenseCents: number;
  /** incomeCents - expenseCents. Αρνητικό σημαίνει έλλειμμα. */
  netCents: number;
  /** Έξοδα ανά categoryId. */
  expenseByCategory: Record<string, number>;
  transactionCount: number;
}

export type Trend = 'rising' | 'stable' | 'falling';

/** Ο μακροπρόθεσμος «χαρακτήρας» μιας κατηγορίας εξόδων. */
export interface CategoryStats {
  categoryId: string;
  /** Μέσος όρος των προηγούμενων μηνών, ΧΩΡΙΣ τον τρέχοντα. */
  monthlyAverageCents: number;
  /** Διάμεσος. Πιο ανθεκτική σε ακραίες αγορές από τον μέσο όρο. */
  monthlyMedianCents: number;
  currentMonthCents: number;
  /** Απόκλιση τρέχοντος από τον μέσο όρο, σε ποσοστό (0.25 = +25%). */
  deviationRatio: number;
  /** Πόσοι μήνες ιστορικού συμμετείχαν. Κάτω από 3 η πρόταση είναι αναξιόπιστη. */
  monthsObserved: number;
  trend: Trend;
  /** Μερίδιο επί των συνολικών εξόδων του τρέχοντα μήνα (0-1). */
  shareOfMonth: number;
}

/* ------------------------------------------------------------------ */
/* Έξυπνες προτάσεις (Insights)                                        */
/* ------------------------------------------------------------------ */

export type InsightType =
  | 'category_overspend'   // υπέρβαση μέσου όρου σε κατηγορία
  | 'reallocation'         // πρόταση μεταφοράς budget από Α σε Β
  | 'positive_trend'       // επιβράβευση
  | 'goal_at_risk'         // ο στόχος κινδυνεύει
  | 'cashflow_warning';    // τα έξοδα ξεπερνούν τα έσοδα

export type InsightSeverity = 'info' | 'success' | 'warning' | 'critical';

/**
 * Συγκεκριμένη ενέργεια που προτείνεται.
 * Το UI μπορεί να τη μετατρέψει σε κουμπί «Εφαρμογή στο budget».
 */
export interface SuggestedAction {
  categoryId: string;
  /** Πόσο προτείνεται να μειωθεί (θετικό) ή να αυξηθεί (αρνητικό) η κατηγορία. */
  deltaCents: number;
  suggestedMonthlyCents: number;
}

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  /**
   * Κλειδί i18n αντί για έτοιμο κείμενο. Έτσι η ίδια πρόταση εμφανίζεται
   * σωστά και στα Ελληνικά και στα Αγγλικά, χωρίς δεύτερη κλήση.
   */
  titleKey: string;
  bodyKey: string;
  /** Παράμετροι interpolation, π.χ. { category: 'Supermarket', amount: '80,00 €' }. */
  params: Record<string, string | number>;
  actions: SuggestedAction[];
  /** Πόσο σοβαρά να το πάρει το UI στην ταξινόμηση. */
  priority: number;
  source: 'rules' | 'llm';
  /** 0-1. Χαμηλή τιμή όταν το ιστορικό είναι λίγο. */
  confidence: number;
  generatedAt: Timestamp;
}

/** Ό,τι χρειάζεται η μηχανή για να παράγει προτάσεις. Ένα αντικείμενο, καμία εξάρτηση. */
export interface InsightContext {
  referenceMonth: MonthKey;
  categories: Category[];
  stats: CategoryStats[];
  summaries: MonthlySummary[];
  goals: FinancialGoal[];
  /** Τα υπολογισμένα πλάνα. Αν λείπουν, η μηχανή απλά δεν σχολιάζει στόχους. */
  goalPlans?: GoalPlan[];
  locale: 'el' | 'en';
  currency: CurrencyCode;
}

/**
 * Το κοινό συμβόλαιο. Υλοποιείται από RuleBasedInsightEngine (τοπικά)
 * και από LlmInsightEngine (μέσω API). Το Dashboard δεν ξέρει ποιο τρέχει.
 */
export interface InsightEngine {
  readonly name: string;
  generate(context: InsightContext): Promise<Insight[]>;
}


/* ------------------------------------------------------------------ */
/* Διαθέσιμο για γούστα                                                */
/* ------------------------------------------------------------------ */

export type AllowanceStatus = 'comfortable' | 'tight' | 'over' | 'impossible';

/**
 * Πόσα μένουν για ελεύθερη κατανάλωση αφού πληρωθούν τα πάγια, τα αναγκαία
 * και η δόση των στόχων. Το νούμερο που απαντά στο «μπορώ να το πάρω;».
 */
export interface SpendingAllowance {
  month: MonthKey;
  incomeCents: number;
  /** Πάγια που δεν μπορούν να μειωθούν: ενοίκιο, δάνειο, λογαριασμοί. */
  fixedCents: number;
  /** Αναγκαία αλλά ελαστικά: σούπερ μάρκετ, μετακινήσεις. Υπολογίζονται στη διάμεσο. */
  essentialsCents: number;
  /** Η μηνιαία δόση όλων των ενεργών στόχων. */
  goalContributionCents: number;
  /** Μαξιλάρι για τα απρόβλεπτα, ως ποσοστό του εισοδήματος. */
  bufferCents: number;
  /** Το ζητούμενο: το ανώτατο μηνιαίο όριο για γούστα. */
  allowanceCents: number;
  /** Πόσα έχουν ήδη ξοδευτεί σε ευέλικτες κατηγορίες αυτόν τον μήνα. */
  spentCents: number;
  remainingCents: number;
  /** Πόσα την ημέρα για τις υπόλοιπες ημέρες του μήνα. */
  dailyRemainingCents: number;
  daysRemaining: number;
  status: AllowanceStatus;
}

/* ------------------------------------------------------------------ */
/* Ταξίδια                                                             */
/* ------------------------------------------------------------------ */

export type TripStatus = 'planning' | 'active' | 'closed';

/**
 * Ένα ταξίδι είναι δοχείο εξόδων.
 *
 * Όσο είναι ανοιχτό, ρίχνεις μέσα ό,τι ξοδεύεις χωρίς να διαλέγεις κατηγορία.
 * Όταν το κλείνεις, όλα αθροίζονται σε ΜΙΑ συναλλαγή στην κατηγορία προορισμού.
 * Έτσι το ιστορικό σου δεν γεμίζει με σαράντα εγγραφές «καφές Ρώμη».
 */
export interface Trip {
  id: string;
  userId: string;
  title: string;
  destination?: string;
  startDate: ISODate;
  endDate?: ISODate;
  /** Προαιρετικός προϋπολογισμός, για να ξέρεις πόσο έχει μείνει. */
  budgetCents?: number;
  currency: CurrencyCode;
  /** Πού θα καταλήξει το σύνολο όταν κλείσει. Προεπιλογή: Ταξίδια. */
  targetCategoryId: string;
  status: TripStatus;
  /** Η συναλλαγή που δημιουργήθηκε στο κλείσιμο. */
  settledTransactionId?: string;
  createdAt: Timestamp;
}

/** Μία γραμμή εξόδου μέσα σε ταξίδι. Σκόπιμα ελαφριά: περιγραφή και ποσό. */
export interface TripEntry {
  id: string;
  tripId: string;
  userId: string;
  label: string;
  amountCents: number;
  date: ISODate;
  note?: string;
  createdAt: Timestamp;
}

export interface TripSummary {
  tripId: string;
  totalCents: number;
  entryCount: number;
  /** Πόσα απομένουν από τον προϋπολογισμό. null αν δεν έχει οριστεί. */
  remainingCents: number | null;
  /** Ποσοστό του προϋπολογισμού που έχει ξοδευτεί, 0-1 και πάνω. */
  budgetRatio: number | null;
  /** Μέσο ημερήσιο κόστος, χρήσιμο όσο το ταξίδι τρέχει. */
  dailyAverageCents: number;
  daysElapsed: number;
}

/* ------------------------------------------------------------------ */
/* Στόχοι                                                              */
/* ------------------------------------------------------------------ */

export type GoalStrategy = 'conservative' | 'balanced' | 'aggressive';

export interface FinancialGoal {
  id: string;
  userId: string;
  title: string;
  targetAmountCents: number;
  savedAmountCents: number;
  startDate: ISODate;
  targetDate: ISODate;
  priority: 'low' | 'medium' | 'high';
  /** Πόσο επιθετικά επιτρέπεται να κοπούν τα ευέλικτα έξοδα. */
  strategy: GoalStrategy;
  /** Κατηγορίες που ο χρήστης δηλώνει «άθικτες» (π.χ. υγεία). */
  protectedCategoryIds?: string[];
  archived: boolean;
}

export type Feasibility = 'ahead' | 'on_track' | 'tight' | 'unrealistic';

/** Σημείο όπου τα προβλεπόμενα έσοδα πέφτουν απότομα, π.χ. λήξη σύμβασης. */
export interface IncomeCliff {
  month: MonthKey;
  beforeCents: number;
  afterCents: number;
  label: string;
}

/**
 * Οι ρεαλιστικές εναλλακτικές όταν ο στόχος δεν βγαίνει με τα σημερινά δεδομένα.
 * Δεν επιλέγει το σύστημα: παρουσιάζει και τις τρεις και αποφασίζει ο χρήστης.
 */
export interface GoalAlternatives {
  /** Πόσο ρεαλιστικά μαζεύεται μέχρι την αρχική ημερομηνία, με τις περικοπές. */
  achievableByTargetDateCents: number;
  /** Πόσους μήνες παραπάνω χρειάζεται ο αρχικός στόχος. */
  extraMonthsNeeded: number;
  /** Η ρεαλιστική ημερομηνία για το αρχικό ποσό. */
  realisticTargetDate: ISODate | null;
  /** Πόσα επιπλέον έσοδα τον μήνα κλείνουν το κενό, αφού εξαντληθούν οι περικοπές. */
  extraIncomeNeededMonthlyCents: number;
}

/** Το αποτέλεσμα της πρόβλεψης: τι πρέπει να αλλάξει για να πιάσει ο στόχος. */
export interface GoalPlan {
  goalId: string;
  monthsRemaining: number;
  /** Πόσα πρέπει να μπαίνουν στην άκρη κάθε μήνα, κατά μέσο όρο. */
  requiredMonthlyCents: number;
  /** Πόσα πράγματι περισσεύουν με βάση την πρόβλεψη εσόδων/εξόδων. */
  projectedMonthlyCents: number;
  /** requiredMonthly - projectedMonthly. Θετικό σημαίνει ότι λείπουν χρήματα. */
  monthlyGapCents: number;
  /** Συνολικό ποσό που λείπει μέχρι την ημερομηνία στόχου. */
  totalGapCents: number;
  feasibility: Feasibility;
  /** Από πού προτείνεται να καλυφθεί το κενό. */
  reallocations: SuggestedAction[];
  /** Πόσο καλύπτουν συνολικά οι παραπάνω περικοπές, ανά μήνα. */
  cutsCoverMonthlyCents: number;
  /** Ημερομηνία ολοκλήρωσης αν δεν αλλάξει τίποτα. */
  projectedCompletionDate: ISODate | null;
  /** Η μηνιαία πρόβλεψη, για γράφημα ή πίνακα. */
  forecast: MonthlyForecast[];
  /** Λήξεις συμβάσεων ή πτώσεις εισοδήματος μέσα στον ορίζοντα. */
  cliffs: IncomeCliff[];
  alternatives: GoalAlternatives;
}
