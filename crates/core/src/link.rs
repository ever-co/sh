//! Rendering a target's link for one product.
//!
//! Placeholders: `{product}` is always filled; `{connect}` is filled with a valid connect code, and
//! without one the query parameter that carries it is dropped, so a link never ends in an empty
//! `connect=`. Any other placeholder is never guessed: its query parameter is dropped, and a link
//! whose path still holds one is not rendered at all.

use crate::connect::ConnectCode;
use crate::product::Product;
use crate::target::{HostingTarget, TargetKind, TargetStatus};

/// A link ready to put in a page.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderedLink {
    /// The URL.
    pub href: String,
    /// `rel` for the anchor: `"sponsored noopener"` on a third-party link that carries Ever's
    /// referral code, `"noopener"` on any other third-party link, empty otherwise.
    pub rel: &'static str,
    /// True for a third-party host (opens outside the site).
    pub external: bool,
}

/// The link of `target` for `product`, or `None` when the target does not list the product, the
/// product is "soon" there, or there is no link to render.
#[must_use]
pub fn render_link(
    target: &HostingTarget,
    product: Product,
    connect: Option<&ConnectCode>,
) -> Option<RenderedLink> {
    if target.status_for(product)? == TargetStatus::Soon {
        return None;
    }
    let offer = target.offer(product)?;
    let template = offer.link.as_deref().or(target.link_template.as_deref())?;
    let href = fill(template, product, connect)?;
    let external = target.kind == TargetKind::ThirdParty;
    let rel = match (external, target.referral.is_some()) {
        (true, true) => "sponsored noopener",
        (true, false) => "noopener",
        (false, _) => "",
    };
    Some(RenderedLink {
        href,
        rel,
        external,
    })
}

fn fill(template: &str, product: Product, connect: Option<&ConnectCode>) -> Option<String> {
    let (rest, fragment) = match template.split_once('#') {
        Some((rest, fragment)) => (rest, Some(fragment)),
        None => (template, None),
    };
    let (base, query) = match rest.split_once('?') {
        Some((base, query)) => (base, Some(query)),
        None => (rest, None),
    };
    let base = base.replace("{product}", product.as_str());
    if has_placeholder(&base) {
        return None;
    }
    let mut out = base;
    if let Some(query) = query {
        let pairs: Vec<String> = query
            .split('&')
            .filter(|pair| !pair.is_empty())
            .filter_map(|pair| {
                let pair = pair.replace("{product}", product.as_str());
                let pair = if pair.contains("{connect}") {
                    pair.replace("{connect}", connect?.as_str())
                } else {
                    pair
                };
                (!has_placeholder(&pair)).then_some(pair)
            })
            .collect();
        if !pairs.is_empty() {
            out.push('?');
            out.push_str(&pairs.join("&"));
        }
    }
    if let Some(fragment) = fragment {
        out.push('#');
        out.push_str(fragment);
    }
    Some(out)
}

fn has_placeholder(s: &str) -> bool {
    s.contains('{') || s.contains('}')
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, clippy::expect_used, reason = "tests")]

    use super::*;
    use crate::target::tests::target;
    use crate::target::{Referral, TargetProduct};

    fn code() -> ConnectCode {
        ConnectCode::parse("EVC-7K2M-9QHX-3RTW").unwrap()
    }

    #[test]
    fn fills_product_and_connect_and_drops_an_empty_connect() {
        let mut t = target("docker-compose", TargetKind::SelfHost);
        t.link_template = Some("https://ever.sh/install/{product}?connect={connect}".into());
        let without = render_link(&t, Product::Gauzy, None).unwrap();
        assert_eq!(without.href, "https://ever.sh/install/gauzy");
        assert_eq!(without.rel, "");
        assert!(!without.external);
        let with = render_link(&t, Product::Gauzy, Some(&code())).unwrap();
        assert_eq!(
            with.href,
            "https://ever.sh/install/gauzy?connect=EVC-7K2M-9QHX-3RTW"
        );
    }

    #[test]
    fn keeps_other_parameters_and_the_fragment() {
        let mut t = target("ever-cloud", TargetKind::EverCloud);
        t.link_template = Some(
            "https://app.example/provision?product={product}&connect={connect}&ref=ever.sh#start"
                .into(),
        );
        let link = render_link(&t, Product::Gauzy, None).unwrap();
        assert_eq!(
            link.href,
            "https://app.example/provision?product=gauzy&ref=ever.sh#start"
        );
    }

    #[test]
    fn never_guesses_an_unknown_placeholder() {
        let mut t = target("a1", TargetKind::SelfHost);
        t.link_template = Some("https://x.example/a?product={product}&back={return_to}".into());
        assert_eq!(
            render_link(&t, Product::Gauzy, None).unwrap().href,
            "https://x.example/a?product=gauzy"
        );
        t.link_template = Some("https://x.example/{region}/a".into());
        assert!(render_link(&t, Product::Gauzy, None).is_none());
    }

    #[test]
    fn per_product_links_win_and_referral_links_are_sponsored() {
        let mut t = target("host", TargetKind::ThirdParty);
        t.products = vec![TargetProduct {
            id: Product::Teams,
            status: TargetStatus::Available,
            link: Some("https://host.example/template/abc?referralCode=xyz".into()),
        }];
        assert_eq!(
            render_link(&t, Product::Teams, None).unwrap().rel,
            "noopener"
        );
        t.referral = Some(Referral {
            program: "host-affiliate".into(),
            param: "referralCode".into(),
        });
        let link = render_link(&t, Product::Teams, Some(&code())).unwrap();
        assert_eq!(
            link.href,
            "https://host.example/template/abc?referralCode=xyz"
        );
        assert_eq!(link.rel, "sponsored noopener");
        assert!(link.external);
    }

    #[test]
    fn no_link_for_unlisted_soon_or_demand() {
        let mut t = target("a1", TargetKind::SelfHost);
        assert!(render_link(&t, Product::Teams, None).is_none());
        t.products[0].status = TargetStatus::Soon;
        assert!(render_link(&t, Product::Gauzy, None).is_none());
        t.products = vec![TargetProduct {
            id: Product::Demand,
            status: TargetStatus::Available,
            link: None,
        }];
        assert!(render_link(&t, Product::Demand, None).is_none());
        let mut bare = target("a2", TargetKind::SelfHost);
        bare.link_template = None;
        assert!(render_link(&bare, Product::Gauzy, None).is_none());
    }
}
