use std::collections::BTreeMap;
use std::env;
use std::io::{self, Read};

fn main() {
    let mut html = String::new();
    if let Err(err) = io::stdin().read_to_string(&mut html) {
        eprintln!("failed to read stdin: {err}");
        std::process::exit(1);
    }

    let url = env::args().nth(1).unwrap_or_default();
    let metrics = analyze(&html, &url);
    println!("{}", metrics.to_json());
}

#[derive(Default)]
struct Metrics {
    total_elements: usize,
    colors: BTreeMap<String, usize>,
    font_sizes: BTreeMap<String, usize>,
    font_families: BTreeMap<String, usize>,
    font_weights: BTreeMap<String, usize>,
    paddings: BTreeMap<String, usize>,
    margins: BTreeMap<String, usize>,
    border_radii: BTreeMap<String, usize>,
    gaps: BTreeMap<String, usize>,
    line_heights: BTreeMap<String, usize>,
    shadows: BTreeMap<String, usize>,
    overflows: usize,
    emoji_count: usize,
    div_span_count: usize,
    landmark_count: usize,
    h1_count: usize,
    empty_links: usize,
    images_without_alt: usize,
    external_scripts: usize,
    has_viewport_meta: bool,
    has_lang_attr: bool,
    meta_description: Option<String>,
    title_tag: Option<String>,
    backdrop_blur_count: usize,
    animation_count: usize,
    gradient_count: usize,
    max_line_length: usize,
    generic_text_count: usize,
    custom_properties: usize,
    has_dark_mode: bool,
    has_container_queries: bool,
    has_srcset: bool,
    unicode_symbols: usize,
    raster_logos: usize,
    svg_icons: usize,
    raster_icons: usize,
    generic_button_texts: usize,
    text_overflows: usize,
    line_height_issues: usize,
    line_length_issues: usize,
    letter_spacing_all_caps: usize,
    cta_count: usize,
    nav_item_count: usize,
    pulse_animation_count: usize,
    gradient_text_count: usize,
    status_dot_count: usize,
    eyebrow_count: usize,
}

impl Metrics {
    fn to_json(&self) -> String {
        let div_ratio = if self.total_elements > 0 {
            self.div_span_count as f64 / self.total_elements as f64
        } else {
            0.0
        };

        format!(
            "{{\"totalElements\":{},\"colors\":{},\"fontSizes\":{},\"fontFamilies\":{},\"fontWeights\":{},\"paddings\":{},\"margins\":{},\"borderRadii\":{},\"gaps\":{},\"lineHeights\":{},\"shadows\":{},\"overflows\":{},\"emojiCount\":{},\"divRatio\":{},\"landmarkCount\":{},\"h1Count\":{},\"emptyLinks\":{},\"imagesWithoutAlt\":{},\"externalScripts\":{},\"hasViewportMeta\":{},\"hasLangAttr\":{},\"metaDescription\":{},\"titleTag\":{},\"backdropBlurCount\":{},\"animationCount\":{},\"gradientCount\":{},\"maxLineLength\":{},\"genericTextCount\":{},\"customProperties\":{},\"hasDarkMode\":{},\"hasContainerQueries\":{},\"hasSrcset\":{},\"unicodeSymbols\":{},\"rasterLogos\":{},\"svgIcons\":{},\"rasterIcons\":{},\"genericButtonTexts\":{},\"textOverflows\":{},\"lineHeightIssues\":{},\"lineLengthIssues\":{},\"letterSpacingAllCaps\":{},\"ctaCount\":{},\"navItemCount\":{},\"pulseAnimationCount\":{},\"gradientTextCount\":{},\"statusDotCount\":{},\"eyebrowCount\":{},\"analysisMode\":\"static\",\"staticAnalyzer\":\"rust\"}}",
            self.total_elements,
            map_json(&self.colors),
            map_json(&self.font_sizes),
            map_json(&self.font_families),
            map_json(&self.font_weights),
            map_json(&self.paddings),
            map_json(&self.margins),
            map_json(&self.border_radii),
            map_json(&self.gaps),
            map_json(&self.line_heights),
            map_json(&self.shadows),
            self.overflows,
            self.emoji_count,
            round2(div_ratio),
            self.landmark_count,
            self.h1_count,
            self.empty_links,
            self.images_without_alt,
            self.external_scripts,
            self.has_viewport_meta,
            self.has_lang_attr,
            opt_json(&self.meta_description),
            opt_json(&self.title_tag),
            self.backdrop_blur_count,
            self.animation_count,
            self.gradient_count,
            self.max_line_length,
            self.generic_text_count,
            self.custom_properties,
            self.has_dark_mode,
            self.has_container_queries,
            self.has_srcset,
            self.unicode_symbols,
            self.raster_logos,
            self.svg_icons,
            self.raster_icons,
            self.generic_button_texts,
            self.text_overflows,
            self.line_height_issues,
            self.line_length_issues,
            self.letter_spacing_all_caps,
            self.cta_count,
            self.nav_item_count,
            self.pulse_animation_count,
            self.gradient_text_count,
            self.status_dot_count,
            self.eyebrow_count,
        )
    }
}

