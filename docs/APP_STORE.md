# App Store – innsending

Alt som skal limes inn i App Store Connect, og stegene i riktig rekkefølge.

## 1. Kontoer (du)

1. **Apple Developer Program** (privatperson): https://developer.apple.com/programs/enroll – 99 USD/år, logg inn med din Apple-ID. Godkjenning tar vanligvis 1–2 dager.
2. **Expo-konto** (gratis): https://expo.dev/signup – brukes til å bygge i skyen.

## 2. Koble prosjektet til EAS (jeg kjører, du logger inn)

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` lager et prosjekt-ID som legges i `.env.local` som `EAS_PROJECT_ID` (og i EAS-miljøvariablene, se under).

Miljøvariabler bygget trenger (EAS → Project → Environment variables, miljø *production*, synlighet *Plain text* – dette er offentlige nøkler):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_WEB_URL` = `https://nordlysplanlegger.vercel.app`

## 3. Opprett appen i App Store Connect (du)

https://appstoreconnect.apple.com → Apper → **+** → Ny app

| Felt | Verdi |
|---|---|
| Plattform | iOS |
| Navn | Nordlys Planlegger |
| Primærspråk | Norsk (bokmål) |
| Pakke-ID | `no.nordlys.planlegger` (registreres automatisk av EAS første gang – kjør steg 4 først hvis den ikke finnes i lista) |
| SKU | `nordlys-planlegger` |
| Brukertilgang | Full tilgang |

## 4. Bygg og send til TestFlight (jeg kjører)

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

EAS spør om Apple-ID og lager sertifikater, push-nøkkel og provisioning profile selv. Du logger inn i terminalen – passordet går rett til Apple, aldri via meg.

Når bygget er behandlet (10–30 min) dukker det opp i TestFlight. Legg til deg selv og gjengen som interne testere.

## 5. App Store-oppføring

**Undertittel** (maks 30 tegn)
> Få gjengen samlet

**Reklametekst** (maks 170 tegn)
> Finn en dato som passer alle – uten endeløse meldingstråder. Gjestene trykker på dagene de ikke kan, og du ser med en gang hvilken dag som fungerer.

**Beskrivelse**
> Det er alltid noen som ikke kan. Nordlys Planlegger finner dagen der flest kan – på sekunder.
>
> SLIK FUNGERER DET
> • Lag et arrangement på under et halvt minutt og velg noen datoer
> • Del lenken i gruppechatten
> • Gjestene trykker på dagene de ikke kan – ingen app eller konto nødvendig
> • Se svarene komme inn live, med den beste datoen øverst
> • Lås datoen, og alle får beskjed og kan legge den rett i kalenderen
>
> LAGET FOR GJENGEN
> • Lagre faste gjenger, så inviterer du alle med ett trykk
> • Legg til venner med brukernavn eller QR-kode
> • Få varsel når noen svarer og når datoen er satt
>
> ENKELT OG PRIVAT
> • Ingen reklame, ingen feed, ingen følgere
> • E-postadressen din vises aldri for andre
> • Du bestemmer selv hvem som kan finne deg

**Nøkkelord** (maks 100 tegn, kommaseparert)
> planlegge,dato,avtale,venner,gjeng,middag,fest,kalender,doodle,avstemning,invitasjon,arrangement

**Kategori:** Sosiale nettverk (primær), Livsstil (sekundær)

**Nettadresser**
- Støtte: `https://nordlysplanlegger.vercel.app/personvern` (bytt til egen støtteside når den finnes)
- Personvernerklæring: `https://nordlysplanlegger.vercel.app/personvern`

**Opphavsrett:** `2026 Alexander Kristensen`

**Aldersgrense:** svar «Nei/Ingen» på alt i spørreskjemaet → 4+. *Brukergenerert innhold: Nei* (ingen åpen deling – bare med venner og inviterte). Hvis Apple likevel ber om rapportering/blokkering, legger vi det til.

## 6. Personvern i App Store («App Privacy»)

Sporing: **Nei**. Data som samles inn, alle *knyttet til brukeren*, *ikke brukt til sporing*, formål *Appfunksjonalitet*:

| Datatype | Hva |
|---|---|
| Kontaktinfo → E-postadresse | innlogging |
| Kontaktinfo → Navn | visningsnavn |
| Brukerinnhold → Bilder | profil- og arrangementsbilder |
| Brukerinnhold → Annet brukerinnhold | arrangementer, svar |
| Identifikatorer → Bruker-ID | profil-ID |
| Identifikatorer → Enhets-ID | push-nøkkel |
| Andre data → Kontakter? **Nei** | vi leser ikke telefonkontaktene |

## 7. Innlogging for Apples testere (du)

Apple kan ikke motta e-postkodene. Lag en egen testbruker **med passord**:

1. Supabase → Authentication → Users → *Add user* → *Create new user*, f.eks. `appreview@…` med et sterkt passord, «Auto Confirm User» på.
2. Logg inn i appen med «Logg inn med passord», sett visningsnavn «App Review» og lag gjerne ett arrangement.
3. I App Store Connect → App Review Information: fyll inn e-post og passord, og notat:

> Innlogging: trykk «Logg inn» → «Logg inn med passord». Vanlige brukere logger inn med en engangskode på e-post. Gjester kan svare på invitasjoner uten konto.

## 8. Skjermbilder

Påkrevd: iPhone 6,9" (1320 × 2868). Forslag til fem bilder: forsiden med arrangementer, «Finn en dato», resultater med beste dato, låst dato, gjenger. Tas fra TestFlight-bygget på en stor iPhone, eller lages fra simulatoren.

## 9. Send til vurdering

Velg bygget under «Bygg», svar på eksportspørsmålet (krypteringen er allerede satt til «nei» i appen), og trykk **Send til vurdering**. Vanligvis 1–3 dager.

## Etter godkjenning

- Legg inn Apple Team ID i `public/.well-known/apple-app-site-association` (erstatt `YOUR_APPLE_TEAM_ID`), så åpner invitasjonslenker appen direkte.
- Sett `APP_STORE_URL` i `src/lib/config.ts` til den ekte App Store-lenken.
