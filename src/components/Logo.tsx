// Λογότυπο: ζυγαριά παλαιού τύπου, από αυτές που χρησιμοποιούνταν στο εμπόριο.
//
// Σχεδιασμένο ως SVG με `currentColor`, οπότε παίρνει μόνο του το χρώμα του
// κειμένου και δουλεύει σε φωτεινό και σκούρο θέμα χωρίς δεύτερη έκδοση.
//
// Οι δίσκοι είναι σκόπιμα στο ίδιο ύψος: ισορροπία, όχι υπέρβαση.

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-hidden="true"
    >
      {/* Κεντρικός στύλος και βάση */}
      <path d="M12 3.2v15.4" />
      <path d="M8.4 20.4h7.2" />
      <path d="M9.8 20.4c1.4-.5 1.9-1.1 2.2-1.8.3.7.8 1.3 2.2 1.8" />

      {/* Ο ζυγός, με ελαφριά καμπύλη ώστε να μη μοιάζει με σταυρό */}
      <path d="M3.6 7.4c2.8-.9 5.6-1.35 8.4-1.35s5.6.45 8.4 1.35" />
      <circle cx="12" cy="5.4" r="1.15" />

      {/* Τα σχοινιά και οι δύο δίσκοι */}
      <path d="M4.2 7.6 2.2 12.2h4.4L4.6 7.5" />
      <path d="M19.8 7.6l2 4.6h-4.4l2-4.7" />
      <path d="M1.5 12.2c0 1.7 1.4 2.8 2.9 2.8s2.9-1.1 2.9-2.8" />
      <path d="M17.1 12.2c0 1.7 1.4 2.8 2.9 2.8s2.9-1.1 2.9-2.8" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Το κινούμενο λογότυπο: πέφτει ένα χρυσό νόμισμα στον αριστερό δίσκο, ο ζυγός
 * γέρνει από το βάρος, το νόμισμα σβήνει και η ζυγαριά ισορροπεί ξανά.
 *
 * Γίνεται με CSS και όχι με GIF: μηδέν αίτημα δικτύου, καθαρές ακμές σε κάθε
 * μέγεθος, και σταματά μόνο του όταν ο χρήστης έχει ζητήσει λιγότερη κίνηση.
 */
export function LogoAnimated({ size = 26, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-hidden="true"
    >
      {/* Ο στύλος και η βάση μένουν ακίνητα */}
      <path d="M12 3.2v15.4" />
      <path d="M8.4 20.4h7.2" />
      <path d="M9.8 20.4c1.4-.5 1.9-1.1 2.2-1.8.3.7.8 1.3 2.2 1.8" />

      {/* Ο ζυγός με τους δίσκους γέρνει ως ενιαίο σύνολο */}
      <g className="logo-beam">
        <path d="M3.6 7.4c2.8-.9 5.6-1.35 8.4-1.35s5.6.45 8.4 1.35" />
        <circle cx="12" cy="5.4" r="1.15" />
        <path d="M4.2 7.6 2.2 12.2h4.4L4.6 7.5" />
        <path d="M19.8 7.6l2 4.6h-4.4l2-4.7" />
        <path d="M1.5 12.2c0 1.7 1.4 2.8 2.9 2.8s2.9-1.1 2.9-2.8" />
        <path d="M17.1 12.2c0 1.7 1.4 2.8 2.9 2.8s2.9-1.1 2.9-2.8" />

        {/* Το νόμισμα πέφτει μέσα στον αριστερό δίσκο */}
        <circle
          className="logo-coin"
          cx="4.4"
          cy="13"
          r="1.5"
          fill="var(--accent)"
          stroke="none"
        />
      </g>
    </svg>
  );
}
