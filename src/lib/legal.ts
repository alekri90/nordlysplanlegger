/**
 * Privacy policy and terms (Norwegian). Served at /personvern and /vilkar — the App Store listing
 * and the sign-in screen link here. Keep in sync with what the app actually stores.
 */
export const LEGAL = {
  /** Shown as the contact address on both pages. Empty → the line is hidden. */
  contactEmail: '',
  owner: 'Alexander Kristensen',
  updated: '6. oktober 2026',
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
      'Arrangementer: tittel, datoforslag, sted, beskrivelse, bilde, hvem som er invitert og hvilke dager hver enkelt ikke kan.',
      'Gjester uten profil: navnet du skriver inn og svarene dine. Telefonen din husker en tilfeldig nøkkel slik at du kan endre svaret senere – vi kobler aldri svar til en profil basert på navn.',
      'Venner og gjenger: hvem du er venn med, venneforespørsler og hvilke gjenger du er med i.',
      'Varsler: en anonym push-nøkkel for telefonen din og hvilke varsler du vil ha.',
    ],
  },
  {
    title: 'Hvem som ser hva',
    paragraphs: [
      'Visningsnavn, brukernavn og profilbilde kan sees av andre etter innstillingen du velger under Personvern: alle, venners venner eller ingen. E-postadressen din vises aldri.',
      'Svarene dine på et arrangement kan sees av arrangøren og de andre som er invitert til det samme arrangementet.',
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
      'Opplysningene lagres så lenge du har profil. Sletter du profilen, slettes profilen, arrangementene og gjengene du har laget, vennskapene, varslene og push-nøklene dine. Svar du har gitt på andres arrangementer blir stående som «En gjest», uten navn. Arrangøren kan når som helst slette et arrangement med alle svar.',
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
