---
title: Anonymous usage statistics
description: Exactly what the statistics module sends, and how to turn it off.
slug: stats-module
order: 20
---

Ever products send a small anonymous report about once a day, so we know how many installs exist
and which versions and features are in use.

## What is sent

Only the fields in the published schema: a random install identifier created by the product, the
product and version, how it was installed (`install_source`), a coarse country code, the month, and
allow-listed counts and on/off feature flags. Amounts are monthly totals only.

**Never sent:** names, e-mail addresses, postal addresses, tax or registration numbers, document
contents, individual records or amounts, free text, or precise location.

The receiving service rejects a report that contains any field outside the schema.

## `install_source` values

| Value | Meaning |
|---|---|
| `self-hosted` | installed by other means (the default) |
| `ever.sh` | installed with the settings from this site |
| `cloud` | run by Ever Cloud |
| `works_app` | an app created with Ever Works |
| `desktop` | the server embedded in a desktop app |
| `partner:<name>` | set by a hosting partner's template |

The value comes only from the `EVER_INSTALL_SOURCE` setting; it is never guessed.

## Turn it off

```dotenv
EVER_STATS_ENABLED=false
```

With this setting the module is not loaded and nothing is sent. The product's settings page shows
the current state and the last report that was sent.
