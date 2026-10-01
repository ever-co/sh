//! `ever-sh-core`: the rules ever.sh applies to hosting options, written once.
//!
//! - [`product`]: the six Ever products the site covers (Ever Demand is always "soon").
//! - [`target`]: a hosting target and the snapshot file that lists them, with its validation.
//! - [`connect`]: the connect-code grammar (`EVC-XXXX-XXXX-XXXX`, Crockford base32).
//! - [`link`]: rendering a target's link for one product, with or without a connect code.
//!
//! Everything here is pure: no I/O, no clock, no network. The web site applies the same rules in
//! `apps/web/src/chooser` and `apps/web/src/install`.

pub mod connect;
pub mod link;
pub mod product;
pub mod target;

pub use connect::ConnectCode;
pub use link::{RenderedLink, render_link};
pub use product::Product;
pub use target::{
    HostingTarget, Referral, SNAPSHOT_SCHEMA, Snapshot, SnapshotError, SnippetKind, TargetKind,
    TargetProduct, TargetStatus,
};