fn analyze(html: &str, url: &str) -> Metrics {
    let lower = html.to_lowercase();
    let css = collect_css(html);
    let css_lower = css.to_lowercase();
    let tags = collect_start_tags(html);
    let mut metrics = Metrics::default();

    metrics.total_elements = tags.len();
    metrics.landmark_count = tags.iter().filter(|t| is_landmark(tag_name(t))).count();
    metrics.h1_count = tags.iter().filter(|t| tag_name(t) == "h1").count();
    metrics.svg_icons = tags.iter().filter(|t| tag_name(t) == "svg").count();
    metrics.has_viewport_meta =
        lower.contains("name=\"viewport\"") || lower.contains("name='viewport'");
    metrics.has_lang_attr =
        lower.contains("<html") && (lower.contains(" lang=\"") || lower.contains(" lang='"));
    metrics.has_srcset = lower.contains("srcset=");
    metrics.title_tag = extract_between(html, "<title", "</title>").and_then(|s| {
        let text = strip_tag_start(&s).trim().to_string();
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    });
    metrics.meta_description = extract_meta_description(html);
    metrics.custom_properties = count_occurrences(&css, "--");
    metrics.has_dark_mode = css_lower.contains("prefers-color-scheme");
    metrics.has_container_queries = css_lower.contains("@container");
    metrics.gradient_count = count_occurrences(&css_lower, "gradient(");
    metrics.backdrop_blur_count = count_occurrences(&css_lower, "backdrop-filter");
    metrics.animation_count =
        count_occurrences(&css_lower, "animation") + count_occurrences(&css_lower, "transition");
    metrics.pulse_animation_count = count_occurrences(&lower, "animate-pulse")
        + count_occurrences(&lower, "animate-ping")
        + count_occurrences(&css_lower, "pulse");
    metrics.gradient_text_count = if css_lower.contains("background-clip: text")
        || css_lower.contains("-webkit-background-clip: text")
    {
        metrics.gradient_count
    } else {
        0
    };
    metrics.unicode_symbols = html.chars().filter(|c| is_symbol(*c)).count();
    metrics.emoji_count = html.chars().filter(|c| is_emoji(*c)).count();
    metrics.generic_text_count = count_generic_text(&lower);
    metrics.max_line_length = max_text_run(html);
    metrics.cta_count = count_cta(&lower);
    metrics.nav_item_count = count_nav_items(&lower);

    for tag in &tags {
        let name = tag_name(tag);
        if name == "div" || name == "span" {
            metrics.div_span_count += 1;
        }
        if name == "a" && is_empty_link(tag) {
            metrics.empty_links += 1;
        }
        if name == "img" {
            if !has_attr(tag, "alt") {
                metrics.images_without_alt += 1;
            }
            if is_raster_logo(tag) {
                metrics.raster_logos += 1;
            }
            if is_raster_icon(tag) {
                metrics.raster_icons += 1;
            }
        }
        if name == "script" && is_external(tag, url) {
            metrics.external_scripts += 1;
        }
        if name == "button" || (name == "a" && (tag.contains("btn") || tag.contains("button"))) {
            metrics.cta_count += 1;
        }
        if let Some(style) = attr_value(tag, "style") {
            analyze_declarations(&style, &mut metrics);
        }
        if tag.contains("status") || tag.contains("dot") {
            metrics.status_dot_count += 1;
        }
        if tag.contains("eyebrow")
            || tag.contains("badge")
            || tag.contains("chip")
            || tag.contains("pill")
        {
            metrics.eyebrow_count += 1;
        }
    }

    analyze_declarations(&css, &mut metrics);
    scan_colors(&css, &mut metrics.colors);

    if metrics.font_sizes.is_empty() && metrics.total_elements > 0 {
        add_count(&mut metrics.font_sizes, "16px", metrics.total_elements);
    }
    if metrics.font_families.is_empty() && metrics.total_elements > 0 {
        add_count(
            &mut metrics.font_families,
            "system-ui",
            metrics.total_elements,
        );
    }
    if metrics.font_weights.is_empty() && metrics.total_elements > 0 {
        add_count(&mut metrics.font_weights, "400", metrics.total_elements);
    }
    if metrics.line_heights.is_empty() && metrics.total_elements > 0 {
        add_count(&mut metrics.line_heights, "normal", metrics.total_elements);
    }
    if metrics.colors.is_empty() {
        add_count(&mut metrics.colors, "rgb(0, 0, 0)", 1);
        add_count(&mut metrics.colors, "rgb(255, 255, 255)", 1);
    }

    metrics
}

