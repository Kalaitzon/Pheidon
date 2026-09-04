// Σύνδεση με Supabase.
//
// Το κλειδί `anon` είναι ΔΗΜΟΣΙΟ και προορίζεται να μπει στο frontend. Δεν είναι
// μυστικό και δεν προστατεύει τίποτα από μόνο του. Αυτό που προστατεύει τα
// δεδομένα είναι τα RLS policies στο `supabase/schema.sql`.
//
// Το κλειδί `service_role` δεν μπαίνει ΠΟΤΕ σε αρχείο του frontend: παρακάμπτει
// τα RLS και δίνει πρόσβαση στα δεδομένα όλων.

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Χωρίς κλειδιά, η εφαρμογή τρέχει τοπικά χωρίς λογαριασμούς. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/**
 * Ο client δημιουργείται με την πρώτη χρήση, όχι κατά τη φόρτωση του module.
 *
 * Αν τον φτιάχναμε στη φόρτωση, η εφαρμογή θα έσκαγε ολόκληρη σε όποιον δεν έχει
 * ρυθμίσει Supabase, ακόμη κι αν δούλευε τοπικά και δεν χρειαζόταν καθόλου.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Λείπουν τα VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Δες το αρχείο .env.example.',
    );
  }
  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Ο χρήστης δεν ξανακάνει login σε κάθε άνοιγμα.
      detectSessionInUrl: true,
    },
  });
  return client;
}

/* ------------------------------------------------------------------ */
/* Λογαριασμός                                                         */
/* ------------------------------------------------------------------ */

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export const signOut = () => getSupabase().auth.signOut();

/** Email επαναφοράς κωδικού. Η σελίδα προορισμού ορίζεται στο Supabase Dashboard. */
export async function requestPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

/** Ορισμός νέου κωδικού, αφού ο χρήστης έχει έρθει από τον σύνδεσμο του email. */
export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw error;
}

/**
 * Ήρθε ο χρήστης από σύνδεσμο επαναφοράς;
 *
 * Η Supabase βάζει τα στοιχεία στο fragment του URL, μετά το #, ώστε να μη
 * φτάνουν ποτέ στον server σε logs ή σε referrer headers.
 */
export const isRecoveryLink = (): boolean =>
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

/** Παρακολούθηση συνεδρίας. Επιστρέφει συνάρτηση αποσύνδεσης του listener. */
export function onSessionChange(callback: (session: Session | null) => void): () => void {
  getSupabase().auth.getSession().then(({ data }) => callback(data.session));
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
