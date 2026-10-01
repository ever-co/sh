//! `ever-sh-api`: serves the ever.sh hosting options (see the library documentation).
//!
//! ```text
//! ever-sh-api                 serve (HOST, PORT, EVER_API_URL; see `config`)
//! ever-sh-api probe <path>    GET a path of the running service (health checks)
//! ever-sh-api --version
//! ```
//!
//! Exit codes: 0 stopped cleanly, 64 usage, 70 invalid compiled-in snapshot, 71 cannot bind,
//! 78 invalid configuration.

use std::io::{IsTerminal, Write};
use std::net::SocketAddr;
use std::process::ExitCode;

use ever_sh_api::config::Config;
use ever_sh_api::{probe, router, snapshot};
use ever_sh_core::Snapshot;
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        None | Some("serve") => serve(),
        Some("probe") => probe::run(args.get(1..).unwrap_or_default()),
        Some("--version" | "-V") => {
            let _ = writeln!(
                std::io::stdout(),
                "ever-sh-api {}",
                env!("CARGO_PKG_VERSION")
            );
            ExitCode::SUCCESS
        }
        Some(_) => {
            let _ = writeln!(
                std::io::stderr(),
                "usage: ever-sh-api [serve | probe </path> | --version]"
            );
            ExitCode::from(64)
        }
    }
}

fn serve() -> ExitCode {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with_target(false)
        .with_ansi(std::io::stdout().is_terminal())
        .init();
    let config = match Config::from_env() {
        Ok(config) => config,
        Err(error) => {
            tracing::error!(%error, "invalid configuration");
            return ExitCode::from(78);
        }
    };
    let snapshot = match snapshot::load() {
        Ok(snapshot) => snapshot,
        Err(error) => {
            tracing::error!(%error, "the compiled-in hosting snapshot is invalid");
            return ExitCode::from(70);
        }
    };
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            tracing::error!(%error, "cannot start the async runtime");
            return ExitCode::FAILURE;
        }
    };
    runtime.block_on(run(config, snapshot))
}

async fn run(config: Config, snapshot: Snapshot) -> ExitCode {
    let addr = SocketAddr::new(config.host, config.port);
    let listener = match TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(error) => {
            tracing::error!(%addr, %error, "cannot bind");
            return ExitCode::from(71);
        }
    };
    tracing::info!(
        %addr,
        upstream = %config.api_url,
        as_of = %snapshot.as_of,
        targets = snapshot.targets.len(),
        "ever-sh-api listening; answering from the compiled-in hosting snapshot"
    );
    let served = axum::serve(listener, router(snapshot))
        .with_graceful_shutdown(shutdown_signal())
        .await;
    match served {
        Ok(()) => {
            tracing::info!("stopped");
            ExitCode::SUCCESS
        }
        Err(error) => {
            tracing::error!(%error, "server error");
            ExitCode::FAILURE
        }
    }
}

/// Resolves on Ctrl-C or SIGTERM (what a pod deletion sends), so in-flight requests finish.
async fn shutdown_signal() {
    let interrupt = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        () = interrupt => {},
        () = terminate => {},
    }
}
