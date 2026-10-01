/**
 * Server-only: the hosting targets, read from this repository's API service (`crates/api`, at
 * `EVER_SH_API_URL`, deployed beside the site). That service answers with the Ever Platform's
 * list or with its own compiled-in snapshot, and says which (`source`, `as_of`). This is the
 * site's only outbound read: no credential, no cookie, no write, no redirect followed.
 *
 * When the API service itself does not answer (down, slower than 8 s, or a malformed reply), the
 * page uses the copy of the same snapshot built into this site, labelled with its date. The
 * chooser is never shown empty as if no host existed.
 */

import { type HostingTarget, parseTargets } from "~/chooser/model";
import snapshot from "~/content.generated/hosts.json";

export interface TargetsResult {
  /** `api`: the Ever Platform's live list; `snapshot`: a saved copy, labelled with `asOf`. */
  readonly source: "api" | "snapshot";
  readonly asOf: string;
  readonly targets: readonly HostingTarget[];
}

/** Longer than the API service's own upstream timeout, so its snapshot answer arrives first. */
export const TIMEOUT_MS = 8_000;
const DEFAULT_API_SERVICE = "http://127.0.0.1:8080";
const LOG_EVERY_MS = 60_000;
let lastLogged = 0;

function builtIn(): TargetsResult {
  return { source: "snapshot", asOf: snapshot.as_of, targets: parseTargets(snapshot.targets) };
}

function logFallback(reason: string): void {
  const now = Date.now();
  if (now - lastLogged < LOG_EVERY_MS) return;
  lastLogged = now;
  process.stderr.write(`ever.sh: hosting list from the built-in snapshot (${reason})\n`);
}

export async function loadTargets(
  fetchImpl: typeof fetch = fetch,
  base: string = process.env.EVER_SH_API_URL ?? DEFAULT_API_SERVICE,
): Promise<TargetsResult> {
  let url: URL;
  try {
    url = new URL("/v1/hosting-targets", base);
  } catch {
    logFallback("EVER_SH_API_URL is not a URL");
    return builtIn();
  }
  try {
    const res = await fetchImpl(url, {
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logFallback(`API service answered ${res.status}`);
      return builtIn();
    }
    const body = (await res.json()) as { items?: unknown; source?: unknown; as_of?: unknown };
    const targets = parseTargets(body.items);
    const source = body.source === "api" || body.source === "snapshot" ? body.source : undefined;
    if (targets.length === 0 || !source || typeof body.as_of !== "string") {
      logFallback("API service reply not understood");
      return builtIn();
    }
    return { source, asOf: body.as_of, targets };
  } catch (err) {
    logFallback(err instanceof Error ? err.name : "API service unreachable");
    return builtIn();
  }
}
