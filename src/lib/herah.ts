// Henter det som er publisert i Herah (herah.frodewerner.no/api/site) når siden bygges.
// Alt er offentlig, så ingen nøkler trengs. Finnes ikke Herah-data, brukes `fallback` bare lokalt
// (HERAH_ALLOW_FALLBACK != "0"); i produksjonsbygget feiler bygget heller enn å publisere plassholdere.
import { codeMask, md as markdown, safeHref, setHerahLinks } from "./markdown";
import { bookmarkHtml, type Bookmark, type Embed, embedHtml } from "./embeds";
import { getImage, inferRemoteSize } from "astro:assets";
import { fallback } from "./fallback";
import { homeDefaults, type HomeContent } from "./home-defaults";
export type { HomeContent };

const API = (process.env.HERAH_API ?? "https://herah.frodewerner.no").replace(/\/$/, "");

/**
 * Oppføringene i Herah (Nettsted) som nettsiden bruker. Står i /herah-build.json (`uses`), så Nettsted-fanen i Herah kan si fra
 * om publiserte oppføringer som ikke vises noe sted (de er likevel åpne i API-et). collection()/page() godtar bare disse.
 */
export const SLUGS = ["tjenester", "prosjekter", "kontakt"] as const;
export type Slug = typeof SLUGS[number];
/** Adressene her for oppføringene i SLUGS, og hvilke som har en egen side per post (/prosjekter/<id>) */
const ROUTES: Record<Slug, string> = { tjenester: "/tjenester", prosjekter: "/prosjekter", kontakt: "/kontakt" };
const HAS_POSTS: Partial<Record<Slug, true>> = { tjenester: true, prosjekter: true };

/** herah:post/<slug>/<id> → /prosjekter/<id>, herah:samling/<slug> og herah:side/<slug> → /prosjekter, /kontakt; ukjent → null (tekst) */
export function herahHref(href: string): string | null {
  const m = href.match(/^herah:(post|samling|side)\/([a-z0-9-]+)(?:\/([0-9a-f-]{36}))?$/i);
  if (!m || !(m[2] in ROUTES)) return null;
  const slug = m[2] as Slug;
  return m[1] === "post" && m[3] && HAS_POSTS[slug] ? `${ROUTES[slug]}/${m[3].toLowerCase()}` : ROUTES[slug];
}
setHerahLinks(herahHref);

const checkSlug = (slug: string) => {
  if (!(SLUGS as readonly string[]).includes(slug)) throw new Error(`«${slug}» er ikke i SLUGS i src/lib/herah.ts – legg den til der`);
};
const ALLOW_FALLBACK = (process.env.HERAH_ALLOW_FALLBACK ?? "1") !== "0";

export interface Item {
  id: string;
  title: string;
  type: string[];
  status: string;
  url: string;
  excerpt: string;
  html: string;
  cover: string | null;
  /** Skal posten ha en egen side? Styres under «Nettsted» i Herah (Postene kan åpnes). Mangler = ja. */
  link?: boolean;
}
export interface PageContent { title: string; html: string }
type Embeds = Record<string, Embed | null> | undefined;

