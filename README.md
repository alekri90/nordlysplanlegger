# Nordlys Planlegger

> Få gjengen samlet.

Et produkt fra Nordlys Kapital.

Mobilapp (iOS + Android) og mobilweb for å finne en dato som passer for gjengen.
Arrangøren foreslår dager, gjestene trykker på dagene de **ikke** kan – uten konto –
og appen finner beste dato.

**Stack:** Expo SDK 57 · React Native 0.86 · Expo Router · TypeScript · Supabase
(Auth, Postgres, RLS, Realtime, Storage, Edge Functions) · React Query · Zustand · Reanimated.

Se [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for informasjonsarkitektur, navigasjon og datamodell.

---

## Kom i gang (demodata, ingen backend)

```bash
npm install
npm run web          # eller: npm run ios / npm run android
```

Uten Supabase-nøkler kjører appen på realistiske demodata generert ut fra dagens dato:
Badstu med jentene (låst), Kortkveld (5 av 8 har svart – et nytt svar «kommer inn» live etter
fem sekunder), Middag (dato ikke bestemt), en Padel-invitasjon fra Sofie og fire gjenger.
Innlogging simuleres.

Prøv:

| Flyt | Hvor |
|---|---|
| Lag noe → finn dato → inviter → (logg inn) → sendt | «Planlegg noe» på velkomstskjermen |
| Resultater live → lås dato → «Vi har en dato!» | Hjem → Kortkveld |
| Gjest uten konto svarer i nettleseren | Logg ut, åpne `/i/kortkveld-demo` |
| Ett trykk til neste gang | Gjenger → Familien → «Finn neste dato» |
| Gjest → profil → venn | Logg ut, åpne `/i/kortkveld-demo`, svar, «Opprett profil», «Legg til Emma» |
| Venner, forespørsler, søk | Profil → Venner (prøv å søke «thomas»), eller `/@thomas` |
| Gjeng med gjester uten konto | Gjenger → Kortklubben → «Planlegg noe» → send → personlige lenker |

## Koble til Supabase

1. Lag et prosjekt på [supabase.com](https://supabase.com) og kopier `.env.example` til `.env.local`:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<publiserbar anon-nøkkel>
   EXPO_PUBLIC_WEB_URL=https://<domenet der weben hostes>
   ```
   Kun offentlige verdier hører hjemme her. Service role-nøkkelen skal **aldri** i klienten.
2. Kjør migrasjonene (tabeller, RLS, RPC-er, sosial graf, storage-bøtter og realtime):
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. **Auth → Providers:** kun **Email** trengs (engangskode og passord). Sett e-postmalen for
   «Magic Link» til å vise koden (`{{ .Token }}`), og legg til redirect-URL-ene
   `nordlysplanlegger://auth-callback` og din web-URL (brukes av bekreftelseslenken ved registrering).
4. **Push:** deploy Edge Function og sett secrets:
   ```bash
   npx supabase functions deploy push-dispatch --no-verify-jwt
   npx supabase secrets set PUSH_WEBHOOK_SECRET=<tilfeldig streng>
   ```
   Lag en Database Webhook (Database → Webhooks) på `INSERT` i `public.notifications` som kaller
   funksjonen med headeren `x-webhook-secret: <samme streng>`.
5. **Påminnelser:** slå på `pg_cron` og kjør linjen som er kommentert ut nederst i migrasjonen
   (`generate_nudges()` daglig kl. 09).
6. `npx eas-cli init` og legg `EXPO_PUBLIC_EAS_PROJECT_ID` i `.env.local` (trengs for Expo push-tokens).

## Invitasjonslenker og web

Invitasjoner deles som `https://<EXPO_PUBLIC_WEB_URL>/i/<token>`. Samme kodebase eksporteres til web:

```bash
npm run export:web   # → dist/
```

`vercel.json` er klar for Vercel (SPA-rewrite for `/i/*`). Med appen installert åpnes lenken
direkte i appen via universal links / app links – fyll inn Apple Team ID i
`public/.well-known/apple-app-site-association` og SHA-256-fingeravtrykket i
`public/.well-known/assetlinks.json`.

## Bygg til App Store / Google Play

```bash
npx eas-cli build --profile development --platform ios   # dev-klient (kalender, push)
npx eas-cli build --profile production --platform all
npx eas-cli submit --platform all
```

## Kvalitet

```bash
npm run typecheck    # tsc
npm run lint         # expo lint
npm test             # rangering, datoer, kategorier, brukernavn (Node test runner)
npm run test:db      # kjører migrasjonene på ekte Postgres (PGlite) + 25 scenarioer for RLS, venner, gjenger og gjestekobling
```

## Struktur

```
src/app/          ruter (Expo Router): faner, opprett-flyt, arrangement, invitasjon, gjenger, innstillinger
src/components/   designsystem (ui/), kalender, arrangement-, gjeng- og sponsorkomponenter
src/data/         domenetyper, Repository-grensesnitt, demo- og Supabase-implementasjon, React Query-hooks
src/lib/          datoer, rangering, kategorier/bilder, deling, kalender, push, konfig
src/state/        opprett-utkast og sesjon (zustand)
src/theme/        tokens: farger (lys + mørk), typografi, spacing, radius, skygger, bevegelse
supabase/         migrasjon og Edge Function
```

## Status

**Ferdig i MVP:** konto med e-post (engangskode eller passord), opprett arrangement (fast dato / finn dato /
ikke bestemt), periode, hurtigvalg og tidspunkt, invitasjon via lenke og delingskanaler, svar uten
konto (app og web), «marker dager du ikke kan», live resultater med automatisk rangering, lås dato,
bekreftelse, arrangementside, legg i kalender (`.ics` på web), gjenger med gjenbruk og «Finn neste
dato», pushvarsler, profil, varselinnstillinger, eksport og sletting av konto.

**Sosial graf:** gjest først (svar uten konto, profil tilbys etterpå), unike case-insensitive @brukernavn med
sjekk og forslag mens man skriver, gjensidige venner med kontekst, søk og diskrete forslag, profillenke
`/@brukernavn` (app + web) med QR, «hvem kan finne meg», gjenger med roller og gjester uten konto,
personlige invitasjonslenker, sikker kobling av gjestehistorikk til ny konto, «Lag gruppe av gjengen»
og smart invitasjon basert på egen historikk. Ingen feed, likes, følgere eller chat.

**Forberedt, ikke bygget:** sponsede forslag (`SponsoredSlot`, `sponsored_placements`), Plus
(`subscriptions`, `usePlan()`), kalenderintegrasjon med free/busy (`calendar_connections`),
mørk modus (tokens klare, `FEATURES.darkMode`).

**Neste steg:** opplasting av bilder etter arrangementet, endre kandidatdatoer i en pågående
avstemning, invitere enkeltpersoner fra telefonens kontakter (krever eksplisitt samtykke),
AI-genererte cover.
