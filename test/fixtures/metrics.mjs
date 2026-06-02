/**
 * Reusable DOM metrics fixtures for unit tests.
 * Mirrors the shape produced by engine/extract.js + crawler-worker.mjs.
 */

/** Minimal metrics — all arrays empty / sane defaults, won't throw in any scorer path */
export const MINIMAL_METRICS = {
  paddings: [['8px', 120], ['16px', 80], ['24px', 60], ['32px', 40]],
  gaps: [['16px', 30], ['24px', 20]],
  fontFamilies: [['Inter', 200]],
  fontSizes: [['14px', 300], ['16px', 200], ['24px', 80], ['32px', 40]],
  colors: [
    ['rgb(15, 23, 42)', 400],
    ['rgb(248, 250, 252)', 200],
    ['rgb(59, 130, 246)', 60],
  ],
  borderRadii: [['6px', 80], ['9999px', 20]],
  totalElements: 120,
  hasContainerQueries: false,
  customProperties: 8,
  hasDarkMode: false,
  hasSrcset: false,
  htmlLang: 'en',
  hasSkipLink: false,
  imgAltRate: 0.9,
  headings: [['H1', 1], ['H2', 4], ['H3', 8]],
  landmarks: { main: 1, nav: 1, footer: 1 },
  paragraphCount: 6,
  wordCount: 320,
  links: [['https://example.com/about', 3], ['https://example.com/docs', 2]],
  inputs: 2,
  buttons: 4,
  images: 8,
}

/**
 * "Good design" fixture — tight spacing system, few colors, consistent typography.
 * Should score ≥ 60 overall.
 */
export const GOOD_METRICS = {
  paddings: [['8px', 200], ['16px', 180], ['24px', 120], ['32px', 60], ['48px', 40]],
  gaps: [['16px', 60], ['24px', 40], ['32px', 30]],
  fontFamilies: [['DM Sans', 500], ['DM Mono', 40]],
  fontSizes: [['12px', 80], ['14px', 400], ['16px', 300], ['20px', 80], ['24px', 40], ['32px', 20]],
  colors: [
    ['rgb(15, 23, 42)', 600],
    ['rgb(71, 85, 105)', 300],
    ['rgb(148, 163, 184)', 200],
    ['rgb(248, 250, 252)', 400],
    ['rgb(255, 255, 255)', 200],
    ['rgb(37, 99, 235)', 80],
    ['rgb(239, 246, 255)', 40],
  ],
  borderRadii: [['4px', 60], ['8px', 100]],
  totalElements: 200,
  hasContainerQueries: true,
  customProperties: 32,
  hasDarkMode: true,
  hasSrcset: true,
  htmlLang: 'en',
  hasSkipLink: true,
  imgAltRate: 1.0,
  headings: [['H1', 1], ['H2', 6], ['H3', 12], ['H4', 4]],
  landmarks: { main: 1, nav: 1, header: 1, footer: 1, aside: 1 },
  paragraphCount: 20,
  wordCount: 1400,
  links: [['https://example.com/docs', 5], ['https://example.com/blog', 3]],
  inputs: 3,
  buttons: 6,
  images: 12,
}

/**
 * "Vibecoded" fixture — Inter font, Tailwind purple-pink palette, pill buttons, sparse content.
 * Should be flagged by originality scoring.
 */
export const VIBECODED_METRICS = {
  paddings: [['12px', 80], ['20px', 60], ['13px', 20], ['7px', 15], ['15px', 10]],
  gaps: [],
  fontFamilies: [['Inter', 400], ['Inter', 100]],
  fontSizes: [['14px', 200], ['16px', 150], ['18px', 80], ['24px', 40], ['36px', 20], ['48px', 10], ['13px', 5], ['17px', 3]],
  colors: [
    ['rgb(59, 130, 246)', 120],   // Tailwind blue-500
    ['rgb(99, 102, 241)', 80],    // Tailwind indigo-500
    ['rgb(139, 92, 246)', 60],    // Tailwind violet-500
    ['rgb(168, 85, 247)', 40],    // Tailwind purple-500
    ['rgb(255, 255, 255)', 200],
    ['rgb(249, 250, 251)', 100],
    ['rgb(17, 24, 39)', 80],
  ],
  borderRadii: [['9999px', 100], ['9999px', 60]],  // pill shapes
  totalElements: 40,  // sparse content
  hasContainerQueries: false,
  customProperties: 2,
  hasDarkMode: false,
  hasSrcset: false,
  htmlLang: '',
  hasSkipLink: false,
  imgAltRate: 0.4,
  headings: [['H1', 1], ['H2', 1]],  // almost no structure
  landmarks: { main: 1 },
  paragraphCount: 2,
  wordCount: 120,
  links: [],
  inputs: 0,
  buttons: 3,
  images: 2,
}
