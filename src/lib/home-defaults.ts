// Standardtekstene til forsiden. Samme som `DEFAULTS` i api/site_home.ts i Herah-repoet (der de vises i redigeringen).
// Brukes bare lokalt uten Herah, eller når Herah ikke har forsiden ennå – ellers kommer alt fra Herah.
export interface HomeContent {
  sections: { key: "hero" | "strip" | "tjenester" | "prosjekter" | "prosess" | "om" | "kontakt"; visible: boolean }[];
  hero: { badge: string; title: string; highlight: string; text: string; primary: { label: string; href: string }; secondary: { label: string; href: string };
          media: string; youtube: string; image: string | null };
  strip: { words: string[] };
  tjenester: { eyebrow: string; title: string; text: string };
  prosjekter: { eyebrow: string; title: string; text: string };
  prosess: { eyebrow: string; title: string; steps: { title: string; text: string }[] };
  om: { eyebrow: string; title: string; paragraphs: string[]; facts: string[]; image: string | null };
  kontakt: { title: string; text: string; email: string; phone: string; orgnr: string };
}

export const homeDefaults: HomeContent = {
  sections: ["hero", "strip", "tjenester", "prosjekter", "prosess", "om", "kontakt"].map((key) => ({ key: key as HomeContent["sections"][number]["key"], visible: true })),
  hero: {
    badge: "Film og trykk fra Nes på Romerike",
    title: "Gode historier, fortalt på film og papir.",
    highlight: "fortalt",
    text: "Jeg lager reklamefilm, dokumentar, eventfilm og trykksaker for bedrifter, kulturliv og foreninger. Personlig oppfølging fra første idé til ferdig fil – eller ferdig trykk.",
    primary: { label: "Se prosjekter →", href: "/prosjekter" },
    secondary: { label: "Ta en uforpliktende prat", href: "/kontakt" },
    media: "auto", youtube: "", image: null,
  },
  strip: { words: ["Reklamefilm", "Dokumentar", "Eventfilm", "Plakater", "Brosjyrer", "Kurs"] },
  tjenester: {
    eyebrow: "Tjenester",
    title: "Én leverandør for det som skal ses – på skjerm og på trykk.",
    text: "Film og trykksaker henger ofte sammen. Når det samme blikket står bak begge, får du et uttrykk som henger sammen også.",
  },
  prosjekter: { eyebrow: "Utvalgte prosjekter", title: "Nylig arbeid", text: "" },
  prosess: {
    eyebrow: "Slik jobber jeg",
    title: "Enkelt, tydelig og uten overraskelser.",
    steps: [
      { title: "Idé og plan", text: "Vi tar en prat om hva du vil oppnå, hvem du snakker til og hva budsjettet tillater. Du får et konkret forslag og en fast pris." },
      { title: "Produksjon", text: "Opptak, foto og design – med deg involvert underveis, så det du får er det du så for deg." },
      { title: "Levering", text: "Ferdig film i formatene du trenger, og trykkfiler klare for trykkeriet – eller ferdig trykket og levert." },
    ],
  },
  om: {
    eyebrow: "Om meg",
    title: "Hei, jeg heter Frode.",
    paragraphs: [
      "Jeg driver Frode Werner Film & Media fra Nes på Romerike. Til daglig underviser jeg i medier og kommunikasjon, og på kveldstid står jeg i maskinrommet på Nes Kulturhus. Film, bilder og trykk har fulgt meg hele veien.",
      "Når du jobber med meg, snakker du med den som faktisk gjør jobben – fra første skisse til siste eksport.",
    ],
    facts: ["Basert i Nes", "Oppdrag i hele landet", "Medieutdannet lærer"],
    image: null,
  },
  kontakt: {
    title: "Har du en idé?\nLa oss ta en kaffe.",
    text: "Fortell kort hva du tenker på, så kommer jeg tilbake med forslag og pris – vanligvis innen to virkedager.",
    email: "", phone: "", orgnr: "",
  },
};
