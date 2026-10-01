//! Hosting targets ("where can I run it?") and the snapshot file that lists them.
//!
//! The shape is the one `content/hosting/hosts.schema.json` describes, both for the committed
//! snapshot `content/hosting/hosts.yaml` and for each item of `GET /v1/hosting-targets`.

use std::collections::HashSet;
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::product::Product;

/// The `schema` value of a snapshot document.
pub const SNAPSHOT_SCHEMA: &str = "ever.hosting-targets.v1";

/// Which column of the chooser a target belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TargetKind {
    /// Ever runs it.
    EverCloud,
    /// The visitor runs it on their own infrastructure.
    SelfHost,
    /// A third-party host with a template or documented method.
    ThirdParty,
}

/// How ready a target is, overall or for one product.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TargetStatus {
    /// Ready.
    Available,
    /// Works, still maturing.
    Beta,
    /// Not yet: shown, never linked.
    Soon,
}

/// The install settings a target comes with.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SnippetKind {
    /// Lines for a Compose file.
    Compose,
    /// Environment variables.
    Env,
    /// Helm values.
    Helm,
    /// No settings.
    None,
}

/// Ever's own referral code at a host, already written into that host's links.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Referral {
    /// The host's referral programme.
    pub program: String,
    /// The URL parameter that carries the code.
    pub param: String,
}

/// A target's offer for one product.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TargetProduct {
    /// The product.
    pub id: Product,
    /// The status for this product.
    pub status: TargetStatus,
    /// A link for this product only (a host with one template per product); otherwise the
    /// target's `link_template` applies.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
}

/// One hosting target.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostingTarget {
    /// Stable id (`docker-compose`, `hostinger`, ...).
    pub id: String,
    /// The chooser column.
    pub kind: TargetKind,
    /// Display name.
    pub title: String,
    /// One sentence or paragraph.
    pub summary_md: String,
    /// What the host needs.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requirements_md: Option<String>,
    /// A guide; may contain `{product}`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub docs_url: Option<String>,
    /// `one-click`, `managed` or `recommended`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub badge: Option<String>,
    /// The products this target offers.
    pub products: Vec<TargetProduct>,
    /// What an install made this way reports as its source.
    pub install_source: String,
    /// The link, with `{product}` and `{connect}` placeholders.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link_template: Option<String>,
    /// The install settings that go with the link.
    pub snippet_kind: SnippetKind,
    /// Ever's referral code at this host, or `null`.
    pub referral: Option<Referral>,
    /// Position within its column.
    pub order: u16,
    /// Overall status.
    pub status: TargetStatus,
}

impl HostingTarget {
    /// This target's offer for `product`, if it lists the product.
    #[must_use]
    pub fn offer(&self, product: Product) -> Option<&TargetProduct> {
        self.products.iter().find(|p| p.id == product)
    }

    /// The status for `product`; a "soon" product is soon whatever the data says.
    #[must_use]
    pub fn status_for(&self, product: Product) -> Option<TargetStatus> {
        let offer = self.offer(product)?;
        Some(if product.is_soon() {
            TargetStatus::Soon
        } else {
            offer.status
        })
    }
}

/// The snapshot document (`content/hosting/hosts.yaml`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Snapshot {
    /// Always [`SNAPSHOT_SCHEMA`].
    pub schema: String,
    /// The date the list was taken, `YYYY-MM-DD`.
    pub as_of: String,
    /// The targets, in file order.
    pub targets: Vec<HostingTarget>,
}

impl Snapshot {
    /// The targets that list `product` (every target when `None`), in file order.
    #[must_use]
    pub fn targets_for(&self, product: Option<Product>) -> Vec<&HostingTarget> {
        self.targets
            .iter()
            .filter(|t| product.is_none_or(|p| t.offer(p).is_some()))
            .collect()
    }

    /// The target with this id.
    #[must_use]
    pub fn target(&self, id: &str) -> Option<&HostingTarget> {
        self.targets.iter().find(|t| t.id == id)
    }

