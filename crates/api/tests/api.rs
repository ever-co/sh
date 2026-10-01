//! The service's routes, end to end through the router (no socket).

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    missing_docs,
    reason = "tests"
)]

use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use ever_sh_api::{router, snapshot};
use http_body_util::BodyExt;
use serde_json::Value;
use tower::ServiceExt;

fn app() -> Router {
    router(snapshot::load().unwrap())
}

async fn get(uri: &str) -> (StatusCode, axum::http::HeaderMap, Value) {
    let response = app()
        .oneshot(Request::get(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let json = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, headers, json)
}

#[tokio::test]
async fn healthz_answers_without_any_other_work() {
    let (status, headers, body) = get("/healthz").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "ever-sh-api");
    assert_eq!(headers[header::CACHE_CONTROL], "no-store");
    assert_eq!(headers[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
}

#[tokio::test]
async fn hosting_targets_come_from_the_dated_snapshot() {
    let snapshot = snapshot::load().unwrap();
    let (status, headers, body) = get("/v1/hosting-targets").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["source"], "snapshot");
    assert_eq!(body["as_of"], snapshot.as_of.as_str());
    assert_eq!(
        body["items"].as_array().unwrap().len(),
        snapshot.targets.len()
    );
    assert_eq!(headers[header::CACHE_CONTROL], "public, max-age=300");
}

#[tokio::test]
async fn hosting_targets_filter_by_product() {
    let (status, _, body) = get("/v1/hosting-targets?product=gauzy").await;
    assert_eq!(status, StatusCode::OK);
    let items = body["items"].as_array().unwrap();
    assert!(items.len() >= 3);
    for item in items {
        let listed = item["products"]
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p["id"] == "gauzy");
        assert!(listed, "{}", item["id"]);
        assert!(item.get("referral").is_some(), "referral is always present");
    }
    let (_, _, demand) = get("/v1/hosting-targets?product=demand").await;
    for item in demand["items"].as_array().unwrap() {
        let status = item["products"]
            .as_array()
            .unwrap()
            .iter()
            .find(|p| p["id"] == "demand")
            .unwrap()["status"]
            .clone();
        assert_eq!(status, "soon");
    }
}

#[tokio::test]
async fn an_unknown_product_is_a_problem_not_an_empty_list() {
    for uri in [
        "/v1/hosting-targets?product=iq",
        "/v1/hosting-targets?product=",
        "/v1/hosting-targets?product=Gauzy",
    ] {
        let (status, headers, body) = get(uri).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{uri}");
        assert_eq!(headers[header::CONTENT_TYPE], "application/problem+json");
        assert_eq!(body["code"], "unknown_product");
    }
}

#[tokio::test]
async fn link_renders_the_install_page_and_carries_only_a_valid_code() {
    let (status, headers, body) =
        get("/v1/hosting-targets/docker-compose/link?product=gauzy").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["href"], "https://ever.sh/install/gauzy");
    assert_eq!(body["install_source"], "ever.sh");
    assert_eq!(body["connect_rejected"], false);
    assert_eq!(headers[header::CACHE_CONTROL], "public, max-age=300");

    let (_, headers, body) =
        get("/v1/hosting-targets/docker-compose/link?product=gauzy&connect=evc-7k2m-9qhx-3rtw")
            .await;
    assert_eq!(
        body["href"],
        "https://ever.sh/install/gauzy?connect=EVC-7K2M-9QHX-3RTW"
    );
    assert_eq!(headers[header::CACHE_CONTROL], "private, no-store");

    let (status, _, body) = get(
        "/v1/hosting-targets/docker-compose/link?product=gauzy&connect=%22%3E%3Cimg%20src%3Dx%3E",
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["href"], "https://ever.sh/install/gauzy");
    assert_eq!(body["connect_rejected"], true);
    assert!(
        !body.to_string().contains("img"),
        "a rejected code is never echoed"
    );
}

#[tokio::test]
async fn referral_links_are_marked_sponsored() {
    let (status, _, body) = get("/v1/hosting-targets/hostinger/link?product=gauzy").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["rel"], "sponsored noopener");
    assert_eq!(body["external"], true);
    assert!(body["href"].as_str().unwrap().contains("aff_id=244060"));
    assert_eq!(body["install_source"], "partner:hostinger");

    let (_, _, body) = get("/v1/hosting-targets/render/link?product=teams").await;
    assert_eq!(body["rel"], "noopener");
}

#[tokio::test]
async fn link_problems() {
    let cases = [
        (
            "/v1/hosting-targets/nope/link?product=gauzy",
            StatusCode::NOT_FOUND,
            "unknown_target",
        ),
        (
            "/v1/hosting-targets/hostinger/link",
            StatusCode::BAD_REQUEST,
            "unknown_product",
        ),
        (
            "/v1/hosting-targets/hostinger/link?product=teams",
            StatusCode::NOT_FOUND,
            "no_link",
        ),
        (
            "/v1/hosting-targets/docker-compose/link?product=demand",
            StatusCode::NOT_FOUND,
            "no_link",
        ),
    ];
    for (uri, expected, code) in cases {
        let (status, _, body) = get(uri).await;
        assert_eq!(status, expected, "{uri}");
        assert_eq!(body["code"], code, "{uri}");
    }
}

#[tokio::test]
async fn unknown_routes_are_404_problems() {
    let (status, headers, body) = get("/v1/unknown").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(headers[header::CONTENT_TYPE], "application/problem+json");
    assert_eq!(body["code"], "not_found");
}

#[tokio::test]
async fn nothing_sets_a_cookie() {
    for uri in [
        "/healthz",
        "/v1/hosting-targets",
        "/v1/hosting-targets/railway/link?product=teams",
        "/missing",
    ] {
        let (_, headers, _) = get(uri).await;
        assert!(headers.get(header::SET_COOKIE).is_none(), "{uri}");
    }
}
