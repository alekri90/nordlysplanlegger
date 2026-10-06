# Nordlys Planlegger — arkitektur

> Få gjengen samlet.

Dette dokumentet beskriver informasjonsarkitektur, navigasjon, datamodell og tekniske valg.
Det er skrevet for utviklere som skal videreutvikle appen.

---

## 1. Produktprinsipper

1. **Datoen er problemet.** Alt i appen finnes for å komme fra «vi burde finne på noe» til en låst dato.
2. **Én skjerm, ett mål.** Hver skjerm har én primærhandling, nederst, innen rekkevidde av tommelen.
3. **Gjester er gjester.** Ingen konto, ingen app, ingen friksjon for å svare. Et navn er nok.
4. **Verdi før konto.** Arrangøren kan lage hele arrangementet før vi spør om innlogging.
5. **Gjengen kommer tilbake.** Grupper gjør neste gang til ett trykk.

## 2. Informasjonsarkitektur

```
Velkommen (ikke innlogget)
├── Planlegg noe  ──────────────► Opprett-flyt (konto spørres først ved «Send»)
└── Logg inn ───────────────────► Innlogging (e-post: engangskode eller passord)

Faner (innlogget)
├── Hjem
│   ├── Varsler (bjelle)
│   ├── Lag noe  ───────────────► Opprett-flyt
│   ├── Du er invitert  ────────► Invitasjon → Marker dager → Takk
│   ├── Neste (arrangementskort) ► Arrangement
│   └── Dine gjenger ───────────► Gjeng
├── [ + ]  ─────────────────────► Opprett-flyt
├── Gjenger
│   ├── «Skal vi finne neste dato?»-forslag
│   ├── Gjengkort → Gjeng → Finn neste dato (forhåndsutfylt flyt)
│   └── Ny gjeng
└── Profil (bilde, navn, @brukernavn, venner, gjenger, kommende)
    ├── Venner → Forespørsler · Finn venner (søk, «personer du kanskje kjenner», Min QR)
    ├── Rediger profil (navn, @brukernavn, bio, bilde)
    ├── Varsler
    ├── Personvern (hvem kan finne meg, eksport, slett konto)
    └── Logg ut

Opprett-flyt (modal stack)
1. Hva skal dere gjøre?   tittel → foreslått kategori → coverbilder (+ opplasting)
2. Når?                   Finn en dato (hoved) · Fast dato · Ikke bestemt ennå
3a. Hvilke dager passer?  periode · hurtigvalg · kalender · tidspunkt
3b. Hvilken dag?          (fast dato) én dag + tidspunkt
4. Hvem skal være med?    gjenger → folk du har planlagt med → del lenke
5. Sendt!                 delingskanaler

Arrangement (én rute, innhold styres av status og rolle)
├── polling  + arrangør   → Resultater («5 av 8 har svart») → Lås dato → Vi har en dato!
├── polling  + gjest      → Invitasjon → Marker dager
├── draft    (ikke bestemt) → Arrangement med «Finn dato»
└── confirmed/completed   → Arrangementside (gjesteliste · detaljer · bilder)
                            completed → «Skal vi finne neste dato?»

Web (samme kodebase, Expo Router web)
└── /i/:token   Invitasjon → Marker dager → Takk (+ last ned appen)
```

## 3. Navigasjonsstruktur (Expo Router, `src/app`)

| Rute | Skjerm | Presentasjon |
|---|---|---|
| `/` | Gate: velkommen eller faner | redirect |
| `/welcome` | Velkommen | stack |
| `/auth` | Innlogging | modal |
| `/auth-otp` | Engangskode på e-post | stack |
| `/(tabs)` | Hjem · Gjenger · Profil + sentral «+» | custom tab bar |
| `/create/*` | Opprett-flyt (`index`, `when`, `dates`, `fixed`, `who`, `sent`) | fullskjerm modal stack |
| `/event/[id]` | Arrangement (status-styrt) | stack |
| `/event/[id]/results` | Resultater | stack |
| `/event/[id]/locked` | Vi har en dato! | fade |
| `/event/[id]/edit` | Endre detaljer | modal |
| `/i/[token]` | Invitasjon (app + web) | stack |
| `/i/[token]/respond` | Hvilke dager kan du ikke? | stack |
| `/i/[token]/done` | Takk for svaret | stack |
| `/group/[id]` | Gjeng | stack |
| `/group/new?fromEvent=` | Ny gjeng (evt. fra arrangement) | modal |
| `/group/[id]/add-members`, `/group/[id]/edit` | Legg til medlemmer · rediger | modal |
| `/signup?token=&name=` | Opprett profil (etter gjestesvar) | modal |
| `/profile-setup` | Bekreft navn/@brukernavn etter innlogging med kode | stack |
| `/auth-password` | Logg inn med passord | stack |
| `/friends`, `/friends/requests`, `/friends/find` | Venner · forespørsler · finn venner | stack |
| `/@[brukernavn]` | Profil (app + web) | stack |
| `/notifications` | Varsler | stack |
| `/settings/*` | Profil, varsler, personvern | stack |

