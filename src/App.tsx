// Το App δένει τα κομμάτια μεταξύ τους και δεν κάνει τίποτα άλλο.
//
// Ένα σημείο αξίζει προσοχή: αν έχουν οριστεί τα κλειδιά της Supabase, η
// εφαρμογή ζητά σύνδεση και αποθηκεύει στο cloud. Αν δεν έχουν οριστεί, τρέχει
// τοπικά στον browser χωρίς λογαριασμό. Έτσι δουλεύεις από την πρώτη στιγμή,
// πριν στηθεί οτιδήποτε.

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session } from '@supabase/supabase-js';
import type { Category, Transaction } from './types/finance';
import { intlLocale } from './i18n';
import { useSettings } from './store/settings';
import { createRepository, LocalRepository, type Repository } from './store/repository';
import { isRecoveryLink, isSupabaseConfigured, onSessionChange, signOut } from './lib/supabase';
import { UpdatePassword } from './features/auth/UpdatePassword';
import { AuthScreen } from './features/auth/AuthScreen';
import { Dashboard } from './features/dashboard/Dashboard';
import { TransactionForm } from './features/transactions/TransactionForm';
import { TransactionList } from './features/transactions/TransactionList';
import { CategoryEditor } from './features/settings/CategoryEditor';
import { CurrencySelect } from './features/settings/CurrencySelect';
import { RecurringManager } from './features/recurring/RecurringManager';
import { LogoAnimated } from './components/Logo';
import { BackgroundMotif } from './components/BackgroundMotif';
import { Footer } from './components/Footer';
import { describeError, type FriendlyError } from './lib/errors';
import { draftFromTransaction } from './lib/transactionForm';
import { LanguageToggle } from './components/LanguageToggle';
import {
  LayoutDashboard,
  Receipt,
  Repeat,
  Plus,
  Plane,
  Sparkles,
  Settings2,
} from 'lucide-react';
import { AboutPheidon } from './features/about/AboutPheidon';
import { InstallPrompt } from './features/install/InstallPrompt';
import { materializeDue } from './lib/recurring';
import type { RecurringRule, Trip, TripEntry } from './types/finance';
import { TripsScreen } from './features/trips/TripsScreen';
import { AnalysisScreen } from './features/analysis/AnalysisScreen';
import { committedInOpenTrips } from './lib/trips';

/**
 * Το όνομα σε ένα σημείο, ώστε να αλλάζει με μία γραμμή.
 *
 * Στην κεφαλίδα μπαίνει η λατινική γραφή: είναι σύντομη, δουλεύει και στις δύο
 * γλώσσες της εφαρμογής και δεν χρειάζεται υπότιτλο για να σταθεί.
 * Η ελληνική μορφή εμφανίζεται στην οθόνη με την ιστορία του ονόματος.
 */
export const APP_NAME = 'Pheidon';
export const APP_NAME_GREEK = 'Φείδων';

type Tab =
  | 'dashboard'
  | 'transactions'
  | 'recurring'
  | 'add'
  | 'trips'
  | 'analysis'
  | 'settings';

