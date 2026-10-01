//! The hosting snapshot compiled into the binary: `content/hosting/hosts.yaml`, the same file the
//! web site builds its own last-resort copy from. It is parsed and validated once at start-up;
//! a binary whose snapshot breaks a rule refuses to start (and its tests fail first).

use std::fmt;

use ever_sh_core::Snapshot;

/// The committed snapshot, verbatim.
pub const SNAPSHOT_YAML: &str = include_str!("../../../content/hosting/hosts.yaml");

/// Parses and validates the compiled-in snapshot.
///
/// # Errors
/// When the file does not parse or breaks a rule of `hosts.schema.json`.
pub fn load() -> Result<Snapshot, LoadError> {
    parse(SNAPSHOT_YAML)
}

/// Parses and validates a snapshot document.
///
/// # Errors
/// When the text does not parse or breaks a rule of `hosts.schema.json`.
pub fn parse(yaml: &str) -> Result<Snapshot, LoadError> {
    let snapshot: Snapshot =
        serde_saphyr::from_str(yaml).map_err(|e| LoadError(format!("parse: {e}")))?;
    snapshot
        .validate()
        .map_err(|e| LoadError(format!("invalid: {e}")))?;
    Ok(snapshot)
}

/// A snapshot that could not be loaded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoadError(String);

impl fmt::Display for LoadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "hosting snapshot: {}", self.0)
    }
}

impl std::error::Error for LoadError {}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, clippy::expect_used, reason = "tests")]

    use ever_sh_core::{Product, TargetKind, TargetStatus, render_link};

    use super::*;

    #[test]
    fn the_committed_snapshot_loads() {
        let s = load().unwrap();
        assert_eq!(s.schema, ever_sh_core::SNAPSHOT_SCHEMA);
        assert!(s.targets.len() >= 3);
    }

    #[test]
    fn every_column_has_targets_for_gauzy() {
        let s = load().unwrap();
        let gauzy = s.targets_for(Some(Product::Gauzy));
        for kind in [
            TargetKind::SelfHost,
            TargetKind::EverCloud,
            TargetKind::ThirdParty,
        ] {
            assert!(gauzy.iter().any(|t| t.kind == kind), "{kind:?}");
        }
    }

    #[test]
    fn demand_is_soon_wherever_it_is_listed() {
        let s = load().unwrap();
        for t in s.targets_for(Some(Product::Demand)) {
            assert_eq!(t.status_for(Product::Demand), Some(TargetStatus::Soon));
            assert!(render_link(t, Product::Demand, None).is_none(), "{}", t.id);
        }
    }

    #[test]
    fn only_the_two_referral_hosts_carry_a_referral_code() {
        let s = load().unwrap();
        let with_referral: Vec<&str> = s
            .targets
            .iter()
            .filter(|t| t.referral.is_some())
            .map(|t| t.id.as_str())
            .collect();
        assert_eq!(with_referral, vec!["hostinger", "railway"]);
        let hostinger = s.target("hostinger").unwrap();
        let link = render_link(hostinger, Product::Gauzy, None).unwrap();
        assert!(link.href.contains("aff_id=244060"), "{}", link.href);
        assert_eq!(link.rel, "sponsored noopener");
        let railway = s.target("railway").unwrap();
        let link = render_link(railway, Product::Teams, None).unwrap();
        assert!(link.href.contains("referralCode=40jeja"), "{}", link.href);
    }

    #[test]
    fn self_hosting_links_point_at_the_install_page() {
        let s = load().unwrap();
        let compose = s.target("docker-compose").unwrap();
        assert_eq!(compose.install_source, "ever.sh");
        let link = render_link(compose, Product::Gauzy, None).unwrap();
        assert_eq!(link.href, "https://ever.sh/install/gauzy");
    }

    #[test]
    fn a_broken_document_is_refused() {
        assert!(
            parse("schema: ever.hosting-targets.v1\nas_of: '2026-10-01'\ntargets: []\n").is_err()
        );
        assert!(parse("not: [valid").is_err());
        let unknown_field = SNAPSHOT_YAML.replacen("targets:", "extra: 1\ntargets:", 1);
        assert!(parse(&unknown_field).is_err());
    }
}
