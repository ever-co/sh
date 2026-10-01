export function validateOrigin(name: string, raw: string): string;
export function readSiteConfig(env: Record<string, string | undefined>): {
  site: string;
  app: string;
  indexable: boolean;
};
export const SITE_ORIGIN: string;
export const APP_ORIGIN: string;
export const INDEXABLE: boolean;