fn collect_start_tags(html: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let bytes = html.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] != b'<' {
            i += 1;
            continue;
        }
        if i + 1 >= bytes.len() || matches!(bytes[i + 1], b'/' | b'!' | b'?') {
            i += 1;
            continue;
        }
        let mut j = i + 1;
        let quote = &mut None;
        while j < bytes.len() {
            let c = bytes[j] as char;
            if let Some(q) = quote {
                if c == *q {
                    *quote = None;
                }
            } else if c == '"' || c == '\'' {
                *quote = Some(c);
            } else if c == '>' {
                break;
            }
            j += 1;
        }
        if j < bytes.len() {
            tags.push(html[i + 1..j].to_lowercase());
            i = j + 1;
        } else {
            break;
        }
    }
    tags
}

fn collect_css(html: &str) -> String {
    let mut out = String::new();
    let lower = html.to_lowercase();
    let mut offset = 0;
    while let Some(start) = lower[offset..].find("<style") {
        let tag_start = offset + start;
        let Some(body_start_rel) = lower[tag_start..].find('>') else {
            break;
        };
        let body_start = tag_start + body_start_rel + 1;
        let Some(end_rel) = lower[body_start..].find("</style>") else {
            break;
        };
        let body_end = body_start + end_rel;
        out.push_str(&html[body_start..body_end]);
        out.push('\n');
        offset = body_end + "</style>".len();
    }
    for tag in collect_start_tags(html) {
        if let Some(style) = attr_value(&tag, "style") {
            out.push_str(&style);
            out.push('\n');
        }
    }
    out
}

fn analyze_declarations(css: &str, metrics: &mut Metrics) {
    for segment in css.split(';') {
        let Some(colon) = segment.rfind(':') else {
            continue;
        };
        let raw_prop = &segment[..colon];
        let prop = raw_prop
            .rsplit(['{', '}'])
            .next()
            .unwrap_or(raw_prop)
            .trim()
            .to_lowercase();
        let value = segment[colon + 1..]
            .trim()
            .trim_matches('"')
            .trim_matches('\'');
        if value.is_empty() || value.starts_with("var(") {
            continue;
        }
        match prop.as_str() {
            "font-size" => add_count(&mut metrics.font_sizes, normalize_value(value), 1),
            "font-family" => add_count(&mut metrics.font_families, first_font(value), 1),
            "font-weight" => add_count(&mut metrics.font_weights, normalize_value(value), 1),
            "padding" | "padding-top" | "padding-right" | "padding-bottom" | "padding-left" => {
                add_count(&mut metrics.paddings, first_box_value(value), 1)
            }
            "margin" | "margin-top" | "margin-right" | "margin-bottom" | "margin-left" => {
                if !value.starts_with('-') {
                    add_count(&mut metrics.margins, first_box_value(value), 1)
                }
            }
            "border-radius" => add_count(&mut metrics.border_radii, first_box_value(value), 1),
            "gap" | "row-gap" | "column-gap" => {
                add_count(&mut metrics.gaps, first_box_value(value), 1)
            }
            "line-height" => add_count(&mut metrics.line_heights, normalize_value(value), 1),
            "box-shadow" => {
                if value != "none" {
                    add_count(&mut metrics.shadows, normalize_value(value), 1)
                }
            }
            "letter-spacing" => {
                if value != "0" && value != "normal" {
                    metrics.letter_spacing_all_caps += 1;
                }
            }
            "overflow" | "overflow-x" | "overflow-y" => {
                if value.contains("hidden") {
                    metrics.overflows += 1;
                }
            }
            _ => {}
        }
        if value.contains("gradient(") {
            metrics.gradient_count += 1;
        }
        if prop.contains("animation") || prop.contains("transition") {
            metrics.animation_count += 1;
        }
        if prop.contains("backdrop-filter") {
            metrics.backdrop_blur_count += 1;
        }
    }
}

