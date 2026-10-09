// Database tests: runs all migrations on real Postgres (PGlite/WASM) with minimal Supabase stubs,
// then checks usernames, friendships, privacy, groups, guest links and claiming. Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const MIG = new URL('../migrations/', import.meta.url);
const db = new PGlite({ extensions: { pg_trgm, pgcrypto } });

const stubs = `
create schema extensions;
create schema auth;
create schema storage;
create role anon nologin; create role authenticated nologin;
grant usage on schema public, extensions to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
`;

await db.exec(stubs);
for (const f of readdirSync(MIG).filter((x) => x.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(new URL(f, MIG), 'utf8'));
    console.log('✔ migrated', f);
  } catch (e) {
    console.error('✖', f, e.message, e.position ?? '', e.where ?? '');
    process.exit(1);
  }
}

// ---------- helpers ----------
const q = async (sql, params) => (await db.query(sql, params)).rows;
const as = async (uid) => db.exec(`set request.jwt.claim.sub = '${uid ?? ''}'`);
const newUser = async (email, meta) =>
  (await q(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, meta]))[0].id;
let failures = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log('  ✔', name);
  } catch (e) {
    failures++;
    console.log('  ✖', name, '→', e.message);
  }
};

console.log('\nUsernames');
const alex = await newUser('alexander@example.com', { display_name: 'Alexander Kristensen', username: '@AlexK' });
const marius = await newUser('marius@example.com', { full_name: 'Marius Olsen' });
const thomas = await newUser('thomas@example.com', { display_name: 'Thomas Berg', username: 'thomas' });
const nora = await newUser('nora@example.com', { display_name: 'Nora Lie', username: 'nora' });

await check('signup keeps chosen username, normalized, onboarded', async () => {
  const [p] = await q(`select username, username_normalized, onboarded_at from profiles where id = $1`, [alex]);
  assert.equal(p.username, 'AlexK');
  assert.equal(p.username_normalized, 'alexk');
  assert.ok(p.onboarded_at);
});
await check('OAuth-style signup gets generated username from name', async () => {
  const [p] = await q(`select username_normalized, onboarded_at from profiles where id = $1`, [marius]);
  assert.match(p.username_normalized, /^mariusolsen/);
  assert.equal(p.onboarded_at, null);
});
await check('code login without a name never exposes the e-mail address', async () => {
  const id = await newUser('alekri90@example.com', {});
  const [p] = await q(`select display_name, username_normalized, onboarded_at from profiles where id = $1`, [id]);
  assert.equal(p.display_name, '');
  assert.ok(!p.username_normalized.includes('alekri'));
  assert.equal(p.onboarded_at, null); // → profile setup asks for a real name
});
await check('case-insensitive uniqueness enforced in the database', async () => {
  await as(thomas);
  await assert.rejects(q(`update profiles set username = 'ALEXK' where id = $1`, [thomas]), /duplicate key|unique/);
});
await check('reserved, prefixed-reserved, blocked, invalid rejected', async () => {
  for (const bad of ['admin', 'support_team', 'Help', 'ab', 'alex k', '.alex', 'al..ex', 'x'.repeat(25), 'fuckface']) {
    await assert.rejects(q(`update profiles set username = $2 where id = $1`, [thomas, bad]), /username_/, bad);
  }
});
await check('allowed formats', async () => {
  for (const ok of ['alex.k2', 'kort_petter', '@Thomas90']) {
    await q(`update profiles set username = $2 where id = $1`, [thomas, ok]);
  }
  await q(`update profiles set username = 'thomas' where id = $1`, [thomas]);
});
await check('check_username: available / taken with suggestions (anon)', async () => {
  await as(null);
  const [{ r: free }] = await q(`select check_username('@Kortpetter') r`);
  assert.equal(free.available, true);
  assert.equal(free.normalized, 'kortpetter');
  const [{ r: taken }] = await q(`select check_username('AlexK', 'Alexander Kristensen') r`);
  assert.equal(taken.available, false);
  assert.equal(taken.reason, 'taken');
  assert.ok(taken.suggestions.length >= 2, JSON.stringify(taken));
  const [{ r: own }] = await (async () => { await as(alex); return q(`select check_username('alexk') r`); })();
  assert.equal(own.available, true, 'own username counts as available');
  const [{ r: res }] = await q(`select check_username('admin') r`);
  assert.equal(res.reason, 'reserved');
});

