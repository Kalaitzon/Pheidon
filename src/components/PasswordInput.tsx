// Πεδίο κωδικού με ματάκι.
//
// Το κουμπί είναι `tabIndex={-1}` επίτηδες: με Tab ο χρήστης πρέπει να περνά από
// το πεδίο στο επόμενο πεδίο, όχι στο ματάκι. Το ματάκι είναι για το ποντίκι και
// για το δάχτυλο.

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  ariaLabel: string;
  showLabel: string;
  hideLabel: string;
  onEnter?: () => void;
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  ariaLabel,
  showLabel,
  hideLabel,
  onEnter,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full rounded-lg border bg-transparent py-2.5 pl-3 pr-10 text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5"
        style={{ color: 'var(--text-muted)' }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