fn scan_colors(css: &str, colors: &mut BTreeMap<String, usize>) {
    let bytes = css.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'#' {
            let start = i + 1;
            let mut end = start;
            while end < bytes.len() && (bytes[end] as char).is_ascii_hexdigit() && end - start < 6 {
                end += 1;
            }
            if end - start == 6 {
                if let Some(rgb) = hex_to_rgb(&css[start..end]) {
                    add_count(colors, rgb, 1);
                }
            }
            i = end;
            continue;
        }
        i += 1;
    }

    let lower = css.to_lowercase();
    for needle in ["rgb(", "rgba("] {
        let mut offset = 0;
        while let Some(pos) = lower[offset..].find(needle) {
            let start = offset + pos;
            if let Some(end_rel) = lower[start..].find(')') {
                let raw = &lower[start..start + end_rel + 1];
                if let Some(rgb) = normalize_rgb(raw) {
                    add_count(colors, rgb, 1);
                }
                offset = start + end_rel + 1;
            } else {
                break;
            }
        }
    }
}

fn tag_name(tag: &str) -> &str {
    tag.split_whitespace().next().unwrap_or("")
}

fn is_landmark(tag: &str) -> bool {
    matches!(
        tag,
        "nav" | "main" | "article" | "aside" | "header" | "footer" | "section"
    )
}

fn has_attr(tag: &str, attr: &str) -> bool {
    tag.contains(&format!(" {attr}=")) || tag.ends_with(&format!(" {attr}"))
}

fn attr_value(tag: &str, attr: &str) -> Option<String> {
    for quote in ['"', '\''] {
        let needle = format!("{attr}={quote}");
        if let Some(start) = tag.find(&needle) {
            let value_start = start + needle.len();
            if let Some(end) = tag[value_start..].find(quote) {
                return Some(tag[value_start..value_start + end].to_string());
            }
        }
    }
    None
}

fn is_empty_link(tag: &str) -> bool {
    attr_value(tag, "href").is_some_and(|href| {
        let href = href.trim().to_lowercase();
        href.is_empty() || href == "#" || href == "javascript:void(0)" || href == "javascript:;"
    })
}

fn is_external(tag: &str, url: &str) -> bool {
    let Some(src) = attr_value(tag, "src") else {
        return false;
    };
    src.starts_with("http") && !url.is_empty() && !src.contains(host_from_url(url).as_str())
}

fn is_raster_logo(tag: &str) -> bool {
    let raw = tag.to_lowercase();
    (raw.contains("logo"))
        && [".png", ".jpg", ".jpeg", ".webp"]
            .iter()
            .any(|ext| raw.contains(ext))
}

fn is_raster_icon(tag: &str) -> bool {
    let raw = tag.to_lowercase();
    raw.contains("icon")
        && [".png", ".jpg", ".jpeg", ".webp", ".gif"]
            .iter()
            .any(|ext| raw.contains(ext))
}

fn add_count<S: Into<String>>(map: &mut BTreeMap<String, usize>, value: S, count: usize) {
    let value = value.into();
    if value.is_empty() || value == "0" || value == "0px" || value == "none" || value == "normal" {
        return;
    }
    *map.entry(value).or_insert(0) += count;
}

fn normalize_value(value: &str) -> String {
    value.trim().trim_matches(';').to_string()
}

fn first_box_value(value: &str) -> String {
    value
        .split_whitespace()
        .next()
        .unwrap_or(value)
        .trim()
        .to_string()
}

