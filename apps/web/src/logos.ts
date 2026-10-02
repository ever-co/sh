/**
 * The logos the site shows next to the names they identify: this site's own (the Ever mark and
 * the ever® selfhost wordmark), the Ever products' lockups and the hosting providers' marks. The
 * files are in `public/logo/` and `public/logos/`; `public/logos/README.md` lists where each one
 * comes from. Every mark belongs to its owner and is shown for identification only (the footer
 * says so on every page).
 *
 * A logo is a plain `<img>` (`~/components/Logo.tsx`), so runtime-free pages stay runtime-free.
 */
import type { ProductId } from "~/products";

export interface Logo {
  readonly src: string;
  /** The brand's name, used as the image's text alternative. */
  readonly alt: string;
  /** The file's own proportions (its viewBox). */
  readonly width: number;
  readonly height: number;
  /**
   * The mark's colours do not read on the dark theme (black or a dark brand colour): there it is
   * shown as the brand's white version, a white silhouette of the same mark.
   */
  readonly reverseOnDark?: boolean;
}

/** The Ever mark (the shared icon of the Ever product sites). */
export const EVER_MARK: Logo = { src: "/logo/ever-icon.svg", alt: "Ever", width: 40, height: 42 };

/** This site's wordmark: ever® selfhost, drawn like the ever® works wordmark of ever.works. */
export const SITE_WORDMARK: Logo = {
  src: "/logo/ever-selfhost.svg",
  alt: "ever.sh",
  width: 147.72,
  height: 20,
  reverseOnDark: true,
};

/** The Ever product lockups (ever® + the product name), as on the products' own sites. */
export const PRODUCT_LOGOS: Readonly<Record<ProductId, Logo>> = {
  gauzy: lockup("gauzy", "Ever Gauzy", 131, 19),
  teams: lockup("teams", "Ever Teams", 132, 18),
  works: lockup("works", "Ever Works", 128, 17),
  rec: lockup("rec", "Ever Rec", 101, 17),
  traduora: lockup("traduora", "Ever Traduora", 153.58, 17),
  demand: lockup("demand", "Ever Demand", 151, 19),
};

function lockup(id: ProductId, alt: string, width: number, height: number): Logo {
  return { src: `/logos/ever/${id}.svg`, alt, width, height, reverseOnDark: true };
}

function vendor(file: string, alt: string, width = 24, height = 24, reverseOnDark = false): Logo {
  return { src: `/logos/vendors/${file}.svg`, alt, width, height, reverseOnDark };
}

const DOCKER = vendor("docker", "Docker", 340, 268);
export const HELM = vendor("helm", "Helm", 24, 24, true);

/**
 * Hosting options by their id in the hosting list. The list, not this table, decides which hosts
 * appear: a host it adds later is shown with a neutral icon until its logo is added here. Fly.io
 * has none on purpose: its brand guidelines ask for written permission before its logo is used.
 */
const HOST_LOGOS: Readonly<Record<string, Logo>> = {
  "ever-cloud": EVER_MARK,
  "docker-compose": DOCKER,
  kubernetes: vendor("kubernetes", "Kubernetes"),
  hostinger: vendor("hostinger", "Hostinger"),
  railway: vendor("railway", "Railway", 24, 24, true),
  render: vendor("render", "Render", 24, 24, true),
  easypanel: vendor("easypanel", "Easypanel", 245, 245),
  repocloud: vendor("repocloud", "RepoCloud", 256, 256),
  elestio: vendor("elestio", "Elestio", 191, 191),
  digitalocean: vendor("digitalocean", "DigitalOcean"),
  heroku: vendor("heroku", "Heroku", 118, 130, true),
  netlify: vendor("netlify", "Netlify"),
  koyeb: vendor("koyeb", "Koyeb", 24, 24, true),
  northflank: vendor("northflank", "Northflank", 52, 36),
};

/** The logo of a hosting option, or undefined when there is none. */
export function hostLogo(id: string): Logo | undefined {
  return Object.hasOwn(HOST_LOGOS, id) ? HOST_LOGOS[id] : undefined;
}

/** The logos of the install page's settings blocks (the environment file has none). */
export const SNIPPET_LOGOS: Readonly<Partial<Record<"compose" | "env" | "helm", Logo>>> = {
  compose: DOCKER,
  helm: HELM,
};

/** Every logo file the site references (for the test that each one exists). */
export function allLogos(): Logo[] {
  return [
    EVER_MARK,
    SITE_WORDMARK,
    ...Object.values(PRODUCT_LOGOS),
    ...Object.values(HOST_LOGOS),
    ...Object.values(SNIPPET_LOGOS),
  ];
}
