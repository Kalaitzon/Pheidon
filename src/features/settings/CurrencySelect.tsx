// Επιλογή νομίσματος.
//
// Η αλλαγή είναι καθαρά θέμα εμφάνισης: τα αποθηκευμένα ποσά δεν πειράζονται.
// Αυτό λέγεται ρητά στον χρήστη, γιατί η προφανής υπόθεση είναι το αντίθετο
// και μια σιωπηλή αλλαγή συμβόλου θα έμοιαζε με απώλεια χρημάτων.

import type { CurrencyCode } from '../../types/finance';
import { CURRENCIES, formatAmount } from '../../lib/currency';

interface CurrencySelectProps {
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale?: string;
  /** Αν true, δείχνει την προειδοποίηση αλλαγής. Στο onboarding δεν χρειάζεται. */
  showWarning?: boolean;
}

export function CurrencySelect({
  value,
  onChange,
  t,
  locale = 'el-GR',
  showWarning = true,
}: CurrencySelectProps) {
  return (
    <div>
      <label
        htmlFor="currency-select"
        className="block text-sm font-medium"
        style={{ color: 'var(--text)' }}
      >
        {t('currency.baseCurrency')}
      </label>

      <div className="mt-2 flex items-center gap-3">
        <select
          id="currency-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm font-medium"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.symbol}
            </option>
          ))}
        </select>

        {/* Ζωντανό δείγμα: ο χρήστης βλέπει αμέσως πώς θα γράφονται τα ποσά του,
            μαζί με τα σωστά δεκαδικά του κάθε νομίσματος. */}
        <span className="tnum text-sm" style={{ color: 'var(--text-muted)' }}>
          {formatAmount(123456, value, locale)}
        </span>
      </div>

      {showWarning && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t('currency.changeWarning')}
        </p>
      )}
    </div>
  );
}