console.log('\nFriendships & privacy');
await check('request → pending, accept → friends, notifications', async () => {
  await as(marius);
  const [{ s }] = await q(`select send_friend_request($1) s`, [alex]);
  assert.equal(s, 'outgoing');
  await as(alex);
  const reqs = await q(`select * from list_friend_requests()`);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].id, marius);
  const [{ s: s2 }] = await q(`select respond_friend_request($1, true) s`, [reqs[0].request_id]);
  assert.equal(s2, 'friends');
  const friends = await q(`select * from list_friends()`);
  assert.deepEqual(friends.map((f) => f.id), [marius]);
  const n = await q(`select type from notifications where user_id in ($1, $2) order by created_at`, [alex, marius]);
  assert.deepEqual(n.map((x) => x.type).sort(), ['friend_accepted', 'friend_request']);
});
await check('reverse request auto-accepts; duplicate pair impossible', async () => {
  await as(thomas);
  await q(`select send_friend_request($1)`, [nora]);
  await as(nora);
  const [{ s }] = await q(`select send_friend_request($1) s`, [thomas]);
  assert.equal(s, 'friends');
  assert.equal((await q(`select count(*)::int c from friendships`))[0].c, 2);
});
await check('only addressee can answer; client cannot insert/update directly', async () => {
  await as(alex);
  await q(`select send_friend_request($1)`, [thomas]);
  const [{ id }] = await q(`select id from friendships where requester_id = $1 and addressee_id = $2`, [alex, thomas]);
  await assert.rejects(q(`select respond_friend_request($1, true)`, [id]), /request_not_found/);
  await db.exec('set role authenticated');
  await assert.rejects(q(`insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')`, [alex, nora]), /row-level security/);
  const updated = await q(`update friendships set status = 'accepted' where id = $1 returning id`, [id]);
  assert.equal(updated.length, 0, 'no update policy');
  await db.exec('reset role');
});
await check('ignored request still looks pending to sender', async () => {
  await as(thomas);
  const [{ request_id }] = await q(`select request_id from list_friend_requests()`);
  await q(`select respond_friend_request($1, false)`, [request_id]);
  await as(alex);
  assert.equal((await q(`select friendship_state($1) s`, [thomas]))[0].s, 'outgoing');
});
await check('discoverability: nobody hides from search and profile; friends still see', async () => {
  await as(nora);
  await q(`update profiles set discoverability = 'nobody' where id = $1`, [nora]);
  await as(alex);
  assert.equal((await q(`select * from search_people('nora')`)).length, 0);
  assert.equal((await q(`select get_public_profile('nora') p`))[0].p, null);
  await as(thomas); // friend of nora
  assert.equal((await q(`select * from search_people('@nora')`)).length, 1);
});
await check('friends_of_friends: visible only with a mutual friend', async () => {
  await as(nora);
  await q(`update profiles set discoverability = 'friends_of_friends' where id = $1`, [nora]);
  await as(marius); // marius–alex friends, alex not friends with nora → no mutual
  assert.equal((await q(`select * from search_people('nora')`)).length, 0);
  await as(nora);
  await q(`select send_friend_request($1)`, [alex]);
  await as(alex);
  await q(`select send_friend_request($1)`, [nora]); // accepts
  await as(marius); // now mutual friend alex
  const r = await q(`select * from search_people('Nora')`);
  assert.equal(r.length, 1);
  assert.equal(r[0].mutual_friends, 1);
});
await check('profiles table never exposes e-mail; RLS select respects visibility', async () => {
  const cols = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='profiles'`)).map((c) => c.column_name);
  assert.ok(!cols.includes('email') && !cols.includes('phone'));
  await as(nora);
  await q(`update profiles set discoverability = 'nobody' where id = $1`, [nora]);
  await as(marius);
  await db.exec('set role authenticated');
  const visible = (await q(`select id from profiles`)).map((r) => r.id);
  await db.exec('reset role');
  assert.ok(!visible.includes(nora), 'nora hidden from marius');
  assert.ok(visible.includes(alex));
});
await check('public profile: mutual friends, anonymous view of an "everyone" profile', async () => {
  await as(marius);
  const [{ p }] = await q(`select get_public_profile('@ALEXK') p`);
  assert.equal(p.username, 'AlexK');
  assert.equal(p.friendship, 'friends');
  assert.equal(p.email, undefined);
  await as(null);
  const [{ p: anon }] = await q(`select get_public_profile('alexk') p`);
  assert.equal(anon.friendship, 'anonymous');
});

await check('anonymous visitors cannot list profiles, but an exact /@username link works', async () => {
  await as(null);
  await db.exec('set role anon');
  const rows = await q(`select id from profiles`);
  await db.exec('reset role');
  assert.equal(rows.length, 0, 'no anonymous enumeration');
  assert.ok((await q(`select get_public_profile('alexk') p`))[0].p, 'link still opens');
  assert.equal((await q(`select get_public_profile(null, $1) p`, [alex]))[0].p, null, 'no anonymous lookup by id');
});

console.log('\nGroups');
let poker;
await check('create group with friends + a guest by name; strangers ignored', async () => {
  await as(alex);
  const stranger = await newUser('x@example.com', { display_name: 'Stranger Danger', username: 'stranger' });
  await as(alex);
  const [{ id }] = await q(`select create_group('Kortklubben', '🃏', null, 'Kort hver torsdag', $1, '{}', array['Petter']) id`, [[marius, stranger]]);
  poker = id;
  const members = await q(`select user_id, guest_id, role, display_name from group_members where group_id = $1 order by joined_at`, [poker]);
  assert.equal(members.length, 3, JSON.stringify(members));
  assert.equal(members.filter((m) => m.guest_id).length, 1);
  assert.ok(!members.some((m) => m.user_id === stranger));
  assert.equal(members.find((m) => m.user_id === alex).role, 'owner');
});
await check('members can add, only admins remove others; anyone can leave', async () => {
  await as(marius);
  const [{ n }] = await q(`select add_group_members($1, $2) n`, [poker, [alex]]);
  assert.equal(n, 0, 'already member');
  const [{ id: alexMember }] = await q(`select id from group_members where group_id = $1 and user_id = $2`, [poker, alex]);
  await assert.rejects(q(`select remove_group_member($1)`, [alexMember]), /not_group_admin/);
  await db.exec('set role authenticated');
  const upd = await q(`update groups set name = 'Hacked' where id = $1 returning id`, [poker]);
  await db.exec('reset role');
  assert.equal(upd.length, 0, 'non-admin cannot edit group');
  await q(`select leave_group($1)`, [poker]);
  assert.equal((await q(`select count(*)::int c from group_members where group_id = $1 and user_id = $2`, [poker, marius]))[0].c, 0);
  await as(alex);
  await q(`select add_group_members($1, $2)`, [poker, [marius]]);
});
await check('owner leaving hands over ownership', async () => {
  await as(alex);
  const [{ id }] = await q(`select create_group('Temp', null, null, null, $1) id`, [[marius]]);
  await q(`select leave_group($1)`, [id]);
  const [g] = await q(`select created_by from groups where id = $1`, [id]);
  assert.equal(g.created_by, marius);
});

console.log('\nEvents, guests and claiming');
let eventId, guestToken, publicToken;
await check('create event from group: users + group guest + new guest get personal links', async () => {
  await as(alex);
  const [{ id: petter }] = await q(`select guest_id id from group_members where group_id = $1 and guest_id is not null`, [poker]);
  const [{ r }] = await q(`select create_event($1) r`, [{
    title: 'Kortkveld', category: 'games', date_mode: 'poll', option_dates: ['2026-10-16', '2026-10-17'],
    time_hint: 'evening', group_id: poker, member_user_ids: [marius], guest_ids: [petter], guest_names: ['Kristian'],
  }]);
  eventId = r.event_id;
  publicToken = r.invite_token;
  assert.equal(r.guests.length, 2, JSON.stringify(r));
  guestToken = r.guests.find((g) => g.name === 'Kristian').token;
  const members = await q(`select count(*)::int c from event_members where event_id = $1`, [eventId]);
  assert.equal(members[0].c, 4);
});
let secret;
await check('guest answers via personal link without account (name prefilled)', async () => {
  await as(null);
  const [{ v }] = await q(`select get_invite($1) v`, [guestToken]);
  assert.equal(v.personal, true);
  assert.equal(v.my_response.name, 'Kristian');
  const opt = v.event.options[0].id;
  const [{ r }] = await q(`select submit_guest_response($1, '', $2::uuid[]) r`, [guestToken, [opt]]);
  assert.ok(r.guest_secret);
  secret = r.guest_secret;
  const [{ v: again }] = await q(`select get_invite($1) v`, [guestToken]);
  assert.deepEqual(again.my_response.unavailable_option_ids, [opt]);
});
await check('open-link guest (no personal link) needs a name', async () => {
  await as(null);
  await assert.rejects(q(`select submit_guest_response($1, '', '{}')`, [publicToken]), /name_required/);
  const [{ r }] = await q(`select submit_guest_response($1, 'Marius G', '{}') r`, [publicToken]);
  assert.ok(r.guest_secret);
});
await check('new account claims guest history via device secret (events + groups move)', async () => {
  const kristian = await newUser('kristian@example.com', { display_name: 'Kristian Vik', username: 'kristian' });
  await as(kristian);
  const [{ r }] = await q(`select claim_guest_identity($1) r`, [secret]);
  assert.equal(r.events, 1);
  const [m] = await q(`select user_id, guest_id, status from event_members where event_id = $1 and user_id = $2`, [eventId, kristian]);
  assert.equal(m.status, 'responded');
  assert.equal(m.guest_id, null);
  const [{ r: again }] = await q(`select claim_guest_identity($1) r`, [secret]);
  assert.equal(again.events, 0, 'secret is single-use');
  assert.equal((await q(`select is_event_member($1) b`, [eventId]))[0].b, true);
});
await check('group guest claims via personal invite link → becomes group member', async () => {
  const [{ token }] = await q(`select i.token from event_invites i join guest_profiles g on g.id = i.guest_profile_id where i.event_id = $1 and g.display_name = 'Petter'`, [eventId]);
  const petter = await newUser('petter@example.com', { display_name: 'Petter Kortsen', username: 'kortpetter' });
  await as(petter);
  const [{ r }] = await q(`select claim_guest_invite($1) r`, [token]);
  assert.equal(r.events, 1);
  assert.equal(r.groups, 1);
  assert.equal((await q(`select count(*)::int c from group_members where group_id = $1 and user_id = $2`, [poker, petter]))[0].c, 1);
});
await check('identities are never linked by name', async () => {
  const other = await newUser('kristian2@example.com', { display_name: 'Kristian', username: 'kristian2' });
  await as(other);
  assert.equal((await q(`select is_event_member($1) b`, [eventId]))[0].b, false);
});
await check('people you may know + smart invite suggestions from own history', async () => {
  await as(marius);
  const pymk = await q(`select * from people_you_may_know()`);
  assert.ok(pymk.length >= 1, 'marius should see people from the card club');
  assert.ok(pymk.every((p) => p.id !== alex), 'friends excluded');
  await as(alex);
  await q(`select create_event($1)`, [{ title: 'Kort igjen', category: 'games', date_mode: 'undecided', time_hint: 'any', member_user_ids: [marius] }]);
  const [{ s }] = await q(`select suggest_invitees('games', 'Kortkveld') s`);
  assert.equal(s.group_id, poker);
  assert.equal(s.people[0].id, marius);
  const recent = await q(`select * from list_recent_people()`);
  assert.ok(recent.some((p) => p.id === marius));
});
await check('lock date + nudges still run on the updated schema', async () => {
  await as(alex);
  const [{ id }] = await q(`select id from event_date_options where event_id = $1 order by date limit 1`, [eventId]);
  await q(`select lock_event_date($1, $2)`, [eventId, id]);
  await as(null);
  await q(`select generate_nudges()`);
});

console.log('\nGroup invite links');
{
  await as(nora);
  const [{ id: band }] = await q(`select create_group('Bandet', '🎸') id`);
  const [{ t: token }] = await q(`select get_group_invite_link($1) t`, [band]);

  await check('one stable link per member; outsiders cannot get one', async () => {
    const [{ t: again }] = await q(`select get_group_invite_link($1) t`, [band]);
    assert.equal(again, token);
    assert.match(token, /^[0-9a-f]{32}$/);
    await as(thomas);
    await assert.rejects(q(`select get_group_invite_link($1)`, [band]), /not_group_member/);
  });
  await check('anyone with the link sees name, inviter and first names only', async () => {
    await as(null);
    const [{ v }] = await q(`select get_group_invite($1) v`, [token]);
    assert.equal(v.group.name, 'Bandet');
    assert.equal(v.inviter.name, 'Nora');
    assert.equal(v.member_count, 1);
    assert.equal(v.is_member, false);
    assert.ok(!JSON.stringify(v).includes('@example.com'));
    assert.equal((await q(`select get_group_invite('nope') v`))[0].v, null);
  });
  await check('joining adds a member once, counts the use and tells the inviter', async () => {
    await as(thomas);
    const [{ g }] = await q(`select join_group_via_invite($1) g`, [token]);
    assert.equal(g, band);
    await q(`select join_group_via_invite($1)`, [token]);
    assert.equal((await q(`select count(*)::int c from group_members where group_id = $1 and user_id = $2`, [band, thomas]))[0].c, 1);
    assert.equal((await q(`select use_count from group_invites where token = $1`, [token]))[0].use_count, 1);
    const [{ v }] = await q(`select get_group_invite($1) v`, [token]);
    assert.equal(v.is_member, true);
    const [n] = await q(`select title from notifications where user_id = $1 and group_id = $2`, [nora, band]);
    assert.equal(n.title, 'Thomas ble med i Bandet');
  });
  await check('joining requires an account', async () => {
    await as(null);
    await assert.rejects(q(`select join_group_via_invite($1)`, [token]), /not_authenticated/);
  });
  await check('link stops working when the inviter leaves', async () => {
    await as(nora);
    await q(`select leave_group($1)`, [band]);
    await as(null);
    assert.equal((await q(`select get_group_invite($1) v`, [token]))[0].v, null);
    await as(marius);
    await assert.rejects(q(`select join_group_via_invite($1)`, [token]), /invite_not_found/);
  });
}

console.log('\nNames & friendship states');
await check('changing your name updates it on events and groups', async () => {
  await as(thomas);
  await q(`update profiles set display_name = 'Thomas Bergersen' where id = $1`, [thomas]);
  const ev = await q(`select distinct display_name from event_members where user_id = $1`, [thomas]);
  const gr = await q(`select distinct display_name from group_members where user_id = $1`, [thomas]);
  assert.ok(ev.length + gr.length > 0, 'thomas should be on something');
  for (const r of [...ev, ...gr]) assert.equal(r.display_name, 'Thomas Bergersen');
  await q(`update profiles set display_name = 'Thomas Berg' where id = $1`, [thomas]);
});
await check('friendship_states: known people only, with incoming request id', async () => {
  const kari = await newUser('kari@example.com', { display_name: 'Kari Nordmann', username: 'kari' });
  await as(kari);
  await q(`select send_friend_request($1)`, [thomas]);
  await as(thomas);
  const stranger = await newUser('stranger@example.com', { display_name: 'Ukjent Person', username: 'ukjent' });
  await as(thomas);
  const rows = await q(`select * from friendship_states($1::uuid[])`, [[thomas, kari, stranger]]);
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(by[thomas].state, 'self');
  assert.equal(by[kari].state, 'incoming');
  assert.ok(by[kari].request_id);
  assert.equal(by[stranger], undefined, 'strangers are not reported');
  await as(null);
  assert.equal((await q(`select * from friendship_states($1::uuid[])`, [[thomas]])).length, 0);
});

console.log('\nBlocking & reporting');
{
  const ola = await newUser('ola@example.com', { display_name: 'Ola Blokk', username: 'olablokk' });
  const per = await newUser('per@example.com', { display_name: 'Per Plager', username: 'perplager' });
  await as(per);
  await q(`select send_friend_request($1)`, [ola]);

  await check('blocking ends the friendship request and hides the profile both ways', async () => {
    await as(ola);
    await q(`select block_user($1)`, [per]);
    assert.equal((await q(`select count(*)::int c from friendships where requester_id = $1 and addressee_id = $2`, [per, ola]))[0].c, 0);
    assert.equal((await q(`select can_view_profile($1) v`, [per]))[0].v, false);
    assert.equal((await q(`select * from search_people('perplager')`)).length, 0);
    await as(per);
    assert.equal((await q(`select can_view_profile($1) v`, [ola]))[0].v, false);
    assert.equal((await q(`select get_public_profile('olablokk') v`))[0].v, null);
  });
  await check('blocked people cannot send friend requests or add each other', async () => {
    await as(per);
    await assert.rejects(q(`select send_friend_request($1)`, [ola]), /profile_not_found|blocked/);
    assert.equal((await q(`select can_add_person($1) v`, [ola]))[0].v, false);
  });
  await check('list and unblock', async () => {
    await as(ola);
    const list = await q(`select * from list_blocked()`);
    assert.deepEqual(list.map((r) => r.id), [per]);
    await q(`select unblock_user($1)`, [per]);
    assert.equal((await q(`select * from list_blocked()`)).length, 0);
  });
  await check('reports are stored, need a target and an account', async () => {
    await as(ola);
    const [{ id }] = await q(`select report_content('harassment', 'Sender ekle meldinger', $1) id`, [per]);
    const [r] = await q(`select reporter_id, target_user_id, reason, status from content_reports where id = $1`, [id]);
    assert.equal(r.reporter_id, ola);
    assert.equal(r.reason, 'harassment');
    assert.equal(r.status, 'open');
    await assert.rejects(q(`select report_content('spam')`), /check/i);
    await as(null);
    await assert.rejects(q(`select report_content('spam', null, $1)`, [per]), /not_authenticated/);
  });
}

console.log('\nMessages, declines & reminders');
{
  const host = await newUser('host@example.com', { display_name: 'Hilde Vert', username: 'hildevert' });
  const g1 = await newUser('g1@example.com', { display_name: 'Geir En', username: 'geiren' });
  const g2 = await newUser('g2@example.com', { display_name: 'Gro To', username: 'groto' });
  await as(host);
  await q(`select send_friend_request($1)`, [g1]);
  await q(`select send_friend_request($1)`, [g2]);
  for (const u of [g1, g2]) { await as(u); await q(`select send_friend_request($1)`, [host]); }
  await as(host);
  // Saturday 17 Oct 2026 at 18:00, fixed date.
  const [{ r }] = await q(`select create_event($1) r`, [{ title: 'Badstu', category: 'sauna', date_mode: 'fixed', fixed_date: '2026-10-17', time_hint: 'exact', start_time: '18:00', member_user_ids: [g1, g2] }]);
  const ev = r.event_id;
  await q(`update events set start_time = '18:00' where id = $1`, [ev]);
  const notes = async (u, kind) => q(`select title, body from notifications where user_id = $1 and event_id is not distinct from $2 and ($3::text is null or data ->> 'kind' = $3) order by created_at`, [u, ev, kind]);

  await check('only the organizer posts; everyone else is notified', async () => {
    await as(g1);
    await assert.rejects(q(`select post_event_message($1, 'hei')`, [ev]), /not_event_organizer/);
    await as(host);
    await q(`select post_event_message($1, 'Vi møtes ved inngangen')`, [ev]);
    for (const u of [g1, g2]) {
      const n = await q(`select title, body from notifications where user_id = $1 and type = 'event_message'`, [u]);
      assert.equal(n.length, 1);
      assert.equal(n[0].body, 'Vi møtes ved inngangen');
    }
    await assert.rejects(q(`select post_event_message($1, '   ')`, [ev]), /message_empty/);
  });
  await check('organizer sees how many have seen a message; others don\'t', async () => {
    await as(g1);
    await q(`select mark_event_messages_seen($1)`, [ev]);
    const [mine] = await q(`select * from list_event_messages($1)`, [ev]);
    assert.equal(mine.seen_count, null);
    await as(host);
    const [m] = await q(`select * from list_event_messages($1)`, [ev]);
    assert.equal(m.body, 'Vi møtes ved inngangen');
    assert.equal(m.seen_count, 1);
    assert.equal(m.recipient_count, 2);
    const stranger = await newUser('nosy@example.com', { display_name: 'Nysgjerrig', username: 'nosy' });
    await as(stranger);
    assert.equal((await q(`select * from list_event_messages($1)`, [ev])).length, 0);
  });
  await check('"kan ikke likevel" tells the organizer', async () => {
    await as(g2);
    await q(`update event_members set status = 'attending' where event_id = $1 and user_id = $2`, [ev, g2]);
    await q(`update event_members set status = 'declined' where event_id = $1 and user_id = $2`, [ev, g2]);
    const n = await q(`select title from notifications where user_id = $1 and event_id = $2 and type = 'response_received'`, [host, ev]);
    assert.deepEqual(n.map((x) => x.title), ['Gro kan ikke likevel']);
  });
  await check('Monday overview at 08:00 Oslo, once, without people who declined', async () => {
    await as(null);
    await q(`select send_event_reminders('2026-10-12 06:05+00')`); // Mon 08:05 in Oslo (CEST)
    await q(`select send_event_reminders('2026-10-12 06:10+00')`);
    const w = await q(`select body from notifications where user_id = $1 and data ->> 'kind' = 'weekly'`, [g1]);
    assert.equal(w.length, 1);
    assert.equal(w[0].body, 'Badstu · lør kl. 18:00');
    assert.equal((await q(`select 1 from notifications where user_id = $1 and data ->> 'kind' = 'weekly'`, [g2])).length, 0);
  });
  await check('day before at 10:00, two hours before, each once', async () => {
    await q(`select send_event_reminders('2026-10-16 08:05+00')`); // Fri 10:05 Oslo
    await q(`select send_event_reminders('2026-10-16 08:10+00')`);
    assert.deepEqual((await notes(g1, 'day_before')).map((x) => x.title), ['I morgen: Badstu']);
    await q(`select send_event_reminders('2026-10-17 14:00+00')`); // Sat 16:00 Oslo, start 18:00
    await q(`select send_event_reminders('2026-10-17 14:05+00')`);
    const soon = await notes(g1, 'soon');
    assert.equal(soon.length, 1);
    assert.equal(soon[0].body, 'Kl. 18:00');
    assert.equal((await notes(g2, 'soon')).length, 0, 'declined');
  });
  await check('"venter på svaret ditt" after two days, once', async () => {
    await as(host);
    const [{ r: poll }] = await q(`select create_event($1) r`, [{ title: 'Quiz', category: 'quiz', date_mode: 'poll', option_dates: ['2026-11-06', '2026-11-07'], time_hint: 'evening', member_user_ids: [g1] }]);
    await q(`update events set created_at = '2026-10-01' where id = $1`, [poll.event_id]);
    await as(null);
    await q(`select send_event_reminders('2026-10-05 10:00+00')`);
    await q(`select send_event_reminders('2026-10-05 12:00+00')`);
    const n = await q(`select title from notifications where user_id = $1 and event_id = $2 and type = 'reminder_respond'`, [g1, poll.event_id]);
    assert.deepEqual(n.map((x) => x.title), ['Hilde venter på svaret ditt']);
  });
}

console.log('\nAccount deletion');
await check('deleting an account removes their photos and group covers they uploaded', async () => {
  const owner = await newUser('owner@example.com', { display_name: 'Eva Eier', username: 'evaeier' });
  const leaver = await newUser('leaver@example.com', { display_name: 'Lars Går', username: 'larsgar' });
  await as(owner);
  await q(`select send_friend_request($1)`, [leaver]);
  await as(leaver);
  await q(`select send_friend_request($1)`, [owner]);
  await as(owner);
  const [{ id: grp }] = await q(`select create_group('Turgjengen', null, null, null, $1) id`, [[leaver]]);
  const [{ r }] = await q(`select create_event($1) r`, [{ title: 'Tur', category: 'outdoor', date_mode: 'fixed', fixed_date: '2026-10-20', time_hint: 'any', member_user_ids: [leaver] }]);
  await as(leaver);
  await q(`insert into event_images (event_id, url, kind, uploaded_by) values ($1, 'https://x/storage/v1/object/public/covers/${leaver}/a.jpg', 'memory', $2)`, [r.event_id, leaver]);
  await q(`update groups set image_url = 'https://x/storage/v1/object/public/covers/${leaver}/g.jpg' where id = $1`, [grp]);
  await q(`select delete_my_account()`);
  assert.equal((await q(`select count(*)::int c from event_images where event_id = $1`, [r.event_id]))[0].c, 0);
  const [g] = await q(`select image_url from groups where id = $1`, [grp]);
  assert.equal(g.image_url, null);
  assert.equal((await q(`select count(*)::int c from profiles where id = $1`, [leaver]))[0].c, 0);
});

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