class HerahError extends Error {
  constructor(path: string, readonly status: number) { super(`${path}: ${status}`); }
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}/api/site${path}`);
  if (!r.ok) throw new HerahError(path, r.status);
  return await r.json() as T;
}

/** 404 fra Herah = ikke publisert. Alt annet (nettverksfeil, 500) skal stoppe produksjonsbygget, så forrige versjon blir stående. */
const notPublished = (e: unknown) => e instanceof HerahError && e.status === 404;


const toList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : (x as { name?: string; title?: string })?.name ?? (x as { title?: string })?.title ?? "")).filter(Boolean)
  : typeof v === "string" && v ? [v] : [];

/**
 * Et bilde fra Herah, lastet ned og skalert (webp) når siden bygges. Det havner i dist/_astro sammen med resten av nettsiden,
 * så de besøkende ikke henter originalen (ofte 1920 px) fra Herah, og bildene virker selv om Herah er nede.
 * Går det ikke, brukes adressen hos Herah (bygget stopper ikke for ett bilde).
 */
const images = new Map<string, Promise<string>>();
export function localImage(src: string, width = 1200, remoteFallback = true): Promise<string> {
  const key = `${src}|${width}|${remoteFallback}`;
  if (!images.has(key)) {
    images.set(key, inferRemoteSize(src)
      .then((size) => {
        // Aldri større enn originalen
        const w = Math.min(width, size.width), h = Math.round((size.height * w) / size.width);
        return getImage({ src, width: w, height: h, format: "webp", quality: 80 });
      })
      .then((img) => img.src)
      .catch((e) => {
        console.warn(`[herah] bildet ${src} ble ikke lastet ned (${(e as Error).message})${remoteFallback ? " – bruker adressen hos Herah" : ""}`);
        return remoteFallback ? src : "";
      }));
  }
  return images.get(key)!;
}

/** En side som er inkludert med ::inkluder: hentes fra Herah og vises inne i teksten (høyst tre nivåer, aldri i ring) */
async function includedPage(slug: string, id: string, seen: Set<string>): Promise<string> {
  if (seen.has(id) || seen.size >= 3) return "";
  try {
    const p = (await get<{ page: { id: string; body: string; embeds?: Embeds } }>(`/${slug}/p/${id}`)).page;
    return `<div class="included">${await render(p.body ?? "", slug, p.embeds, p.id, new Set([...seen, id]))}</div>`;
  } catch (e) {
    if (ALLOW_FALLBACK || notPublished(e)) return "";
    throw new Error(`Kunne ikke hente siden som er inkludert i "${slug}" (${(e as Error).message})`);
  }
}

/** Det Herah har hentet om et bokmerke (tittel, beskrivelse, bilde). null hvis det ikke går – et bokmerke stopper aldri bygget. */
async function bookmarkMeta(url: string): Promise<(Bookmark & { image?: string | null }) | null> {
  try {
    const r = await fetch(`${API}/api/bookmark?${new URLSearchParams({ url })}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.ok ? d : null;
  } catch {
    return null;
  }
}

/**
 * Markdown fra Herah → HTML. Innebygde samlinger (`::samling[…](site:N)`, innholdet i `embeds[N]`) blir tabell, kort, tavle eller datoliste
 * (embeds.ts), bokmerker blir kort med bilde; andre egne blokker (::side, ::inkluder, skjulte samlinger) fjernes. Linjer i kodeblokker
 * står urørt. Bilder lastes ned (localImage). `src` er id-en til siden eller posten teksten hører til (filene i blokkene hentes via den).
 */
