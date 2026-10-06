-- Nordlys Planlegger — friendship state for several people at once
--
-- Used on a group to offer "Legg til som venn" for members you aren't friends with yet.
-- Only reports on people who share a group or event with you (or are already connected).

create or replace function public.friendship_states(p_user_ids uuid[])
returns table (id uuid, state text, request_id uuid)
language sql stable security definer set search_path = public as $$
  select u.id, friendship_state(u.id),
         (select f.id from friendships f
           where f.status = 'pending' and f.addressee_id = auth.uid() and f.requester_id = u.id)
  from unnest(coalesce(p_user_ids, '{}')) as u(id)
  where auth.uid() is not null
    and (u.id = auth.uid() or shares_context_with(u.id) or friendship_state(u.id) <> 'none');
$$;

revoke all on function public.friendship_states(uuid[]) from public, anon;
grant execute on function public.friendship_states(uuid[]) to authenticated;
