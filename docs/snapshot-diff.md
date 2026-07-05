# Snapshot Diff

`mdvp diff` compares two saved audit JSON files without crawling, calling the
hosted API, or requiring screenshots. It is useful when CI, an agent, or a
preview workflow already produced `--json` audit artifacts.

```bash
npx @mdvp/cli audit https://preview.example.com --json > before.json
npx @mdvp/cli audit https://preview.example.com --json > after.json
npx @mdvp/cli diff before.json after.json
```

By default, valid comparisons exit 0 and only report deltas. Add `--check` when
you want CI to fail on regressions:

```bash
npx @mdvp/cli diff before.json after.json --check
```

Check mode exits 1 when the overall score or any top-level component score is
lower in the after snapshot. Category deltas remain visible in the output, but
they do not fail the check by default; this keeps CI focused on high-level score
movement instead of noisy internal submetrics.

For CI parsers, combine `--json` and `--check`:

```bash
npx @mdvp/cli diff before.json after.json --check --json
```

The JSON payload includes a `check` object:

```json
{
  "check": {
    "ok": false,
    "status": "fail",
    "policy": "overall-or-component-regression",
    "regressionCount": 1,
    "regressions": [
      {
        "scope": "overall",
        "key": "overall",
        "label": "Overall",
        "before": 74,
        "after": 70,
        "delta": -4
      }
    ]
  }
}
```

This gives GitHub Actions, GitLab CI, and local agent loops a deterministic
regression gate without maintaining screenshot baselines.
