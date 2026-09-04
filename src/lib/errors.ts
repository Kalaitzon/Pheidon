// Μετάφραση σφαλμάτων σε ανθρώπινη γλώσσα.
//
// Η Postgres λέει «new row violates check constraint
// "recurring_rules_frequency_check"». Σωστό, αλλά άχρηστο για τον χρήστη.
//
// Εδώ κάθε σφάλμα γίνεται τρία πράγματα:
//   title   τι πήγε στραβά, σε μία φράση
//   hint    τι να κάνει ο χρήστης γι' αυτό
//   detail  το τεχνικό μήνυμα, μικρό και σε δεύτερο πλάνο, για διάγνωση
//
// Το detail δεν κρύβεται ποτέ. Όταν κάτι σπάει με τρόπο που δεν προβλέψαμε, το
// αρχικό μήνυμα είναι το μόνο νήμα που οδηγεί στην αιτία.

export interface FriendlyError {
  titleKey: string;
  hintKey?: string;
  detail: string;
  params?: Record<string, string | number>;
}

interface PostgresError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  name?: string;
}

const asRecord = (error: unknown): PostgresError =>
  error && typeof error === 'object' ? (error as PostgresError) : {};

/** Το ωμό τεχνικό κείμενο, για την τελευταία γραμμή του μηνύματος. */
export function rawDetail(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;

  const e = asRecord(error);
  const parts = [e.message, e.details, e.hint].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  const code = e.code ? ` [${e.code}]` : '';

  if (parts.length > 0) return parts.join(' · ') + code;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Αναγνωρίζει το σφάλμα και επιστρέφει κατανοητή εξήγηση.
 *
 * Η αντιστοίχιση γίνεται πρώτα με το όνομα του κανόνα, που είναι το πιο
 * συγκεκριμένο, και μετά με τον κωδικό σφάλματος της Postgres.
 */
export function describeError(error: unknown): FriendlyError {
  const e = asRecord(error);
  const detail = rawDetail(error);
  const text = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase();
  const code = e.code ?? '';

  /* --- Δίκτυο και συνεδρία: τα πιο συχνά, πριν από οτιδήποτε άλλο --- */

  if (e.name === 'TypeError' && text.includes('fetch')) {
    return { titleKey: 'errors.offline', hintKey: 'errors.offlineHint', detail };
  }
  if (code === 'PGRST301' || text.includes('jwt') || text.includes('token is expired')) {
    return { titleKey: 'errors.sessionExpired', hintKey: 'errors.sessionExpiredHint', detail };
  }

  /* --- Κανόνες της βάσης, ανά όνομα: το πιο ακριβές σήμα --- */

  if (text.includes('frequency_check')) {
    return { titleKey: 'errors.staleSchema', hintKey: 'errors.staleSchemaHint', detail };
  }
  if (text.includes('day_of_month')) {
    return { titleKey: 'errors.dayOutOfRange', hintKey: 'errors.dayOutOfRangeHint', detail };
  }
  if (text.includes('amount_cents')) {
    return { titleKey: 'errors.amountInvalid', hintKey: 'errors.amountInvalidHint', detail };
  }

  /* --- Κωδικοί της Postgres --- */

  switch (code) {
    case '23514': // check constraint
      return { titleKey: 'errors.valueRejected', hintKey: 'errors.staleSchemaHint', detail };

    case '23503': // foreign key
      return { titleKey: 'errors.missingReference', hintKey: 'errors.missingReferenceHint', detail };

    case '23502': // not null
      return { titleKey: 'errors.missingField', hintKey: 'errors.missingFieldHint', detail };

    case '23505': // unique
      return { titleKey: 'errors.duplicate', hintKey: 'errors.duplicateHint', detail };

    case '22P02': // invalid text representation
      return { titleKey: 'errors.badFormat', hintKey: 'errors.badFormatHint', detail };

    case '42P01': // undefined table
      return { titleKey: 'errors.missingTable', hintKey: 'errors.staleSchemaHint', detail };

    case '42501': // insufficient privilege
      return { titleKey: 'errors.notAllowed', hintKey: 'errors.notAllowedHint', detail };

    default:
      return { titleKey: 'errors.saveFailed', detail };
  }
}
