-- Nordlys Planlegger — «venteliste»: wants to come, but the event is full.
-- On its own so the new value is committed before the next migration uses it.
alter type public.invite_status add value if not exists 'waitlisted';
