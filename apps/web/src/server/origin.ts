/**
 * The validated origins, read on the SERVER only. `site-origin.mjs` reads `process.env`, so it is
 * never imported by code that also runs in the browser; components call this server function.
 */
export interface Origins {
  /** The public origin of this deployment (`EVER_SH_URL`). */
  readonly site: string;
  /** The Ever account portal (`EVER_APP_URL`). */
  readonly app: string;
}

export async function origins(): Promise<Origins> {
  "use server";
  const { APP_ORIGIN, SITE_ORIGIN } = await import("../../site-origin.mjs");
  return { site: SITE_ORIGIN, app: APP_ORIGIN };
}
