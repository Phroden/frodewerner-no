// Henter det som er publisert i Herah (herah.frodewerner.no/api/site) når siden bygges.
// Alt er offentlig, så ingen nøkler trengs. Finnes ikke Herah-data, brukes `fallback` bare lokalt
// (HERAH_ALLOW_FALLBACK != "0"); i produksjonsbygget feiler bygget heller enn å publisere plassholdere.
import { marked } from "marked";
import { getImage, inferRemoteSize } from "astro:assets";
import { fallback } from "./fallback";

const API = (process.env.HERAH_API ?? "https://herah.frodewerner.no").replace(/\/$/, "");
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
}
export interface PageContent { title: string; html: string }

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}/api/site${path}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return await r.json() as T;
}

const toList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : (x as { name?: string; title?: string })?.name ?? (x as { title?: string })?.title ?? "")).filter(Boolean)
  : typeof v === "string" && v ? [v] : [];

/**
 * Et bilde fra Herah, lastet ned og skalert (webp) når siden bygges. Det havner i dist/_astro sammen med resten av nettsiden,
 * så de besøkende ikke henter originalen (ofte 1920 px) fra Herah, og bildene virker selv om Herah er nede.
 * Går det ikke, brukes adressen hos Herah (bygget stopper ikke for ett bilde).
 */
const images = new Map<string, Promise<string>>();
export function localImage(src: string, width = 1200): Promise<string> {
  const key = `${src}|${width}`;
  if (!images.has(key)) {
    images.set(key, inferRemoteSize(src)
      .then((size) => {
        // Aldri større enn originalen
        const w = Math.min(width, size.width), h = Math.round((size.height * w) / size.width);
        return getImage({ src, width: w, height: h, format: "webp", quality: 80 });
      })
      .then((img) => img.src)
      .catch((e) => {
        console.warn(`[herah] bildet ${src} ble ikke lastet ned (${(e as Error).message}) – bruker adressen hos Herah`);
        return src;
      }));
  }
  return images.get(key)!;
}

/** Markdown fra Herah → HTML. Egne blokker (::samling, ::side …) fjernes, og bilder lastes ned (localImage). */
export async function render(md: string, slug: string): Promise<string> {
  const text = md.split("\n").filter((l) => !/^\s*::[a-zæøå]+\[/.test(l)).join("\n")
    .replace(/\/api\/ws\/files\/([0-9a-f-]{36})/gi, `${API}/api/site/${slug}/files/$1`);
  let html = marked.parse(text, { async: false }) as string;
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
  fields: { id: string; name: string; config?: { options?: { id: string; name: string }[] } }[];
  items: { id: string; title: string; values: Record<string, unknown> }[];
};
type RecordResp = { record: { body?: string; cover?: string | null } };

/** Alle poster i en publisert samling, med notat og toppbilde hentet per post. Hentes én gang per bygg (flere sider bruker samme samling). */
const collections = new Map<string, Promise<Item[]>>();
export function collection(slug: string): Promise<Item[]> {
  if (!collections.has(slug)) collections.set(slug, loadCollection(slug));
  return collections.get(slug)!;
}

async function loadCollection(slug: string): Promise<Item[]> {
  try {
    const c = await get<CollectionResp>(`/${slug}`);
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
        html = await render(r.body ?? "", slug);
        cover = r.cover ? await localImage(`${API}/api/site/${slug}/files/${r.cover}`, 1600) : null;
      } catch { /* posten mangler notat eller bilde */ }
      const url = toList(byName("url", it.values))[0] ?? "";
      return {
        id: it.id, title: it.title, type: toList(byName("type", it.values)).concat(toList(byName("tags", it.values))),
        status: toList(byName("status", it.values))[0] ?? "", url, html, cover, excerpt: clip(plain(html)),
      };
    }));
  } catch (e) {
    if (!ALLOW_FALLBACK) throw new Error(`Fant ikke "${slug}" i Herah (${(e as Error).message}). Er den publisert?`);
    console.warn(`[herah] ${slug}: bruker plassholdere (${(e as Error).message})`);
    return fallback.collections[slug] ?? [];
  }
}

/** En publisert side (tekst), eller null hvis den ikke finnes */
export async function page(slug: string): Promise<PageContent | null> {
  try {
    const p = (await get<{ page: { title: string; body: string } }>(`/${slug}`)).page;
    return { title: p.title, html: await render(p.body, slug) };
  } catch {
    return ALLOW_FALLBACK ? (fallback.pages[slug] ?? null) : null;
  }
}
