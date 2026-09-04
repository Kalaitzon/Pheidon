-- Ενημέρωση υπάρχουσας βάσης.
--
-- Σε αντίθεση με το schema.sql, αυτό το αρχείο τρέχει ΟΣΕΣ ΦΟΡΕΣ ΘΕΛΕΙΣ χωρίς
-- σφάλμα. Κάθε εντολή ελέγχει πρώτα αν χρειάζεται.
--
-- Χρήση: Supabase Dashboard -> SQL Editor -> επικόλληση -> Run.

/* ================================================================== */
/* 1. Πίνακες που ίσως λείπουν                                        */
/* ================================================================== */

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('income', 'expense')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR',
  category_id uuid not null references public.categories(id) on delete restrict,
  frequency text not null check (frequency in ('monthly', 'bimonthly', 'quarterly', 'yearly')),
  day_of_month integer not null,
  start_month text not null,
  end_month text,
  note text,
  active boolean not null default true,
  last_generated_month text,
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
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

create table if not exists public.trip_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount_cents integer not null check (amount_cents > 0),
  date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists trip_entries_trip_idx on public.trip_entries (trip_id);

/* ================================================================== */
/* 2. Το όριο της ημέρας: από 28 σε 31                                */
/*                                                                    */
/* Αν ο πίνακας φτιάχτηκε με παλιότερη έκδοση, το παλιό όριο απορρίπτει*/
/* κάθε πάγιο μετά την 28η. Αφαιρούμε τον παλιό κανόνα και βάζουμε νέο.*/
/* ================================================================== */

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.recurring_rules'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%day_of_month%'
  loop
    execute format('alter table public.recurring_rules drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.recurring_rules
  add constraint recurring_rules_day_of_month_check
  check (day_of_month between 1 and 31);

/* ================================================================== */
/* 2β. Η συχνότητα: προσθήκη του «κάθε 2 μήνες»                       */
/*                                                                    */
/* Ο παλιός κανόνας δεχόταν μόνο monthly, quarterly και yearly, οπότε  */
/* απορρίπτει κάθε δίμηνο πάγιο.                                       */
/* ================================================================== */

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.recurring_rules'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%frequency%'
  loop
    execute format('alter table public.recurring_rules drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.recurring_rules
  add constraint recurring_rules_frequency_check
  check (frequency in ('monthly', 'bimonthly', 'quarterly', 'yearly'));

/* ================================================================== */
/* 3. Row Level Security                                              */
/*                                                                    */
/* Το enable είναι ασφαλές να ξανατρέξει. Τα policies τα σβήνουμε      */
/* πρώτα, γιατί το create policy δεν δέχεται "if not exists".          */
/* ================================================================== */

alter table public.recurring_rules enable row level security;
alter table public.trips           enable row level security;
alter table public.trip_entries    enable row level security;

drop policy if exists "own recurring rules" on public.recurring_rules;
create policy "own recurring rules" on public.recurring_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own trips" on public.trips;
create policy "own trips" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own trip entries" on public.trip_entries;
create policy "own trip entries" on public.trip_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* ================================================================== */
/* 4. Επαλήθευση                                                      */
/*                                                                    */
/* Το αποτέλεσμα πρέπει να δείχνει 8 πίνακες, όλους με secured = true. */
/* ================================================================== */

select tablename, rowsecurity as secured
from pg_tables
where schemaname = 'public'
order by tablename;
