---
title: Ever Connect
description: What connecting an install to your Ever organization does, and what it never does.
slug: connect
order: 10
---

Ever Connect links a self-hosted install to your organization in your Ever account, so you can see
it there and use the Ever Platform features you choose to enable.

## Off until you turn it on

- On a self-hosted install nothing is connected by default. With `EVER_CONNECT_ENABLED` unset, the
  install makes no request to any Ever service for this feature.
- Connecting uses a one-time code you create in your Ever account. The code works once and expires
  24 hours after it was created.
- Each integration asks for your consent separately and names the exact data it uses. You can turn
  any of them off at any time, and disconnecting never stops the product from working.

## How to connect

1. Open your product's install page (for example [Ever Gauzy](/install/gauzy)) and choose
   **Connect this install to Ever**.
2. Sign in with Ever ID and pick your organization.
3. You come back to the install page with the settings filled in.
