// Η ιστορία πίσω από το όνομα, με εφέ πληκτρολόγησης.
//
// Τρία πράγματα που ξεχωρίζουν ένα καλό εφέ πληκτρολόγησης από ένα ενοχλητικό:
//
//   1. Παρακάμπτεται. Ένα κλικ οπουδήποτε εμφανίζει αμέσως όλο το κείμενο.
//      Τη δεύτερη φορά κανείς δεν θέλει να περιμένει.
//   2. Σέβεται το prefers-reduced-motion. Για όποιον έχει ζητήσει λιγότερη
//      κίνηση, το κείμενο εμφανίζεται ολόκληρο χωρίς καθυστέρηση.
//   3. Δεν αναπηδά η σελίδα. Ο χώρος δεσμεύεται από την αρχή, αλλιώς κάθε νέα
//      γραμμή σπρώχνει το περιεχόμενο προς τα κάτω.

import { useEffect, useMemo, useRef, useState } from 'react';
import { LogoAnimated } from '../../components/Logo';

/**
 * Ρυθμός πληκτρολόγησης.
 *
 * Ένας άνθρωπος δεν γράφει με σταθερό ρυθμό. Επιταχύνει μέσα στη λέξη,
 * κοντοστέκεται στα σημεία στίξης και παίρνει ανάσα στην αλλαγή παραγράφου.
 * Ένας μετρητής που προχωρά κάθε Χ χιλιοστά ακούγεται σαν μηχανή.
 */
const BASE_DELAY_MS = 42;   // ~24 χαρακτήρες το δευτερόλεπτο
const JITTER_MS = 34;       // τυχαία διακύμανση σε κάθε χαρακτήρα

/** Επιπλέον παύση μετά από συγκεκριμένους χαρακτήρες. */
const PAUSE_AFTER: Record<string, number> = {
  '.': 420,
  ',': 180,
  ':': 260,
  ';': 260,
  '\n': 560,
};

interface AboutPheidonProps {
  t: (key: string, params?: Record<string, unknown>) => string;
  appName: string;
  variant?: 'card' | 'overlay';
  className?: string;
  onDismiss?: () => void;
  /** Απόκρυψη του πλαισίου από την επισκόπηση. */
  onHide?: () => void;
}

/**
 * Το εφέ παίζει μία φορά ανά φόρτωση της σελίδας, όχι κάθε φορά που γυρνάς
 * στην επισκόπηση. Αλλιώς, μετά την τρίτη εναλλαγή καρτέλας, γίνεται βασανιστικό.
 *
 * ΠΡΟΣΟΧΗ: η σημαία μπαίνει όταν το κείμενο ΟΛΟΚΛΗΡΩΘΕΙ, όχι όταν ξεκινήσει.
 * Το StrictMode της React προσαρτά κάθε component δύο φορές κατά την ανάπτυξη:
 * αν τη βάζαμε στην αρχή, το πρώτο πέρασμα θα την ύψωνε, το δεύτερο θα έβγαινε
 * αμέσως, και το κείμενο δεν θα γραφόταν ποτέ.
 */
let alreadyTyped = false;

