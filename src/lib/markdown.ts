// Markdown fra Herah → HTML, uten astro-avhengigheter (så det kan testes med node: npm test).
import { Marked, type Tokens } from "marked";

/**
 * Hvilke linjer som står i en kodeblokk, slik Herah leser dem (`codeMask` i site_embed.ts / renderMarkdown i core.js):
 * en linje som starter med ``` åpner, en linje med bare ``` lukker. En blokklinje (::samling …) i en kodeblokk er tekst.
 */
export function codeMask(lines: string[]): boolean[] {
  let code = false;
  return lines.map((l) => {
    if (code) {
      if (/^\s*```\s*$/.test(l)) code = false;
      return true;
    }
    if (/^\s*```/.test(l)) {
      code = true;
      return true;
    }
    return false;
  });
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Tallentiteter og de navngitte som kan lage «:» eller mellomrom; null hvis noe er ugyldig */
function decodeEntities(s: string): string | null {
  try {
    return s
      .replace(/&#x([0-9a-f]+);?/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
      .replace(/&#(\d+);?/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&colon;/gi, ":").replace(/&(tab|newline);/gi, " ");
  } catch {
    return null;
  }
}

/**
 * Bare http(s), mailto:, tel: og relative adresser (/…, #…, sti uten skjema) slipper gjennom; ellers null.
 * Brukes på lenker i teksten og på URL-feltet («Se prosjektet»), så javascript: o.l. aldri havner på siden.
 */
export function safeHref(href: string | null | undefined): string | null {
  const h = (href ?? "").trim();
  if (!h) return null;
  // Nettleseren dekoder entiteter i attributter («javascript&#58;» = «javascript:»), så sjekken gjøres på den dekodede adressen
  const d = decodeEntities(h);
  if (d === null || /[\s\\\u0000-\u001f]/.test(d) || d.startsWith("//")) return null;
  const scheme = d.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if (scheme && !["http", "https", "mailto", "tel"].includes(scheme)) return null;
  return h;
}

/**
 * Markdown slik Herah viser den: HTML i teksten er tekst, ikke kode (Herah bygger visningen med DOM og viser «<b>» som «<b>»).
 * Uten dette ville HTML i et notat – skrevet av deg, importert fra Notion eller lagt inn av KI-en over MCP – havne rett på nettsiden.
 */
/**
 * Lenker Herah har skrevet om til nettstedet (herah:post/<slug>/<id>, herah:samling/<slug>, herah:side/<slug>) → adresser her.
 * Settes av herah.ts (som vet hvilke sider som finnes). null = ingen side her: lenka blir vanlig tekst.
 */
let herahLinks: (href: string) => string | null = () => null;
export function setHerahLinks(fn: (href: string) => string | null) {
  herahLinks = fn;
}

export const md = new Marked({
  renderer: {
    html: ({ text }: Tokens.HTML | Tokens.Tag) => escapeHtml(text),
    // En herah:-lenke uten side her blir vanlig tekst (href tom), ellers som vanlig
    link(this: { parser: { parseInline(t: unknown[]): string } }, token: Tokens.Link) {
      return token.href ? false : this.parser.parseInline(token.tokens);
    },
  },
  walkTokens(token) {
    if (token.type === "link" || token.type === "image") {
      const t = token as Tokens.Link | Tokens.Image;
      if (t.type === "link" && t.href.startsWith("herah:")) t.href = herahLinks(t.href) ?? "";
      else t.href = safeHref(t.href) ?? "#";
    }
  },
});
