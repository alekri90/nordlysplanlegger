-- Nordlys Planlegger — account deletion also removes the person's pictures
--
-- The app deletes the files themselves (avatars/<uid>/…, covers/<uid>/…) through the Storage API
-- before calling this. Here we remove what still points at them: photos shared on other people's
-- events, and group covers the person uploaded for groups that live on. Otherwise as before.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;

  -- Photos shared on any event, and covers uploaded for groups others keep.
  delete from event_images where uploaded_by = v_uid;
  update groups set image_url = null where image_url like '%/covers/' || v_uid::text || '/%';

  -- Keep the shape of other people's polls, but drop the identity.
  update event_members m set user_id = null, guest_id = null, display_name = 'En gjest'
  where m.user_id = v_uid and m.role = 'guest'
    and exists (select 1 from events e where e.id = m.event_id and e.organizer_id <> v_uid);

  delete from auth.users where id = v_uid;   -- cascades to profile, own events, groups, tokens, notifications
end $$;

-- Listing and removing files through the Storage API also needs SELECT on storage.objects.
-- Only your own folder; the files themselves stay public by URL as before.
create policy "covers: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
