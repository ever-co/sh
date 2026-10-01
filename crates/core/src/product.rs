//! The Ever products ever.sh documents.

use std::fmt;

use serde::{Deserialize, Serialize};

/// One of the six Ever products. Nothing outside this list appears on the site.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Product {
    /// Ever Gauzy.
    Gauzy,
    /// Ever Teams.
    Teams,
    /// Ever Works.
    Works,
    /// Ever Rec.
    Rec,
    /// Ever Traduora.
    Traduora,
    /// Ever Demand: listed as "soon", never installable from this site.
    Demand,
}

impl Product {
    /// Every product, in the order the site lists them.
    pub const ALL: [Self; 6] = [
        Self::Gauzy,
        Self::Teams,
        Self::Works,
        Self::Rec,
        Self::Traduora,
        Self::Demand,
    ];

    /// The id used in URLs and data (`gauzy`, `teams`, ...).
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Gauzy => "gauzy",
            Self::Teams => "teams",
            Self::Works => "works",
            Self::Rec => "rec",
            Self::Traduora => "traduora",
            Self::Demand => "demand",
        }
    }

    /// Parses an id exactly as written in URLs (lower case only).
    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|p| p.as_str() == raw)
    }

    /// Products shown as "soon": no install page, no link, whatever the data says.
    #[must_use]
    pub const fn is_soon(self) -> bool {
        matches!(self, Self::Demand)
    }
}

impl fmt::Display for Product {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::Product;

    #[test]
    fn ids_round_trip_and_nothing_else_parses() {
        for p in Product::ALL {
            assert_eq!(Product::parse(p.as_str()), Some(p));
        }
        for bad in ["", "Gauzy", "GAUZY", "iq", "gauzy ", "demand2"] {
            assert_eq!(Product::parse(bad), None, "{bad:?} must not parse");
        }
    }

    #[test]
    fn only_demand_is_soon() {
        let soon: Vec<Product> = Product::ALL.into_iter().filter(|p| p.is_soon()).collect();
        assert_eq!(soon, vec![Product::Demand]);
    }
}
