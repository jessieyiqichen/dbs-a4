-- Step 7: the rule is back, each person reads only their own goals again.
alter policy "Read own goals" on public.goals using (((select auth.jwt()) ->> 'sub') = user_id);
