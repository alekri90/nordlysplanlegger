# Google Play – innsending

Alt som skal limes inn i Play Console, og svarene på skjemaene. Grafikken ligger i `google-play/`
(ikke i git) og på skrivebordet i mappen «Planlegger Google Play».

## Grafikk

| Felt i Play Console | Fil | Krav |
|---|---|---|
| App-ikon | `ikon-512.png` | 512 × 512 PNG |
| Fremhevet grafikk | `feature-graphic-1024x500.jpg` | 1024 × 500, uten gjennomsiktighet |
| Skjermbilder for telefon | `telefon-1-hjem.jpg` … `telefon-7-gjeng.jpg` (i den rekkefølgen) | 2–8 bilder, 1080 × 1920 |

Nettbrett-skjermbilder er valgfrie. Hopp over dem.

## Butikkoppføring

Play Console → appen → **Vekst → Butikkoppføring → Hovedoppføring**. Standardspråk: **norsk (bokmål) – no-NO**.

**Appnavn** (maks 30 tegn)
> Nordlys Planlegger

**Kort beskrivelse** (maks 80 tegn)
> Finn en dato som passer alle – uten endeløse meldingstråder.

**Full beskrivelse** (maks 4000 tegn)
> Det er alltid noen som ikke kan. Nordlys Planlegger finner dagen der flest kan – på sekunder.
>
> SLIK FUNGERER DET
> • Lag et arrangement på under et halvt minutt og velg noen datoer
> • Del lenken på Snapchat, Messenger, WhatsApp eller i gruppechatten
> • Gjestene trykker på dagene de ikke kan – ingen app eller konto nødvendig
> • Se svarene komme inn live, med den beste datoen øverst
> • Lås datoen, og alle får beskjed og kan legge den rett i kalenderen
>
> IDEER SOM PASSER
> • Forslag etter hva gjengen pleier å gjøre og hva som passer i tiden – julebord, skitur, båttur
> • Velg blant ferdige bilder til hvert arrangement, eller bruk dine egne
>
> LAGET FOR GJENGEN
> • Lagre faste gjenger, så inviterer du alle med ett trykk
> • Gjenta arrangementet – hver uke, annenhver uke eller hver måned. Nordlys lager neste gang selv og finner datoen sammen med gjengen
> • Send beskjeder til alle som er invitert, og få påminnelser før det skjer
> • Inviter nye inn i gjengen med en lenke
> • Legg til venner med brukernavn eller QR-kode
> • Del bilder fra kvelden med de som var der
>
> ENKELT OG PRIVAT
> • Ingen reklame, ingen feed, ingen følgere
> • E-postadressen din vises aldri for andre
> • Du bestemmer selv hvem som kan finne deg, og kan blokkere og rapportere

**Kategori:** Sosiale (app). **Tagger:** Arrangementer, Planlegging (velg de nærmeste som finnes).

**Kontaktinformasjon:** e-post `alekri90@gmail.com`, nettsted `https://nordlysplanlegger.vercel.app`.

## Appinnhold (Policy → Appinnhold)

**Personvernregler**
> https://nordlysplanlegger.vercel.app/personvern

**Annonser:** Nei, appen inneholder ikke annonser.

**Apptilgang:** «Hele eller deler av appen er begrenset». Legg inn testbrukeren med passord (samme som for Apple, se `docs/APP_STORE.md` punkt 5):
> Logg inn: trykk «Logg inn» → «Logg inn med passord» og bruk kontoen over. Vanlige brukere logger inn med en engangskode på e-post. Gjester kan svare på en invitasjon i nettleseren uten konto.

**Innholdsvurdering (IARC-spørreskjema):** kategori *Sosial / kommunikasjon*. Svar **Nei** på vold, sex, banning, rusmidler, gambling og skremmende innhold. Svar **Ja** på:
- Brukere kan samhandle / utveksle innhold (bilder og tekst med venner og inviterte)
- Brukere kan dele innhold med hverandre

Svar **Nei** på deling av fysisk posisjon og kjøp i appen. Resultatet blir vanligvis PEGI 12 / «Tenåring».

**Målgruppe:** kryss av for **16–17** og **18 og eldre**. Ikke velg under 13 år. Da gjelder Googles familieregler, og vilkårene sier minst 13 år. Svar **Nei** på «Kan appen tiltrekke barn?».

**Nyhetsapp:** Nei. **Helse-, finans- og offentlige apper:** Nei. **Covid-19:** Nei.

**Sletting av data / konto**
- Kan brukere lage konto? **Ja**
- Nettadresse for kontosletting:
  > https://nordlysplanlegger.vercel.app/support

  Siden forklarer sletting i appen, på nett og per e-post, og hva som slettes.

### Datasikkerhet (Data safety)

- Samler appen inn eller deler data? **Ja**
- Krypteres data under overføring? **Ja**
- Kan brukere be om sletting av data? **Ja**
- **Deling med tredjeparter:** Nei. Supabase, Vercel, Resend og Expo er databehandlere, og det regnes ikke som deling.

| Datatype | Samles inn | Påkrevd? | Formål |
|---|---|---|---|
| Personlig info → Navn | Ja | Påkrevd | Appfunksjonalitet, Kontoadministrasjon |
| Personlig info → E-postadresse | Ja | Påkrevd | Kontoadministrasjon |
| Personlig info → Bruker-ID-er | Ja | Påkrevd | Appfunksjonalitet, Kontoadministrasjon |
| Bilder og videoer → Bilder | Ja | Valgfritt | Appfunksjonalitet |
| Appaktivitet → Annet brukergenerert innhold (arrangementer, svar, beskjeder, rapporter) | Ja | Påkrevd | Appfunksjonalitet |
| Enhets-ID eller andre ID-er (push-nøkkel) | Ja | Valgfritt | Appfunksjonalitet |

Ikke samlet inn: posisjon, kontakter, økonomi, helse, meldinger (SMS/e-post), nettleserhistorikk, filer, kalender, appytelse/diagnostikk.

## Lukket test (krav for personlige kontoer)

1. **Testing → Lukket testing** → opprett et spor (f.eks. «Venner»).
2. **Testere:** lag en e-postliste med minst 12 Google-kontoer (helst 14–15).
3. Last opp `.aab`-filen fra EAS (første gang manuelt; last den ned fra byggesiden på expo.dev).
4. **Versjonsnotat:**
   > Første testversjon av Nordlys Planlegger. Lag et arrangement, del lenken med gjengen og se hvilken dag som passer best. Gi oss gjerne tilbakemelding!
5. Send til gjennomgang. Når den er godkjent: kopier **lenken for å bli med i testen** og send den til testerne.
6. Testerne trykker lenken → «Bli tester» → installerer fra Play Store. De må være med i **14 dager sammenhengende**.
7. Etter 14 dager: **Søk om produksjonstilgang** på oversiktssiden og svar på spørsmålene om testingen.

## Etter første opplasting

- Signeringsnøkkelen: Play Console → **Test og lansering → Appintegritet → Appsignering** → kopier SHA-256 for *appsigneringsnøkkelen*. Den skal inn i `public/.well-known/assetlinks.json`, så invitasjonslenker åpner appen.
- Push-varsler på Android: Firebase-prosjekt og FCM-nøkkel (egen oppskrift).
- Automatisk opplasting fra EAS: tjenestekonto-nøkkel fra Google Cloud (egen oppskrift).
