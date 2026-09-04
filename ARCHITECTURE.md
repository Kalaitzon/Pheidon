# Finance Tracker — Αρχιτεκτονική & Οδηγός Εκκίνησης

Web app διαχείρισης εσόδων/εξόδων σε React + Vite + TypeScript, σχεδιασμένο ώστε
η μεταφορά σε mobile (React Native / Expo) να μην απαιτεί ξαναγράψιμο της λογικής.

---

## 1. Η βασική αρχή: "λογική χωρίς οθόνη"

Ό,τι γράφουμε χωρίζεται σε δύο κόσμους:

- **Καθαρή λογική** (`src/lib`, `src/types`, `src/store`): υπολογισμοί, μέσοι όροι,
  προτάσεις, στόχοι, μοντέλα δεδομένων. Καθαρή TypeScript, **μηδέν αναφορά σε DOM,
  σε Tailwind ή σε browser API**. Αυτός ο φάκελος αντιγράφεται αυτούσιος στο mobile.
- **Παρουσίαση** (`src/features`, `src/components`): React components, γραφήματα, φόρμες.
  Αυτά είναι τα μόνα που θα ξαναγραφτούν για mobile.

Αν κρατήσεις αυτόν τον διαχωρισμό, το mobile port είναι θέμα ημερών, όχι εβδομάδων.

---

## 2. Δομή φακέλων

```
finance-tracker/
├─ src/
│  ├─ types/
│  │  └─ finance.ts            # Όλα τα interfaces (transactions, goals, insights)
│  ├─ lib/                     # ΚΑΘΑΡΗ ΛΟΓΙΚΗ — μεταφέρσιμη στο mobile
│  │  ├─ money.ts              # Χειρισμός ποσών σε cents + formatting
│  │  ├─ analytics.ts          # Μηνιαία σύνολα, μέσοι όροι ανά κατηγορία
│  │  ├─ insights.ts           # Μηχανή "Smart Tips" (rules) + adapter για LLM
│  │  ├─ goals.ts              # Πρόβλεψη στόχων & ανακατανομή budget
│  │  └─ llm/
│  │     ├─ client.ts          # Κλήση προς το API (μέσω δικού μας proxy)
│  │     └─ prompts.ts         # Τα prompts, ξεχωριστά από τον κώδικα
│  ├─ store/
│  │  ├─ transactions.ts       # Zustand store
│  │  ├─ settings.ts           # Θέμα, γλώσσα, νόμισμα
│  │  └─ persistence.ts        # Adapter αποθήκευσης (βλ. §4)
│  ├─ features/                # ΠΑΡΟΥΣΙΑΣΗ — ανά λειτουργία, όχι ανά τύπο αρχείου
│  │  ├─ dashboard/
│  │  ├─ transactions/
│  │  ├─ goals/
│  │  └─ settings/
│  ├─ components/ui/           # Κοινά κουμπιά, cards, modals
│  ├─ i18n/
│  │  ├─ index.ts
│  │  └─ locales/{el,en}.json
│  ├─ styles/
│  │  └─ tokens.css            # Χρώματα & θέμα ως CSS variables
│  ├─ App.tsx
│  └─ main.tsx
├─ supabase/                   # SQL schema & migrations (όταν φτάσουμε εκεί)
└─ index.html
```

**Γιατί ανά feature και όχι `components/`, `pages/`, `hooks/`:** όταν δουλεύεις πάνω
στους στόχους, όλα τα σχετικά αρχεία είναι σε έναν φάκελο. Σε 6 μήνες θα το εκτιμήσεις.

---

## 3. Βιβλιοθήκες

| Ανάγκη | Επιλογή | Γιατί αυτή |
|---|---|---|
| Build | **Vite** | Ήδη το ξέρεις από το birthday app |
| Styling & θέμα | **Tailwind CSS v4** + CSS variables | Το dark mode γίνεται με μία κλάση στο `<html>` |
| Γραφήματα | **Recharts** | Δηλωτικό API, ελάχιστη ρύθμιση για pie + bar |
| Γλώσσες | **i18next** + `react-i18next` | Ανίχνευση γλώσσας, πληθυντικοί, interpolation |
| State | **Zustand** | ~1KB, δουλεύει αυτούσιο και σε React Native |
| Φόρμες | **React Hook Form** + **Zod** | Το ίδιο Zod schema κάνει validation και στο backend |
| Ημερομηνίες | **date-fns** | Μόνο ό,τι κάνεις import μπαίνει στο bundle, έχει ελληνικό locale |
| Routing | **React Router** | — |
| Icons | **lucide-react** | — |

