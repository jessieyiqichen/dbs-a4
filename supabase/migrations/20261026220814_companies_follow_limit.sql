-- Security review (2026-10-26): every search fetches each followed company's board, so one person may follow at most
-- 25 companies. Enforced here as well as in the page, so writing to the database directly can't get around it.
-- security invoker: the count runs as the person (RLS applies), and search_path is fixed.
create or replace function public.companies_follow_limit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select count(*) from public.companies where user_id = new.user_id) >= 25 then
    raise exception 'You can follow up to 25 companies' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger companies_follow_limit before insert on public.companies
  for each row execute function public.companies_follow_limit();
