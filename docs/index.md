# Privacy Policy — Anatolian Kilim Home Pinterest Automation

_Last updated: 2026-08-28_

## Overview

This application ("the App") is a private, self-hosted automation tool operated by the
owner of the Etsy shop **Anatolian Kilim Home** and the Pinterest account
**@mehmetnecibyildirim**. Its sole purpose is to publish the shop owner's own product
listings as Pins to the shop owner's own Pinterest account.

The App is not offered to, installed by, or used on behalf of any third party.

## Data the App accesses

- **Pinterest account (via the official Pinterest API v5):** The App uses an OAuth
  access/refresh token, authorized by the account owner, with the scopes
  `boards:read`, `boards:write`, `pins:read`, `pins:write`, `user_accounts:read`.
  It uses these only to look up / create a board and to create Pins on the owner's
  account.
- **Public Etsy shop data:** The App reads the publicly available RSS feed of the
  shop `AnatolianKilimHome` (listing titles, links, images, prices). No Etsy account
  credentials are used.

## Data the App stores

- **OAuth tokens:** Stored as encrypted secrets in the owner's private GitHub
  repository (GitHub Actions Secrets). Not shared with anyone.
- **Run state:** A file (`data/state.json`) listing which Etsy listing IDs have
  already been pinned and timestamps, kept in the owner's private repository to avoid
  duplicate Pins. Contains no personal data.

## Data the App shares

None. The App does not sell, transfer, or disclose any data to third parties. The
only outbound calls are to the Pinterest API and to public Etsy/Anthropic endpoints.

## AI-generated content disclosure

The decorative patterns in the products are created with generative AI tools and then
produced as physical goods. Every Pin created by the App discloses this in the Pin
description and embeds an IPTC/XMP `DigitalSourceType = trainedAlgorithmicMedia`
metadata tag in the image.

## Third-party services

- **Pinterest API** — Pin creation. See Pinterest's Privacy Policy.
- **GitHub Actions** — Runs the automation on a schedule and stores secrets.
- **Anthropic (Claude) API** — Generates Pin titles/descriptions from public listing
  data. No personal data is sent.

## Retention & deletion

Tokens and run state persist until the owner revokes the Pinterest app authorization
or deletes the GitHub repository. To revoke access: Pinterest → Settings → Security
→ Apps → remove this app.

## Contact

Operated by the Anatolian Kilim Home shop owner. Contact via the Etsy shop
[Anatolian Kilim Home](https://anatoliankilimhome.etsy.com) message system.
