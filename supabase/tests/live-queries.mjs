// Runs the app's exact PostgREST selects against the configured Supabase project with the public key.
// PostgREST validates query structure (embeds, columns) before RLS, so this catches broken selects
// without signing in. Run: npm run check:queries  (reads EXPO_PUBLIC_* from .env.local)
import { existsSync, readFileSync } from 'node:fs';

const envFile = new URL('../../.env.local', import.meta.url);
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (e.g. in .env.local).');
  process.exit(1);
}

const src = readFileSync(new URL('../../src/data/supabase/supabaseRepository.ts', import.meta.url), 'utf8');
const select = (name) => {
  const marker = `const ${name} = \``;
  const start = src.indexOf(marker) + marker.length;
  return src.slice(start, src.indexOf('`', start)).replace(/\s+/g, ' ').trim();
};

const checks = {
  events: `events?select=${encodeURIComponent(select('EVENT_SELECT'))}&limit=1`,
  groups: `groups?select=${encodeURIComponent(select('GROUP_SELECT'))}&limit=1`,
  notifications: `notifications?select=${encodeURIComponent('id, type, title, body, data, created_at, read_at, actor:profiles!notifications_actor_id_fkey(id, display_name, avatar_url)')}&limit=1`,
  profile: 'profiles?select=id,display_name,avatar_url,username,bio,discoverability,onboarded_at&limit=1',
  prefs: 'notification_preferences?select=*&limit=1',
  subscriptions: 'subscriptions?select=tier&limit=1',
};

let failed = 0;
for (const [name, path] of Object.entries(checks)) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const body = await res.text();
  if (res.ok) {
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✖ ${name} (${res.status}) ${body.slice(0, 300)}`);
  }
}
console.log(failed ? `\n${failed} query check(s) failed` : '\nAll queries valid');
process.exit(failed ? 1 : 0);