export async function render(md: string, slug: string, embeds?: Embeds, src = "", seen: Set<string> = new Set()): Promise<string> {
  const blocks: string[] = [];
  const lines: string[] = [];
  const all = md.split("\n");
  const code = codeMask(all);
  // Plassholder som marked lar være i fred; byttes med HTML-en etterpå
  const placeholder = (html: string) => {
    if (!html) return;
    lines.push("", `HERAHEMBED${blocks.length}X`, "");
    blocks.push(html);
  };
  let m2: RegExpMatchArray | null;
  for (const [i, l] of all.entries()) {
    if (code[i]) {
      lines.push(l);
      continue;
    }
    const m = l.match(/^\s*::samling\[[^\]]*\]\(site:(\d+)\)\s*$/);
    const e = m ? embeds?.[m[1]] : null;
    const bm = l.match(/^\s*::bokmerke\[([^\]]*)\]\(([^)\s]*)\)\s*$/);
    if (e && src) {
      const base = `${API}/api/site/${slug}/e/${src}/${m![1]}/files`;
      const covers = new Map<string, string>();
      for (const it of e.items) if (it.cover) covers.set(it.id, await localImage(`${base}/${it.cover}`, 900));
      placeholder(embedHtml(e, covers, (id) => `${base}/${id}`));
    } else if (bm) {
      let url = bm[2];
      try { url = decodeURIComponent(url); } catch { /* som den er */ }
      const meta = /^https?:\/\//i.test(url) ? await bookmarkMeta(url) : null;
      const img = meta?.image?.startsWith("/api/bookmark-img/") ? await localImage(`${API}${meta.image}`, 600, false) : "";
      placeholder(bookmarkHtml(url, bm[1], meta, img));
    } else if ((m2 = l.match(/^\s*::inkluder\[[^\]]*\]\(([0-9a-f-]{36})\)\s*$/i))) {
      // «Innhold fra side»: siden hentes og vises her (Herah sender den bare når den er en del av det publiserte)
      placeholder(await includedPage(slug, m2[1].toLowerCase(), seen));
    } else if (!/^\s*::[a-zæøå]+\[/.test(l)) lines.push(l);
  }
  const text = lines.join("\n").replace(/\/api\/ws\/files\/([0-9a-f-]{36})/gi, `${API}/api/site/${slug}/files/$1`);
  let html = markdown.parse(text, { async: false }) as string;
  html = html.replace(/<p>HERAHEMBED(\d+)X<\/p>/g, (_, i) => blocks[Number(i)] ?? "");
  // Bilder i teksten: <img src="https://herah…/api/site/<slug>/files/<id>">
  const prefix = `${API}/api/site/`;
  const srcs = [...new Set([...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1]).filter((u) => u.startsWith(prefix)))];
  for (const src of srcs) {
    const local = await localImage(src, 1200);
    html = html.split(`src="${src}"`).join(`src="${local}" loading="lazy"`);
  }
  return html;
}
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const clip = (s: string, n = 160) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);

type CollectionResp = {
  links?: boolean;
  total?: number;
  fields: { id: string; name: string; config?: { options?: { id: string; name: string }[] } }[];
  items: { id: string; title: string; values: Record<string, unknown> }[];
};
type RecordResp = { record: { body?: string; cover?: string | null; embeds?: Embeds } };

/** Alle poster i en publisert samling, med notat og toppbilde hentet per post. Hentes én gang per bygg (flere sider bruker samme samling). */
const collections = new Map<string, Promise<Item[]>>();
export function collection(slug: Slug): Promise<Item[]> {
  checkSlug(slug);
  if (!collections.has(slug)) collections.set(slug, loadCollection(slug));
  return collections.get(slug)!;
}

async function loadCollection(slug: string): Promise<Item[]> {
  try {
    // Herah gir 500 poster om gangen; hent resten med offset
    const c = await get<CollectionResp>(`/${slug}`);
    while (c.total != null && c.items.length < c.total) {
      const more = await get<CollectionResp>(`/${slug}?offset=${c.items.length}`);
      if (!more.items.length) break;
      c.items.push(...more.items);
    }
    // Valg (select, flervalg, status) lagres som id-er; gjør dem om til navnene
    const byName = (name: string, values: Record<string, unknown>) => {
      const f = c.fields.find((x) => x.name.toLowerCase() === name);
      const raw = f ? values[f.id] : undefined;
      const options = f?.config?.options;
      if (!options) return raw;
      const label = (id: unknown) => options.find((o) => o.id === id)?.name ?? "";
      return Array.isArray(raw) ? raw.map(label) : raw == null ? raw : label(raw);
    };
    return await Promise.all(c.items.map(async (it) => {
      let html = "", cover: string | null = null;
      try {
        const r = (await get<RecordResp>(`/${slug}/r/${it.id}`)).record;
        html = await render(r.body ?? "", slug, r.embeds, it.id);
        cover = r.cover ? await localImage(`${API}/api/site/${slug}/files/${r.cover}`, 1600) : null;
      } catch (e) {
        // I produksjon stopper bygget heller enn å publisere prosjekter uten tekst og bilde fordi én henting feilet
        if (!ALLOW_FALLBACK) throw e;
        console.warn(`[herah] ${slug}/${it.id}: uten notat og bilde (${(e as Error).message})`);
      }
      const url = safeHref(toList(byName("url", it.values))[0]) ?? "";
      return {
        id: it.id, title: it.title, type: toList(byName("type", it.values)).concat(toList(byName("tags", it.values))),
        status: toList(byName("status", it.values))[0] ?? "", url, html, cover, excerpt: clip(plain(html)),
        link: c.links !== false,
      };
    }));
  } catch (e) {
    if (!ALLOW_FALLBACK) throw new Error(`Fant ikke "${slug}" i Herah (${(e as Error).message}). Er den publisert?`);
    console.warn(`[herah] ${slug}: bruker plassholdere (${(e as Error).message})`);
    return fallback.collections[slug] ?? [];
  }
}