    /// Checks every rule of `hosts.schema.json` that the types alone do not express.
    ///
    /// # Errors
    /// The first rule a target breaks.
    pub fn validate(&self) -> Result<(), SnapshotError> {
        if self.schema != SNAPSHOT_SCHEMA {
            return Err(SnapshotError::document(format!(
                "schema must be {SNAPSHOT_SCHEMA:?}, found {:?}",
                self.schema
            )));
        }
        if !is_iso_date(&self.as_of) {
            return Err(SnapshotError::document("as_of must be a YYYY-MM-DD date"));
        }
        if self.targets.is_empty() {
            return Err(SnapshotError::document("the snapshot lists no target"));
        }
        let mut ids = HashSet::new();
        for t in &self.targets {
            if !ids.insert(t.id.as_str()) {
                return Err(SnapshotError::target(&t.id, "duplicate id"));
            }
            validate_target(t).map_err(|message| SnapshotError::target(&t.id, message))?;
        }
        Ok(())
    }
}

fn validate_target(t: &HostingTarget) -> Result<(), String> {
    if !is_slug(&t.id, 2, 32) || !t.id.starts_with(|c: char| c.is_ascii_lowercase()) {
        return Err("id must be a lower-case slug of 2 to 32 characters".into());
    }
    if !(1..=60).contains(&t.title.chars().count()) {
        return Err("title must be 1 to 60 characters".into());
    }
    if !(1..=400).contains(&t.summary_md.chars().count()) {
        return Err("summary_md must be 1 to 400 characters".into());
    }
    if t.requirements_md
        .as_ref()
        .is_some_and(|r| r.chars().count() > 800)
    {
        return Err("requirements_md must be at most 800 characters".into());
    }
    if let Some(badge) = &t.badge
        && !matches!(badge.as_str(), "one-click" | "managed" | "recommended")
    {
        return Err(format!("unknown badge {badge:?}"));
    }
    for url in [&t.docs_url, &t.link_template].into_iter().flatten() {
        check_url(url)?;
    }
    if t.order > 1000 {
        return Err("order must be at most 1000".into());
    }
    validate_install_source(t)?;
    validate_products(t)?;
    validate_referral(t)
}

fn validate_install_source(t: &HostingTarget) -> Result<(), String> {
    let source = t.install_source.as_str();
    let partner = source
        .strip_prefix("partner:")
        .is_some_and(|name| is_slug(name, 2, 32));
    if !(partner || matches!(source, "cloud" | "self-hosted" | "ever.sh")) {
        return Err(format!("install_source {source:?} is not allowed"));
    }
    match t.kind {
        TargetKind::ThirdParty if !partner => {
            Err("a third-party target reports partner:<name>".into())
        }
        TargetKind::EverCloud if source != "cloud" => Err("Ever Cloud reports cloud".into()),
        _ => Ok(()),
    }
}

fn validate_products(t: &HostingTarget) -> Result<(), String> {
    if t.products.is_empty() {
        return Err("products must not be empty".into());
    }
    let mut seen = HashSet::new();
    for p in &t.products {
        if !seen.insert(p.id) {
            return Err(format!("product {} is listed twice", p.id));
        }
        if p.id.is_soon() && p.status != TargetStatus::Soon {
            return Err(format!("{} is always soon", p.id));
        }
        if let Some(link) = &p.link {
            check_url(link)?;
        }
    }
    Ok(())
}

fn validate_referral(t: &HostingTarget) -> Result<(), String> {
    let Some(referral) = &t.referral else {
        return Ok(());
    };
    if t.kind != TargetKind::ThirdParty {
        return Err("only third-party targets carry a referral code".into());
    }
    if !is_slug(&referral.program, 2, 32) {
        return Err("referral.program must be a slug".into());
    }
    let param_ok = (1..=32).contains(&referral.param.len())
        && referral
            .param
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_');
    if !param_ok {
        return Err("referral.param must be 1 to 32 letters, digits or underscores".into());
    }
    let links = t.products.iter().filter_map(|p| p.link.as_deref());
    let templates = t.link_template.as_deref().into_iter();
    for link in links.chain(templates) {
        let in_query = link.split_once('?').is_some_and(|(_, query)| {
            query
                .split('&')
                .any(|pair| pair.split('=').next() == Some(referral.param.as_str()))
        });
        if !in_query {
            return Err(format!(
                "a link of a referral target must carry its {} parameter",
                referral.param
            ));
        }
    }
    Ok(())
}

