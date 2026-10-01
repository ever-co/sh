//! `GET /v1/hosting-targets/{id}/link?product=<id>[&connect=<code>]`.
//!
//! The connect code is checked against its grammar first: a malformed value is dropped (and the
//! answer says so), never copied into a link.

use axum::Json;
use axum::extract::rejection::QueryRejection;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::http::header::CACHE_CONTROL;
use axum::response::{IntoResponse, Response};
use ever_sh_core::{ConnectCode, Product, render_link};
use serde::{Deserialize, Serialize};

use crate::AppState;
use crate::http::problem;

/// The query string.
#[derive(Debug, Deserialize)]
pub(crate) struct LinkQuery {
    product: Option<String>,
    connect: Option<String>,
}

#[derive(Serialize)]
struct LinkBody<'a> {
    id: &'a str,
    product: Product,
    href: String,
    rel: &'static str,
    external: bool,
    /// What an install made through this link reports as its source.
    install_source: &'a str,
    /// True when the request carried a `connect` value that is not a valid code.
    connect_rejected: bool,
    source: &'static str,
}

/// The rendered link of one target for one product.
pub(crate) async fn render(
    State(state): State<AppState>,
    Path(id): Path<String>,
    query: Result<Query<LinkQuery>, QueryRejection>,
) -> Response {
    let Ok(Query(query)) = query else {
        return problem(
            StatusCode::BAD_REQUEST,
            "invalid_query",
            "the query string is malformed",
        );
    };
    let Some(target) = state.snapshot.target(&id) else {
        return problem(
            StatusCode::NOT_FOUND,
            "unknown_target",
            "no hosting target has this id",
        );
    };
    let Some(product) = query.product.as_deref().and_then(Product::parse) else {
        return problem(
            StatusCode::BAD_REQUEST,
            "unknown_product",
            "product must be one of gauzy, teams, works, rec, traduora, demand",
        );
    };
    let supplied = query
        .connect
        .as_deref()
        .filter(|raw| !raw.trim().is_empty());
    let code = supplied.and_then(ConnectCode::parse);
    let connect_rejected = supplied.is_some() && code.is_none();
    let Some(link) = render_link(target, product, code.as_ref()) else {
        return problem(
            StatusCode::NOT_FOUND,
            "no_link",
            "this target has no link for this product",
        );
    };
    // A link that carries a connect code belongs to one person: never cached anywhere.
    let cache = if code.is_some() {
        "private, no-store"
    } else {
        "public, max-age=300"
    };
    let body = LinkBody {
        id: &target.id,
        product,
        href: link.href,
        rel: link.rel,
        external: link.external,
        install_source: &target.install_source,
        connect_rejected,
        source: "snapshot",
    };
    ([(CACHE_CONTROL, cache)], Json(body)).into_response()
}