/** En publisert side (tekst), eller null hvis den ikke er publisert. Andre feil stopper produksjonsbygget. */
export async function page(slug: Slug): Promise<PageContent | null> {
  checkSlug(slug);
  try {
    const p = (await get<{ page: { id: string; title: string; body: string; embeds?: Embeds } }>(`/${slug}`)).page;
    return { title: p.title, html: await render(p.body, slug, p.embeds, p.id, new Set([p.id])) };
  } catch (e) {
    if (ALLOW_FALLBACK) return fallback.pages[slug] ?? null;
    if (notPublished(e)) return null;
    throw new Error(`Kunne ikke hente "${slug}" fra Herah (${(e as Error).message})`);
  }
}

/**
 * Menyen: slugene som er publisert og har «Vis i menyen» på i Herah. null = vis alt (lokalt uten Herah).
 */
let menuPromise: Promise<Set<string> | null> | null = null;
export function menu(): Promise<Set<string> | null> {
  menuPromise ??= (async () => {
    try {
      const r = await get<{ items: { slug: string; in_menu: boolean }[] }>("");
      return new Set(r.items.filter((i) => i.in_menu).map((i) => i.slug));
    } catch (e) {
      if (ALLOW_FALLBACK) return null;
      throw new Error(`Fant ikke menyen i Herah (${(e as Error).message})`);
    }
  })();
  return menuPromise;
}


// ---------------------------------------------------------------------------
// Forsiden (Nettsted → Forside i Herah). Standardtekstene ligger i home-defaults.ts og brukes bare lokalt eller hvis Herah ikke har forsiden ennå.
// ---------------------------------------------------------------------------

let homePromise: Promise<HomeContent> | null = null;
export function home(): Promise<HomeContent> {
  homePromise ??= (async () => {
    try {
      return await get<HomeContent>("/home");
    } catch (e) {
      const msg = (e as Error).message;
      // Eldre Herah uten forside-API (404): standardtekstene. Andre feil stopper bygget, så en nettfeil ikke publiserer standardtekster over det du har skrevet.
      if (ALLOW_FALLBACK || msg.endsWith(": 404")) {
        console.warn(`[herah] forsiden: bruker standardtekstene (${msg})`);
        return structuredClone(homeDefaults);
      }
      throw new Error(`Fant ikke forsiden i Herah (${msg})`);
    }
  })();
  return homePromise;
}

/** Bilde lastet opp under Nettsted → Forside, lastet ned og skalert ved bygging */
export const homeImage = (id: string, width = 1600) => localImage(`${API}/api/site/home/files/${id}`, width);

/** Miniatyrbilde fra YouTube, lastet ned ved bygging så besøkende ikke kontakter YouTube før de trykker på videoen. "" hvis det ikke går. */
export async function youtubeThumb(id: string): Promise<string> {
  for (const name of ["maxresdefault", "hqdefault"]) {
    const url = `https://i.ytimg.com/vi/${id}/${name}.jpg`;
    try {
      if (!(await fetch(url, { method: "HEAD" })).ok) continue;
    } catch { continue; }
    const local = await localImage(url, 1280, false);
    if (local) return local;
  }
  return "";
}
