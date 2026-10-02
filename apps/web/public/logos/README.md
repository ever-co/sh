# Logos

The logos ever.sh shows next to the names they identify: the Ever products and the places they
can run. Each mark is a trademark of its owner. It is used here for identification only, and its
use does not imply endorsement (the footer of every page says so). Apart from the two ever®
lockups made for this site (described below), the files are copies of the owners' artwork, not
redrawings; the notes say what was changed (a title for screen readers, a colour, a trimmed
canvas).

On the dark theme, a mark whose colours do not read there is shown as the brand's white version
(`reverseOnDark` in `apps/web/src/logos.ts`).

## This site (`../logo/`)

| File | Source |
|---|---|
| `ever-icon.svg` | The Ever mark from the header of <https://ever.works/> (the same mark heads <https://ever.team/>). Only the gradient layer is kept. |
| `ever-selfhost.svg` | The ever® selfhost wordmark. "ever®" is the exact outline of the ever® works wordmark in the header of <https://ever.works/>. "selfhost" is set in Fira Sans Light Italic, the face of "works" there (same size, baseline and starting point; the outlines of "works" redrawn this way match the original), and converted to outlines. The font is from <https://github.com/google/fonts/tree/main/ofl/firasans> and is not part of this repository. |

`../favicon.svg`, `../favicon.ico` and `../apple-touch-icon.png` are the Ever mark as the Ever
product sites use it for their favicons (<https://ever.works/favicon.svg>), on this site's violet
gradient.

## Ever products (`ever/`)

The ever® lockups, each a single outline in the text colour, as on the products' own sites.

| File | Source |
|---|---|
| `ever/gauzy.svg` | Header of <https://gauzy.co/> |
| `ever/teams.svg` | Header of <https://ever.team/> |
| `ever/works.svg` | Header of <https://ever.works/> |
| `ever/rec.svg` | Header of <https://rec.so/> |
| `ever/demand.svg` | The Ever products list in the footer of <https://ever.works/> |
| `ever/traduora.svg` | Made like `../logo/ever-selfhost.svg`: "ever®" from <https://ever.works/>, "traduora" in Fira Sans Light Italic. <https://traduora.co/> sets its name as text, so there is no outline to copy. |

## Hosting providers (`vendors/`)

Marks from [Simple Icons](https://github.com/simple-icons/simple-icons) 16.33.0 are filled with the
brand colour Simple Icons records for them. The others come from the owner's brand kit or website.

| File | Source | Notes |
|---|---|---|
| `vendors/docker.svg` | Docker logo kit, <https://www.docker.com/company/newsroom/media-resources/> | The mark in Ocean Blue (`docker-mark-ocean-blue.svg`). Simple Icons still has the previous whale and colour. |
| `vendors/kubernetes.svg` | <https://github.com/simple-icons/simple-icons/blob/16.33.0/icons/kubernetes.svg> | #326CE5 |
| `vendors/helm.svg` | <https://github.com/simple-icons/simple-icons/blob/16.33.0/icons/helm.svg> | #0F1689; white on the dark theme |
| `vendors/hostinger.svg` | <https://github.com/simple-icons/simple-icons/blob/16.33.0/icons/hostinger.svg> | #673DE6 |
| `vendors/railway.svg` | <https://github.com/simple-icons/simple-icons/blob/16.33.0/icons/railway.svg> | #0B0D0E; white on the dark theme |
| `vendors/render.svg` | <https://github.com/simple-icons/simple-icons/blob/16.33.0/icons/render.svg> | #000000; white on the dark theme |
| `vendors/digitalocean.svg` | <https://github.com/simple-icons/simple-icons/blob/16.33.0/icons/digitalocean.svg> | #0080FF |
| `vendors/netlify.svg` | <https://github.com/simple-icons/simple-icons/blob/16.33.0/icons/netlify.svg> | #00C7B7 |
| `vendors/koyeb.svg` | <https://github.com/simple-icons/simple-icons/blob/16.33.0/icons/koyeb.svg> | #121212; white on the dark theme |
| `vendors/easypanel.svg` | Easypanel brand assets, <https://easypanel.io/brand> | The logomark, unchanged. |
| `vendors/heroku.svg` | Heroku logo kit, <https://devcenter.heroku.com/articles/heroku-brand-guidelines> | The mark for light backgrounds (#5A1BA9), with the empty canvas around it trimmed; white (the kit's reversed version) on the dark theme. |
| `vendors/elestio.svg` | Elestio press kit, <https://elest.io/about> | The colour "e" symbol, taken with its mask from `elestio-logo-color.svg`; the kit has it as `elestio-icon-color-512px.png`. |
| `vendors/northflank.svg` | <https://northflank.com/> (the mark in the site header) | Unchanged. |
| `vendors/repocloud.svg` | <https://repocloud.io/> | The app icon (white "RC" on RepoCloud blue, #3F00FF), from the site's pinned-tab outline. |

Fly.io has no logo here: its brand guidelines (<https://docs.fly.io/about/brand/>) ask for
written permission before its logo is used. The chooser shows a neutral icon instead, as it does
for any host without a logo.

## Adding a logo

Copy the owner's SVG (or the Simple Icons one) into `vendors/`, add the host to `HOST_LOGOS` in
`apps/web/src/logos.ts` (a dark mark gets `reverseOnDark`), add a row above, and check it on both
themes.
