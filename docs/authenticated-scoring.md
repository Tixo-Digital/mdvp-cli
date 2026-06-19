# Authenticated Page Scoring

MDVP can score private app pages by connecting the exact local crawler to a Chrome instance that you started and logged into. This is a local-only workflow: the CLI opens a new page in that browser, extracts rendered DOM and computed CSS metrics, scores them locally, and prints the normal audit result.

Use this when the page needs cookies, local storage, preview headers, or an internal network that the public crawler cannot reach.

## Security Model

- Cookies, local storage, session storage, request headers, passwords, and tokens are not printed or POSTed by default.
- Default `audit` with `MDVP_BROWSER_URL` or `MDVP_BROWSER_WS_ENDPOINT` still runs locally and does not require an API key.
- Do not use `--swarm`, `submit`, or cloud-only commands for private pages.
- Use a dedicated browser profile for MDVP, not your daily browser profile.
- Bind Chrome remote debugging to `127.0.0.1`; do not expose the debugging port to a network.
- Review JSON output before attaching it to a public issue. Scores and metric counts are usually safe, but URLs, page text-derived recommendations, or design-system names can still reveal private product context.

## Recommended Prototype Path

Start Chrome with a temporary profile and local remote debugging:

```bash
mkdir -p /tmp/mdvp-auth-profile
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/mdvp-auth-profile
```

Open the private or local app in that Chrome window and sign in normally. Then run MDVP against the authenticated URL:

```bash
MDVP_BROWSER_URL=http://127.0.0.1:9222 \
  npx @mdvp/cli audit http://localhost:3000/dashboard --json
```

If your tooling already gives you a DevTools websocket endpoint, pass it directly:

```bash
MDVP_BROWSER_WS_ENDPOINT=ws://127.0.0.1:9222/devtools/browser/<id> \
  npx @mdvp/cli audit https://staging.example.com/app --json
```

The crawler disconnects when it is done. It does not close the Chrome instance you started.

## Local Fixture Smoke

This fixture proves the flow without external services:

1. Start a local app that serves `/login` and `/dashboard`.
2. Require a cookie or local storage value before `/dashboard` renders the real UI.
3. Start Chrome with `--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=9222`, and a temporary `--user-data-dir`.
4. Log in through Chrome.
5. Run:

```bash
MDVP_BROWSER_URL=http://127.0.0.1:9222 \
  node cli.mjs audit http://localhost:3000/dashboard --json
```

Expected result:

- The audit returns `source: "local"`.
- The score reflects the authenticated dashboard DOM, not the login page.
- No cookie, authorization header, or local storage value appears in stdout or stderr.
- The Chrome window remains open after the command exits.

## Current Limitations

- This is not a browser extension. You still launch Chrome with remote debugging yourself.
- MDVP opens a new tab in the connected browser; it does not score the currently selected tab yet.
- Pages that require hardware keys, enterprise device posture, or cross-origin login popups may need a manual fixture or staging route.
- `--swarm`, `submit`, `compare`, `top`, `worst`, and `stats` are dataset or hosted commands and are not appropriate for private authenticated pages.

## Future Direction

The next integration should turn this prototype into a safer connector or extension flow that can score the currently active tab without asking users to copy a DevTools endpoint. That future connector should preserve the same boundary: extraction happens locally, credentials stay in the browser profile, and cloud submission remains explicit.
