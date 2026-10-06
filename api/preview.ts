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
  return {
    title: `${v.organizer?.name ?? 'Noen'} inviterer deg til ${v.event.title}`,
    description: v.event.status === 'polling' ? 'Trykk og marker dagene du ikke kan – du trenger ikke appen.' : 'Trykk for å se invitasjonen og svare.',
    image: v.event.cover_image_url || FALLBACK_IMAGE,
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind');
  const token = params.get('token') ?? '';
  const path = `/${kind === 'g' ? 'g' : 'i'}/${encodeURIComponent(token)}`;

  let card: Card | null = null;
  if (/^[A-Za-z0-9-]{8,64}$/.test(token)) {
    try {
      card = kind === 'g' ? await groupCard(token) : await eventCard(token);
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
