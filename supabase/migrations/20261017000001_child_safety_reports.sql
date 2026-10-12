-- Nordlys Planlegger — a report reason of its own for child safety (Google Play CSAE policy).
-- These reports are handled first; confirmed abuse material is removed and reported to the police.

alter table public.content_reports drop constraint if exists content_reports_reason_check;
alter table public.content_reports add constraint content_reports_reason_check
  check (reason in ('spam', 'harassment', 'inappropriate', 'child_safety', 'other'));
