# Adoption Playbook

This page is for maintainers who want MDVP to be easy to try, evaluate, and share without resorting to fake stars, spam, or vague AI claims.

## Positioning

Lead with the concrete wedge:

> Design linter for AI-generated frontends.

Then explain the proof in one sentence:

> MDVP crawls the rendered DOM, reads computed CSS, scores color/type/spacing/structure, and flags common generated-UI patterns without screenshots or an API key.

Avoid saying that MDVP judges taste. It measures repeatable signals: unique colors, font families, type scale, spacing rhythm, CSS custom properties, APCA contrast risk, semantic structure, and heuristic pattern matches.

## Fast Public Examples

Use examples that a developer can run immediately:

```bash
npx @mdvp/cli audit mdvp.dev
npx @mdvp/cli audit myapp.com --json | jq '{score: .overall_score, components: .components}'
npx @mdvp/cli init --github-action
npx @mdvp/cli badge myapp.com
```

When sharing an example, include the component breakdown rather than only the overall score:

```text
myapp.com  C+  58/100  local crawl

  css_health      48   32 colors · 4 fonts · 61% on grid
  visual_quality  67
  structure       81
  originality     38

Lowest: originality (38) · color (44) · spacing (51)
```

The component breakdown makes the tool feel inspectable. It also helps users decide whether a finding is useful for their project before they install anything.

## Development Proof To Share

Use evidence that shows the tool changes engineering behavior:

- A live dogfood audit that names a fixable issue, such as font-family drift or color sprawl.
- A before/after workflow where reducing those issues improves the score.
- A CI gate example showing how the same finding blocks a pull request before merge.
- A benchmark caveat link, so the claim stays honest: MDVP provides deterministic development signals, not a universal taste oracle.

For the current proof artifact, see [Development proof](development-proof.md).

## Conversion Loops

Useful adoption loops are product artifacts, not star requests:

- **First run:** `npx @mdvp/cli audit <url>` gives a local score without signup.
- **Repo adoption:** `npx @mdvp/cli init --github-action` turns the trial into a pull-request gate.
- **Social proof:** `npx @mdvp/cli badge <domain>` gives maintainers a README badge after submitting a public result.
- **Agent workflow:** `npx @mdvp/cli mcp` exposes the same audit surface to MCP-compatible coding agents.
- **Contributor path:** new signal detectors are one-file additions under `engine/signals/`.

## Distribution Checklist

Before posting or pitching MDVP, prepare a specific artifact:

- A real audit excerpt for a public URL.
- The exact `npx` command that produced it.
- One concrete finding, such as color sprawl, font-family drift, or generated-hero pattern matches.
- A link to the relevant docs page: CLI, CI, scoring, benchmark, or MCP.
- A request for feedback on the scoring signal, not a request for stars.

Good channels are places where developers already discuss frontend quality, generated UI, CI checks, visual regression, or MCP tooling. Keep posts narrow and technical. Convert useful feedback into GitHub issues so the project visibly improves.

## Why This Work Comes Before Another Detector

New detectors improve MDVP for people who already run it. The larger current gap is that many visitors do not immediately see the sharp use case. Sharper README positioning, npm search metadata, runnable examples, and adoption loops increase the chance that existing traffic turns into trials, stars, and CI installs.

That does not replace signal work. It makes each future detector easier to discover and evaluate.
