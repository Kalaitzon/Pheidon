// Εναλλαγή γλώσσας.
//
// Πρέπει να είναι ορατή ΠΡΙΝ τη σύνδεση και χωρίς να διαβάσει κανείς ελληνικά.
// Γι' αυτό:
//   - Δεν έχει ετικέτα «Γλώσσα» δίπλα της, που θα ήταν μεταφρασμένη και άχρηστη
//     σε όποιον δεν καταλαβαίνει τη γλώσσα που βλέπει.
//   - Τα ονόματα γράφονται στην ίδια τη γλώσσα τους: «English» αναγνωρίζεται
//     ακόμη κι όταν όλη η οθόνη είναι στα ελληνικά.
//   - Έχει εικονίδιο υδρογείου, που είναι διεθνώς κατανοητό σύμβολο γλώσσας.

import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'el', label: 'Ελληνικά', short: 'ΕΛ' },
  { code: 'en', label: 'English', short: 'EN' },
] as const;

interface LanguageToggleProps {
  /** 'full' δείχνει τα ονόματα, 'compact' μόνο τους κωδικούς. */
  variant?: 'full' | 'compact';
  className?: string;
}

export function LanguageToggle({ variant = 'compact', className = '' }: LanguageToggleProps) {
  const { i18n } = useTranslation();

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Globe size={14} style={{ color: 'var(--text-muted)' }} aria-hidden />
      {LANGUAGES.map(({ code, label, short }) => {
        const active = i18n.language.startsWith(code);
        return (
          <button
            key={code}
            type="button"
            onClick={() => void i18n.changeLanguage(code)}
            aria-pressed={active}
            // Η ετικέτα προσβασιμότητας είναι πάντα στη γλώσσα-στόχο.
            aria-label={label}
            lang={code}
            className="rounded px-1.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              textDecoration: active ? 'underline' : 'none',
              textUnderlineOffset: '3px',
            }}
          >
            {variant === 'full' ? label : short}
          </button>
        );
      })}
    </div>
  );
}
