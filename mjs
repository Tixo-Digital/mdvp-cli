/**
 * AI-Generated UI Patterns Detector
 * 
 * Detects common UI patterns that are characteristic of AI-generated code,
 * particularly in Tailwind CSS components. AI models tend to produce certain
 * predictable patterns in their output that differ from human-written code.
 */

const AI_UI_PATTERNS = {
  id: 'ai-ui-patterns',
  label: 'AI-Generated UI Patterns',
  penalty: 0.3,
  weight: 0.25,
  rationale: 'Detects common UI patterns characteristic of AI-generated code, including predictable Tailwind class combinations, layout structures, and styling choices that differ from human-written components.',
  
  /**
   * Test function that analyzes metrics for AI-generated UI patterns
   * @param {Object} metrics - The metrics object containing code analysis data
   * @returns {Object} Detection result with score and details
   */
  test(metrics) {
    const detections = [];
    let totalScore = 0;
    
    // 1. Detect AI-preferred Tailwind class combinations
    if (metrics.tailwindClasses) {
      const aiPatterns = [
        { pattern: /flex\s+items-center\s+justify-between/g, label: 'AI-preferred flex layout', weight: 0.3 },
        { pattern: /grid\s+grid-cols-\d+\s+gap-\d+/g, label: 'AI-standard grid pattern', weight: 0.2 },
        { pattern: /rounded-lg\s+shadow-(sm|md)/g, label: 'AI-default card styling', weight: 0.15 },
        { pattern: /text-(sm|base)\s+font-(medium|semibold)/g, label: 'AI-typical text hierarchy', weight: 0.1 },
        { pattern: /hover:bg-\w+-\d+\s+transition-colors/g, label: 'AI-standard hover effect', weight: 0.1 },
        { pattern: /space-y-\d+/g, label: 'AI-preferred vertical spacing', weight: 0.05 },
        { pattern: /max-w-\d+xl\s+mx-auto/g, label: 'AI-standard container pattern', weight: 0.1 }
      ];
      
      const classString = Array.isArray(metrics.tailwindClasses) 
        ? metrics.tailwindClasses.join(' ')
        : metrics.tailwindClasses;
      
      aiPatterns.forEach(({ pattern, label, weight }) => {
        const matches = classString.match(pattern);
        if (matches) {
          detections.push({
            pattern: label,
            occurrences: matches.length,
            weight: weight * matches.length,
            evidence: matches.slice(0, 3) // Limit evidence to first 3 matches
          });
          totalScore += weight * matches.length;
        }
      });
    }
    
    // 2. Detect AI-preferred component structure
    if (metrics.componentStructure) {
      const structurePatterns = [
        { pattern: /<div\s+className="flex\s+items-center">/g, label: 'AI-standard flex container', weight: 0.2 },
        { pattern: /<div\s+className="container\s+mx-auto">/g, label: 'AI-standard page wrapper', weight: 0.15 },
        { pattern: /className="mt-\d+\s+mb-\d+"/g, label: 'AI-typical margin pattern', weight: 0.1 },
        { pattern: /className="p-\d+\s+rounded-lg"/g, label: 'AI-standard padding+radius', weight: 0.1 }
      ];
      
      const structureString = typeof metrics.componentStructure === 'string'
        ? metrics.componentStructure
        : JSON.stringify(metrics.componentStructure);
      
      structurePatterns.forEach(({ pattern, label, weight }) => {
        const matches = structureString.match(pattern);
        if (matches) {
          detections.push({
            pattern: label,
            occurrences: matches.length,
            weight: weight * matches.length,
            evidence: matches.slice(0, 3)
          });
          totalScore += weight * matches.length;
        }
      });
    }
    
    // 3. Detect AI-preferred color schemes
    if (metrics.colorUsage) {
      const colorPatterns = [
        { pattern: /bg-(blue|indigo|purple)-\d+/g, label: 'AI-preferred primary colors', weight: 0.2 },
        { pattern: /text-gray-\d+/g, label: 'AI-standard text colors', weight: 0.1 },
        { pattern: /border-gray-\d+/g, label: 'AI-standard border colors', weight: 0.1 }
      ];
      
      const colorString = typeof metrics.colorUsage === 'string'
        ? metrics.colorUsage
        : JSON.stringify(metrics.colorUsage);
      
      colorPatterns.forEach(({ pattern, label, weight }) => {
        const matches = colorString.match(pattern);
        if (matches) {
          detections.push({
            pattern: label,
            occurrences: matches.length,
            weight: weight * matches.length,
            evidence: matches.slice(0, 3)
          });
          totalScore += weight * matches.length;
        }
      });
    }
    
    // 4. Detect AI-preferred responsive patterns
    if (metrics.responsivePatterns) {
      const responsivePatterns = [
        { pattern: /lg:flex\s+lg:items-center/g, label: 'AI-standard responsive layout', weight: 0.2 },
        { pattern: /md:grid-cols-\d+/g, label: 'AI-standard responsive grid', weight: 0.15 },
        { pattern: /sm:text-(sm|base)/g, label: 'AI-standard responsive text', weight: 0.1 }
      ];
      
      const responsiveString = typeof metrics.responsivePatterns === 'string'
        ? metrics.responsivePatterns
        : JSON.stringify(metrics.responsivePatterns);
      
      responsivePatterns.forEach(({ pattern, label, weight }) => {
        const matches = responsiveString.match(pattern);
        if (matches) {
          detections.push({
            pattern: label,
            occurrences: matches.length,
            weight: weight * matches.length,
            evidence: matches.slice(0, 3)
          });
          totalScore += weight * matches.length;
        }
      });
    }
    
    // Normalize score to 0-1 range
    const normalizedScore = Math.min(totalScore / 10, 1);
    
    return {
      score: normalizedScore,
      details: detections,
      summary: detections.length > 0 
        ? `Found ${detections.length} AI-generated UI pattern(s) with total score ${normalizedScore.toFixed(2)}`
        : 'No AI-generated UI patterns detected'
    };
  }
};

export default AI_UI_PATTERNS;