-- Step 7, on purpose: anyone signed in may read every goal, to watch the two-user test fail. Restored right after.
alter policy "Read own goals" on public.goals using (true);
