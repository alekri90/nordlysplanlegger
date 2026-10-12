/**
 * Privacy policy, terms, support and child safety standards (Norwegian). Served at /personvern, /vilkar, /support and
 * /barnesikkerhet — the App Store listing
 * and the sign-in screen link here. Keep in sync with what the app actually stores.
 */
export const LEGAL = {
  /** Shown as the contact address on both pages. Empty → the line is hidden. */
  contactEmail: 'alekri90@gmail.com',
  owner: 'Alexander Kristensen',
  updated: '12. oktober 2026',
};

export type LegalSection = { title: string; paragraphs: string[] };

export const PRIVACY: LegalSection[] = [
  {
    title: 'Kort fortalt',
    paragraphs: [
      'Nordlys Planlegger hjelper vennegjenger å finne en dato som passer. Vi lagrer bare det som trengs for å gjøre det, vi viser ingen reklame, vi sporer deg ikke og vi selger aldri opplysninger om deg.',
    ],
  },
  {
    title: 'Hvem er ansvarlig',
    paragraphs: [`${LEGAL.owner} er behandlingsansvarlig for opplysningene i Nordlys Planlegger.`],
  },
  {
    title: 'Hva vi lagrer',
    paragraphs: [
      'Profil: e-postadresse (privat – brukes bare til innlogging og vises aldri for andre), visningsnavn, brukernavn, og eventuelt profilbilde og kort beskrivelse.',
      'Arrangementer: tittel, datoforslag, sted, beskrivelse, bilde, hvem som er invitert og hvilke dager hver enkelt ikke kan, og bilder som deles fra arrangementet.',
      'Gjester uten profil: navnet du skriver inn og svarene dine. Telefonen din husker en tilfeldig nøkkel slik at du kan endre svaret senere – vi kobler aldri svar til en profil basert på navn.',
      'Venner og gjenger: hvem du er venn med, venneforespørsler og hvilke gjenger du er med i.',
      'Varsler: en anonym push-nøkkel for telefonen din og hvilke varsler du vil ha.',
      'Blokkeringer og rapporter: hvem du har blokkert, og rapporter du sender om personer, arrangementer eller gjenger. Den som blir rapportert eller blokkert får ikke vite hvem det var.',
    ],
  },
  {
    title: 'Hvem som ser hva',
    paragraphs: [
      'Visningsnavn, brukernavn og profilbilde kan sees av andre etter innstillingen du velger under Personvern: alle, venners venner eller ingen. E-postadressen din vises aldri.',
      'Svarene dine på et arrangement, og bilder som deles der, kan sees av arrangøren og de andre som er invitert til det samme arrangementet.',
    ],
  },
  {
    title: 'Leverandører',
    paragraphs: [
      'Vi bruker noen få leverandører for å drive tjenesten: Supabase (database, innlogging og bildelagring), Vercel (nettsiden), Resend (e-post med innloggingskoder) og Expo, Apple og Google (push-varsler). De behandler opplysningene bare på våre vegne.',
    ],
  },
  {
    title: 'Hvor lenge',
    paragraphs: [
      'Opplysningene lagres så lenge du har profil. Sletter du profilen, slettes profilen, arrangementene og gjengene du har laget, bildene du har lastet opp (også bilder du har delt i andres arrangementer), vennskapene, blokkeringene, varslene og push-nøklene dine. Svar du har gitt på andres arrangementer blir stående som «En gjest», uten navn. Arrangøren kan når som helst slette et arrangement med alle svar.',
    ],
  },
  {
    title: 'Dine rettigheter',
    paragraphs: [
      'Du kan se, endre og slette opplysningene dine i appen under Profil → Personvern, og der kan du også slette hele profilen. Du har rett til innsyn, retting, sletting og dataportabilitet etter personvernforordningen (GDPR).',
      'Mener du at vi behandler opplysninger i strid med regelverket, kan du klage til Datatilsynet.',
    ],
  },
];

export const TERMS: LegalSection[] = [
  {
    title: 'Tjenesten',
    paragraphs: [
      'Nordlys Planlegger er en gratis tjeneste for å planlegge sosiale arrangementer med venner. Tjenesten leveres som den er, og vi kan endre eller avslutte funksjoner.',
    ],
  },
  {
    title: 'Din bruk',
    paragraphs: [
      'Du er ansvarlig for det du skriver og laster opp, og for at du har lov til å dele bildene du bruker. Ikke bruk tjenesten til å trakassere andre, sende søppelpost eller dele ulovlig innhold.',
      'Vi kan fjerne innhold eller stenge profiler som bryter disse vilkårene.',
    ],
  },
  {
    title: 'Null toleranse for støtende innhold',
    paragraphs: [
      'Det er ikke lov å dele støtende, seksuelt, voldelig, hatefullt eller trakasserende innhold eller bilder, eller å plage andre. Vi har null toleranse for dette.',
      'Du kan rapportere en person, et arrangement eller en gjeng fra menyen «Mer» eller ved å trykke på personen, og du kan blokkere personer du ikke vil ha kontakt med. Vi går gjennom rapporter innen 24 timer, fjerner innhold som bryter vilkårene og stenger profilen til den som la det ut.',
    ],
  },
  {
    title: 'Profil',
    paragraphs: [
      'Du må være minst 13 år for å opprette profil. Du kan slette profilen din når som helst i appen.',
    ],
  },
  {
    title: 'Ansvar',
    paragraphs: [
      'Vi gjør vårt beste for at tjenesten er tilgjengelig og at varsler kommer fram, men kan ikke garantere det. Vi er ikke ansvarlige for arrangementer som planlegges med tjenesten.',
    ],
  },
  {
    title: 'Personvern',
    paragraphs: ['Hvordan vi behandler opplysninger om deg står i personvernerklæringen.'],
  },
];

