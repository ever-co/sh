//! `ever-sh-api`: the API service the ever.sh web site reads hosting options from.
//!
//! Public, read-only routes; no credential, no cookie, no write:
//!
//! - `GET /healthz`: liveness, answered without any other work.
//! - `GET /v1/hosting-targets[?product=<id>]`: `{ "items": [...], "source", "as_of" }`.
//! - `GET /v1/hosting-targets/{id}/link?product=<id>[&connect=<code>]`: one rendered link.
//!
//! Every answer currently comes from the hosting snapshot compiled into the binary
//! (`content/hosting/hosts.yaml`, `source: "snapshot"`, labelled with its `as_of` date). Reading
//! the live list from the Ever Platform API comes later, with this snapshot as its fallback.

pub mod config;
mod http;
mod link;
pub mod probe;
pub mod snapshot;
mod targets;

use std::sync::Arc;

use axum::Router;
use axum::middleware;
use axum::routing::get;
use ever_sh_core::Snapshot;

/// Shared, read-only state of the router.
#[derive(Clone)]
struct AppState {
    snapshot: Arc<Snapshot>,
}

/// The service's routes over `snapshot`.
pub fn router(snapshot: Snapshot) -> Router {
    let state = AppState {
        snapshot: Arc::new(snapshot),
    };
    Router::new()
        .route("/healthz", get(http::healthz))
        .route("/v1/hosting-targets", get(targets::list))
        .route("/v1/hosting-targets/{id}/link", get(link::render))
        .fallback(http::not_found)
        .with_state(state)
        .layer(middleware::from_fn(http::observe))
}
