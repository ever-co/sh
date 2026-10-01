//! Connect codes, as the Ever account portal creates them. ever.sh never creates one: it only
//! recognises a code that comes back in a link and writes it into the install settings.

use std::fmt;

/// A connect code: `EVC-` and three groups of four Crockford base32 characters (`0-9`, `A-Z`
/// without `I`, `L`, `O`, `U`). Accepted case-insensitively, kept in upper case.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConnectCode(String);

impl ConnectCode {
    /// Parses a visitor-supplied value. Anything that is not exactly a code is `None`: the caller
    /// drops it and never echoes it.
    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        let upper = raw.trim().to_ascii_uppercase();
        let mut parts = upper.split('-');
        if parts.next() != Some("EVC") {
            return None;
        }
        let groups: Vec<&str> = parts.collect();
        let valid = groups.len() == 3
            && groups
                .iter()
                .all(|g| g.len() == 4 && g.chars().all(is_crockford));
        valid.then_some(Self(upper))
    }

    /// The code, upper case.
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for ConnectCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

const fn is_crockford(c: char) -> bool {
    c.is_ascii_digit() || (c.is_ascii_uppercase() && !matches!(c, 'I' | 'L' | 'O' | 'U'))
}

#[cfg(test)]
mod tests {
    use super::ConnectCode;

    #[test]
    fn accepts_the_grammar_case_insensitively_and_trims_whitespace() {
        for raw in [
            "evc-7k2m-9qhx-3rtw",
            " EVC-7K2M-9QHX-3RTW ",
            "EVC-7K2M-9QHX-3RTW\n",
        ] {
            let code = ConnectCode::parse(raw).map(|c| c.to_string());
            assert_eq!(code.as_deref(), Some("EVC-7K2M-9QHX-3RTW"), "{raw:?}");
        }
    }

    #[test]
    fn rejects_look_alikes_and_anything_else() {
        for bad in [
            "",
            "EVC",
            "EVC-7K2M-9QHX",
            "EVC-7K2M-9QHX-3RTW-AAAA",
            "EVC-7K2M-9QHX-3RTI",
            "EVC-7K2M-9QHX-3RTL",
            "EVC-7K2M-9QHX-3RTO",
            "EVC-7K2M-9QHX-3RTU",
            "EVL-7K2M-9QHX-3RTW",
            "EVC-7K2M-9QHX-3RT",
            "EVC_7K2M_9QHX_3RTW",
            "EVC-7K2M -9QHX-3RTW",
            "<script>",
            "EVC-7K2M-9QHX-3RTÉ",
        ] {
            assert!(
                ConnectCode::parse(bad).is_none(),
                "{bad:?} must be rejected"
            );
        }
    }
}