export default function App() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const { currency, setCurrency, theme, setTheme, bufferRatio, setBufferRatio } =
    useSettings();

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [tab, setTab] = useState<Tab>('dashboard');

  // Η προτίμηση για την ιστορία κρατιέται τοπικά: δεν είναι δεδομένο του
  // λογαριασμού και δεν αξίζει ταξίδι στη βάση.
  const [showStory, setShowStory] = useState(
    () => localStorage.getItem('ft.hideStory') !== '1',
  );

  useEffect(() => {
    localStorage.setItem('ft.hideStory', showStory ? '0' : '1');
  }, [showStory]);
  const [recovering, setRecovering] = useState(() => isRecoveryLink());

  const [repository, setRepository] = useState<Repository>(() => new LocalRepository());
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripEntries, setTripEntries] = useState<TripEntry[]>([]);

  /* --- Συνεδρία --- */
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    return onSessionChange((next) => {
      setSession(next);
      setAuthReady(true);
    });
  }, []);

  /* --- Η μία γραμμή που αλλάζει τοπικό με cloud --- */
  useEffect(() => {
    setRepository(createRepository(isSupabaseConfigured ? session?.user.id : undefined));
  }, [session]);

  /*
   * Κάθε εγγραφή στη βάση περνά από εδώ.
   *
   * Χωρίς αυτό, μια αποτυχία (κανόνας της βάσης, χαμένη σύνδεση, ληγμένη
   * συνεδρία) κατέληγε σε unhandled rejection: η φόρμα έμενε ανοιχτή και ο
   * χρήστης δεν μάθαινε ποτέ γιατί δεν αποθηκεύτηκε τίποτα.
   */
  const [saveError, setSaveError] = useState<FriendlyError | null>(null);

  const guard = useCallback(async (action: () => Promise<void>) => {
    setSaveError(null);
    try {
      await action();
    } catch (error) {
      console.error('[pheidon] Αποτυχία αποθήκευσης:', error);
      setSaveError(describeError(error));
    }
  }, []);

  const reload = useCallback(async () => {
    const [nextCategories, nextTransactions, nextRules, nextTrips, nextEntries] =
      await Promise.all([
        repository.listCategories(),
        repository.listTransactions(),
        repository.listRecurring(),
        repository.listTrips(),
        repository.listTripEntries(),
      ]);

    // Τα πάγια που έχουν λήξει καταχωρούνται εδώ, μία φορά στο άνοιγμα.
    // Αν έλειψες δύο μήνες, θα δημιουργηθούν και οι δύο, όχι μόνο ο τελευταίος.
    const due = materializeDue(nextRules, nextTransactions, {
      userId: session?.user.id ?? 'local',
    });

    if (due.transactions.length > 0) {
      await Promise.all(due.transactions.map((tx) => repository.saveTransaction(tx)));
      await Promise.all(due.updatedRules.map((rule) => repository.saveRecurring(rule)));
    }

    setCategories(nextCategories);
    setTransactions([...nextTransactions, ...due.transactions]);
    setRecurringRules(
      nextRules.map((rule) => due.updatedRules.find((u) => u.id === rule.id) ?? rule),
    );
    setTrips(nextTrips);
    setTripEntries(nextEntries);
  }, [repository, session]);

  useEffect(() => {
    if (isSupabaseConfigured && !session) return;
    void reload();
  }, [reload, session]);

  /* --- Οθόνες --- */
  if (!authReady) return null;
  // Η επαναφορά κωδικού προηγείται: ο χρήστης έχει ήδη προσωρινή συνεδρία και
  // αν τον στέλναμε στο Dashboard δεν θα άλλαζε ποτέ κωδικό.
  if (recovering && session) {
    return <UpdatePassword t={t} onDone={() => setRecovering(false)} />;
  }
  if (isSupabaseConfigured && !session) return <AuthScreen t={t} />;

  const userId = session?.user.id ?? 'local';

  const saveTransaction = (tx: Transaction) =>
    guard(async () => {
      await repository.saveTransaction(tx);
      setEditing(null);
      await reload();
      setTab('dashboard');
    });

  return (
    <div className="min-h-screen lg:flex" style={{ background: 'var(--bg)' }}>
      <BackgroundMotif />
      <SideNav tab={tab} setTab={setTab} t={t} />

      <div className="min-w-0 flex-1 pb-20 lg:pb-0">
        <MobileHeader />
        <InstallPrompt t={t} appName={APP_NAME} />

        {saveError && (
          <div
            role="alert"
            className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-lg border px-4 py-3 text-sm"
            style={{
              background: 'var(--expense-soft)',
              borderColor: 'var(--expense)',
              color: 'var(--text)',
            }}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t(saveError.titleKey)}</p>

              {saveError.hintKey && (
                <p className="mt-1 leading-relaxed">{t(saveError.hintKey)}</p>
              )}

              {/* Το τεχνικό μήνυμα μένει ορατό αλλά σε δεύτερο πλάνο: όταν κάτι
                  σπάσει με τρόπο που δεν προβλέψαμε, είναι το μόνο νήμα. */}
              <p
                className="mt-1.5 break-words font-[var(--font-numeric)] text-[11px]"
                style={{ color: 'var(--text-muted)' }}
              >
                {saveError.detail}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              aria-label={t('errors.dismiss')}
              style={{ color: 'var(--text-muted)' }}
            >
              ×
            </button>
          </div>
        )}
      {tab === 'dashboard' && (
        <div className="mx-auto w-full max-w-[84rem] px-0 xl:flex xl:items-start">
          <div className="min-w-0 flex-1">
            <Dashboard
              transactions={transactions}
              categories={categories}
              t={t}
              locale={locale as 'el-GR' | 'en-US'}
              currency={currency}
              recurringRules={recurringRules}
              committedCents={committedInOpenTrips(trips, tripEntries)}
              bufferRatio={bufferRatio}
              onAddTransaction={() => setTab('add')}
            />
          </div>

          {/*
            Η ιστορία του ονόματος: μόνιμη στήλη δεξιά σε πλατιές οθόνες, κάτω
            από την επισκόπηση σε μικρότερες.

            Το `items-stretch` στον γονέα μαζί με το `h-full` εδώ κάνουν την
            κάρτα να φτάνει ως το κάτω μέρος της στήλης, ώστε να ευθυγραμμίζεται
            με το τελευταίο πλαίσιο της επισκόπησης αντί να κρέμεται στη μέση.
          */}
          {showStory ? (
            <aside className="w-full px-4 pb-6 xl:w-[22rem] xl:shrink-0 xl:py-6 xl:pl-0">
              <AboutPheidon
                t={t}
                appName={APP_NAME_GREEK}
                onHide={() => setShowStory(false)}
              />
            </aside>
          ) : (
            // Όταν είναι κρυμμένο, μένει ένας διακριτικός σύνδεσμος: αλλιώς ο
            // χρήστης δεν θα έβρισκε ποτέ πώς να το ξαναφέρει.
            <aside className="px-4 pb-4 xl:py-6 xl:pl-0">
              <button
                type="button"
                onClick={() => setShowStory(true)}
                className="text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('about.show')}
              </button>
            </aside>
          )}
        </div>
      )}

      {tab === 'transactions' && (
        <TransactionList
          transactions={transactions}
          categories={categories}
          t={t}
          locale={locale}
          currency={currency}
          onEdit={(tx) => {
            setEditing(tx);
            setTab('add');
          }}
          onDelete={async (id) => {
            await repository.deleteTransaction(id);

            // Αν η συναλλαγή ήταν το τακτοποιημένο σύνολο ενός ταξιδιού, φεύγει
            // και το ταξίδι. Αλλιώς το ταξίδι θα έμενε ορφανό στη λίστα, με τα
            // έξοδά του να μη μετράνε πουθενά.
            const orphan = trips.find((trip) => trip.settledTransactionId === id);
            if (orphan) await repository.deleteTrip(orphan.id);

            await reload();
          }}
        />
      )}

      {tab === 'add' && (
        <TransactionForm
          /*
           * Το key αναγκάζει τη φόρμα να ξαναστηθεί όταν αλλάζει η συναλλαγή
           * που επεξεργάζεσαι. Χωρίς αυτό, το initialDraft διαβάζεται μόνο την
           * πρώτη φορά και τα πεδία μένουν με τα προηγούμενα δεδομένα.
           */
          key={editing?.id ?? 'new'}
          categories={categories}
          userId={userId}
          t={t}
          locale={locale}
          currency={currency}
          existing={editing ?? undefined}
          initialDraft={editing ? draftFromTransaction(editing, currency) : undefined}
          onSave={saveTransaction}
          onCancel={() => {
            setEditing(null);
            setTab('dashboard');
          }}
        />
      )}

      {tab === 'trips' && (
        <TripsScreen
          trips={trips}
          entries={tripEntries}
          categories={categories}
          userId={userId}
          t={t}
          locale={locale}
          currency={currency}
          onSaveTrip={(trip) =>
            guard(async () => {
              await repository.saveTrip(trip);
              await reload();
            })
          }
          onSaveEntry={(entry) =>
            guard(async () => {
              await repository.saveTripEntry(entry);
              await reload();
            })
          }
          onDeleteEntry={(id) =>
            guard(async () => {
              await repository.deleteTripEntry(id);
              await reload();
            })
          }
          onDeleteTrip={async (trip) => {
            // Αν το ταξίδι είχε κλείσει, φεύγει και η συγκεντρωτική συναλλαγή
            // του: αλλιώς θα έμενε στα έξοδα ένα ποσό χωρίς προέλευση.
            if (trip.settledTransactionId) {
              await repository.deleteTransaction(trip.settledTransactionId);
            }
            await repository.deleteTrip(trip.id);
            await reload();
          }}
          onSettle={async (transaction, trip) => {
            // Πρώτα η συναλλαγή, μετά το κλείσιμο: αν σκάσει το δεύτερο, το
            // ταξίδι μένει ανοιχτό και ξαναδοκιμάζει, αντί να χαθεί το ποσό.
            await repository.saveTransaction(transaction);
            await repository.saveTrip(trip);
            await reload();
          }}
        />
      )}

      {tab === 'recurring' && (
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          <RecurringManager
            rules={recurringRules}
            categories={categories}
            userId={userId}
            t={t}
            locale={locale}
            currency={currency}
            onSave={(rule) =>
              guard(async () => {
                await repository.saveRecurring(rule);
                await reload();
              })
            }
            onToggle={(rule) =>
              guard(async () => {
                await repository.saveRecurring(rule);
                await reload();
              })
            }
            onDelete={(rule) =>
              guard(async () => {
                await repository.deleteRecurring(rule.id);
                await reload();
              })
            }
          />
        </div>
      )}

      {tab === 'analysis' && (
        <AnalysisScreen
          transactions={transactions}
          categories={categories}
          t={t}
          locale={locale}
          currency={currency}
        />
      )}

      {tab === 'settings' && (
        <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
          {/*
            Διαγνωστικό: δείχνει αν η εφαρμογή διάβασε τα κλειδιά της Supabase.
            Χωρίς αυτό, το μόνο σύμπτωμα λανθασμένου .env.local είναι ότι «δεν
            εμφανίζεται η σύνδεση», που δεν λέει πού είναι το πρόβλημα.
          */}
          <div
            className="rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: session ? 'var(--income)' : 'var(--text-muted)',
            }}
          >
            {session
              ? t('settings.signedInAs', { email: session.user.email ?? '' })
              : isSupabaseConfigured
                ? t('settings.cloudReady')
                : t('settings.localMode')}
          </div>

          <CurrencySelect value={currency} onChange={setCurrency} t={t} locale={locale} />

          <div>
            <p className="text-sm font-medium">{t('common.theme')}</p>
            <div className="mt-2 flex gap-1.5">
              {(['light', 'dark', 'system'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTheme(option)}
                  className="rounded-full border px-3 py-1.5 text-xs"
                  style={{
                    borderColor: theme === option ? 'var(--accent)' : 'var(--border)',
                    color: theme === option ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {t(`common.themes.${option}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">{t('common.language')}</p>
            <div className="mt-2 flex gap-1.5">
              {/* Το όνομα κάθε γλώσσας γράφεται στην ΙΔΙΑ τη γλώσσα, όχι
                  μεταφρασμένο: όποιος ψάχνει τα αγγλικά αναγνωρίζει το
                  «English» ακόμη κι αν η εφαρμογή είναι στα ελληνικά. */}
              {([
                { code: 'el', label: 'Ελληνικά' },
                { code: 'en', label: 'English' },
              ] as const).map(({ code, label }) => {
                const active = i18n.language.startsWith(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => void i18n.changeLanguage(code)}
                    aria-pressed={active}
                    className="rounded-full border px-3 py-1.5 text-xs"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'var(--border)',
                      color: active ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">{t('settings.buffer')}</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {t('settings.bufferHint')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {[0, 0.05, 0.1, 0.15].map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setBufferRatio(ratio)}
                  className="tnum rounded-full border px-3 py-1.5 text-xs"
                  style={{
                    borderColor: bufferRatio === ratio ? 'var(--accent)' : 'var(--border)',
                    color: bufferRatio === ratio ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {Math.round(ratio * 100)}%
                </button>
              ))}

              {/*
                Ελεύθερη τιμή, με ανώτατο όριο 30%. Πάνω από αυτό το «διαθέσιμο
                για γούστα» γίνεται τόσο μικρό που ο χρήστης το αγνοεί, και ένα
                όριο που αγνοείται δεν προστατεύει από τίποτα.
              */}
              <label className="ml-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  value={Math.round(bufferRatio * 100)}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value)) {
                      setBufferRatio(Math.min(30, Math.max(0, value)) / 100);
                    }
                  }}
                  className="tnum w-16 rounded-lg border bg-transparent px-2 py-1.5 text-xs"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  aria-label={t('settings.buffer')}
                />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('settings.bufferRange')}
                </span>
              </label>
            </div>
          </div>

          <CategoryEditor
            categories={categories}
            t={t}
            locale={locale}
            currency={currency}
            onChange={(category) =>
              guard(async () => {
                await repository.saveCategory(category);
                await reload();
              })
            }
          />

          {session && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm"
              style={{ color: 'var(--expense)' }}
            >
              {t('auth.signOut')}
            </button>
          )}
        </div>
      )}

        <Footer appName={APP_NAME} />
      </div>

      <TabBar tab={tab} setTab={setTab} t={t} />
    </div>
  );
}

// Σειρά κατά ροή εργασίας: βλέπω, ελέγχω, καταχωρώ, ρυθμίζω.
const TABS: Tab[] = [
  'dashboard',
  'transactions',
  'recurring',
  'add',
  'trips',
  'analysis',
  'settings',
];

/** Το λογότυπο και το όνομα, μόνο σε κινητό: στον υπολογιστή είναι στο πλαϊνό. */
function MobileHeader() {
  return (
    <header className="safe-top flex items-center gap-2 px-4 lg:hidden">
      <LogoAnimated size={26} />
      <span className="font-[var(--font-display)] text-lg font-semibold tracking-tight">
        {APP_NAME}
      </span>
      <LanguageToggle className="ml-auto" />
    </header>
  );
}

/**
 * Πλαϊνό μενού, μόνο σε πλατιές οθόνες.
 *
 * Οριζόντιες καρτέλες στο κάτω μέρος δουλεύουν στο κινητό, όπου ο αντίχειρας
 * φτάνει εκεί. Σε υπολογιστή είναι λάθος: το βλέμμα ξεκινά πάνω αριστερά και
 * το ποντίκι διανύει ολόκληρη την οθόνη για κάθε αλλαγή καρτέλας.
 */
function SideNav({
  tab,
  setTab,
  t,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  t: (key: string) => string;
}) {
  return (
    <aside
      className="safe-top hidden w-56 shrink-0 flex-col gap-1 border-r p-4 lg:sticky lg:top-0 lg:flex lg:h-screen"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Το όνομα πιάνει όλο το πλάτος της στήλης μαζί με το λογότυπο. */}
      <div className="mb-5 flex items-center gap-2.5 px-1">
        <LogoAnimated size={38} className="shrink-0" />
        <span className="font-[var(--font-display)] text-2xl font-bold leading-none tracking-tight">
          {APP_NAME}
        </span>
      </div>

      {TABS.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setTab(item)}
          aria-current={tab === item}
          className="rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
          style={{
            background: tab === item ? 'var(--surface-sunken)' : 'transparent',
            color: tab === item ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          {t(`nav.${item}`)}
        </button>
      ))}

      {/* Στο κάτω μέρος του μενού, μόνιμα ορατή σε κάθε καρτέλα. */}
      <div className="mt-auto border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        <LanguageToggle variant="full" />
      </div>
    </aside>
  );
}

/**
 * Κάτω μπάρα κινητού.
 *
 * Εικονίδιο και ετικέτα σε κάθε καρτέλα. Οι ελληνικές λέξεις δεν χωρούν
 * ολόκληρες σε 360 εικονοστοιχεία, οπότε κόβονται με αποσιωπητικά: «Επισκόπ…».
 * Το αρχικό κομμάτι της λέξης αρκεί για να αναγνωριστεί, και το πλήρες όνομα
 * παραμένει διαθέσιμο σε aria-label και title.
 *
 * Η ενεργή καρτέλα ξεχωρίζει με τρία σήματα μαζί: χρώμα, πιο έντονη γραμμή στο
 * εικονίδιο και έντονη γραφή. Ποτέ μόνο με χρώμα, γιατί ένας στους δώδεκα
 * άνδρες δεν διακρίνει αξιόπιστα αποχρώσεις.
 */
const TAB_ICONS: Record<Tab, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  transactions: Receipt,
  recurring: Repeat,
  add: Plus,
  trips: Plane,
  analysis: Sparkles,
  settings: Settings2,
};

function TabBar({
  tab,
  setTab,
  t,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  t: (key: string) => string;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 grid grid-cols-7 border-t lg:hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map((item) => {
        const Icon = TAB_ICONS[item];
        const active = tab === item;
        const label = t(`nav.${item}`);

        return (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            aria-current={active}
            aria-label={label}
            title={label}
            className="flex min-w-0 flex-col items-center gap-0.5 px-0.5 pb-1.5 pt-2"
            style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            <Icon size={18} strokeWidth={active ? 2.3 : 1.7} />
            <span
              className={`w-full truncate text-center text-[9px] leading-tight ${
                active ? 'font-semibold' : 'font-normal'
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
