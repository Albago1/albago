# Deep-link association files (serve at Gate B, not before)

These are templates. They contain placeholders and MUST NOT be served from
the domain until both values exist (serving broken files helps nobody):

1. **assetlinks.json** — replace `REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT`
   with the SHA-256 certificate fingerprint from **Play Console → Setup →
   App signing** (use the *App signing key* fingerprint, not the upload key).
2. **apple-app-site-association** — replace `REPLACE_APPLE_TEAM_ID` with the
   Apple Developer Team ID (Membership page in the developer account).

Then copy both files into the web app at `public/.well-known/` and deploy:

- `https://www.albago.org/.well-known/assetlinks.json`
- `https://www.albago.org/.well-known/apple-app-site-association`
  (must be served as `application/json`, no redirect — add a header rule if
  needed; Apple's CDN caches it for ~24h, verify with the branch validator).

After deploying, Android app links and iOS universal links make
`/events/*`, `/map`, `/protests`, and future ticket routes open in-app.
