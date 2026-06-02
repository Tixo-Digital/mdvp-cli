# Architecture

MDVP is a design quality measurement tool for any live URL. It works in two modes:

- **Local mode** (`--local`): fully offline after first Puppeteer install. No API key, no cloud call. Suitable for CI.
- **Cloud mode** (default): reads historical scores from `api.mdvp.dev`. Fast, no browser needed.

---

## System overview

```mermaid
flowchart LR
    subgraph Input
        URL[URL / domain]
    end

    subgraph CLI ["@mdvp/cli (npm)"]
        cli[cli.mjs\narg parsing]
        audit[commands/audit.mjs\norchestration]
    end

    subgraph Engine ["engine/ — bundled, no download"]
        crawler["crawler-worker.mjs\nPuppeteer orchestrator"]
        extract["extract.js\nDOM metrics extractor\n(injected via page.evaluate)"]
        scorer["scorer.mjs\nShannon entropy +\n12 scoring categories"]
        colors["color-science.mjs\nOklab · APCA contrast"]
        thresholds["thresholds.mjs\n.mdvprc config +\nCI violation check"]
    end

    subgraph Output
        terminal[Terminal output\ncolored bar chart]
        json[JSON report\n--json flag]
        ci[Exit code\n--check flag]
    end

    subgraph Cloud ["mdvp.dev cloud  (optional)"]
        api[api.mdvp.dev\nhistorical dataset]
    end

    URL -->|--local| cli
    URL -->|cloud mode| cli
    cli --> audit
    audit -->|spawn subprocess| crawler
    crawler -->|page.evaluate| extract
    extract -->|DOM metrics JSON| audit
    audit -->|scoreDOMMetrics| scorer
    scorer --> colors
    scorer --> thresholds
    thresholds -->|violations array| audit
    audit --> terminal
    audit --> json
    audit -->|exit 1 on violation| ci

    audit -->|"GET /dataset/:domain"| api
    api -->|cached score| terminal
```

---

## Scoring pipeline

```mermaid
flowchart TD
    M[DOM Metrics\nfrom extract.js] --> S12[12 scoring categories]

    subgraph S12
        direction LR
        spacing["spacing (×15)"]
        typography["typography (×15)"]
        color["color (×25)"]
        components["components (×10)"]
        modernity["modernity (×10)"]
        originality["originality (×35)"]
        html["html_quality (×15)"]
        polish["visual_polish (×15)"]
        soph["sophistication (×15)"]
        readability["readability (×15)"]
        ux["ux_patterns (×10)"]
        content["contentDepth (×25)"]
    end

    S12 --> W[Weighted average\n→ overall 0-100]
    W --> Cap["Originality cap\n<45 → max 60\n<60 → max 70"]
    Cap --> Grade[Letter grade\nA+ to F]

    S12 --> G[groupComponents]
    subgraph G
        css_health["css_health\ntypography · spacing · color · components\n+ raw counts"]
        visual_quality["visual_quality\nmodernity · polish · sophistication · readability"]
        structure["structure\nhtml_quality · ux_patterns · contentDepth"]
        orig["originality\nAI-vibe detection"]
    end

    M --> E[computeEntropyMetrics\nShannon entropy]
    E --> entropy_out["typographyEntropy\ncolorEntropy\nspacingEntropy\nspacingGridAdherence\napcaContrastRisk"]
```

---

## Local mode: offline crawl

```mermaid
sequenceDiagram
    participant User
    participant CLI as cli.mjs
    participant Audit as commands/audit.mjs
    participant Puppeteer as crawler-worker.mjs
    participant Browser as Headless Chromium
    participant Extractor as extract.js (in-page)
    participant Scorer as engine/scorer.mjs

    User->>CLI: npx mdvp audit mysite.com --local --check
    CLI->>Audit: cmdAuditLocal("mysite.com", opts)

    Note over Audit: Copy bundled engine files to ~/.mdvp/crawler/
    Note over Audit: npm install puppeteer (first run only, ~30s)

    Audit->>Puppeteer: spawn node crawler-worker.mjs<br/>CRAWL_ONCE=https://mysite.com<br/>CRAWL_ONCE_STDOUT=1

    Puppeteer->>Browser: puppeteer.launch()
    Browser->>Puppeteer: page loaded
    Puppeteer->>Extractor: page.evaluate(extractScript)
    Extractor->>Puppeteer: DOM metrics JSON
    Puppeteer->>Audit: stdout JSON { metrics }

    Audit->>Scorer: scoreDOMMetrics(metrics)
    Scorer->>Audit: { overall, grade, breakdown, recommendations }
    Audit->>Audit: groupComponents() → css_health, visual_quality, structure, originality
    Audit->>Audit: loadThresholds() → read .mdvprc
    Audit->>Audit: checkThresholds() → violations[]

    alt violations.length > 0 and --check
        Audit->>User: stderr: violation list
        Audit->>User: exit 1
    else all pass
        Audit->>User: colored score output
        Audit->>User: exit 0
    end
```

