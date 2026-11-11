// Plassholdere for lokal utvikling uten tilgang til Herah. Brukes aldri i produksjonsbygget (HERAH_ALLOW_FALLBACK=0).
import type { Item, PageContent } from "./herah";

const item = (id: string, title: string, type: string[], text: string): Item => ({
  id, title, type, status: "", url: "", excerpt: text, html: `<p>${text}</p>`, cover: null,
});

export const fallback: { collections: Record<string, Item[]>; pages: Record<string, PageContent> } = {
  collections: {
    tjenester: [
      item("t1", "Filmproduksjon", ["Film"], "Fra idé og manus til opptak og ferdig film. (plassholder)"),
      item("t2", "Flerkamera-stream", ["Stream"], "Live-sending med flere kameraer. (plassholder)"),
      item("t3", "Klipp og etterarbeid", ["Klipp"], "Klipp, lyd og farge. (plassholder)"),
    ],
    prosjekter: [
      item("p1", "Eksempelprosjekt", ["Film"], "Her kommer prosjektene dine fra Herah. (plassholder)"),
    ],
  },
  pages: {
    kontakt: { title: "Kontakt", html: "<p>Kontaktinformasjon kommer. (plassholder)</p>" },
  },
};
