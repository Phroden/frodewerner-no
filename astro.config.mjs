import { defineConfig } from "astro/config";

// Bilder fra Herah lastes ned og skaleres når siden bygges (astro:assets), så de besøkende henter dem herfra og ikke fra Herah
const herahHost = new URL(process.env.HERAH_API ?? "https://herah.frodewerner.no").hostname;

export default defineConfig({
  site: "https://frodewerner.no",
  output: "static",
  image: { domains: [herahHost, "i.ytimg.com"] },
  // Stilarket som egen fil (ikke <style> i siden), så Caddy kan ha en streng CSP uten 'unsafe-inline'
  build: { inlineStylesheets: "never" },
  // Skript som egen fil også når det er lite (CSP: script-src 'self' tillater ikke inline-skript)
  vite: { build: { assetsInlineLimit: 0 } },
});
