export const INSTALLABLE: readonly string[];
export const BASE_HEADERS: Readonly<Record<string, string>>;
export function redirectFor(
  url: URL,
  siteOrigin: string,
): { status: 301 | 308; location: string } | null;
export function carriesConnectCode(url: URL): boolean;
export function policyHeaders(url: URL, options: { indexable: boolean }): Record<string, string>;
