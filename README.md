# frodewerner.no

Nettsiden til Frode Werner Film & Media. Statisk side (Astro) som henter innholdet fra Herah
(`herah.frodewerner.no/api/site`) når den bygges. Hva som vises, bestemmer du i Herah: alt er skjult til du publiserer det.

## Sider og hvor innholdet kommer fra

| Side | Kilde i Herah (slug) |
|---|---|
| `/tjenester` og forsiden | samlingen med slug `tjenester` (tittel, `Tags`, og notatet på posten som beskrivelse) |
| `/prosjekter`, `/prosjekter/<id>` og forsiden | samlingen med slug `prosjekter` (tittel, `Type`, `URL`, notat og toppbilde) |
| `/kontakt` | siden med slug `kontakt` |

Publiser en samling eller side i Herah (`POST /api/ws/site`) med riktig slug, velg hvilke felt som skal vises (`visible_fields`)
og slå på `include_body` for notatene. Bare tittelfeltet og feltene du velger, sendes ut.

**Menyen** følger «Vis i menyen» i Herah for `tjenester` og `prosjekter` (`menu()` i `src/lib/herah.ts`); «Om meg» vises når seksjonen er synlig
på forsiden, og Kontakt vises alltid.

**Tekst** (notater og sider) gjøres om fra markdown med `src/lib/markdown.ts`: HTML i teksten vises som tekst, slik Herah selv viser den, og lenker
og bilder godtas bare med http(s), mailto:, tel: eller relativ adresse (ellers `#`). Det samme gjelder URL-feltet («Se prosjektet»).
Tester: `npm test`.

**Innebygde samlinger**: en samling du bygger inn i en publisert side eller et publisert postnotat i Herah (`::samling`-blokk), vises på nettsiden med postene
blokken viser og kolonnene du velger under «🌐 Kolonner på nettsiden» i ⚙ på blokken. Herah sender den som `::samling[…](site:N)` med innholdet i `embeds[N]`;
`src/lib/embeds.ts` lager tabell, kort med toppbilde (galleri), tavle eller datoliste (kalender) som statisk HTML. Toppbildene lastes ned ved bygging. Overskriften over blokken
er blokkens navn (kan endres i ⚙ på blokken) og kan skjules der («Vis overskrift over blokken», `show_title: false`; da får skjermlesere navnet som `aria-label`).

