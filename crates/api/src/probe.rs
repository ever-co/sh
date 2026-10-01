//! `ever-sh-api probe <path>`: a dependency-free HTTP check of the running service, for container
//! health checks and boot smoke tests in images that ship no curl.
//!
//! It sends `GET <path>` to `127.0.0.1:$PORT` (default 8080), prints the response body on
//! stdout and exits 0 for a 200 answer, 1 for anything else, 64 for a usage error.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::process::ExitCode;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(5);

/// Runs the probe with the arguments after `probe`.
#[must_use]
pub fn run(args: &[String]) -> ExitCode {
    let [path] = args else {
        return usage();
    };
    let valid_path =
        path.starts_with('/') && path.len() <= 2048 && path.chars().all(|c| c.is_ascii_graphic());
    if !valid_path {
        return usage();
    }
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.trim().parse::<u16>().ok())
        .unwrap_or(8080);
    match get(SocketAddr::from(([127, 0, 0, 1], port)), path) {
        Ok((status, body)) => {
            let mut out = std::io::stdout();
            let _ = out.write_all(&body);
            let _ = out.flush();
            if status == 200 {
                ExitCode::SUCCESS
            } else {
                ExitCode::FAILURE
            }
        }
        Err(e) => {
            let _ = writeln!(std::io::stderr(), "probe: {e}");
            ExitCode::FAILURE
        }
    }
}

fn usage() -> ExitCode {
    let _ = writeln!(std::io::stderr(), "usage: ever-sh-api probe </path>");
    ExitCode::from(64)
}

/// One HTTP/1.0 request; the server closes the connection after the answer.
fn get(addr: SocketAddr, path: &str) -> std::io::Result<(u16, Vec<u8>)> {
    let mut stream = TcpStream::connect_timeout(&addr, TIMEOUT)?;
    stream.set_read_timeout(Some(TIMEOUT))?;
    stream.set_write_timeout(Some(TIMEOUT))?;
    let request = format!(
        "GET {path} HTTP/1.0\r\nHost: 127.0.0.1\r\nUser-Agent: ever-sh-api-probe\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(request.as_bytes())?;
    let mut raw = Vec::new();
    stream.take(4 * 1024 * 1024).read_to_end(&mut raw)?;
    parse_response(&raw).ok_or_else(|| std::io::Error::other("malformed HTTP response"))
}

fn parse_response(raw: &[u8]) -> Option<(u16, Vec<u8>)> {
    let split = raw.windows(4).position(|w| w == b"\r\n\r\n")?;
    let head = std::str::from_utf8(raw.get(..split)?).ok()?;
    let status = head
        .lines()
        .next()?
        .split_whitespace()
        .nth(1)?
        .parse()
        .ok()?;
    Some((status, raw.get(split + 4..)?.to_vec()))
}

#[cfg(test)]
mod tests {
    use super::parse_response;

    #[test]
    fn parses_status_and_body() {
        let raw = b"HTTP/1.0 200 OK\r\ncontent-type: application/json\r\n\r\n{\"status\":\"ok\"}";
        assert_eq!(
            parse_response(raw),
            Some((200, b"{\"status\":\"ok\"}".to_vec()))
        );
        assert_eq!(
            parse_response(b"HTTP/1.1 404 Not Found\r\n\r\n"),
            Some((404, Vec::new()))
        );
        assert_eq!(parse_response(b"garbage"), None);
    }
}