Εγκατάσταση (PowerShell):

```powershell
npm create vite@latest finance-tracker -- --template react-ts
cd finance-tracker
npm install recharts zustand i18next react-i18next i18next-browser-languagedetector
npm install react-hook-form zod @hookform/resolvers date-fns react-router-dom lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

Στο `vite.config.ts` προσθέτεις το plugin του Tailwind και στο `src/main.tsx` κάνεις
`import './styles/tokens.css'`.

---

## 4. Αποθήκευση δεδομένων (η απόφαση που επηρεάζει το mobile)

Μην καλείς ποτέ τη Supabase απευθείας μέσα από component. Όρισε ένα interface:

```ts
interface TransactionRepository {
  list(range: DateRange): Promise<Transaction[]>;
  upsert(tx: Transaction): Promise<void>;
  remove(id: string): Promise<void>;
}
```

Ξεκίνα με `LocalStorageRepository` για να δουλεύεις γρήγορα, και μετά περνάς σε
`SupabaseRepository` αλλάζοντας **μία γραμμή**. Στο mobile η ίδια υλοποίηση δουλεύει
με AsyncStorage. Γι' αυτό κάθε `Transaction` έχει πεδία `updatedAt` και `syncState`:
είναι η βάση για offline-first συγχρονισμό.

---

## 5. Το LLM κομμάτι

Η μηχανή προτάσεων έχει δύο υλοποιήσεις πίσω από το ίδιο interface (`InsightEngine`):

1. `RuleBasedInsightEngine` — ντετερμινιστική, δωρεάν, τρέχει τοπικά, δουλεύει offline.
   **Αυτή είναι η βάση.** Παράγει δομημένα `Insight` αντικείμενα με `titleKey` + `params`,
   άρα οι προτάσεις είναι αυτόματα μεταφρασμένες σε EL/EN.
2. `LlmInsightEngine` — παίρνει τα ίδια δεδομένα, τα στέλνει ως συμπυκνωμένο JSON
   και ζητά πίσω **αποκλειστικά JSON** στο ίδιο σχήμα. Χρησιμοποιείται για τη
   διατύπωση και για συσχετίσεις που δεν πιάνουν οι κανόνες.

Πρακτικά: το LLM δεν κάνει ποτέ αριθμητική. Τους υπολογισμούς τους κάνει το `analytics.ts`,
το LLM παίρνει έτοιμα νούμερα και γράφει το κείμενο. Έτσι δεν σου βγάζει λάθος ποσά.

**Ασφάλεια:** το API key δεν μπαίνει ποτέ στο frontend. Θα το βάλεις σε Vercel Function
(`/api/insights`) που κρατά το key σε environment variable, ακριβώς όπως έκανες με το Resend.

---

## 6. Θέμα & γλώσσα

- Dark mode: κλάση `dark` στο `<html>`, τρεις καταστάσεις (`light` / `dark` / `system`).
  Τα χρώματα ζουν ως CSS variables στο `tokens.css`, οπότε αλλάζει μόνο ένα block.
- Γλώσσα: όλα τα κείμενα περνούν από `t('key')`. Οι κατηγορίες αποθηκεύονται με
  σταθερό `slug` (π.χ. `groceries`) και **όχι** με ελληνικό όνομα, ώστε η αλλαγή
  γλώσσας να μην χαλάει τα δεδομένα.

---

## 7. Σειρά υλοποίησης

1. `types/finance.ts` + `lib/money.ts` (έτοιμα)
2. `lib/analytics.ts` + `lib/insights.ts` (έτοιμα)
3. Dashboard με mock δεδομένα (έτοιμο)
4. Φόρμα καταχώρησης συναλλαγής + local storage
5. i18n σε όλο το UI
6. Supabase (schema, auth, RLS)
7. Στόχοι (`lib/goals.ts`)
8. LLM endpoint
9. Mobile port