---

## GitHub Action integration

```mermaid
flowchart LR
    PR[Pull Request] -->|on: pull_request| GHA[GitHub Actions runner\nubuntu-latest]
    GHA -->|actions/setup-node| Node[Node.js 20]
    GHA -->|writes| mdvprc[".mdvprc\n(inline threshold overrides)"]
    GHA -->|npx @mdvp/cli audit URL --local --check --json| CLI
    CLI -->|Puppeteer local crawl| Score[score JSON]
    Score -->|GITHUB_OUTPUT| Outputs["overall_score\ngrade\ncss_health_score\nviolations\nreport_json"]
    Score -->|::group::| Log[collapsible log]

    Outputs -->|fail_on_violation=true\nviolations > 0| Fail[exit 1\nfail step]
    Outputs -->|all pass| Pass[exit 0\ngreen check]
```

---

## File map

```
@mdvp/cli/
├── cli.mjs                   Entry point — arg parsing, command routing
├── commands/
│   ├── audit.mjs             Local + cloud audit orchestration
│   ├── auth.mjs              npx mdvp login (stores key in ~/.mdvp/config.json)
│   ├── compare.mjs           Side-by-side two-site comparison
│   └── hire.mjs              Submit/recrawl (cloud)
├── engine/                   Bundled scoring engine — shipped in npm tarball
│   ├── color-science.mjs     Oklab conversion, APCA contrast, palette analysis
│   ├── scorer.mjs            12-category scoring algorithm + groupComponents
│   ├── thresholds.mjs        .mdvprc loader + CI violation checker
│   ├── crawler-worker.mjs    Puppeteer orchestrator (local mode)
│   └── extract.js            DOM metrics extractor (injected into page)
├── lib/
│   ├── config.mjs            ~/.mdvp/config.json read/write
│   ├── constants.mjs         Version, help text, category labels
│   ├── format.mjs            Terminal color, bar chart, text formatter
│   └── http.mjs              Minimal HTTPS client (no fetch dependency)
├── mcp.mjs                   MCP server (npx mdvp mcp)
├── action/                   GitHub Action — NOT in npm tarball
│   ├── action.yml            Composite action definition
│   └── README.md             Action usage docs
└── test/                     Unit tests — NOT in npm tarball
    ├── fixtures/metrics.mjs  DOM metrics fixtures (minimal/good/vibecoded)
    ├── color-science.test.mjs
    ├── thresholds.test.mjs
    └── scorer.test.mjs
```

---

## Key design decisions

**Why Shannon entropy for design consistency?**  
Entropy (H) quantifies variety in a distribution. `H=0` means perfect consistency (one value, used everywhere); `H=1` means maximum chaos (all values equally frequent). Applied to font sizes, spacing values, and color counts, it gives an objective measure of design system discipline that doesn't require a reference design.

**Why Oklab for color analysis?**  
RGB distance is perceptually non-uniform — two colors that are "close" in RGB can look very different to human eyes. Oklab is designed so that Euclidean distance in the space correlates with perceived color difference, making `deltaE` meaningful for detecting near-duplicate colors and palette analysis.

**Why APCA contrast instead of WCAG 2.1?**  
WCAG 2.1 uses a simple luminance ratio that produces many false positives (e.g., large bold text flagged when it reads fine) and false negatives (some small gray text passes that shouldn't). APCA models spatial frequency, font weight, and text size — it better predicts what's actually readable.

**Why bundle the scoring engine in the npm package?**  
Requiring a cloud download on first run breaks CI: no network egress policy, no reliable cache, version pinning is impossible. Bundling `scorer.mjs` + `color-science.mjs` in the tarball makes `--local` fully reproducible — same algorithm version as the CLI version.

**Why a composite GitHub Action (not JS/Docker)?**  
Composite actions have no container startup cost, use the runner's existing Node.js install, and are easier to audit — the full logic is plain shell + `node` inline scripts. Docker actions add ~30s cold start; JS actions require compiled bundles checked into the repo.
