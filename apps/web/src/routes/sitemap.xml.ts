/** `/sitemap.xml`: every page of the site, once, without query strings; URLs from EVER_SH_URL. */
import { allRoutes } from "~/content";

export async function GET() {
  const { SITE_ORIGIN } = await import("../../site-origin.mjs");
  const routes = [...new Set(["/", "/hosting", ...allRoutes()])].sort();
  const urls = routes.map((r) => `  <url><loc>${SITE_ORIGIN}${r}</loc></url>`).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    },
  );
}