fn check_url(url: &str) -> Result<(), String> {
    let rest = url
        .strip_prefix("https://")
        .ok_or_else(|| format!("{url:?} must be an https:// URL"))?;
    if rest.is_empty() || url.chars().any(char::is_whitespace) {
        return Err(format!("{url:?} is not a valid URL"));
    }
    Ok(())
}

fn is_slug(s: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&s.len())
        && s.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn is_iso_date(s: &str) -> bool {
    let b = s.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' {
        return false;
    }
    let digits = |r: std::ops::Range<usize>| -> Option<u32> {
        s.get(r)
            .filter(|d| d.bytes().all(|c| c.is_ascii_digit()))
            .and_then(|d| d.parse().ok())
    };
    matches!(
        (digits(0..4), digits(5..7), digits(8..10)),
        (Some(_), Some(1..=12), Some(1..=31))
    )
}

/// A snapshot that breaks a rule.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotError {
    /// The target at fault, if the problem is in one target.
    pub target: Option<String>,
    /// What is wrong.
    pub message: String,
}

impl SnapshotError {
    fn document(message: impl Into<String>) -> Self {
        Self {
            target: None,
            message: message.into(),
        }
    }

    fn target(id: &str, message: impl Into<String>) -> Self {
        Self {
            target: Some(id.to_owned()),
            message: message.into(),
        }
    }
}

impl fmt::Display for SnapshotError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.target {
            Some(id) => write!(f, "target {id:?}: {}", self.message),
            None => f.write_str(&self.message),
        }
    }
}

impl std::error::Error for SnapshotError {}

#[cfg(test)]
pub(crate) mod tests {
    #![allow(clippy::unwrap_used, clippy::expect_used, reason = "tests")]

    use super::*;

    pub(crate) fn target(id: &str, kind: TargetKind) -> HostingTarget {
        HostingTarget {
            id: id.into(),
            kind,
            title: "Title".into(),
            summary_md: "Summary.".into(),
            requirements_md: None,
            docs_url: None,
            badge: None,
            products: vec![TargetProduct {
                id: Product::Gauzy,
                status: TargetStatus::Available,
                link: None,
            }],
            install_source: match kind {
                TargetKind::EverCloud => "cloud".into(),
                TargetKind::SelfHost => "ever.sh".into(),
                TargetKind::ThirdParty => format!("partner:{id}"),
            },
            link_template: Some("https://host.example/deploy?app={product}".into()),
            snippet_kind: SnippetKind::None,
            referral: None,
            order: 10,
            status: TargetStatus::Available,
        }
    }

    fn snapshot(targets: Vec<HostingTarget>) -> Snapshot {
        Snapshot {
            schema: SNAPSHOT_SCHEMA.into(),
            as_of: "2026-10-01".into(),
            targets,
        }
    }

    fn error_of(t: HostingTarget) -> String {
        snapshot(vec![t]).validate().unwrap_err().message
    }

    #[test]
    fn a_well_formed_snapshot_validates() {
        let s = snapshot(vec![
            target("docker-compose", TargetKind::SelfHost),
            target("ever-cloud", TargetKind::EverCloud),
            target("host", TargetKind::ThirdParty),
        ]);
        assert_eq!(s.validate(), Ok(()));
    }

