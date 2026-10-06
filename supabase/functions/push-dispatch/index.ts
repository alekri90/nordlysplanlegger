// Supabase Edge Function: push-dispatch
//
// Triggered by a Database Webhook on INSERT into public.notifications.
// Looks up the recipient's push tokens and preferences and sends via the Expo Push API.
//
// Secrets (set with `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  – provided automatically
//   PUSH_WEBHOOK_SECRET                      – shared secret sent by the webhook as `x-webhook-secret`
//   EXPO_ACCESS_TOKEN                        – optional, if push security is enabled in Expo

import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  event_id: string | null;
  group_id: string | null;
};

type WebhookPayload = { type: 'INSERT'; table: string; record: NotificationRow };

// Which preference column controls which notification type.
const PREFERENCE_FOR_TYPE: Record<string, string> = {
  invited: 'invites',
  response_received: 'responses',
  all_can: 'responses',
  reminder_respond: 'reminders',
  event_reminder: 'reminders',
  date_locked: 'date_locked',
  event_updated: 'date_locked',
  event_cancelled: 'date_locked',
  group_nudge: 'group_nudges',
};

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = (await req.json()) as WebhookPayload;
  const n = payload.record;
  if (payload.table !== 'notifications' || !n?.user_id) {
    return new Response('ignored', { status: 200 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const prefColumn = PREFERENCE_FOR_TYPE[n.type];
  if (prefColumn) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select(prefColumn)
      .eq('user_id', n.user_id)
      .maybeSingle();
    if (prefs && (prefs as Record<string, boolean>)[prefColumn] === false) {
      return new Response('muted', { status: 200 });
    }
  }

  const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', n.user_id);
  if (!tokens?.length) return new Response('no tokens', { status: 200 });

  const messages = tokens.map(({ token }) => ({
    to: token,
    title: n.title,
    body: n.body ?? undefined,
    sound: 'default',
    data: { ...(n.data ?? {}), notificationId: n.id },
    channelId: 'default',
  }));

  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoToken) headers.authorization = `Bearer ${expoToken}`;

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  const result = await res.json();

  // Remove tokens Expo reports as no longer registered.
  const tickets: Array<{ status: string; details?: { error?: string } }> = result?.data ?? [];
  const stale = tickets
    .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? tokens[i].token : null))
    .filter((t): t is string => !!t);
  if (stale.length) await supabase.from('push_tokens').delete().in('token', stale);

  await supabase.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', n.id);

  return new Response(JSON.stringify({ sent: messages.length, stale: stale.length }), {
    headers: { 'content-type': 'application/json' },
  });
});
