// Υποσέλιδο.
//
// Το έτος υπολογίζεται τη στιγμή της εμφάνισης και δεν γράφεται σταθερό στον
// κώδικα. Ένα υποσέλιδο που λέει «2026» τον Ιανουάριο του 2028 είναι από τα
// πρώτα πράγματα που προσέχει κανείς σε μια εγκαταλελειμμένη εφαρμογή.
//
// Η γραμμή μένει στα αγγλικά και στις δύο γλώσσες: το σύμβολο © και το
// «All rights reserved» είναι τυποποιημένη διατύπωση, και το όνομα είναι κύριο.

interface FooterProps {
  appName: string;
  compact?: boolean;
}

export function Footer({ appName, compact = false }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      lang="en"
      className={`mx-auto w-full max-w-3xl px-4 text-center text-[11px] ${
        compact ? 'py-4' : 'border-t py-6'
      }`}
      style={{
        color: 'var(--text-muted)',
        borderColor: compact ? 'transparent' : 'var(--border)',
      }}
    >
      © {year} {appName} · Developed by Ioannis Kalaitzidis. All rights reserved.
    </footer>
  );
}