**Bokmerker** (`::bokmerke` i Herah) blir lenkekort med tittel, beskrivelse og bilde fra det Herah har hentet (`/api/bookmark`); går det ikke, en enkel lenke.
Linjer i kodeblokker (```) står urørt, også `::`-linjer (`codeMask` i `src/lib/markdown.ts`, som i Herah).

**Byggestatus**: bygget legger ut `/herah-build.json` med versjonen fra Herah det er bygd fra (`HERAH_VERSION`, satt av `server/build-if-changed.sh` og `deploy.sh`),
når, og hvilke oppføringer nettsiden bruker (`uses` = `SLUGS` i `src/lib/herah.ts`; `collection()`/`page()` godtar bare disse). Herah henter fila og sier fra
under «Trenger tilsyn» hvis nettsiden står stille, og Nettsted-fanen varsler om publiserte oppføringer nettsiden ikke bruker. Bruker du en ny oppføring, legg den i `SLUGS`.

**Feil fra Herah** i produksjonsbygget (`HERAH_ALLOW_FALLBACK=0`) stopper bygget, så forrige versjon blir stående: bare 404 (ikke publisert) gir en tom side.
Samlinger med mer enn 500 poster hentes i flere omganger.

**Bilder** lastes ned fra Herah og skaleres (webp, toppbilder høyst 1600 px, bilder i teksten høyst 1200 px, aldri større enn originalen)
når siden bygges (`localImage` i `src/lib/herah.ts`, `astro:assets`). De ligger i `dist/_astro` sammen med resten, så de besøkende ikke
henter originalene fra Herah, og nettsiden virker selv om Herah er nede. Går ett bilde ikke å laste ned, brukes adressen hos Herah, og bygget fortsetter.
Hver samling hentes én gang per bygg, selv om flere sider bruker den.

## Bygge

```bash
npm install
npm run build          # lokalt: bruker plassholdere hvis Herah ikke svarer
HERAH_ALLOW_FALLBACK=0 npm run build   # produksjon: feiler heller enn å publisere plassholdere
```

Miljøvariabler: `HERAH_API` (standard `https://herah.frodewerner.no`), `HERAH_ALLOW_FALLBACK` (`0` = ingen plassholdere).
Ingen hemmeligheter trengs, siden alt som hentes er offentlig.

## Legge ut

`dist/` er hele nettsiden. Caddy på Hetzner-serveren serverer `/var/www/frodewerner.no`. Oppsettet ligger i repoet, i `server/frodewerner.caddy`:
`www` sendes til `frodewerner.no`, streng CSP (sidene har ingen innebygd stil eller skript, `inlineStylesheets: "never"`), `/_astro/*` mellomlagres lenge,
og ukjente adresser gir `404.html`. `server/install.sh` legger det i `/etc/caddy/sites/frodewerner.caddy` (Herahs Caddyfile importerer mappa).
Er fila endret, tas en kopi av den gamle, og godtar ikke Caddy den nye, legges den gamle tilbake. Endrer du Caddy-fila: kjør `server/install.sh` på nytt.

### Automatisk (anbefalt)

En systemd-timer på serveren ser etter endringer hvert minutt (`server/build-if-changed.sh`) og bygger bare når noe er nytt:
ny kode på `main` i dette repoet, eller ny versjon fra Herah (`/api/site/version`, som bare endrer seg når noe *publisert* endres –
poster i publiserte samlinger, publiserte sider, felt og filer). Publiser eller rediger i Herah, så ligger det på nettet etter ca. ett til to minutter.
Feiler bygget (f.eks. en samling er avpublisert), blir forrige versjon stående, og det prøves på nytt tidligst etter ti minutter.

Sett opp én gang, som root på serveren:

```bash
git clone https://github.com/Phroden/frodewerner-no.git /tmp/frodewerner-no
sudo bash /tmp/frodewerner-no/server/install.sh
```

Skriptet installerer Node og rsync, lager brukeren `sitebuild`, henter koden til `/opt/frodewerner-no`, legger Caddy-oppsettet på plass
og slår på timeren. Repoet er offentlig, så det trengs ingen nøkkel; gjøres det privat, lager skriptet en lesenøkkel du legger til som
*deploy key* (bare lesing) på GitHub. Følg med: `journalctl -u frodewerner-build -f`.

### For hånd

`./deploy.sh` bygger lokalt og kopierer til serveren med rsync (nyttig hvis timeren ikke er satt opp).

## Poster: hvilke som vises og om de kan åpnes
Styres i Herah under «Nettsted»: visning (filter), enkeltposter og «Postene kan åpnes». Er den av, får postene ingen egen side (`/prosjekter/<id>`, `/tjenester/<id>`), og tjenestene viser hele teksten i kortet.

## Design
Følger «Medieprodusent nettside design» (Stilguide: papirhvit, skoggrønn aksent, solgul markering; Bricolage Grotesque og Inter, selvhostet via @fontsource). Alt stilsett ligger i `src/styles/global.css` (ingen inline-stil, pga. CSP). Filterknappene på prosjekter er en liten skriptfil (`ProjectGrid.astro`) og vises bare når prosjektene har mer enn én type.

## Forsiden redigeres i Herah
Nettsted → Forside: tekster, seksjoner (av/på og rekkefølge), YouTube-lenke eller bilde i toppen, kontaktinfo og portrett. YouTube vises som bilde med spill-knapp og lastes fra youtube-nocookie.com først når en besøkende trykker (`YouTube.astro`; miniatyren lastes ned ved bygging). Caddy-oppsettet tillater bare den vertene i `frame-src`: kjør `server/install.sh` på serveren etter oppdatering. Standardtekster: `src/lib/home-defaults.ts` (må følge `DEFAULTS` i Herah).

