# Validation Study

This document describes the planned study to measure how well MDVP scores correlate with human aesthetic judgments. The study design, analysis scripts, and success criteria are defined here so they can be executed and cited once data is collected.

**Status:** study design complete, data collection pending.

---

## Goal

Establish a citable Spearman ρ between MDVP component scores and mean human ratings on the same pages. Success: ρ ≥ 0.45 on at least one component (the threshold for "moderate positive correlation" in social science research).

This would allow MDVP to claim: *"css_health score correlates with human aesthetic ratings (ρ = X, n = 50 pages, N = 1000 ratings, p < 0.01)"* — a concrete, falsifiable statement.

---

## Sample selection

50 websites across 5 categories (10 per category):

| Category | Selection criteria |
|---|---|
| Landing pages | SaaS product landing pages, no paywall |
| Dashboards | Admin/analytics UIs accessible without login |
| Documentation | Reference docs (devtools, frameworks, APIs) |
| E-commerce | Product listing + detail pages |
| Portfolios | Personal/agency sites |

Sites are selected to cover the score range: aim for roughly uniform distribution across 0–100, not just top-tier sites. Include at least 5 sites that score below 50.

**Avoiding selection bias:** do not hand-pick sites you expect to score well or poorly. Use a random sample from each category (e.g. first 10 results for each category in a search, or from Webis-Web-Archive if using that dataset).

### Existing public datasets

Before running a custom study, check if existing labeled data is sufficient:

- **[Webis-Web-Archive-17](https://zenodo.org/records/1002204)** (5000 screenshots, no aesthetic ratings, but has web category annotations)
- **[AMT homepage ratings](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10823051/)** — 450 homepage screenshots rated on aesthetic dimensions by Amazon Mechanical Turk workers
- **[Webthetics dataset](https://github.com/carrenD/Webthetics)** — 1000 web screenshots with aesthetic scores (1–10) — **most applicable**

If Webthetics data is used: download the dataset, run MDVP locally on each available URL (some may be dead), match by domain, run correlation. This avoids the cost and time of a new study.

---

## Rating protocol (if running custom study)

**Platform:** Prolific (preferred) or Amazon Mechanical Turk

**Task per rater:**
> "Rate the visual design quality of this webpage screenshot on a scale from 1 (very poor) to 7 (excellent). Consider: clarity, visual organization, use of color and typography, and overall polish. Do not rate the content, product, or functionality."

**Controls:**
- Catch trial: include 2 known-high and 2 known-low pages (pre-screened)
- Attention check: one screenshot is shown twice (ratings should be consistent ±1)
- Reject raters who fail both catch trials or show extreme response bias (all 1s or all 7s)

**Volume:**
- 20 raters per page × 50 pages = 1000 ratings
- Estimated time per rater: 25 minutes (50 screenshots at 30 seconds each)
- Estimated cost: 20 raters × $6/hour × 25/60 hours = ~$50 at Prolific minimum wage
- With markup: ~$150–$200 total

---

## Analysis

Once ratings and MDVP scores are collected, run:

```bash
node scripts/compute-correlation.mjs --ratings data/human-ratings.json --domains data/study-domains.txt
```

See `scripts/compute-correlation.mjs` for implementation. The script:
1. Runs `mdvp audit <domain> --local --json` for each domain
2. Computes mean human rating per page
3. Computes Spearman ρ for: overall, css_health, visual_quality, structure, originality
4. Reports p-values, confidence intervals, and a scatter plot (ASCII)

**Spearman ρ vs. Pearson r:**  
Spearman is chosen over Pearson because:
- Human ratings are ordinal (1–7 scale), not continuous
- MDVP scores are bounded (0–100) with non-normal distribution
- Spearman is robust to outliers

**Expected results:**

Based on design of the metrics:
- `css_health` should correlate most strongly (objective counts match human "cluttered vs. clean" perception)
- `originality` may anti-correlate (human raters may not penalize AI-generated aesthetics)
- `visual_quality` depends heavily on heuristic calibration
- `overall` should fall between the best and worst components

**Published baselines:**
- Webthetics CNN: ρ ≈ 0.85 (trained model)
- Human inter-rater reliability: ρ ≈ 0.55–0.70 (ceiling for any automated system on 7-point scale)
- Random baseline: ρ ≈ 0.00

A target of ρ ≥ 0.45 for css_health is realistic and meaningful.

---

## Output format

After running the analysis, results should be added to:

1. **`docs/methodology.md`** — update "What is validated vs. heuristic" table with actual ρ values
2. **`README.md`** — add a one-line citation in the methodology section
3. **`spec.md`** (mdvp.dev) — update the scoring spec page

Citation format:
```
css_health score correlates with human aesthetic ratings
(Spearman ρ = 0.XX, n = 50 pages, N = 1000 ratings, p < 0.01, Prolific 2025)
```

---

## Cost and timeline

| Phase | Time | Cost |
|---|---|---|
| Site selection + MDVP crawl of 50 sites | 2 hours | $0 |
| Prolific study setup + launch | 1 hour | $0 |
| Data collection | 48 hours | $150–$200 |
| Analysis + documentation | 2 hours | $0 |
| **Total** | **~1 week elapsed** | **~$200** |

---

## References

- Reinecke et al. (2013). [Predicting users' first impressions of website aesthetics with a quantification of perceived visual complexity and colorfulness](https://doi.org/10.1145/2470654.2481281). CHI 2013.
- Dou et al. (2019). [Webthetics: Quantifying webpage aesthetics with deep learning](https://doi.org/10.1016/j.ijhcs.2019.07.002). IJHCS.
- Moran (2016). [The Impact of Visual Complexity on Websites](https://www.nngroup.com/articles/visual-complexity/). Nielsen Norman Group.
- Myndex (2023). [APCA — Advanced Perceptual Contrast Algorithm](https://github.com/Myndex/SAPC-APCA).
