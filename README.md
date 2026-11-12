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

## Bygge

```bash
npm install
npm run build          # lokalt: bruker plassholdere hvis Herah ikke svarer
HERAH_ALLOW_FALLBACK=0 npm run build   # produksjon: feiler heller enn å publisere plassholdere
```

Miljøvariabler: `HERAH_API` (standard `https://herah.frodewerner.no`), `HERAH_ALLOW_FALLBACK` (`0` = ingen plassholdere).
Ingen hemmeligheter trengs, siden alt som hentes er offentlig.

## Legge ut

`dist/` er hele nettsiden. Caddy på Hetzner-serveren serverer `/var/www/frodewerner.no` (se `/etc/caddy/sites/frodewerner.caddy`).

### Automatisk (anbefalt)

En systemd-timer på serveren ser etter endringer hvert minutt (`server/build-if-changed.sh`) og bygger bare når noe er nytt:
ny kode på `main` i dette repoet, eller ny versjon fra Herah (`/api/site/version`, som bare endrer seg når noe *publisert* endres –
poster i publiserte samlinger, publiserte sider, felt og filer). Publiser eller rediger i Herah, så ligger det på nettet etter ca. ett til to minutter.
Feiler bygget (f.eks. en samling er avpublisert), blir forrige versjon stående, og det prøves på nytt tidligst etter ti minutter.

Sett opp én gang, som root på serveren:

```bash
git clone https://github.com/Phroden/frodewerner-no.git /tmp/frodewerner-no   # repoet er privat: bruk SSH eller last ned server/install.sh
sudo bash /tmp/frodewerner-no/server/install.sh
```

Skriptet installerer Node og rsync, lager brukeren `sitebuild`, lager en lesenøkkel du legger til som *deploy key* (bare lesing) på GitHub,
henter koden til `/opt/frodewerner-no` og slår på timeren. Følg med: `journalctl -u frodewerner-build -f`.

### For hånd

`./deploy.sh` bygger lokalt og kopierer til serveren med rsync (nyttig hvis timeren ikke er satt opp).
