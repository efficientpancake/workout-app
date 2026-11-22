-- Fifth Gear Fitness database. Paste all of this into Supabase:
-- SQL Editor > New query > paste > Run. Safe to run once on a new project.
-- Every table is private: each row can only be read or changed by the
-- signed-in user who owns it (row level security).

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  units text not null default 'metric',
  sex text,
  age int,
  height_cm numeric,
  weight_kg numeric,
  activity text,
  pace_kg_week numeric,
  calorie_target int,
  protein_target int,
  fiber_target int,
  updated_at timestamptz not null default now()
);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_on date not null,
  food jsonb not null,
  amount numeric not null,
  unit text not null,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  sugar numeric,
  fiber numeric,
  salt numeric,
  created_at timestamptz not null default now()
);

create index food_entries_user_day on public.food_entries (user_id, eaten_on);

-- Foods you star, with the amount you usually have.
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food jsonb not null,
  amount numeric not null,
  unit text not null,
  created_at timestamptz not null default now()
);

-- For stage 2 (workout burn and manual activity).
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  done_on date not null,
  name text not null,
  minutes numeric,
  calories numeric,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create index activities_user_day on public.activities (user_id, done_on);

-- Meals you build from several foods. items is a list of
-- { food, amount, unit }; servings is how many servings the meal makes.
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  servings numeric not null default 1,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- The weekly plan: a meal (meal_id) or a single food (food) on a day.
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_on date not null,
  meal_id uuid references public.meals (id) on delete cascade,
  food jsonb,
  amount numeric not null,
  unit text not null,
  logged boolean not null default false,
  created_at timestamptz not null default now()
);

create index plan_items_user_day on public.plan_items (user_id, plan_on);

-- The shopping list. from_plan rows are rebuilt from the plan; the rest
-- are items you typed in.
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  amount text,
  checked boolean not null default false,
  from_plan boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.meals enable row level security;
alter table public.plan_items enable row level security;
alter table public.shopping_items enable row level security;

create policy "own meals" on public.meals
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own plan" on public.plan_items
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own shopping" on public.shopping_items
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.profiles enable row level security;
alter table public.food_entries enable row level security;
alter table public.activities enable row level security;
alter table public.favorites enable row level security;

create policy "own favorites" on public.favorites
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own profile" on public.profiles
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own food" on public.food_entries
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own activities" on public.activities
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Two-step sign-in, enforced by the database too: a password alone can't read
-- or change anything. Every table also needs a session that passed the
-- authenticator code (aal2). "as restrictive" means this rule must pass on top
-- of the "own ..." rules above.
create policy "needs code" on public.profiles as restrictive to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2') with check ((select auth.jwt()->>'aal') = 'aal2');
create policy "needs code" on public.food_entries as restrictive to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2') with check ((select auth.jwt()->>'aal') = 'aal2');
create policy "needs code" on public.favorites as restrictive to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2') with check ((select auth.jwt()->>'aal') = 'aal2');
create policy "needs code" on public.activities as restrictive to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2') with check ((select auth.jwt()->>'aal') = 'aal2');
create policy "needs code" on public.meals as restrictive to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2') with check ((select auth.jwt()->>'aal') = 'aal2');
create policy "needs code" on public.plan_items as restrictive to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2') with check ((select auth.jwt()->>'aal') = 'aal2');
create policy "needs code" on public.shopping_items as restrictive to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2') with check ((select auth.jwt()->>'aal') = 'aal2');
