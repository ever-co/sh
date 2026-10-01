//! Configuration, read once from the environment at start-up.
//!
//! | Variable | Default | Meaning |
//! |---|---|---|
//! | `HOST` | `0.0.0.0` | bind address |
//! | `PORT` | `8080` | bind port |
//! | `EVER_API_URL` | `https://api.ever.co` | the public Ever Platform API (not read yet: answers come from the snapshot) |
//!
//! A malformed value stops the process at start-up (exit code 78) instead of serving with a
//! guess.

use std::fmt;
use std::net::IpAddr;

/// The validated configuration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    /// Bind address.
    pub host: IpAddr,
    /// Bind port.
    pub port: u16,
    /// Origin of the public Ever Platform API, without a trailing slash.
    pub api_url: String,
}

/// A configuration value that is not acceptable.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigError(String);

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ConfigError {}

impl Config {
    /// Reads the process environment.
    ///
    /// # Errors
    /// The first malformed value.
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_lookup(|key| std::env::var(key).ok())
    }

    /// Reads values through `get` (the environment, or a map in tests).
    ///
    /// # Errors
    /// The first malformed value.
    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        let host = match get("HOST") {
            None => IpAddr::from([0, 0, 0, 0]),
            Some(raw) => raw
                .trim()
                .parse()
                .map_err(|_| ConfigError(format!("HOST must be an IP address, got {raw:?}")))?,
        };
        let port = match get("PORT") {
            None => 8080,
            Some(raw) => raw
                .trim()
                .parse::<u16>()
                .ok()
                .filter(|p| *p != 0)
                .ok_or_else(|| ConfigError(format!("PORT must be 1-65535, got {raw:?}")))?,
        };
        let api_url = match get("EVER_API_URL") {
            None => "https://api.ever.co".to_owned(),
            Some(raw) => origin("EVER_API_URL", &raw)?,
        };
        Ok(Self {
            host,
            port,
            api_url,
        })
    }
}

/// Accepts an absolute `http(s)://host[:port]` origin (an optional trailing `/` is dropped): no
/// credentials, path, query or fragment.
fn origin(name: &str, raw: &str) -> Result<String, ConfigError> {
    let bad = || ConfigError(format!("{name} must be an http(s) origin, got {raw:?}"));
    let value = raw.trim();
    let rest = value
        .strip_prefix("https://")
        .or_else(|| value.strip_prefix("http://"))
        .ok_or_else(bad)?;
    let authority = rest.strip_suffix('/').unwrap_or(rest);
    let valid = !authority.is_empty()
        && authority
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':' | '[' | ']'));
    if !valid {
        return Err(bad());
    }
    Ok(value.strip_suffix('/').unwrap_or(value).to_owned())
}

#[cfg(test)]
mod tests {
    #![allow(clippy::unwrap_used, clippy::expect_used, reason = "tests")]

    use std::collections::HashMap;

    use super::*;

    fn with(pairs: &[(&str, &str)]) -> Result<Config, ConfigError> {
        let map: HashMap<String, String> = pairs
            .iter()
            .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
            .collect();
        Config::from_lookup(|key| map.get(key).cloned())
    }

    #[test]
    fn defaults() {
        let c = with(&[]).unwrap();
        assert_eq!(c.host.to_string(), "0.0.0.0");
        assert_eq!(c.port, 8080);
        assert_eq!(c.api_url, "https://api.ever.co");
    }

    #[test]
    fn accepts_valid_values() {
        let c = with(&[
            ("HOST", "127.0.0.1"),
            ("PORT", "9090"),
            ("EVER_API_URL", "http://ever-smoke-api.invalid:9/"),
        ])
        .unwrap();
        assert_eq!(c.port, 9090);
        assert_eq!(c.api_url, "http://ever-smoke-api.invalid:9");
    }

    #[test]
    fn refuses_malformed_values() {
        assert!(with(&[("HOST", "localhost")]).is_err());
        assert!(with(&[("PORT", "0")]).is_err());
        assert!(with(&[("PORT", "70000")]).is_err());
        for bad in [
            "api.ever.co",
            "ftp://api.ever.co",
            "https://",
            "https://user:pass@api.ever.co",
            "https://api.ever.co/v1",
            "https://api.ever.co?x=1",
        ] {
            assert!(with(&[("EVER_API_URL", bad)]).is_err(), "{bad}");
        }
    }
}
