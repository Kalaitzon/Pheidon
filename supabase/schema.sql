-- Finance Tracker — schema για Supabase (Postgres)
--
-- Το σημαντικό αρχείο ολόκληρου του project. Τα RLS policies στο τέλος είναι
-- αυτά που κάνουν την εφαρμογή πολυχρηστική με ασφάλεια: χωρίς αυτά, ο κάθε
-- συνδεδεμένος χρήστης μπορεί να διαβάσει τα έξοδα όλων των υπολοίπων.
--
-- Εκτέλεση: Supabase Dashboard -> SQL Editor -> επικόλληση -> Run.

/* ================================================================== */
/* Ρυθμίσεις χρήστη                                                    */
/* ================================================================== */

create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'EUR',
  locale text not null default 'el',
  theme text not null default 'system',
  buffer_ratio numeric not null default 0.05,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* ================================================================== */
/* Κατηγορίες                                                          */
/* ================================================================== */

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  custom_name text,
  kind text not null check (kind in ('income', 'expense', 'both')),
  parent_id uuid references public.categories(id) on delete set null,
  is_group boolean not null default false,
  icon text not null default 'circle',
  color text not null default 'var(--cat-2)',
  flexibility text not null check (flexibility in ('fixed', 'semi_flexible', 'flexible')),
  user_protected boolean not null default false,
  monthly_budget_cents integer,
  archived boolean not null default false,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Κάθε χρήστης έχει το δικό του αντίγραφο των προεπιλεγμένων κατηγοριών,
-- ώστε να μπορεί να τις μετονομάσει χωρίς να επηρεάσει κανέναν άλλον.
create unique index categories_user_slug_idx
  on public.categories (user_id, slug)
  where is_system = true;

create index categories_user_idx on public.categories (user_id, archived);

/* ================================================================== */
/* Συναλλαγές                                                          */
/* ================================================================== */

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  -- Ακέραιες υποδιαιρέσεις, πάντα θετικές. Το πρόσημο το δίνει το kind.
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  category_id uuid not null references public.categories(id) on delete restrict,
  date date not null,
  note text,
  merchant text,
  payment_method text check (payment_method in ('cash', 'card', 'bank', 'other')),
  tags text[],
  recurring_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Τα ερωτήματα είναι σχεδόν πάντα «οι συναλλαγές μου σε αυτό το διάστημα».
create index transactions_user_date_idx on public.transactions (user_id, date desc);
create index transactions_category_idx on public.transactions (category_id);

/* ================================================================== */
/* Αναμενόμενα έσοδα και στόχοι                                        */
/* ================================================================== */

create table public.income_expectations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  monthly_amount_cents integer not null check (monthly_amount_cents >= 0),
  start_month text not null,           -- 'YYYY-MM'
  end_month text,                      -- null = χωρίς λήξη
  confidence text not null check (confidence in ('confirmed', 'likely', 'uncertain')),
  source text not null default 'other',
  created_at timestamptz not null default now()
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('income', 'expense')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  category_id uuid not null references public.categories(id) on delete restrict,
  frequency text not null check (frequency in ('monthly', 'bimonthly', 'quarterly', 'yearly')),
  -- Επιτρέπονται 1-31. Αν η ημέρα δεν υπάρχει στον μήνα, ο κώδικας πέφτει
  -- στην τελευταία ημέρα του, όπως κάνει και μια πάγια τραπεζική εντολή.
  day_of_month integer not null check (day_of_month between 1 and 31),
  start_month text not null,
  end_month text,
  note text,
  active boolean not null default true,
  last_generated_month text,
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  destination text,
  start_date date not null,
  end_date date,
  budget_cents integer,
  currency text not null default 'EUR',
  target_category_id uuid not null references public.categories(id) on delete restrict,
  status text not null default 'active' check (status in ('planning', 'active', 'closed')),
  settled_transaction_id uuid,
  created_at timestamptz not null default now()
);

create table public.trip_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount_cents integer not null check (amount_cents > 0),
  date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index trip_entries_trip_idx on public.trip_entries (trip_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_amount_cents integer not null check (target_amount_cents > 0),
  saved_amount_cents integer not null default 0,
  start_date date not null,
  target_date date not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  strategy text not null default 'balanced'
    check (strategy in ('conservative', 'balanced', 'aggressive')),
  protected_category_ids uuid[],
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

/* ================================================================== */
/* Αυτόματο updated_at                                                 */
/* ================================================================== */

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

/* ================================================================== */
/* ROW LEVEL SECURITY                                                  */
/*                                                                     */
/* Χωρίς αυτό το κομμάτι, οποιοσδήποτε συνδεδεμένος χρήστης διαβάζει   */
/* τα δεδομένα όλων. Το κλειδί anon του frontend είναι δημόσιο, οπότε  */
/* η προστασία γίνεται ΕΔΩ και μόνο εδώ.                              */
/* ================================================================== */

alter table public.settings            enable row level security;
alter table public.categories          enable row level security;
alter table public.transactions        enable row level security;
alter table public.income_expectations enable row level security;
alter table public.recurring_rules     enable row level security;
alter table public.trips               enable row level security;
alter table public.trip_entries        enable row level security;
alter table public.goals               enable row level security;

-- Ένα policy ανά πίνακα, για όλες τις πράξεις.
-- `using` ελέγχει τι βλέπεις, `with check` τι επιτρέπεται να γράψεις:
-- χωρίς το δεύτερο, κάποιος θα μπορούσε να εισάγει γραμμή με ξένο user_id.

create policy "own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own income expectations" on public.income_expectations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own recurring rules" on public.recurring_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own trips" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own trip entries" on public.trip_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* ================================================================== */
/* Έλεγχος                                                             */
/*                                                                     */
/* Μετά την εκτέλεση, τρέξε αυτό. Πρέπει να επιστρέψει 8 γραμμές με    */
/* rowsecurity = true. Αν κάποια είναι false, ο πίνακας είναι ανοιχτός.*/
/* ================================================================== */

-- select tablename, rowsecurity from pg_tables
-- where schemaname = 'public' order by tablename;
