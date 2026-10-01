//! `GET /v1/hosting-targets[?product=<id>]`.

use axum::Json;
use axum::extract::rejection::QueryRejection;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::http::header::CACHE_CONTROL;
use axum::response::{IntoResponse, Response};
use ever_sh_core::{HostingTarget, Product};
use serde::{Deserialize, Serialize};

use crate::AppState;
use crate::http::problem;

/// The query string.
#[derive(Debug, Deserialize)]
pub(crate) struct TargetsQuery {
    product: Option<String>,
}

#[derive(Serialize)]
struct TargetsBody<'a> {
    items: Vec<&'a HostingTarget>,
    /// `snapshot` while the answer comes from the compiled-in list.
    source: &'static str,
    as_of: &'a str,
}

/// The hosting targets, every one or those that list `product`, in snapshot order.
pub(crate) async fn list(
    State(state): State<AppState>,
    query: Result<Query<TargetsQuery>, QueryRejection>,
) -> Response {
    let Ok(Query(query)) = query else {
        return problem(
            StatusCode::BAD_REQUEST,
            "invalid_query",
            "the query string is malformed",
        );
    };
    let product = match query.product.as_deref() {
        None => None,
        Some(raw) => match Product::parse(raw) {
            Some(product) => Some(product),
            None => {
                return problem(
                    StatusCode::BAD_REQUEST,
                    "unknown_product",
                    "product must be one of gauzy, teams, works, rec, traduora, demand",
                );
            }
        },
    };
    let body = TargetsBody {
        items: state.snapshot.targets_for(product),
        source: "snapshot",
        as_of: &state.snapshot.as_of,
    };
    ([(CACHE_CONTROL, "public, max-age=300")], Json(body)).into_response()
}