Invitasjonslenker: `https://<EXPO_PUBLIC_WEB_URL>/i/<token>`. Er appen installert åpnes ruten
via universal links / app links (konfigurert i `app.config.ts`); ellers åpnes samme rute som
mobiloptimalisert webside, eksportert med `npx expo export --platform web`.

## 4. Kodestruktur

```
src/
  app/            ruter (kun skjermer og layouts)
  components/
    ui/           designsystem: Text, Button, Card, Input, Avatar, Chip, Sheet, Toast, Skeleton …
    calendar/     MonthCalendar (custom kalender med alle dagstilstander)
    event/        EventCard, EventHero, DateResultRow, GuestList, ShareSheet …
    group/        GroupBubble, GroupCard
    sponsored/    SponsoredSlot (tom i MVP, forberedt for native annonser)
  data/
    types.ts      domenemodeller (UI snakker kun med disse)
    repository.ts Repository-grensesnittet
    demo/         realistiske demodata + in-memory implementasjon
    supabase/     Supabase-implementasjon (mapping rad → domene)
    hooks.ts      React Query-hooks
  lib/            rene hjelpefunksjoner: datoer, rangering, kategorier, bilder, deling, kalender, push
  state/          zustand: opprett-utkast, sesjon
  theme/          tokens (farger lys/mørk, typografi, spacing, radius, skygger)
supabase/
  migrations/     skjema, RLS, RPC-er, cron
  functions/      Edge Functions (push-dispatch)
```

**Datakilde.** `src/data/index.ts` velger implementasjon: uten `EXPO_PUBLIC_SUPABASE_URL`
(eller med `EXPO_PUBLIC_DEMO_MODE=1`) kjører appen på demodata, slik at hele flyten kan
vises og testes uten backend. Komponentene kjenner bare `Repository` og domenetypene.

## 5. Datamodell

Se `supabase/migrations/0001_init.sql` for fullstendig skjema. Oversikt:

| Tabell | Formål |
|---|---|
| `auth.users` (*users*) | Supabase Auth. Vi dupliserer ikke e-post/telefon. |
| `profiles` | Visningsnavn og bilde. Lesbar kun for folk du deler gjeng/arrangement med. |
| `subscriptions` | `free` / `plus`. Premium låser aldri planleggingsfunksjoner i MVP. |
| `guest_identities` | Gjester uten konto. Hemmelig nøkkel (kun hash lagres) på enheten. Kan senere `claim`-es av en konto. |
| `groups`, `group_members` | Gjenger + standardinnstillinger (tittel, kategori, tidspunkt, ukedager). |
| `events` | Arrangement. `status`: draft · polling · date_selected · confirmed · completed · cancelled. |
| `event_members` | Hvem er med. Bruker *eller* gjest. `status`: invited · opened · responded · attending · declined. |
| `event_date_options` | Kandidatdatoer. |
| `event_availability` | Kun det motsatte: dager en deltaker **ikke** kan. |
| `event_invites` | Delbare lenker (token, utløp, tilbaketrekking). |
| `guest_responses` | Revisjonsspor for svar uten konto. |
| `event_locations`, `event_images` | Sted og bilder. |
| `notifications`, `push_tokens`, `notification_preferences` | Varsler og push. |
| `calendar_connections` | Forberedt for Google/Apple-kalender (free/busy, kun med samtykke). |
| `sponsored_placements` | Forberedt for native sponsede forslag. Ingen markedsplass bygget. |

**Rangering av datoer** (`src/lib/ranking.ts`, speilet i SQL-viewet `event_date_scores`):
flest som kan → færrest som ikke kan → tidligst dato. Arrangøren teller som tilgjengelig
på alle kandidatdatoer. «Beste dato» markeres med grønt *og* tekst/ikon.

**Gjestesvar** går gjennom `security definer`-funksjoner (`get_invite`, `submit_guest_response`,
`guest_rsvp`) som kun eksponerer det en gjest trenger: tittel, bilde, arrangørens fornavn,
kandidatdatoer og antall/avatarer — aldri kontaktdata.

## 5b. Sosial graf: profiler, venner og gjenger

Prinsipp: brukernavn, venner og gjenger skal **redusere friksjon**, aldri være et krav.
En ny person kan fortsatt åpne lenke → svare → ferdig. Se `supabase/migrations/20261005000001_social.sql`.

**Vekstreisen:** motta invitasjon → svare (kun navn) → «Vil du lagre profilen din?» → én skjerm
(`/signup`: visningsnavn, @brukernavn, e-post, passord – tydelig merket offentlig/privat) →
«Profil opprettet» → «Legg til arrangøren som venn» / «Du er med i gjengen» → neste gang inviteres man direkte.

