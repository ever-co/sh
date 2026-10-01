---
title: Install Ever Rec
description: The settings for a self-hosted Ever Rec, with the optional connection to your Ever account.
slug: rec
order: 0
snippets: [env]
sources:
  - repo: ever-co/ever-rec
    path: README.md#firebase-integration
    sha: "e39470b5611099381890ba4e5cc2ed6b40eb0d2a"
verified: 2026-10-01
---

Ever Rec needs a Firebase project you own: it provides authentication, the database and storage.
There is no published container image yet, so you build and run the apps from the repository.

1. Create the Firebase project and set the `FIREBASE_*` values as the
   [README](https://github.com/ever-co/ever-rec#firebase-integration) describes.
2. Add the settings below to the environment of the API app.