export function AboutPheidon({
  t,
  appName,
  variant = 'card',
  className = '',
  onDismiss,
  onHide,
}: AboutPheidonProps) {
  const paragraphs = useMemo(
    () => [t('about.p1'), t('about.p2'), t('about.p3')],
    [t],
  );

  const fullText = paragraphs.join('\n\n');
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [charCount, setCharCount] = useState(
    reducedMotion || alreadyTyped ? fullText.length : 0,
  );
  const done = charCount >= fullText.length;
  const timerRef = useRef<number>();

  useEffect(() => {
    if (reducedMotion || alreadyTyped) return;
    let cancelled = false;

    // Αναδρομικό setTimeout αντί για setInterval: κάθε χαρακτήρας μπορεί να
    // έχει δική του καθυστέρηση, που είναι όλο το ζητούμενο εδώ.
    const typeNext = (index: number) => {
      if (cancelled) return;

      if (index >= fullText.length) {
        alreadyTyped = true;
        return;
      }

      setCharCount(index + 1);

      const justTyped = fullText[index];
      const delay =
        BASE_DELAY_MS +
        Math.random() * JITTER_MS +
        (PAUSE_AFTER[justTyped] ?? 0);

      timerRef.current = window.setTimeout(() => typeNext(index + 1), delay);
    };

    // Μικρή καθυστέρηση πριν το πρώτο γράμμα: ο χρήστης προλαβαίνει να δει
    // τον κέρσορα και καταλαβαίνει ότι κάτι πρόκειται να γραφτεί.
    timerRef.current = window.setTimeout(() => typeNext(0), 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timerRef.current);
    };
  }, [fullText.length, reducedMotion]);

  const skip = () => {
    window.clearTimeout(timerRef.current);
    alreadyTyped = true;
    setCharCount(fullText.length);
  };

  const visible = fullText.slice(0, charCount);

  const content = (
    <div
      onClick={done ? undefined : skip}
      className={variant === 'overlay' ? 'w-full max-w-lg' : ''}
      style={{ cursor: done ? 'default' : 'pointer' }}
    >
      <div className="flex items-center gap-2.5">
        <LogoAnimated size={28} className="shrink-0" />
        {/* whitespace-nowrap: ο τίτλος μένει σε μία σειρά. Η στήλη είναι αρκετά
            φαρδιά ώστε να χωράει χωρίς σμίκρυνση της γραμματοσειράς. */}
        <h2 className="whitespace-nowrap font-[var(--font-display)] text-lg font-bold tracking-tight">
          {appName}
          <span style={{ color: 'var(--text-muted)' }}> / </span>
          {t('about.latinName')}
          {/*
            Επιστημονική μεταγραφή, με τόνο και μακρόν: pheídōn. Είναι η μορφή
            που χρησιμοποιείται σε φιλολογικά και ιστορικά κείμενα, οπότε δείχνει
            ακριβώς πού πέφτει ο τόνος και ποιο ωμέγα είναι μακρό.
          */}
          <span
            className="ml-1 text-xs font-normal italic"
            style={{ color: 'var(--text-muted)' }}
            lang="grc-Latn"
          >
            ({t('about.transliteration')})
          </span>
        </h2>
      </div>

      {/*
        Ο χώρος δεσμεύεται με ένα αόρατο αντίγραφο του πλήρους κειμένου, ώστε το
        ορατό κείμενο να γράφεται από πάνω χωρίς να μετακινείται τίποτα.
      */}
      <div className="relative mt-4">
        <p
          aria-hidden
          className="whitespace-pre-line text-sm leading-relaxed opacity-0"
          style={{ textAlign: 'justify', hyphens: 'auto' }}
        >
          {fullText}
        </p>
        <p
          className="absolute inset-0 whitespace-pre-line text-sm leading-relaxed"
          // Πλήρης στοίχιση, με συλλαβισμό ώστε να μη μένουν μεγάλα κενά
          // ανάμεσα στις λέξεις σε στενές οθόνες.
          style={{ color: 'var(--text-muted)', textAlign: 'justify', hyphens: 'auto' }}
        >
          {visible}
          {!done && (
            <span
              className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse"
              style={{ background: 'var(--accent)' }}
              aria-hidden
            />
          )}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {!done && (
          <button
            type="button"
            onClick={skip}
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('about.skip')}
          </button>
        )}
        {done && onHide && (
          <button
            type="button"
            onClick={onHide}
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('about.hide')}
          </button>
        )}
        {done && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {t('about.continue')}
          </button>
        )}
      </div>
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-6"
        style={{ background: 'var(--bg)' }}
        role="dialog"
        aria-label={t('about.menuTitle')}
      >
        {content}
      </div>
    );
  }

  return (
    <section
      className={`rounded-xl border p-5 ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {content}
    </section>
  );
}

/* ------------------------------------------------------------------ */

const SEEN_KEY = 'ft.aboutSeen.v1';

/** Έχει ήδη δει την ιστορία; Εμφανίζεται μία φορά, όχι σε κάθε άνοιγμα. */
export function hasSeenAbout(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // Ιδιωτική περιήγηση: καλύτερα να μην εμφανιστεί καθόλου παρά κάθε φορά.
    return true;
  }
}

export function markAboutSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* αγνοείται */
  }
}
