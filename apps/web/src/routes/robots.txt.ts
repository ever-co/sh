/**
 * `/robots.txt`, also the container boot-smoke path: answered without any upstream call. Only an
 * indexable deployment (`EVER_SH_INDEXABLE=true`) invites crawlers; dev and stage hosts say
 * `Disallow: /`.
 */
export async function GET() {
  const { INDEXABLE, SITE_ORIGIN } = await import("../../site-origin.mjs");
  const lines = INDEXABLE
    ? ["User-agent: *", "Allow: /", `Sitemap: ${SITE_ORIGIN}/sitemap.xml`]
    : ["User-agent: *", "Disallow: /"];
  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
