// Οθόνη σύνδεσης.
//
// Τρεις καταστάσεις σε μία φόρμα: σύνδεση, εγγραφή, επαναφορά κωδικού. Δεν
// υπάρχει λόγος για τρεις σελίδες και τρία routes σε κάτι που είναι δύο πεδία.
//
// Τα μηνύματα σφάλματος της Supabase έρχονται στα αγγλικά και είναι τεχνικά.
// Τα μεταφράζουμε σε κάτι που βοηθάει, χωρίς όμως να αποκαλύπτουμε αν υπάρχει
// λογαριασμός με το συγκεκριμένο email.

import { useState } from 'react';
import { requestPasswordReset, signIn, signUp } from '../../lib/supabase';
import { PasswordInput } from '../../components/PasswordInput';
import { Footer } from '../../components/Footer';
import { LogoAnimated } from '../../components/Logo';
import { LanguageToggle } from '../../components/LanguageToggle';

type Mode = 'signin' | 'signup' | 'reset';

interface AuthScreenProps {
  t: (key: string, params?: Record<string, unknown>) => string;
}

export function AuthScreen({ t }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === 'reset') {
        await requestPasswordReset(email);
        // Το ίδιο μήνυμα είτε υπάρχει ο λογαριασμός είτε όχι: αλλιώς η φόρμα
        // γίνεται εργαλείο για να μαθαίνει κανείς ποια email είναι εγγεγραμμένα.
        setNotice(t('auth.resetSent'));
      } else if (mode === 'signup') {
        await signUp(email, password);
        setNotice(t('auth.checkEmail'));
      } else {
        await signIn(email, password);
        // Η αλλαγή session πιάνεται από το onSessionChange, δεν κάνουμε τίποτα εδώ.
      }
    } catch (err) {
      setError(translateError(err, t));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    email.includes('@') && (mode === 'reset' || password.length >= 6) && !busy;

  return (
    <main className="safe-top mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      {/* Στο κέντρο, όπως όλα τα υπόλοιπα της οθόνης, και πάνω από το λογότυπο:
          όποιος δεν διαβάζει ελληνικά τη συναντά πρώτη. */}
      <LanguageToggle variant="full" className="mb-6 justify-center" />

      {/* Το ίδιο λογότυπο και όνομα με το πλαϊνό μενού: ο χρήστης αναγνωρίζει
          πού βρίσκεται πριν καν συνδεθεί. */}
      <div className="flex items-center justify-center gap-2.5">
        <LogoAnimated size={34} className="shrink-0" />
        <span className="font-[var(--font-display)] text-2xl font-bold tracking-tight">
          Pheidon
        </span>
      </div>
      <p className="mt-2 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        {t(`auth.subtitle.${mode}`)}
      </p>

      <div className="mt-6 space-y-3">
        <Field label={t('auth.email')}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </Field>

        {mode !== 'reset' && (
          <Field
            label={t('auth.password')}
            hint={mode === 'signup' ? t('auth.passwordHint') : undefined}
          >
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              ariaLabel={t('auth.password')}
              showLabel={t('auth.showPassword')}
              hideLabel={t('auth.hidePassword')}
              onEnter={() => canSubmit && submit()}
            />
          </Field>
        )}

        {error && (
          <p className="text-center text-sm" role="alert" style={{ color: 'var(--expense)' }}>
            {error}
          </p>
        )}
        {notice && (
          <p className="text-center text-sm" style={{ color: 'var(--income)' }}>
            {notice}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {busy ? t('auth.working') : t(`auth.action.${mode}`)}
        </button>
      </div>

      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        {mode !== 'signin' && (
          <button type="button" onClick={() => setMode('signin')} style={{ color: 'var(--text-muted)' }}>
            {t('auth.toSignin')}
          </button>
        )}
        {mode === 'signin' && (
          <>
            <button type="button" onClick={() => setMode('signup')} style={{ color: 'var(--text-muted)' }}>
              {t('auth.toSignup')}
            </button>
            <button type="button" onClick={() => setMode('reset')} style={{ color: 'var(--text-muted)' }}>
              {t('auth.toReset')}
            </button>
          </>
        )}
      </div>

      <Footer appName="Pheidon" compact />
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="block text-center text-[11px] uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint && (
        <span
          className="mt-1 block text-center text-[11px]"
          style={{ color: 'var(--text-muted)' }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

/** Τα τεχνικά μηνύματα της Supabase σε κάτι που βοηθάει τον χρήστη. */
function translateError(err: unknown, t: AuthScreenProps['t']): string {
  const message = err instanceof Error ? err.message.toLowerCase() : '';

  if (message.includes('invalid login')) return t('auth.errors.invalid');
  if (message.includes('already registered')) return t('auth.errors.exists');
  if (message.includes('password')) return t('auth.errors.weakPassword');
  if (message.includes('rate limit') || message.includes('too many')) {
    return t('auth.errors.rateLimit');
  }
  if (message.includes('fetch') || message.includes('network')) {
    return t('auth.errors.network');
  }
  return t('auth.errors.generic');
}