    #[test]
    fn document_rules() {
        let mut s = snapshot(vec![target("a1", TargetKind::SelfHost)]);
        s.schema = "other".into();
        assert!(s.validate().is_err());
        let mut s = snapshot(vec![target("a1", TargetKind::SelfHost)]);
        s.as_of = "2026-13-01".into();
        assert!(s.validate().is_err());
        assert!(snapshot(vec![]).validate().is_err());
        let dup = snapshot(vec![
            target("a1", TargetKind::SelfHost),
            target("a1", TargetKind::SelfHost),
        ]);
        assert_eq!(dup.validate().unwrap_err().message, "duplicate id");
    }

    #[test]
    fn demand_is_always_soon() {
        let mut t = target("a1", TargetKind::SelfHost);
        t.products.push(TargetProduct {
            id: Product::Demand,
            status: TargetStatus::Available,
            link: None,
        });
        assert_eq!(error_of(t.clone()), "demand is always soon");
        t.products[1].status = TargetStatus::Soon;
        assert_eq!(snapshot(vec![t.clone()]).validate(), Ok(()));
        // and the accessor says so even for data that slipped through
        t.products[1].status = TargetStatus::Beta;
        assert_eq!(t.status_for(Product::Demand), Some(TargetStatus::Soon));
        assert_eq!(t.status_for(Product::Teams), None);
    }

    #[test]
    fn install_source_follows_the_column() {
        let mut t = target("host", TargetKind::ThirdParty);
        t.install_source = "ever.sh".into();
        assert!(error_of(t).contains("partner"));
        let mut t = target("ever-cloud", TargetKind::EverCloud);
        t.install_source = "self-hosted".into();
        assert!(error_of(t).contains("cloud"));
        let mut t = target("a1", TargetKind::SelfHost);
        t.install_source = "partner:X".into();
        assert!(error_of(t).contains("not allowed"));
    }

    #[test]
    fn referral_links_must_carry_the_code_parameter() {
        let mut t = target("host", TargetKind::ThirdParty);
        t.link_template = None;
        t.products[0].link = Some("https://host.example/deploy?ref=abc".into());
        t.referral = Some(Referral {
            program: "host-affiliate".into(),
            param: "aff_id".into(),
        });
        assert!(error_of(t.clone()).contains("aff_id"));
        t.products[0].link = Some("https://host.example/deploy?x=1&aff_id=123".into());
        assert_eq!(snapshot(vec![t.clone()]).validate(), Ok(()));
        let mut own = target("a1", TargetKind::SelfHost);
        own.referral = t.referral.clone();
        assert!(error_of(own).contains("third-party"));
    }

    #[test]
    fn urls_and_lengths() {
        let mut t = target("a1", TargetKind::SelfHost);
        t.link_template = Some("http://insecure.example/".into());
        assert!(error_of(t).contains("https"));
        let mut t = target("a1", TargetKind::SelfHost);
        t.title = "x".repeat(61);
        assert!(error_of(t).contains("title"));
        let mut t = target("a1", TargetKind::SelfHost);
        t.badge = Some("best".into());
        assert!(error_of(t).contains("badge"));
        let mut t = target("A1", TargetKind::SelfHost);
        t.install_source = "ever.sh".into();
        assert!(error_of(t).contains("slug"));
    }

    #[test]
    fn filters_by_product() {
        let mut teams = target("teams-only", TargetKind::ThirdParty);
        teams.products[0].id = Product::Teams;
        let s = snapshot(vec![target("a1", TargetKind::SelfHost), teams]);
        assert_eq!(s.targets_for(None).len(), 2);
        let ids: Vec<&str> = s
            .targets_for(Some(Product::Teams))
            .iter()
            .map(|t| t.id.as_str())
            .collect();
        assert_eq!(ids, vec!["teams-only"]);
        assert!(s.target("a1").is_some());
        assert!(s.target("nope").is_none());
    }

    #[test]
    fn serializes_referral_as_null_and_omits_absent_options() {
        let json = serde_json::to_value(target("a1", TargetKind::SelfHost)).unwrap();
        assert!(json.get("referral").unwrap().is_null());
        assert!(json.get("docs_url").is_none());
        assert_eq!(json["kind"], "self_host");
        assert_eq!(json["products"][0]["id"], "gauzy");
    }
}
