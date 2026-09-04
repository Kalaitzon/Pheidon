// Διακριτικό φόντο.
//
// Ο κανόνας σε ένα φόντο είναι ένας: να μη διαβάζεται. Τη στιγμή που ο χρήστης
// το προσέχει αντί για τα νούμερά του, έχει αποτύχει. Γι' αυτό:
//
//   - Ζει στις άκρες, ποτέ πίσω από κείμενο ή γραφήματα.
//   - Αδιαφανές στο 4% σε φωτεινό θέμα, 6% σε σκούρο. Πιο πολύ γίνεται θόρυβος.
//   - `pointer-events: none`, ώστε να μην μπλοκάρει κλικ.
//   - Κρύβεται τελείως σε στενές οθόνες: στο κινητό δεν υπάρχει περιθώριο για
//     διακόσμηση, κάθε εικονοστοιχείο πλάτους χρειάζεται για το περιεχόμενο.

export function BackgroundMotif() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 hidden select-none overflow-hidden lg:block"
    >
      {/* Ζυγαριά, δεξιά, μεγάλη και σχεδόν αόρατη */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute -right-24 top-1/2 h-[42rem] w-[42rem] -translate-y-1/2 text-[var(--text)] opacity-[0.04] dark:opacity-[0.06]"
      >
        <path d="M12 3.2v15.4" />
        <path d="M8.4 20.4h7.2" />
        <path d="M9.8 20.4c1.4-.5 1.9-1.1 2.2-1.8.3.7.8 1.3 2.2 1.8" />
        <path d="M3.6 7.4c2.8-.9 5.6-1.35 8.4-1.35s5.6.45 8.4 1.35" />
        <circle cx="12" cy="5.4" r="1.15" />
        <path d="M4.2 7.6 2.2 12.2h4.4L4.6 7.5" />
        <path d="M19.8 7.6l2 4.6h-4.4l2-4.7" />
        <path d="M1.5 12.2c0 1.7 1.4 2.8 2.9 2.8s2.9-1.1 2.9-2.8" />
        <path d="M17.1 12.2c0 1.7 1.4 2.8 2.9 2.8s2.9-1.1 2.9-2.8" />
      </svg>

      {/*
        Αριστερά, μια στήλη από γραμμές λογιστικού καταστίχου. Επαναλαμβάνεται
        με CSS gradient αντί για εικόνα: μηδέν επιπλέον αίτημα δικτύου.
      */}
      <div
        className="absolute inset-y-0 left-0 w-40 opacity-[0.05] dark:opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, var(--text) 0px, var(--text) 1px, transparent 1px, transparent 28px)',
          maskImage: 'linear-gradient(to right, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, black, transparent)',
        }}
      />
    </div>
  );
}
