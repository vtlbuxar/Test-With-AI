/**
 * Normalizes enum values, maps LLM synonyms to exact schema expected values,
 * and populates missing fields/defaults automatically.
 */

function normalizePriority(val: any): string {
  if (typeof val !== 'string') return 'Medium';
  const v = val.trim().toLowerCase();
  if (v.includes('crit') || v.includes('high') || v.includes('urg') || v.includes('p1')) return 'High';
  if (v.includes('low') || v.includes('min') || v.includes('p3')) return 'Low';
  return 'Medium';
}

function normalizeRiskLevel(val: any): string {
  if (typeof val !== 'string') return 'Medium';
  const v = val.trim().toLowerCase();
  if (v.includes('crit') || v.includes('high') || v.includes('severe')) return 'High';
  if (v.includes('low') || v.includes('minor')) return 'Low';
  return 'Medium';
}

function normalizeCategory(val: any): string {
  if (typeof val !== 'string') return 'Positive/Happy Path';
  const v = val.trim().toLowerCase();
  if (v.includes('neg') || v.includes('excep') || v.includes('fail') || v.includes('error')) {
    return 'Negative/Exception Path';
  }
  if (v.includes('bound') || v.includes('edge') || v.includes('limit') || v.includes('extreme')) {
    return 'Boundary/Edge Cases';
  }
  return 'Positive/Happy Path';
}

function normalizeType(val: any): string {
  if (typeof val !== 'string') return 'Functional';
  const v = val.trim().toLowerCase();
  if (v.includes('smoke') || v.includes('sanity')) return 'Smoke';
  if (v.includes('regress')) return 'Regression';
  if (v.includes('sec')) return 'Security';
  if (v.includes('api')) return 'API';
  if (v.includes('non-func')) return 'Non-Functional';
  return 'Functional';
}

function stringifyIfObject(val: any): string {
  if (typeof val === 'string') return val;
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) {
    return val.map((item, idx) => {
      if (typeof item === 'string') return `${idx + 1}. ${item}`;
      if (typeof item === 'object' && item !== null) {
        return Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(', ');
      }
      return String(item);
    }).join('\n');
  }
  if (typeof val === 'object') {
    return Object.entries(val)
      .map(([k, v]) => {
        if (typeof v === 'object' && v !== null) {
          return `${k}: ${JSON.stringify(v)}`;
        }
        return `${k}: ${v}`;
      })
      .join('\n');
  }
  return String(val);
}

export function normalizeLlamaData(data: any): { normalizedData: any; normalizationApplied: boolean } {
  if (!data || typeof data !== 'object') {
    return { normalizedData: data, normalizationApplied: false };
  }

  let normalizationApplied = false;

  const processObject = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(item => processObject(item));
    }

    if (obj && typeof obj === 'object') {
      const result: any = { ...obj };

      // 1. Populate missing risk_justification if risk_level is present
      if ('risk_level' in result && (!('risk_justification' in result) || result.risk_justification === undefined)) {
        result.risk_justification = '';
        normalizationApplied = true;
      }

      // 2. Normalize priority, risk_level, category, type if present
      if ('priority' in result) {
        const norm = normalizePriority(result.priority);
        if (norm !== result.priority) {
          result.priority = norm;
          normalizationApplied = true;
        }
      }

      if ('risk_level' in result) {
        const norm = normalizeRiskLevel(result.risk_level);
        if (norm !== result.risk_level) {
          result.risk_level = norm;
          normalizationApplied = true;
        }
      }

      if ('category' in result) {
        const norm = normalizeCategory(result.category);
        if (norm !== result.category) {
          result.category = norm;
          normalizationApplied = true;
        }
      }

      if ('type' in result) {
        const norm = normalizeType(result.type);
        if (norm !== result.type) {
          result.type = norm;
          normalizationApplied = true;
        }
      }

      // 3. Convert object/array values under known string fields to string
      const stringFields = [
        'requirement_analysis',
        'summary',
        'description',
        'steps',
        'expected_result',
        'risk_justification',
        'justification',
        'title'
      ];

      for (const field of stringFields) {
        if (field in result && typeof result[field] !== 'string') {
          result[field] = stringifyIfObject(result[field]);
          normalizationApplied = true;
        }
      }

      // 4. Quality score defaults population
      if ('quality_score' in result && result.quality_score) {
        const qs = result.quality_score;
        if (!qs.missing_scenarios || !Array.isArray(qs.missing_scenarios)) {
          qs.missing_scenarios = [];
          normalizationApplied = true;
        }
        if (!qs.coverage_breakdown || typeof qs.coverage_breakdown !== 'object') {
          qs.coverage_breakdown = {
            positive_coverage: false,
            negative_coverage: false,
            boundary_coverage: false,
            security_coverage: false,
            accessibility_coverage: false,
            api_validation: false,
          };
          normalizationApplied = true;
        }
      }

      // Recursively process nested keys
      for (const key of Object.keys(result)) {
        result[key] = processObject(result[key]);
      }

      return result;
    }

    return obj;
  };

  const normalizedData = processObject(data);

  return {
    normalizedData,
    normalizationApplied,
  };
}
