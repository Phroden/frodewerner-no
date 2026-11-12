// Innebygde samlinger fra Herah (::samling-blokker i publiserte sider og postnotater) → statisk HTML.
// Herah sender bare postene blokken viser og kolonnene som er valgt for nettsiden («🌐 Kolonner på nettsiden» på blokken).
// Uten astro-avhengigheter, så det kan testes med node (npm test). Alt fra Herah escapes; lenker går gjennom safeHref.
import { safeHref } from "./markdown.ts";

export interface EmbedField {
  id: string;
  name: string;
  type: string;
  config?: { options?: { id: string; name: string; group?: string }[]; format?: string };
}
export interface EmbedItem {
  id: string;
  title: string;
  values: Record<string, unknown>;
  cover?: string | null;
  cover_pos?: number;
}
export interface Embed {
  label: string;
  layout: "table" | "gallery" | "board" | "calendar" | string;
  title_name: string;
  fields: EmbedField[];
  group_field: (EmbedField & { hidden_groups?: string[]; hide_empty?: boolean }) | null;
  date_field: EmbedField | null;
  total: number;
  items: EmbedItem[];
}

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const pad = (n: number) => String(n).padStart(2, "0");

/** «2026-11-12» → «12.11.2026», «2026-11-12T14:00» → «12.11.2026 14:00» (tiden står som Herah lagret den) */
export function formatDate(s: unknown): string {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ""}`;
}

const dateStart = (v: unknown) => (v && typeof v === "object" ? String((v as { start?: string }).start ?? "") : "");

/** Verdien i et felt som HTML (escapet) */
export function valueHtml(f: EmbedField, v: unknown, fileUrl?: (id: string) => string): string {
  if (v == null || v === "") return "";
  const opt = (id: unknown) => f.config?.options?.find((o) => o.id === id)?.name ?? "";
  switch (f.type) {
    case "select":
    case "status":
      return esc(opt(v));
    case "multi_select":
      return Array.isArray(v) ? v.map((x) => esc(opt(x))).filter(Boolean).join(", ") : "";
    case "checkbox":
      return v === true ? `<span aria-label="Ja">✓</span>` : "";
    case "number": {
      const n = Number(v);
      if (!Number.isFinite(n)) return "";
      const fmt = f.config?.format ?? "";
      const txt = n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
      return esc(/kr|nok/i.test(fmt) ? `${txt} kr` : /percent|prosent/i.test(fmt) ? `${txt} %` : txt);
    }
    case "date": {
      const d = v as { start?: string; end?: string };
      const a = formatDate(d.start), b = formatDate(d.end);
      return esc(b && b !== a ? `${a} – ${b}` : a);
    }
    case "url": {
      const h = safeHref(String(v));
      if (!h) return esc(v);
      const shown = String(v).replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
      return `<a href="${esc(h)}" rel="noopener">${esc(shown.length > 40 ? shown.slice(0, 38) + "…" : shown)}</a>`;
    }
    case "email":
      return /^[^\s@<>"]+@[^\s@<>"]+$/.test(String(v)) ? `<a href="mailto:${esc(v)}">${esc(v)}</a>` : esc(v);
    case "phone": {
      const tel = String(v).replace(/[^0-9+]/g, "");
      return tel ? `<a href="tel:${esc(tel)}">${esc(v)}</a>` : esc(v);
    }
    case "relation":
      return Array.isArray(v) ? v.map((x) => esc((x as { title?: string })?.title)).filter(Boolean).join(", ") : "";
    case "file":
      return Array.isArray(v)
        ? v.map((x) => {
          const file = x as { id?: string; name?: string };
          return fileUrl && file.id ? `<a href="${esc(fileUrl(file.id))}" rel="noopener">${esc(file.name)}</a>` : esc(file.name);
        }).join(", ")
        : "";
    default:
      return esc(v).replace(/\n/g, "<br>");
  }
}

/** Feltene på en post som «Navn: verdi»-liste (kort, tavle, kalender) */
function detailsHtml(e: Embed, it: EmbedItem, fileUrl?: (id: string) => string, skip?: string): string {
  const rows = e.fields.filter((f) => f.id !== skip)
    .map((f) => [f, valueHtml(f, it.values[f.id], fileUrl)] as const)
    .filter(([, v]) => v)
    .map(([f, v]) => `<div><dt>${esc(f.name)}</dt><dd>${v}</dd></div>`);
  return rows.length ? `<dl class="embed-dl">${rows.join("")}</dl>` : "";
}

const GROUP_ORDER: Record<string, number> = { todo: 0, in_progress: 1, complete: 2 };

/**
 * En blokk som HTML. `covers` er toppbildene (post-id → adresse, allerede lastet ned ved bygging),
 * `fileUrl` gir adressen til en fil i et filfelt.
 */
export function embedHtml(e: Embed, covers: Map<string, string> = new Map(), fileUrl?: (id: string) => string): string {
  const head = `<h3 class="embed-title">${esc(e.label)}</h3>`;
  const more = e.total > e.items.length ? `<p class="embed-more">Viser ${e.items.length} av ${e.total}.</p>` : "";
  if (!e.items.length) return `<section class="embed">${head}<p class="embed-empty">Ingen oppføringer.</p></section>`;
  let body: string;

  if (e.layout === "gallery") {
    body = `<div class="embed-cards">${e.items.map((it) => {
      const img = covers.get(it.id);
      return `<article class="embed-card">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}<div class="embed-card-body"><h4>${esc(it.title || "Uten navn")}</h4>${detailsHtml(e, it, fileUrl)}</div></article>`;
    }).join("")}</div>`;
  } else if (e.layout === "board" && e.group_field) {
    const gf = e.group_field;
    const hidden = new Set(gf.hidden_groups ?? []);
    const opts = (gf.config?.options ?? []).map((o, i) => ({ o, i }))
      .sort((a, b) => (gf.type === "status" ? (GROUP_ORDER[a.o.group ?? ""] ?? 0) - (GROUP_ORDER[b.o.group ?? ""] ?? 0) : 0) || a.i - b.i)
      .map((x) => x.o);
    const groups = [{ id: "none", name: `Uten ${gf.name.toLowerCase()}` }, ...opts.map((o) => ({ id: o.id, name: o.name }))];
    const known = new Set(opts.map((o) => o.id));
    const cols = groups.filter((g) => !hidden.has(g.id)).map((g) => {
      const its = e.items.filter((it) => {
        const v = it.values[gf.id];
        return g.id === "none" ? !known.has(String(v ?? "")) : v === g.id;
      });
      if (!its.length && (gf.hide_empty || g.id === "none")) return "";
      return `<section class="embed-col"><h4>${esc(g.name)} <span>${its.length}</span></h4><ul>${
        its.map((it) => `<li><strong>${esc(it.title || "Uten navn")}</strong>${detailsHtml(e, it, fileUrl, gf.id)}</li>`).join("")
      }</ul></section>`;
    }).join("");
    body = `<div class="embed-board">${cols}</div>`;
  } else if (e.layout === "calendar" && e.date_field) {
    const df = e.date_field;
    const dated = e.items.filter((it) => dateStart(it.values[df.id])).sort((a, b) => dateStart(a.values[df.id]).localeCompare(dateStart(b.values[df.id])));
    body = dated.length
      ? `<ul class="embed-dates">${dated.map((it) =>
        `<li><time datetime="${esc(dateStart(it.values[df.id]))}">${valueHtml(df, it.values[df.id])}</time><div><strong>${esc(it.title || "Uten navn")}</strong>${detailsHtml(e, it, fileUrl, df.id)}</div></li>`
      ).join("")}</ul>`
      : `<p class="embed-empty">Ingen oppføringer med dato.</p>`;
  } else {
    body = `<div class="embed-table-wrap"><table class="embed-table"><thead><tr><th scope="col">${esc(e.title_name)}</th>${
      e.fields.map((f) => `<th scope="col">${esc(f.name)}</th>`).join("")
    }</tr></thead><tbody>${
      e.items.map((it) => `<tr><th scope="row">${esc(it.title || "Uten navn")}</th>${e.fields.map((f) => `<td>${valueHtml(f, it.values[f.id], fileUrl)}</td>`).join("")}</tr>`).join("")
    }</tbody></table></div>`;
  }
  return `<section class="embed embed-${esc(e.layout)}">${head}${body}${more}</section>`;
}
