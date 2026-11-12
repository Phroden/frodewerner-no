// Tester for innebygde samlinger (src/lib/embeds.ts). Kjør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { type Embed, embedHtml, formatDate, valueHtml } from "../src/lib/embeds.ts";

const base: Embed = {
  label: "Standard størrelser <trykk>", layout: "table", title_name: "Format",
  fields: [{ id: "mal", name: "Mål", type: "text" }, { id: "url", name: "Lenke", type: "url" }],
  group_field: null, date_field: null, total: 2,
  items: [
    { id: "a", title: "A4", values: { mal: "210 × 297 mm", url: "javascript:alert(1)" } },
    { id: "b", title: "<img src=x onerror=alert(1)>", values: { mal: "297 × 420 mm", url: "https://example.com/a" } },
  ],
};

test("tabell med valgte kolonner, alt escapet", () => {
  const h = embedHtml(base);
  assert.match(h, /<table class="embed-table">/);
  assert.match(h, /<th scope="col">Mål<\/th>/);
  assert.match(h, /210 × 297 mm/);
  assert.ok(!h.includes("<img") && !h.includes("<trykk>"), h);
  assert.ok(!/href="javascript/i.test(h), h);
  assert.match(h, /href="https:\/\/example.com\/a"/);
});

test("galleri med toppbilder", () => {
  const h = embedHtml({ ...base, layout: "gallery" }, new Map([["a", "/_astro/a.webp"]]));
  assert.match(h, /<img src="\/_astro\/a.webp"/);
  assert.equal((h.match(/class="embed-card"/g) ?? []).length, 2);
});

test("tavle grupperer etter status og skjuler valgte kolonner", () => {
  const status = { id: "s", name: "Status", type: "status", config: { options: [{ id: "f", name: "Ferdig", group: "complete" }, { id: "p", name: "Pågår", group: "in_progress" }] } };
  const h = embedHtml({ ...base, layout: "board", group_field: { ...status, hidden_groups: ["f"] },
    items: [{ id: "a", title: "En", values: { s: "p" } }, { id: "b", title: "To", values: { s: "f" } }] });
  assert.match(h, /Pågår <span>1<\/span>/);
  assert.ok(!h.includes("Ferdig"), h);
});

test("kalender sortert etter dato", () => {
  const df = { id: "d", name: "Dato", type: "date" };
  const h = embedHtml({ ...base, layout: "calendar", date_field: df,
    items: [{ id: "a", title: "Senere", values: { d: { start: "2026-12-01" } } }, { id: "b", title: "Først", values: { d: { start: "2026-11-20T14:00" } } }, { id: "c", title: "Uten dato", values: {} }] });
  assert.ok(h.indexOf("Først") < h.indexOf("Senere"));
  assert.ok(!h.includes("Uten dato"));
  assert.match(h, /20\.11\.2026 14:00/);
});

test("verdier", () => {
  assert.equal(formatDate("2026-11-12"), "12.11.2026");
  assert.equal(valueHtml({ id: "x", name: "x", type: "select", config: { options: [{ id: "o", name: "Blank" }] } }, "o"), "Blank");
  assert.equal(valueHtml({ id: "x", name: "x", type: "number", config: { format: "kr" } }, 1234.5), "1 234,5 kr");
  assert.equal(valueHtml({ id: "x", name: "x", type: "relation" }, [{ title: "Kunde <AS>" }]), "Kunde &lt;AS&gt;");
  assert.equal(valueHtml({ id: "x", name: "x", type: "checkbox" }, false), "");
});

test("overskriften kan skjules", () => {
  assert.match(embedHtml(base), /<h3 class="embed-title">Standard størrelser &lt;trykk&gt;<\/h3>/);
  const h = embedHtml({ ...base, show_title: false });
  assert.ok(!h.includes("<h3"), h);
  assert.match(h, /<section class="embed embed-table" aria-label="Standard størrelser &lt;trykk&gt;">/);
  assert.match(embedHtml({ ...base, label: "Våre formater" }), />Våre formater<\/h3>/);
});

test("tom blokk og «viser N av M»", () => {
  assert.match(embedHtml({ ...base, items: [], total: 0 }), /Ingen oppføringer/);
  assert.match(embedHtml({ ...base, total: 700 }), /Viser 2 av 700/);
});

test("bokmerke som kort, og bare http(s)", async () => {
  const { bookmarkHtml } = await import("../src/lib/embeds.ts");
  const h = bookmarkHtml("https://www.example.com/side", "Min lenke", { title: "Eksempel <b>", description: "Beskrivelse", site: "Example" }, "/_astro/b.webp");
  assert.match(h, /<a class="bookmark" href="https:\/\/www.example.com\/side" rel="noopener">/);
  assert.match(h, /<strong>Eksempel &lt;b&gt;<\/strong><span>Beskrivelse<\/span><small>Example<\/small>/);
  assert.match(h, /<img src="\/_astro\/b.webp"/);
  assert.match(bookmarkHtml("https://www.example.com/", "", null), /<strong>example.com<\/strong>/);
  assert.equal(bookmarkHtml("javascript:alert(1)", "x", null), "");
  assert.equal(bookmarkHtml("mailto:a@b.no", "x", null), "");
});
