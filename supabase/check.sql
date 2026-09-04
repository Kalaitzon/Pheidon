-- Διαγνωστικό: τι υπάρχει πραγματικά στη βάση σου.
--
-- Τρέξε το στο SQL Editor της Supabase. Αν κάποιος πίνακας λείπει από το πρώτο
-- αποτέλεσμα, τότε το schema.sql που έτρεξες ήταν παλιότερη έκδοση και πρέπει
-- να τρέξεις ξανά μόνο τα κομμάτια που λείπουν.

-- 1. Ποιοι πίνακες υπάρχουν και αν είναι κλειδωμένοι.
--    Περιμένουμε 8 γραμμές, όλες με rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- 2. Το όριο της ημέρας στα πάγια.
--    Αν λέει "between 1 and 28", η βάση σου είναι παλιά και απορρίπτει
--    οτιδήποτε πάνω από 28.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.recurring_rules'::regclass
  and contype = 'c';
