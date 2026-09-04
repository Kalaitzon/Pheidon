// Πρόσκληση εγκατάστασης.
//
// Δύο εντελώς διαφορετικοί κόσμοι:
//
//   Android/Chrome  Ο browser στέλνει το συμβάν `beforeinstallprompt`, το
//                   κρατάμε και το ενεργοποιούμε με δικό μας κουμπί.
//
//   iOS/Safari      Δεν υπάρχει τέτοιο συμβάν και δεν υπάρχει τρόπος να
//                   ξεκινήσει η εγκατάσταση από τον κώδικα. Το μόνο που
//                   μπορούμε είναι να δείξουμε τα βήματα.
//
// Η πρόσκληση δεν εμφανίζεται ποτέ σε ήδη εγκατεστημένη εφαρμογή, και όταν ο
// χρήστης την κλείσει δεν ξαναεμφανίζεται.

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISSED_KEY = 'ft.installDismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Τρέχει ήδη ως εγκατεστημένη εφαρμογή; */
const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // Το iOS χρησιμοποιεί δικό του, μη τυποποιημένο πεδίο.
  (window.navigator as { standalone?: boolean }).standalone === true;

const isIosSafari = (): boolean => {
  const ua = window.navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  // Στο iOS όλοι οι browsers χρησιμοποιούν WebKit, αλλά μόνο ο Safari
  // εγκαθιστά. Το Chrome για iOS δηλώνει «CriOS».
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

interface InstallPromptProps {
  t: (key: string, params?: Record<string, unknown>) => string;
  appName: string;
}

export function InstallPrompt({ t, appName }: InstallPromptProps) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1',
  );

  useEffect(() => {
    if (isStandalone() || dismissed) return;

    const onPrompt = (event: Event) => {
      // Χωρίς αυτό, ο Chrome δείχνει δικό του μπάνερ σε δικό του χρόνο.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    if (isIosSafari()) setShowIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [dismissed]);

  const close = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') close();
    setDeferred(null);
  };

  if (dismissed || isStandalone()) return null;
  if (!deferred && !showIosHint) return null;

  return (
    <section
      className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-xl border px-4 py-3"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t('install.title', { app: appName })}</p>

        {deferred ? (
          <>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('install.body')}
            </p>
            <button
              type="button"
              onClick={install}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Download size={14} />
              {t('install.action')}
            </button>
          </>
        ) : (
          <p
            className="mt-1 inline-flex flex-wrap items-center gap-1 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('install.iosStep1')}
            <Share size={13} className="inline" aria-hidden />
            {t('install.iosStep2')}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={close}
        aria-label={t('install.dismiss')}
        style={{ color: 'var(--text-muted)' }}
      >
        <X size={16} />
      </button>
    </section>
  );
}
