-- Nudge's four tables (data model in AGENTS.md, user-approved 2026-10-21).
-- Every row belongs to one person: user_id is the Clerk user id ("user_..."), filled in by the database from the
-- signed-in person's token (auth.jwt() ->> 'sub'), never sent by the browser. Row-level security on every table lets
-- a signed-in person select, insert, update and delete only rows whose user_id is their own; signed-out visitors
-- (the anon role) get no access at all.

-- goals: a person's goals, in the order they see them (position)
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  verb text not null default '',
  title text not null check (char_length(title) between 1 and 300),
  unit text not null check (char_length(unit) between 1 and 100),
  type text not null check (type in ('by-date', 'daily')),
  target integer not null check (target > 0),
  deadline date,
  link text check (link is null or char_length(link) <= 2000),
  start_date date not null,
  pauses jsonb not null default '[]'::jsonb check (jsonb_typeof(pauses) = 'array'),
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  check (type = 'by-date' or deadline is null),
  -- lets entries point at (goal, owner) together, so an entry can only belong to its owner's goal
  unique (id, user_id)
);

-- saved_jobs: jobs a person saved, with a snapshot so they stay readable after the posting is taken down
create table public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  source text not null check (source in ('greenhouse', 'ashby', 'lever')),
  board_token text not null check (board_token ~ '^[a-z0-9-]{1,64}$'),
  job_id text not null check (char_length(job_id) between 1 and 100),
  title text not null check (char_length(title) between 1 and 300),
  company_name text not null check (char_length(company_name) between 1 and 200),
  location text check (location is null or char_length(location) <= 500),
  url text not null check (url like 'https://%' and char_length(url) <= 2000),
  posted_at timestamptz,
  status text not null default 'saved' check (status in ('saved', 'applied')),
  saved_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (user_id, source, board_token, job_id),
  unique (id, user_id)
);

-- entries: how many were done, per goal per moment; one Applied job adds one entry that points at it
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  goal_id uuid not null,
  saved_job_id uuid,
  date date not null,
  amount integer not null check (amount > 0),
  at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade,
  -- deleting a saved job keeps its entry (they did apply): only saved_job_id is cleared
  foreign key (saved_job_id, user_id) references public.saved_jobs (id, user_id) on delete set null (saved_job_id)
);

-- companies: the companies a person follows
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  source text not null check (source in ('greenhouse', 'ashby', 'lever')),
  board_token text not null check (board_token ~ '^[a-z0-9-]{1,64}$'),
  name text not null check (char_length(name) between 1 and 200),
  added_at timestamptz not null default now(),
  unique (user_id, source, board_token)
);

create index goals_user_id_idx on public.goals (user_id);
create index entries_user_id_idx on public.entries (user_id);
create index entries_goal_id_user_id_idx on public.entries (goal_id, user_id);
create index entries_saved_job_id_user_id_idx on public.entries (saved_job_id, user_id);
create index companies_user_id_idx on public.companies (user_id);
create index saved_jobs_user_id_idx on public.saved_jobs (user_id);

-- Row-level security: the same four rules on every table
alter table public.goals enable row level security;
alter table public.entries enable row level security;
alter table public.companies enable row level security;
alter table public.saved_jobs enable row level security;

create policy "Read own goals" on public.goals for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Add own goals" on public.goals for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Change own goals" on public.goals for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Delete own goals" on public.goals for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Read own entries" on public.entries for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Add own entries" on public.entries for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Change own entries" on public.entries for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Delete own entries" on public.entries for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Read own companies" on public.companies for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Add own companies" on public.companies for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Change own companies" on public.companies for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Delete own companies" on public.companies for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Read own saved jobs" on public.saved_jobs for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "Add own saved jobs" on public.saved_jobs for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Change own saved jobs" on public.saved_jobs for update to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "Delete own saved jobs" on public.saved_jobs for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- Table access: RLS only filters rows a role may already touch, so the signed-in role needs these grants
-- (without them every read fails with 42501). Signed-out visitors get none, and no one gets more than these four
-- (Supabase's defaults would also allow truncate, which skips RLS).
revoke all on table public.goals, public.entries, public.companies, public.saved_jobs from anon, authenticated, public;
grant select, insert, update, delete on table public.goals, public.entries, public.companies, public.saved_jobs to authenticated;
