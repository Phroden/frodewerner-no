// Tester for markdown fra Herah (src/lib/markdown.ts). Kjør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { md, safeHref } from "../src/lib/markdown.ts";

const html = (s: string) => md.parse(s, { async: false }) as string;

test("HTML i teksten blir tekst", () => {
  const out = html('Hei <meta http-equiv="refresh" content="0;url=https://evil.example">\n\n<script>alert(1)</script>\n\n<iframe src="https://evil.example"></iframe>');
  assert.ok(!/<meta|<script|<iframe/i.test(out), out);
  assert.match(out, /&lt;script&gt;/);
});

test("inline HTML blir tekst", () => {
  const out = html('Klikk <a href="https://evil.example">her</a> og <img src=x onerror=alert(1)>');
  assert.ok(!/<a |<img/i.test(out), out);
});

test("farlige lenker blir #", () => {
  for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "vbscript:x", "//evil.example", "/\\evil.example"]) {
    const out = html(`[x](${href}) ![b](${href})`);
    assert.ok(!/evil|javascript|data:|vbscript/i.test(out.replace(/&lt;b&gt;x&lt;\/b&gt;/, "")), `${href} → ${out}`);
  }
});

test("entiteter i lenker lurer ikke sjekken", () => {
  const out = html("[x](javascript&#58;alert(1)) [y](&#106;avascript:alert(1)) [z](javascript&colon;alert(1)) [w](java&#x09;script:alert(1))");
  assert.equal((out.match(/href="#"/g) ?? []).length, 4, out);
});

test("vanlige lenker og bilder virker", () => {
  const out = html("[a](https://frodewerner.no) [b](/kontakt) [c](#om) [d](mailto:post@example.com) [e](tel:+4712345678) ![f](https://herah.frodewerner.no/api/site/x/files/1)");
  for (const h of ["https://frodewerner.no", "/kontakt", "#om", "mailto:post@example.com", "tel:+4712345678", "https://herah.frodewerner.no/api/site/x/files/1"]) {
    assert.ok(out.includes(`"${h}"`), `${h} mangler i ${out}`);
  }
  assert.match(html("**fet** og _kursiv_"), /<strong>fet<\/strong>/);
});

test("safeHref", () => {
  assert.equal(safeHref("https://x.no"), "https://x.no");
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref(" java\tscript:alert(1)"), null);
  assert.equal(safeHref(""), null);
  assert.equal(safeHref(undefined), null);
});

test("codeMask: linjer i kodeblokker, som i Herah", async () => {
  const { codeMask } = await import("../src/lib/markdown.ts");
  const lines = ["a", "```js", "::samling[x](site:0)", "```", "::samling[y](site:1)", "``` ", "b"];
  assert.deepEqual(codeMask(lines), [false, true, true, true, false, true, true]);
});

test("herah:-lenker oversettes, ukjente blir tekst", async () => {
  const { md, setHerahLinks } = await import("../src/lib/markdown.ts");
  setHerahLinks((h) => (h === "herah:post/prosjekter/abc" ? "/prosjekter/abc" : h === "herah:side/kontakt" ? "/kontakt" : null));
  const out = md.parse("[Et prosjekt](herah:post/prosjekter/abc), [kontakt](herah:side/kontakt) og [ukjent](herah:samling/hemmelig)", { async: false }) as string;
  assert.match(out, /<a href="\/prosjekter\/abc">Et prosjekt<\/a>/);
  assert.match(out, /<a href="\/kontakt">kontakt<\/a>/);
  assert.ok(out.includes(" og ukjent") && !out.includes("hemmelig"), out);
  setHerahLinks(() => null);
});