/** Child safety standards (Google Play CSAE policy). Public, at /barnesikkerhet. */
export const CHILD_SAFETY: LegalSection[] = [
  {
    title: 'Null toleranse for seksuell utnyttelse av barn',
    paragraphs: [
      'Nordlys Planlegger har null toleranse for seksuelt misbruk og seksuell utnyttelse av barn (CSAE), inkludert overgrepsmateriale (CSAM), grooming, seksualisering av mindreårige og all annen kontakt eller innhold som utsetter barn for fare.',
      'Slikt innhold og slik oppførsel er forbudt i vilkårene våre. Profiler som bryter dette stenges permanent.',
    ],
  },
  {
    title: 'Aldersgrense',
    paragraphs: ['Du må være minst 13 år for å opprette profil. Appen er laget for å planlegge arrangementer med folk du kjenner, og har ingen åpen feed, ingen søk etter fremmede ut fra alder eller sted, og ingen private meldinger mellom fremmede.'],
  },
  {
    title: 'Slik melder du fra i appen',
    paragraphs: [
      'Trykk på en person og velg «Rapporter», eller velg «Rapporter» fra menyen «Mer» på et arrangement eller en gjeng. Velg «Bekymring for barns sikkerhet». Du kan også blokkere personen med en gang.',
      'Du kan også sende e-post til oss (se kontakt øverst) – også uten å ha profil.',
    ],
  },
  {
    title: 'Slik håndterer vi rapporter',
    paragraphs: [
      'Rapporter om barns sikkerhet behandles før alle andre, og alltid innen 24 timer. Innhold som kan være overgrepsmateriale fjernes med en gang, og profilen stenges.',
      'Vi tar vare på nødvendig informasjon og melder fra til politiet (Kripos, tips.kripos.no) og, der det er aktuelt, til NCMEC. Vi samarbeider med myndighetene i etterforskningen.',
    ],
  },
  {
    title: 'Lover vi følger',
    paragraphs: ['Vi følger norsk lov og relevante internasjonale lover om beskyttelse av barn, og Google Plays og Apples retningslinjer for barns sikkerhet.'],
  },
  {
    title: 'In English',
    paragraphs: [
      'Nordlys Planlegger has zero tolerance for child sexual abuse and exploitation (CSAE), including child sexual abuse material (CSAM) and grooming. Users must be at least 13. Anyone can report a person, an event or a group in the app (reason: "Bekymring for barns sikkerhet" – child safety concern) or by e-mail. Child safety reports are handled first, always within 24 hours: the content is removed, the account is banned and the case is reported to the Norwegian police (Kripos) and, where applicable, NCMEC. Contact: the e-mail address at the top of this page.',
    ],
  },
];

export const SUPPORT: LegalSection[] = [
  {
    title: 'Hvordan svarer gjestene?',
    paragraphs: [
      'Del lenken til arrangementet i gruppechatten. Gjestene åpner den i nettleseren og trykker på dagene de ikke kan – de trenger verken app eller konto.',
    ],
  },
  {
    title: 'Hvordan inviterer jeg folk til en gjeng?',
    paragraphs: ['Åpne gjengen og trykk «Inviter på Snapchat» eller «Send på andre måter». Den som åpner lenken lager en konto med e-post og er med.'],
  },
  {
    title: 'Rapportere eller blokkere',
    paragraphs: [
      'Trykk på en person og velg «Rapporter» eller «Blokker». Arrangementer og gjenger rapporterer du fra menyen «Mer». Vi går gjennom alle rapporter innen 24 timer. Blokkerte personer fjerner du under Profil → Personvern.',
    ],
  },
  {
    title: 'Logge inn',
    paragraphs: ['Skriv e-postadressen din, så sender vi en engangskode. Får du ikke koden, sjekk søppelpost-mappen eller be om en ny.'],
  },
  {
    title: 'Slette profilen',
    paragraphs: [
      'Gå til Profil → Personvern → Slett kontoen. Profilen, arrangementene og gjengene du har laget slettes med en gang. Du kan også eksportere dataene dine samme sted.',
      'Uten appen: logg inn på nordlysplanlegger.vercel.app og gjør det samme, eller send oss en e-post fra adressen du bruker i appen (se kontakt øverst), så sletter vi kontoen innen 30 dager.',
      'Dette slettes: profil, e-postadresse, profilbilde, arrangementer og gjenger du har laget, bilder du har delt og push-nøkler. Svar du har gitt i andres arrangementer blir stående uten navn, så deres oversikt fortsatt stemmer.',
    ],
  },
];
