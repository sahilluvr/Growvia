-- v056: every mailbox belongs to one project, so a project's emails only ever go from its own address.
alter table public.mailboxes add column if not exists business_id uuid references public.businesses(id) on delete set null;
create index if not exists mailboxes_business_idx on public.mailboxes(business_id);

-- Owners with exactly one project: their mailboxes obviously belong to it.
update public.mailboxes m set business_id = b.id
from public.businesses b
where m.business_id is null and b.owner_id = m.owner_id
  and (select count(*) from public.businesses x where x.owner_id = m.owner_id) = 1;
