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

For agent-specific operating guidance, use [Agent workflows](agent-workflows.md). It gives coding agents the safe preflight, audit, JSON, CI, and MCP reporting loop without turning MDVP into a vague taste judgment.

## Ethical Star Growth Loop

The star loop should be a consequence of useful public work:

1. Ship or document a concrete MDVP workflow that solves a real frontend-quality problem.
2. Publish the exact command, input URL, and output excerpt so readers can reproduce the result.
3. Ask for critique of the signal, docs, or integration path instead of asking for stars.
4. Convert useful feedback into issues, fixes, examples, or release notes.
5. Make the improvement visible in the README, docs, changelog, or GitHub release.
6. Let stars, forks, npm installs, and discussion activity measure whether the work is resonating.

This loop should reject fake stars, star swaps, spam comments, mass DMs, review manipulation, paid engagement farms, and low-quality growth hacks. Maintainers can ask users to star the repository only after providing value, such as a working audit, a CI snippet, a benchmark artifact, or a reproducible scoring explanation.

## Audiences And Channels

Use a different artifact for each audience:

- **AI frontend builders:** share before/after audits for v0, Bolt, Lovable, Cursor, or similar generated pages. Channel fit: GitHub issues, project READMEs, focused demos, and technical posts about generated-UI cleanup.
- **CI and release engineers:** lead with `audit --check`, `.mdvprc`, GitHub Action setup, and failure output that is stable enough for scripts. Channel fit: CI examples, release notes, action marketplace copy, and build-tool discussions.
- **Design-system teams:** lead with color count, font count, spacing-grid adherence, CSS custom property usage, APCA risk, and `DESIGN.md` compliance. Channel fit: design-system docs, design engineering communities, and case studies.
- **MCP and agent tool users:** lead with `npx @mdvp/cli mcp`, `audit_url`, and `perceive_url` so coding agents can inspect a preview URL before reporting done. Channel fit: MCP directories, agent workflow docs, and coding-agent templates.
- **Open-source contributors:** lead with one-file signal detectors, scoring feedback issues, and reproducible fixtures. Channel fit: good-first-issue lists, contribution guides, and release notes that call out new detector opportunities.

## Repo Conversion Review

Review these surfaces before a public push:

- **README first viewport:** the first screen should state "Design linter for AI-generated frontends", show the `npx @mdvp/cli audit myapp.com` command, and include a real output screenshot or excerpt.
- **Social preview clarity:** the preview image should say what the CLI does, not just show a logo. Test whether the card communicates "rendered DOM design linting without screenshots" at small sizes.
- **Repo About and topics:** keep the About text and topics aligned with the current wedge: CLI, frontend quality, generated UI, GitHub Action, MCP, design-system, design tokens, APCA, and visual regression alternatives.
- **Discussions:** if enabled, seed categories for questions, audit examples, signal feedback, and showcases. Keep bugs and feature work in issues.
- **Release notes:** every release should include one user-visible proof point: a new signal, a CI workflow improvement, a benchmark update, a before/after example, or a docs path that removes onboarding friction.
- **Comparison and proof docs:** keep [Development proof](development-proof.md), [Benchmark](benchmark.md), [Scoring](scoring.md), and [Signal catalog](signals.md) easy to reach from share links.
- **Examples and issue templates:** keep issue templates oriented around command run, URL, mode, JSON output, expected behavior, and scoring feedback so external interest becomes reproducible work.

## 30-Day Checklist

Use this as an operating checklist, not a marketing calendar:

- **Days 1-3:** re-run `npx @mdvp/cli audit mdvp.dev`, update the dogfood excerpt if it changed, and ensure the README first viewport still shows a real local audit path.
- **Days 4-6:** validate the social preview card at small sizes and open a follow-up issue if it does not clearly sell the CLI value.
- **Days 7-9:** publish one copy-paste CI example using `npx @mdvp/cli init --github-action`, `.mdvprc`, and `audit --check` output.
- **Days 10-12:** turn one scoring surprise into a GitHub issue with JSON output, URL, mode, and expected behavior.
- **Days 13-15:** add or refresh one proof artifact: before/after fixture, benchmark note, or signal explanation.
- **Days 16-18:** review repo About text, topics, README badges, npm keywords, and package description for alignment with the "design linter for AI-generated frontends" wedge.
- **Days 19-21:** prepare a focused MCP/agent workflow example that uses `audit_url` or `perceive_url` against a preview URL.
- **Days 22-24:** identify one good-first signal detector or docs fix and make it easy for a contributor to reproduce locally with `npm ci` and `npm test`.
- **Days 25-27:** write release notes that describe the user-visible improvement and link the proof artifact.
- **Days 28-30:** review the measurement dashboard, compare against the prior month, and choose the next product improvement based on real usage or feedback.

## Measurement

Track signals that show real developer adoption:

- GitHub stars and forks, measured weekly with the release or docs changes that might explain movement.
- npm downloads and version adoption for `@mdvp/cli`, especially after README, release, or CI workflow updates.
- README badge usage by searching public repositories for `mdvp.dev/badge` or generated badge markdown.
- Issues and pull requests, split by bug reports, scoring feedback, feature requests, and external contributions.
- Discussion posts if GitHub Discussions are enabled, split by questions, examples, showcases, and scoring feedback.
- External mentions from technical posts, GitHub repos, MCP directories, package directories, and CI examples.
- Conversion from first-run docs to durable usage: `init --github-action`, badge generation, MCP config, and repeat scoring feedback.

Measurement should inform product work, not become a vanity target. A small number of detailed scoring-feedback issues is more useful than a large number of low-intent stars.

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
