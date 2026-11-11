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

`dist/` er hele nettsiden. På Hetzner-serveren kan Caddy servere den direkte:

```
frodewerner.no, www.frodewerner.no {
	root * /var/www/frodewerner.no
	encode zstd gzip
	file_server
	handle_errors {
		rewrite * /404.html
		file_server
	}
}
```

Siden må bygges på nytt når innholdet i Herah endres (webhook fra Herah er neste steg).
