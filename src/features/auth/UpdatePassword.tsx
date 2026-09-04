// Ορισμός νέου κωδικού.
//
// Εμφανίζεται όταν ο χρήστης έρχεται από τον σύνδεσμο του email. Σε αυτό το
// σημείο η Supabase τον έχει ήδη συνδέσει προσωρινά, οπότε το μόνο που μένει
// είναι να ορίσει νέο κωδικό.

import { useState } from 'react';
import { updatePassword } from '../../lib/supabase';
import { PasswordInput } from '../../components/PasswordInput';

interface UpdatePasswordProps {
  t: (key: string, params?: Record<string, unknown>) => string;
  onDone: () => void;
}

export function UpdatePassword({ t, onDone }: UpdatePasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 6 && password === confirm && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      // Το fragment με το token φεύγει από τη διεύθυνση: δεν υπάρχει λόγος να
      // μείνει στο ιστορικό του browser.
      window.history.replaceState(null, '', window.location.pathname);
      onDone();
    } catch {
      setError(t('auth.errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <h1 className="font-[var(--font-display)] text-xl font-bold tracking-tight">
        {t('auth.newPasswordTitle')}
      </h1>

      <div className="mt-5 space-y-3">
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder={t('auth.password')}
          ariaLabel={t('auth.password')}
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
        />
        <PasswordInput
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          placeholder={t('auth.confirmPassword')}
          ariaLabel={t('auth.confirmPassword')}
          showLabel={t('auth.showPassword')}
          hideLabel={t('auth.hidePassword')}
          onEnter={() => canSubmit && submit()}
        />

        {tooShort && <Hint text={t('auth.errors.weakPassword')} />}
        {mismatch && <Hint text={t('auth.errors.mismatch')} />}
        {error && <Hint text={error} />}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {busy ? t('auth.working') : t('auth.savePassword')}
        </button>
      </div>
    </main>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <p className="text-sm" role="alert" style={{ color: 'var(--expense)' }}>
      {text}
    </p>
  );
}
