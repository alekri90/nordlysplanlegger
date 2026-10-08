# App Store – innsending

Alt som skal limes inn i App Store Connect, og stegene i riktig rekkefølge.

## Allerede gjort

- Apple Developer Program og Expo-konto (`nordlys-kapital`).
- Prosjektet er koblet til EAS. ID-en `623cc93d-c24b-46f6-aac0-0fa470305919` står som standardverdi i `app.config.ts` (offentlig, ikke hemmelig).
- Miljøvariabler i EAS (miljø *production*, *Plain text*): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_WEB_URL` = `https://nordlysplanlegger.vercel.app`.
- Appen finnes i App Store Connect (ASC App ID `6819851126`, pakke-ID `no.nordlys.planlegger`), og bygg sendes til TestFlight.
- Universal links: Team ID `9795ZWN3D3` ligger i `public/.well-known/apple-app-site-association`.
- Rapportering og blokkering (retningslinje 1.2), støtteside, kontoslett i appen, personvernmanifest.

## 1. Nytt bygg til TestFlight

```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit --non-interactive
```

Sertifikater og App Store Connect-nøkkel ligger hos EAS, så det går uten spørsmål. Bygget dukker opp i TestFlight 10–30 minutter etter at det er ferdig. Navnet under ikonet er «Planlegger»; i App Store heter appen «Nordlys Planlegger».

## 2. App Store-oppføring

App Store Connect → appen → **App Store** → versjon 1.0.

**Undertittel** (maks 30 tegn)
> Få gjengen samlet

**Reklametekst** (maks 170 tegn)
> Finn en dato som passer alle – uten endeløse meldingstråder. Gjestene trykker på dagene de ikke kan, og du ser med en gang hvilken dag som fungerer.

**Beskrivelse**
> Det er alltid noen som ikke kan. Nordlys Planlegger finner dagen der flest kan – på sekunder.
>
> SLIK FUNGERER DET
> • Lag et arrangement på under et halvt minutt og velg noen datoer
> • Del lenken på Snapchat, Messenger eller i gruppechatten
> • Gjestene trykker på dagene de ikke kan – ingen app eller konto nødvendig
> • Se svarene komme inn live, med den beste datoen øverst
> • Lås datoen, og alle får beskjed og kan legge den rett i kalenderen
>
> LAGET FOR GJENGEN
> • Lagre faste gjenger, så inviterer du alle med ett trykk
> • Inviter nye inn i gjengen med en lenke
> • Legg til venner med brukernavn eller QR-kode
> • Del bilder fra kvelden med de som var der
> • Få varsel når noen svarer og når datoen er satt
>
> ENKELT OG PRIVAT
> • Ingen reklame, ingen feed, ingen følgere
> • E-postadressen din vises aldri for andre
> • Du bestemmer selv hvem som kan finne deg, og kan blokkere og rapportere

**Nøkkelord** (maks 100 tegn, kommaseparert)
> planlegge,dato,avtale,venner,gjeng,middag,fest,kalender,doodle,avstemning,invitasjon,arrangement

**Kategori:** Sosiale nettverk (primær), Livsstil (sekundær)

**Nettadresser**
- Støtte: `https://nordlysplanlegger.vercel.app/support`
- Personvernerklæring: `https://nordlysplanlegger.vercel.app/personvern`

**Opphavsrett:** `2026 Alexander Kristensen`

## 3. Aldersgrense

App Store Connect → **App-informasjon** → Aldersgrense → Rediger. Svar **Nei/Ingen** på alle spørsmål om vold, sex, rus, gambling osv., men:

| Spørsmål | Svar |
|---|---|
| Brukergenerert innhold / meldinger mellom brukere | **Ja** – brukere kan dele bilder og tekst med venner og inviterte |
| Moderering: kan brukere rapportere og blokkere? | **Ja** |
| Ubegrenset nettilgang | **Nei** |

Resultatet blir vanligvis 12+ (vilkårene sier minst 13 år, og det er greit).

## 4. Personvern i App Store («App Privacy»)

Sporing: **Nei**. Data som samles inn, alle *knyttet til brukeren*, *ikke brukt til sporing*, formål *Appfunksjonalitet*:

| Datatype | Hva |
|---|---|
| Kontaktinfo → E-postadresse | innlogging |
| Kontaktinfo → Navn | visningsnavn |
| Brukerinnhold → Bilder | profil-, forside- og arrangementsbilder |
| Brukerinnhold → Annet brukerinnhold | arrangementer, svar, gjenger, rapporter |
| Identifikatorer → Bruker-ID | profil-ID |
| Identifikatorer → Enhets-ID | push-nøkkel |

Ikke samlet inn: plassering, kontakter, helse, økonomi, nettleserhistorikk, søkehistorikk, diagnostikk.

## 5. Testbruker for Apple

Apple kan ikke motta e-postkoder. Lag en egen testbruker **med passord**:

1. Supabase → **Authentication** → **Users** → *Add user* → *Create new user*: f.eks. `appreview.planlegger@gmail.com` og et sterkt passord, **Auto Confirm User** på.
2. Logg inn i appen med «Logg inn med passord». Sett visningsnavn «App Review», lag en gjeng og ett arrangement, så Apple ser noe innhold.
3. App Store Connect → versjonen → **App Review Information**: kryss av for innlogging, fyll inn e-post og passord, kontaktinfo (navn, telefon, `alekri90@gmail.com`) og dette notatet:

> Sign in: tap "Logg inn" → "Logg inn med passord" and use the account above. Regular users sign in with a one-time code sent by e-mail; guests can answer an invitation in the browser without an account.
>
> User-generated content (guideline 1.2): users can report a person (tap the person → "Rapporter"), an event or its photos (event → "Mer" → "Rapporter arrangementet") and a group (group → "…" → "Rapporter gjengen"), and block a person (tap the person → "Blokker"; blocked users are listed under Profil → Personvern). Reports are reviewed by the developer within 24 hours. The terms (/vilkar) state zero tolerance for objectionable content.
>
> Account deletion: Profil → Personvern → "Slett kontoen".

## 6. Skjermbilder

Påkrevd: iPhone 6,9" (1320 × 2868), 3–10 bilder. Ta dem på en iPhone 15/16/17 Pro Max eller Plus (sideknapp + volum opp) fra TestFlight-appen. Forslag:

1. Forsiden med arrangementer
2. «Når passer det?» / velg datoer
3. Resultater med beste dato øverst
4. Invitasjonen slik gjestene ser den
5. En gjeng med «Inviter på Snapchat»

Har du ikke en så stor iPhone, si fra, så lager jeg dem fra simulator/nettversjonen.

## 7. Send til vurdering

Versjonen → **Bygg** → velg siste bygg. Eksportspørsmålet er allerede besvart i appen (ingen kryptering ut over standard). Trykk **Legg til for vurdering** → **Send til vurdering**. Vanligvis 1–3 dager.

## Rapporter – slik følger du dem opp

Rapporter havner i Supabase → **Table Editor** → `content_reports` (nyeste øverst, `status = open`). Apple forventer at de håndteres innen 24 timer:

- Se på innholdet (`target_user_id`, `event_id` eller `group_id`).
- Fjern det som bryter vilkårene (slett raden for arrangementet/bildet, eller brukeren under Authentication → Users).
- Sett `status` til `handled`.

## Etter godkjenning

- Sett `APP_STORE_URL` i `src/lib/config.ts` til `https://apps.apple.com/app/id6819851126` (da vises nedlastingslenken for gjester).