fn first_font(value: &str) -> String {
    value
        .split(',')
        .next()
        .unwrap_or(value)
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .to_string()
}

fn hex_to_rgb(hex: &str) -> Option<String> {
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some(format!("rgb({r}, {g}, {b})"))
}

fn normalize_rgb(raw: &str) -> Option<String> {
    let nums: Vec<u16> = raw
        .split(|c: char| !c.is_ascii_digit())
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse::<u16>().ok())
        .collect();
    if nums.len() < 3 {
        return None;
    }
    Some(format!(
        "rgb({}, {}, {})",
        nums[0].min(255),
        nums[1].min(255),
        nums[2].min(255)
    ))
}

fn map_json(map: &BTreeMap<String, usize>) -> String {
    let mut entries: Vec<_> = map.iter().collect();
    entries.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));
    let parts: Vec<String> = entries
        .into_iter()
        .take(20)
        .map(|(k, v)| format!("[\"{}\",{}]", json_escape(k), v))
        .collect();
    format!("[{}]", parts.join(","))
}

fn opt_json(value: &Option<String>) -> String {
    value
        .as_ref()
        .map(|s| format!("\"{}\"", json_escape(s)))
        .unwrap_or_else(|| "null".to_string())
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn extract_between(haystack: &str, start_pat: &str, end_pat: &str) -> Option<String> {
    let lower = haystack.to_lowercase();
    let start = lower.find(start_pat)?;
    let after_start = lower[start..].find('>').map(|n| start + n + 1)?;
    let end = lower[after_start..]
        .find(end_pat)
        .map(|n| after_start + n)?;
    Some(haystack[after_start..end].to_string())
}

fn strip_tag_start(value: &str) -> String {
    if let Some(pos) = value.find('>') {
        value[pos + 1..].to_string()
    } else {
        value.to_string()
    }
}

fn extract_meta_description(html: &str) -> Option<String> {
    for tag in collect_start_tags(html) {
        if tag_name(&tag) == "meta" && tag.contains("description") {
            return attr_value(&tag, "content");
        }
    }
    None
}

fn host_from_url(url: &str) -> String {
    url.trim_start_matches("https://")
        .trim_start_matches("http://")
        .split('/')
        .next()
        .unwrap_or("")
        .trim_start_matches("www.")
        .to_string()
}

fn count_occurrences(haystack: &str, needle: &str) -> usize {
    haystack.matches(needle).count()
}

fn count_generic_text(lower: &str) -> usize {
    [
        "lorem ipsum",
        "your amazing",
        "get started today",
        "welcome to our",
        "we are a team",
        "our mission is",
        "revolutionize",
        "cutting-edge",
        "next-generation",
        "world-class",
    ]
    .iter()
    .map(|needle| count_occurrences(lower, needle))
    .sum()
}

fn count_cta(lower: &str) -> usize {
    [
        "get started",
        "sign up",
        "try",
        "buy",
        "contact",
        "book",
        "start",
    ]
    .iter()
    .map(|needle| count_occurrences(lower, needle))
    .sum()
}

fn count_nav_items(lower: &str) -> usize {
    let Some(nav_start) = lower.find("<nav") else {
        return 0;
    };
    let Some(nav_end_rel) = lower[nav_start..].find("</nav>") else {
        return 0;
    };
    let nav = &lower[nav_start..nav_start + nav_end_rel];
    count_occurrences(nav, "<a") + count_occurrences(nav, "<button")
}

fn max_text_run(html: &str) -> usize {
    let mut max_len = 0;
    let mut current = 0;
    let mut in_tag = false;
    for c in html.chars() {
        if c == '<' {
            max_len = max_len.max(current);
            current = 0;
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            if c.is_whitespace() {
                current = 0;
            } else {
                current += 1;
            }
        }
    }
    max_len.max(current)
}

fn is_symbol(c: char) -> bool {
    matches!(c as u32, 0x2500..=0x27BF | 0x2B50..=0x2BFF | 0x1F900..=0x1FAFF)
}

fn is_emoji(c: char) -> bool {
    matches!(c as u32, 0x1F300..=0x1F6FF | 0x1F1E0..=0x1F1FF | 0x2600..=0x27BF)
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}
