//! Shared HTTP pieces: problem responses, `/healthz`, the 404 fallback and the request
//! middleware.

use std::time::Instant;

use axum::extract::Request;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE, X_CONTENT_TYPE_OPTIONS};
use axum::http::{HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

/// An RFC 9457 problem document with a stable machine-readable `code`.
pub(crate) fn problem(status: StatusCode, code: &'static str, detail: &str) -> Response {
    let body = serde_json::json!({
        "type": "about:blank",
        "title": status.canonical_reason().unwrap_or("Error"),
        "status": status.as_u16(),
        "code": code,
        "detail": detail,
    });
    (
        status,
        [
            (CONTENT_TYPE, "application/problem+json"),
            (CACHE_CONTROL, "no-store"),
        ],
        body.to_string(),
    )
        .into_response()
}

/// `GET /healthz`: the process is up. No other work, no upstream call.
pub(crate) async fn healthz() -> Response {
    (
        [
            (CONTENT_TYPE, "application/json"),
            (CACHE_CONTROL, "no-store"),
        ],
        "{\"status\":\"ok\",\"service\":\"ever-sh-api\"}\n",
    )
        .into_response()
}

/// Any other path.
pub(crate) async fn not_found() -> Response {
    problem(StatusCode::NOT_FOUND, "not_found", "no such route")
}

/// Adds the headers every response carries and logs one line per request. Only the path is
/// logged, never the query: a query string can hold a visitor's connect code.
pub(crate) async fn observe(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_owned();
    let started = Instant::now();
    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    if path != "/healthz" {
        let ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
        tracing::info!(
            %method,
            path,
            status = response.status().as_u16(),
            ms,
            "request"
        );
    }
    response
}