| Tabell / funksjon | Formål |
|---|---|
| `profiles.username` / `username_normalized` | Unikt, case-insensitivt (`unique(username_normalized)`). Trigger normaliserer (lowercase, fjerner @, trimmer) og validerer: 3–24 tegn, `a–z 0–9 _ .`, ingen punktum først/sist/doble. Reservert (`reserved_usernames`, med prefiks-sperre for admin/support/…) og blokkert (`blocked_username_terms`). |
| `check_username()` | Tilgjengelighet mens man skriver + forslag (@alexanderk, @alexk …). Fungerer før registrering. |
| `profiles.discoverability` | `everyone` (standard) · `friends_of_friends` · `nobody`. Styrer søk og profillenke. Folk man planlegger med ser hverandre alltid. |
| `friendships` | Gjensidige vennskap, én rad per par (`unique(least, greatest)`): `pending` → `accepted` (eller `declined`, som for avsender fortsatt ser ut som «sendt»). Opprettes/besvares kun via RPC. |
| `can_view_profile()` | Hjertet i personvernet. Brukt av RLS på `profiles`. Kun bilde, navn, @brukernavn og felles venner/gjenger eksponeres – aldri e-post, telefon eller andres private gjenger/arrangementer. |
| `search_people`, `people_you_may_know`, `list_recent_people`, `get_public_profile` | Søk (navn eller @), diskrete forslag kun fra egen historikk (ingen kontaktbok-opplasting), «Nylig», og profilsiden `/@brukernavn` (også web for besøkende uten konto). |
| `groups` (`name`, `emoji`, `image_url`, `description`, `created_by`, `last_activity_at`) + `group_members` (`role`: owner/admin/member, `user_id` **eller** `guest_id`) | Gjenger kan ha gjester uten konto («6 registrerte · 2 gjester»). Alle medlemmer kan legge til; kun admin redigerer/fjerner; alle kan forlate (eier gir videre). |
| `guest_profiles` (`display_name`, `invite_token`, `claimed_by_user_id`) + `event_invites.guest_profile_id` | Gjester lagt til ved navn får **personlige lenker**. Lenken (128-bit tilfeldig token, kun delt med personen) er legitimasjonen; navnet er forhåndsutfylt. |
| `claim_guest_identity(secret)` / `claim_guest_invite(token)` → `merge_guest_into_user()` | Kobler tidligere svar, invitasjoner og gruppemedlemskap til ny konto. Kun via enhetens hemmelige nøkkel eller en personlig lenke — **aldri på navn**. Personlig token lagres lokalt til kontoen finnes (overlever e-postbekreftelse). |
| `suggest_invitees()` | «Du inviterer vanligvis …» / foreslått gjeng – kun arrangørens egen historikk. |

Ikke bygget med vilje: feed, likes, følgere, stories, status, chat.

**QR:** «Min QR» viser profillenken som QR-kode. Skanning med kamera åpner `/@brukernavn`
(appen via universal/app links, ellers web). Ingen egen QR-tabell trengs.

## 6. Varsler

`notifications`-rader lages i databasen (låst dato, ny invitasjon, alle kan, påminnelser).
En Database Webhook på `insert` kaller Edge Function `push-dispatch`, som slår opp
`push_tokens` + preferanser og sender via Expo Push API. `pg_cron` kjører
`generate_nudges()` daglig for «3 personer mangler å svare» og «Pokerklubben har ikke møttes
på 7 uker». Maks én påminnelse per arrangement per 48 timer — nyttig, ikke masete.

Appen ber om push-tillatelse først når det gir mening: rett etter at første invitasjon er sendt.

## 7. Kalender

- MVP: «Legg i kalender» bruker systemets skjema (`expo-calendar` `addEventWithForm`)
  på iOS/Android og en `.ics`-fil på web.
- Senere: `calendar_connections` + Edge Function som henter **kun free/busy** fra
  Google/Apple etter eksplisitt samtykke, for å forhåndsmarkere dager du ikke kan.
  Private kalenderdetaljer lagres eller vises aldri.

## 8. Annonser og premium (forberedt, ikke bygget)

- `SponsoredSlot placement="post_lock_venue"` er plassert på «Vi har en dato!»-skjermen og
  returnerer `null` til `FEATURES.sponsored` slås på. Datamodellen `sponsored_placements`
  matcher på kategori og region. Ingen bannerannonser i hovedgrensesnittet.
- `profiles` → `subscriptions.tier` (`free`/`plus`). `usePlan()` gir `isPlus`. Ingenting i
  planleggingsflyten sjekker dette.

## 9. Sikkerhet og personvern

- Kun `EXPO_PUBLIC_SUPABASE_URL` og den publiserbare anon-nøkkelen er i klienten.
  Service role-nøkkel finnes kun som Edge Function-secret.
- RLS på alle tabeller. Hjelpefunksjonene `is_event_member`, `is_event_organizer`,
  `is_group_member` er `security definer` med låst `search_path`.
- Invitasjonstokens er 128-bit tilfeldige og kan trekkes tilbake.
- Gjestenøkler lagres kun som SHA-256-hash.
- Kontodeletion: `delete_my_account()` anonymiserer svar (beholder «En gjest» i andres
  arrangementer) og sletter profil, tokens og varsler.
- Vi ber ikke om tilgang til kontakter i MVP: «kontakter» er folk du allerede har planlagt med.

## 10. Kjøring

Se `README.md`.
