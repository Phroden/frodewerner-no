// /herah-build.json: hvilken versjon fra Herah nettsiden er bygd fra, når, og hvilke oppføringer den bruker.
// Herah (api/site_build.ts) henter fila og sier fra hvis nettsiden står stille, og Nettsted-fanen varsler om publiserte
// oppføringer som ikke står i `uses` (de er åpne i API-et, men vises ikke her).
// HERAH_VERSION settes av server/build-if-changed.sh og deploy.sh (versjonen hentet FØR bygget, så innholdet er minst så nytt).
import { SLUGS } from "../lib/herah";

export function GET() {
  const body = {
    version: process.env.HERAH_VERSION || null,
    commit: process.env.HERAH_COMMIT || null,
    built_at: new Date().toISOString(),
    uses: [...SLUGS],
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json; charset=utf-8" } });
}
