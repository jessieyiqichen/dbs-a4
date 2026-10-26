-- Same rule, written so the performance advisor recognises it: (select auth.jwt()) runs once per query instead of
-- once per row. The first form, (select auth.jwt() ->> 'sub'), already ran once; the advisor only knows this spelling.

alter policy "Read own goals" on public.goals using (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Add own goals" on public.goals with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Change own goals" on public.goals
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Delete own goals" on public.goals using (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Read own entries" on public.entries using (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Add own entries" on public.entries with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Change own entries" on public.entries
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Delete own entries" on public.entries using (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Read own companies" on public.companies using (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Add own companies" on public.companies with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Change own companies" on public.companies
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Delete own companies" on public.companies using (((select auth.jwt()) ->> 'sub') = user_id);

alter policy "Read own saved jobs" on public.saved_jobs using (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Add own saved jobs" on public.saved_jobs with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Change own saved jobs" on public.saved_jobs
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);
alter policy "Delete own saved jobs" on public.saved_jobs using (((select auth.jwt()) ->> 'sub') = user_id);
