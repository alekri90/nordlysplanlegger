/**
 * Link previews for invite links (Vercel function). The web app is a single-page app with one
 * static index.html, so Snapchat, Messenger, iMessage and WhatsApp would all show the same generic
 * card. Link-preview bots are routed here instead (see vercel.json) and get a card that says who
 * invites to what, with the picture. People always get the app itself.
 */

const SITE = 'Nordlys Planlegger';
const FALLBACK_IMAGE = 'https://nordlysplanlegger.vercel.app/icon-512.png';

type Card = { title: string; description: string; image: string };

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function rpc(name: string, args: Record<string, unknown>) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return res.ok ? res.json() : null;
}

async function groupCard(token: string): Promise<Card | null> {
  const v = await rpc('get_group_invite', { p_token: token });
  if (!v?.group) return null;
  const name = `${v.group.emoji ? `${v.group.emoji} ` : ''}${v.group.name}`;
  const others = Math.max(0, (v.member_count ?? 1) - 1);
  return {
    title: `${v.inviter?.name ?? 'Noen'} inviterer deg til ${name}`,
    description: others ? `${v.inviter?.name ?? 'Noen'} og ${others} ${others === 1 ? 'annen' : 'andre'} er med. Trykk for å bli med i gjengen.` : 'Trykk for å bli med i gjengen.',
    image: v.group.image_url || FALLBACK_IMAGE,
  };
}

async function eventCard(token: string): Promise<Card | null> {
  const v = await rpc('get_invite', { p_token: token, p_guest_secret: null });
  if (!v?.event) return null;
  const activity = await rpc('get_invite_activity', { p_token: token }).catch(() => null);
  const theme: string | null = activity?.theme ?? null;
  return {
    title: `${v.organizer?.name ?? 'Noen'} inviterer deg til ${v.event.title}`,
    description: `${theme ? `Tema: ${theme}. ` : ''}${v.event.status === 'polling' ? 'Trykk og marker dagene du ikke kan – du trenger ikke appen.' : `${v.event.selected_date ? `${day(v.event.selected_date)}. ` : ''}Trykk og si om du kommer – du trenger ikke appen.`}`,
    image: v.event.cover_image_url || FALLBACK_IMAGE,
  };
}

const MONTHS = ['jan.', 'feb.', 'mars', 'april', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];
const day = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d}. ${MONTHS[m - 1]}`; };
const daysLine = (dates: string[]) => (dates.length <= 3 ? dates.map(day).join(', ') : `${dates.length} datoer fra ${day(dates[0])}`);

/** «Emma spør om du vil være badstumester på Aufguss» – the sauna master link. */
async function roleCard(token: string): Promise<Card | null> {
  const v = await rpc('get_role_request', { p_token: token });
  if (!v?.title) return null;
  const org = v.organizer?.name ?? 'Noen';
  const dates: string[] = (v.dates ?? []).filter((d: { cancelled?: boolean }) => !d.cancelled).map((d: { date: string }) => d.date);
  return {
    title: `${org} spør om du vil være ${v.role_label ?? 'med'} på ${v.title}`,
    description: `${dates.length ? daysLine(dates) : ''}${v.place_name ? `${dates.length ? ' · ' : ''}${v.place_name}` : ''}. Trykk og svar på hver dato – du trenger ikke appen.`.replace(/^\. /, ''),
    image: FALLBACK_IMAGE,
  };
}

/** «Emma lurer på hvilke dager som passer for Middag» – the check-with-someone-first link. */
async function clearanceCard(token: string): Promise<Card | null> {
  const v = await rpc('get_date_clearance', { p_token: token });
  if (!v?.title) return null;
  const org = v.organizer?.name ?? 'Noen';
  const dates: string[] = (v.days ?? []).map((d: { date: string }) => d.date);
  return {
    title: `${org} lurer på hvilke dager som passer for ${v.title}`,
    description: `${dates.length ? `${daysLine(dates)}. ` : ''}Kryss av dagene som passer – du trenger ikke appen.`,
    image: v.cover_image_url || FALLBACK_IMAGE,
  };
}

const CARDS: Record<string, (token: string) => Promise<Card | null>> = { g: groupCard, i: eventCard, r: roleCard, a: clearanceCard };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind');
  const token = params.get('token') ?? '';
  const make = CARDS[kind ?? ''] ?? eventCard;
  const path = `/${kind && CARDS[kind] ? kind : 'i'}/${encodeURIComponent(token)}`;

  let card: Card | null = null;
  if (/^[A-Za-z0-9-]{8,64}$/.test(token)) {
    try {
      card = await make(token);
    } catch {
      card = null;
    }
  }
  card ??= { title: SITE, description: 'Få gjengen samlet. Trykk på dagene du ikke kan – ferdig.', image: FALLBACK_IMAGE };

  const pageUrl = `${new URL(request.url).origin}${path}`;
  const html = `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="utf-8" />
<title>${escape(card.title)}</title>
<meta name="description" content="${escape(card.description)}" />
<meta property="og:site_name" content="${SITE}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escape(pageUrl)}" />
<meta property="og:title" content="${escape(card.title)}" />
<meta property="og:description" content="${escape(card.description)}" />
<meta property="og:image" content="${escape(card.image)}" />
<meta name="twitter:card" content="summary_large_image" />
</head>
<body><a href="${escape(path)}?web=1">${escape(card.title)}</a></body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
  });
}
