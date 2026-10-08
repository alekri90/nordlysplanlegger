-- Nordlys Planlegger — the "poker" theme is now "games" (Spillkveld: card and board games)
--
-- The app has more themes now and no longer uses the id "poker". Existing events and groups keep
-- their own cover photo; only the theme id changes so icons and suggestions keep working.

update public.events set category = 'games' where category = 'poker';
update public.groups set default_category = 'games' where default_category = 'poker';
