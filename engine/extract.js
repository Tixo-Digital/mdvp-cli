// Paste this in browser DevTools console, or inject via Chrome extension/DevTools protocol
// Returns DOMMetrics object ready for POST /audit
(function extractDesignMetrics() {
  const elements = document.querySelectorAll('*');
  const colors = new Map(), fontSizes = new Map(), fontFamilies = new Map(),
    fontWeights = new Map(), paddings = new Map(), margins = new Map(),
    borderRadii = new Map(), gaps = new Map(), lineHeights = new Map(),
    shadows = new Map();

  let total = 0, overflows = 0, emojiCount = 0, divSpanCount = 0,
    backdropBlurCount = 0, animationCount = 0, gradientCount = 0,
    emptyLinks = 0, imagesWithoutAlt = 0, maxLineLength = 0, genericTextCount = 0,
    pulseAnimationCount = 0, gradientTextCount = 0, gradientBackgroundCount = 0,
    gradientBackgroundLayerCount = 0, statusDotCount = 0,
    centeredMaxWidthContainerCount = 0;

  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const genericPhrases = ['lorem ipsum', 'your amazing', 'get started today', 'welcome to our', 'we are a team', 'our mission is', 'revolutionize', 'cutting-edge', 'next-generation', 'world-class'];
  const centeredTags = new Set(['article', 'div', 'footer', 'header', 'main', 'nav', 'section']);

  for (const el of elements) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.top > window.innerHeight * 1.5) continue;
    total++;

    const tag = el.tagName.toLowerCase();
    if (tag === 'div' || tag === 'span') divSpanCount++;

    // Centered max-width shells: repeated `max-w-* mx-auto` page sections.
    // Count only explicit layout containers so a single article/content wrapper
    // does not look like a whole-page layout pattern.
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const maxWidth = parseFloat(cs.maxWidth);
    const centeredWhitespace =
      viewportWidth > 0 && Math.abs(rect.left - (viewportWidth - rect.right)) <= 32;
    const hasSideGutters = viewportWidth > 0 && viewportWidth - rect.width >= 48;
    const layoutDisplay = ['block', 'flex', 'grid'].includes(cs.display);
    const explicitMaxWidth = Number.isFinite(maxWidth) && maxWidth >= 560 && maxWidth <= 1320;
    if (
      viewportWidth >= 900 &&
      centeredTags.has(tag) &&
      layoutDisplay &&
      explicitMaxWidth &&
      rect.width >= 560 &&
      hasSideGutters &&
      centeredWhitespace
    ) {
      const parent = el.parentElement;
      const parentRect = parent ? parent.getBoundingClientRect() : null;
      const parentCs = parent ? getComputedStyle(parent) : null;
      const parentMaxWidth = parentCs ? parseFloat(parentCs.maxWidth) : NaN;
      const parentIsSameShell =
        parentRect &&
        parentCs &&
        Number.isFinite(parentMaxWidth) &&
        parentMaxWidth >= 560 &&
        parentMaxWidth <= 1320 &&
        Math.abs(parentRect.width - rect.width) <= 16 &&
        Math.abs(parentRect.left - rect.left) <= 16;
      if (!parentIsSameShell) centeredMaxWidthContainerCount++;
    }

    // Colors
    const color = cs.color, bg = cs.backgroundColor;
    if (color !== 'rgba(0, 0, 0, 0)') colors.set(color, (colors.get(color) || 0) + 1);
    if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') colors.set(bg, (colors.get(bg) || 0) + 1);

    // Fonts
    fontSizes.set(cs.fontSize, (fontSizes.get(cs.fontSize) || 0) + 1);
    const ff = cs.fontFamily.split(',')[0].trim().replace(/"/g, '');
    fontFamilies.set(ff, (fontFamilies.get(ff) || 0) + 1);
    fontWeights.set(cs.fontWeight, (fontWeights.get(cs.fontWeight) || 0) + 1);
    lineHeights.set(cs.lineHeight, (lineHeights.get(cs.lineHeight) || 0) + 1);

    // Spacing
    for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) {
      const v = cs[p]; if (v !== '0px') paddings.set(v, (paddings.get(v) || 0) + 1);
    }
    for (const p of ['marginTop', 'marginRight', 'marginBottom', 'marginLeft']) {
      const v = cs[p]; if (v !== '0px' && !v.startsWith('-')) margins.set(v, (margins.get(v) || 0) + 1);
    }

    // Components
    const br = cs.borderRadius; if (br !== '0px') borderRadii.set(br, (borderRadii.get(br) || 0) + 1);
    const gap = cs.gap; if (gap && gap !== 'normal') gaps.set(gap, (gaps.get(gap) || 0) + 1);
    const shadow = cs.boxShadow; if (shadow !== 'none') shadows.set(shadow, (shadows.get(shadow) || 0) + 1);

    // Overflow detection
    if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
      if (cs.overflow !== 'auto' && cs.overflow !== 'scroll' && cs.overflowX !== 'auto') overflows++;
    }

    // Backdrop blur
    if (cs.backdropFilter && cs.backdropFilter !== 'none') backdropBlurCount++;

    // Animations
    if (cs.animationName !== 'none' || cs.transition !== 'all 0s ease 0s') animationCount++;

    // Pulse animations — gratuitous pulsing UI elements
    if (cs.animationName && cs.animationName !== 'none' && cs.animationName.toLowerCase().includes('pulse')) pulseAnimationCount++;
    // Also catch Tailwind's animate-pulse and similar class-based pulse
    const cls = typeof el.className === 'string' ? el.className : '';
    if (cls.includes('pulse') || cls.includes('animate-ping')) pulseAnimationCount++;

    // Gradients
    const gradientLayers = cs.backgroundImage
      ? (cs.backgroundImage.match(/-gradient\(/g) || []).length
      : 0;
    const isGradientText =
      (cs.webkitTextFillColor === 'transparent' || cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') &&
      cs.backgroundImage && cs.backgroundImage.includes('gradient');

    if (gradientLayers > 0) {
      gradientCount++;
      if (isGradientText) {
        gradientTextCount++;
      } else {
        gradientBackgroundCount++;
        gradientBackgroundLayerCount += gradientLayers;
      }
    }

    // Status dots — tiny colored circles (online/status indicators)
    // Heuristic: w == h, <= 14px, border-radius >= 50%, non-neutral color
    const w = rect.width, h = rect.height;
    if (w > 0 && w === h && w <= 14 && parseFloat(cs.borderRadius) >= w / 2) {
      const m = (cs.backgroundColor || '').match(/\d+/g);
      if (m && m.length >= 3) {
        const [r, g, b] = m.map(Number);
        // Non-neutral color (status green, warning amber, error red)
        if (Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b)) > 30) statusDotCount++;
      }
    }

    // Emoji in text
    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
      const text = el.textContent || '';
      const matches = text.match(emojiRegex);
      if (matches) emojiCount += matches.length;

      // Line length
      if (text.length > 20) {
        const charWidth = parseFloat(cs.fontSize) * 0.5;
        const containerWidth = rect.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const approxChars = Math.round(containerWidth / charWidth);
        if (approxChars > maxLineLength) maxLineLength = approxChars;
      }

      // Generic text
      const lower = text.toLowerCase();
      if (genericPhrases.some(p => lower.includes(p))) genericTextCount++;
    }

    // Empty links
    if (tag === 'a') {
      const href = el.getAttribute('href');
      if (!href || href === '#' || href === 'javascript:void(0)' || href === 'javascript:;') emptyLinks++;
    }

    // Images without alt
    if (tag === 'img' && !el.getAttribute('alt')) imagesWithoutAlt++;
  }

  // Landmarks
  const landmarks = document.querySelectorAll('nav, main, article, aside, header, footer, section');
  const h1s = document.querySelectorAll('h1');

  // External scripts
  const scripts = document.querySelectorAll('script[src]');
  const externalScripts = [...scripts].filter(s => {
    const src = s.getAttribute('src') || '';
    return src.startsWith('http') && !src.includes(location.hostname);
  }).length;

  // Meta
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  const descMeta = document.querySelector('meta[name="description"]');
  const titleTag = document.title;
  const langAttr = document.documentElement.getAttribute('lang');

  // CSS custom properties
  const rootStyles = getComputedStyle(document.documentElement);
  let customProps = 0;
  const rootSheet = [...document.styleSheets].find(s => { try { return s.cssRules; } catch { return false; } });
  if (rootSheet) {
    try {
      for (const rule of rootSheet.cssRules) {
        if (rule.cssText && rule.cssText.includes('--')) customProps += (rule.cssText.match(/--[\w-]+/g) || []).length;
      }
    } catch {}
  }

  // Dark mode
  const hasDarkMode = [...document.styleSheets].some(s => {
    try { return [...s.cssRules].some(r => r.cssText && r.cssText.includes('prefers-color-scheme')); } catch { return false; }
  });

  // Container queries
  const hasContainerQueries = [...document.styleSheets].some(s => {
    try { return [...s.cssRules].some(r => r.cssText && r.cssText.includes('@container')); } catch { return false; }
  });

  // Srcset
  const hasSrcset = document.querySelector('img[srcset]') !== null;

  const unicodeRegex = /[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2B50-\u2BFF\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;
  let unicodeSymbols = 0;
  document.querySelectorAll('*').forEach(el => {
    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
      const m = (el.textContent || '').match(unicodeRegex);
      if (m) unicodeSymbols += m.length;
    }
  });

  const rasterLogos = [...document.querySelectorAll('img')].filter(img => {
    const src = (img.getAttribute('src') || '').toLowerCase();
    const cls = (img.className || '').toLowerCase();
    const alt = (img.getAttribute('alt') || '').toLowerCase();
    return (cls.includes('logo') || alt.includes('logo') || src.includes('logo')) && (src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.webp'));
  }).length;

  const svgIcons = document.querySelectorAll('svg').length;
  const rasterIcons = [...document.querySelectorAll('img')].filter(img => {
    const r = img.getBoundingClientRect();
    return r.width < 48 && r.height < 48 && r.width > 0;
  }).length;

  const genericBtnTexts = ['click here', 'submit', 'learn more', 'read more', 'get started', 'sign up', 'buy now', 'contact us'];
  let genericButtonTexts = 0;
  document.querySelectorAll('button, a[role="button"], [type="submit"]').forEach(btn => {
    const txt = (btn.textContent || '').trim().toLowerCase();
    if (genericBtnTexts.includes(txt)) genericButtonTexts++;
  });

  let textOverflows = 0;
  let lineHeightIssues = 0;
  let lineLengthIssues = 0;
  let letterSpacingAllCaps = 0;
  document.querySelectorAll('p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, a, label').forEach(el => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'auto' && cs.overflow !== 'scroll' && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && cs.textOverflow !== 'ellipsis') {
      textOverflows++;
    }

    const fs = parseFloat(cs.fontSize);
    const lh = parseFloat(cs.lineHeight);
    if (fs > 0 && lh > 0 && !isNaN(lh)) {
      const ratio = lh / fs;
      const isHeading = /^h[1-6]$/i.test(el.tagName);
      if (isHeading && ratio < 1.1) lineHeightIssues++;
      if (!isHeading && ratio < 1.3 && fs < 20) lineHeightIssues++;
    }

    if (el.textContent && el.textContent.length > 30) {
      const charWidth = fs * 0.5;
      const contentWidth = rect.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const approxChars = contentWidth / charWidth;
      if (approxChars > 85) lineLengthIssues++;
    }

    if (cs.textTransform === 'uppercase' && parseFloat(cs.letterSpacing) < 0.5) {
      letterSpacingAllCaps++;
    }
  });

  // Eyebrow chip detection — small label immediately before first <h1>
  // Pattern: AI-generated hero sections often have a pill/badge above H1
  let eyebrowCount = 0;
  const firstH1 = document.querySelector('h1');
  if (firstH1) {
    const prev = firstH1.previousElementSibling;
    if (prev) {
      const prevTag = prev.tagName.toLowerCase();
      const prevCs = getComputedStyle(prev);
      const prevRect = prev.getBoundingClientRect();
      const h1Size = parseFloat(getComputedStyle(firstH1).fontSize);
      const prevSize = parseFloat(prevCs.fontSize);
      const prevText = (prev.textContent || '').trim();
      // Small font, short text, above h1, inline-ish element or badge-like
      if (
        prevText.length < 60 &&
        prevText.length > 2 &&
        (prevTag === 'span' || prevTag === 'p' || prevTag === 'div') &&
        prevSize <= h1Size * 0.65 &&
        prevRect.width < 400
      ) {
        // Check for badge styling: border, background, border-radius, or explicit badge classes
        const hasBadgeStyling =
          parseFloat(prevCs.borderRadius) > 2 ||
          (prevCs.backgroundColor !== 'rgba(0, 0, 0, 0)' && prevCs.backgroundColor !== 'transparent') ||
          prevCs.border !== '0px none rgb(0, 0, 0)' ||
          /badge|chip|tag|label|pill|eyebrow|caption|overline/i.test(prev.className);
        if (hasBadgeStyling) eyebrowCount++;
      }
    }
  }

  const ctaButtons = [...document.querySelectorAll('button, a')].filter(el => {
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)';
  });

  const navItems = document.querySelectorAll('nav a, nav button').length;

  const sort = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

  return {
    totalElements: total,
    colors: sort(colors),
    fontSizes: sort(fontSizes),
    fontFamilies: sort(fontFamilies),
    fontWeights: sort(fontWeights),
    paddings: sort(paddings),
    margins: sort(margins),
    borderRadii: sort(borderRadii),
    gaps: sort(gaps),
    lineHeights: sort(lineHeights),
    shadows: sort(shadows),
    overflows,
    emojiCount,
    divRatio: total > 0 ? divSpanCount / total : 0,
    landmarkCount: landmarks.length,
    h1Count: h1s.length,
    emptyLinks,
    imagesWithoutAlt,
    externalScripts,
    hasViewportMeta: !!viewportMeta,
    hasLangAttr: !!langAttr,
    metaDescription: descMeta ? descMeta.getAttribute('content') : null,
    titleTag,
    backdropBlurCount,
    animationCount,
    gradientCount,
    maxLineLength,
    genericTextCount,
    customProperties: customProps,
    hasDarkMode,
    hasContainerQueries,
    hasSrcset,
    unicodeSymbols,
    rasterLogos,
    svgIcons,
    rasterIcons,
    genericButtonTexts,
    textOverflows,
    lineHeightIssues,
    lineLengthIssues,
    letterSpacingAllCaps,
    ctaCount: ctaButtons.length,
    navItemCount: navItems,
    pulseAnimationCount,
    gradientTextCount,
    gradientBackgroundCount,
    gradientBackgroundLayerCount,
    statusDotCount,
    centeredMaxWidthContainerCount,
    eyebrowCount,
  };
})();
