import { db } from './db.js';

// Term extraction and normalization
export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.\:\/]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'were', 'been',
  'user', 'into', 'what', 'then', 'when', 'more', 'some', 'does', 'which',
  'over', 'also', 'after', 'there', 'could', 'their', 'about'
]);

export function similarityLabelFor(percentage: number): SimilarityMatch['similarity_label'] {
  if (percentage < 40) return 'Low Similarity';
  if (percentage < 75) return 'Moderate Similarity';
  return 'High Similarity';
}

export interface SimilarityMatch {
  incident_id: string;
  title: string;
  status: string;
  severity: string;
  affected_system: string;
  similarity_score: number; // 0 to 1.0
  similarity_percentage: number; // 0 to 100
  similarity_label: 'Low Similarity' | 'Moderate Similarity' | 'High Similarity';
  matching_terms: string[];
  recorded_actions_count: number;
  successful_actions_count: number;
  failed_actions_count: number;
  outcome_type: 'Verified' | 'Unverified' | 'Incomplete' | 'None';
  resolution_summary: string | null;
  resolution_evidence: string | null;
  recommended_procedure?: string;
  is_demo_data: boolean;
}

export function findSimilarIncidents(query: {
  title?: string;
  description?: string;
  affected_system?: string;
  category?: string;
  log_content?: string;
  component?: string;
  exclude_incident_id?: string;
}): SimilarityMatch[] {
  const queryText = [
    query.title || '',
    query.description || '',
    query.category || '',
    query.component || '',
    query.log_content || ''
  ].join(' ');

  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) return [];

  const queryFreq: Record<string, number> = {};
  for (const t of queryTokens) {
    queryFreq[t] = (queryFreq[t] || 0) + 1;
  }

  const incidents = query.exclude_incident_id
    ? db.prepare('SELECT * FROM incidents WHERE id != ?').all(query.exclude_incident_id) as any[]
    : db.prepare('SELECT * FROM incidents').all() as any[];

  const results: SimilarityMatch[] = [];

  for (const inc of incidents) {
    const targetText = [
      inc.title,
      inc.description,
      inc.affected_system,
      inc.category,
      inc.resolution_summary || '',
      inc.resolution_evidence || ''
    ].join(' ');

    const targetTokens = tokenize(targetText);
    if (targetTokens.length === 0) continue;

    const targetFreq: Record<string, number> = {};
    for (const t of targetTokens) {
      targetFreq[t] = (targetFreq[t] || 0) + 1;
    }

    // Compare normalized keyword-frequency vectors; this is not TF-IDF or machine learning.
    const matchingTerms: string[] = [];
    let dotProduct = 0;

    for (const [term, qCount] of Object.entries(queryFreq)) {
      if (targetFreq[term]) {
        matchingTerms.push(term);
        dotProduct += qCount * targetFreq[term];
      }
    }

    if (matchingTerms.length === 0) continue;

    // Vector norms
    const qNorm = Math.sqrt(Object.values(queryFreq).reduce((a, b) => a + b * b, 0));
    const tNorm = Math.sqrt(Object.values(targetFreq).reduce((a, b) => a + b * b, 0));
    const cosine = dotProduct / (qNorm * tNorm);

    const score = Math.min(1, Math.max(0, parseFloat(cosine.toFixed(3))));
    const percentage = Math.round(score * 100);

    if (percentage >= 12) {
      // Get action statistics
      const actions = db.prepare('SELECT result FROM investigation_actions WHERE incident_id = ?').all(inc.id) as any[];
      const successCount = actions.filter(a => a.result === 'Successful').length;
      const failedCount = actions.filter(a => a.result === 'Failed').length;

      results.push({
        incident_id: inc.id,
        title: inc.title,
        status: inc.status,
        severity: inc.severity,
        affected_system: inc.affected_system,
        similarity_score: score,
        similarity_percentage: percentage,
        similarity_label: similarityLabelFor(percentage),
        matching_terms: matchingTerms.slice(0, 8),
        recorded_actions_count: actions.length,
        successful_actions_count: successCount,
        failed_actions_count: failedCount,
        outcome_type: inc.resolution_verified || 'None',
        resolution_summary: inc.resolution_summary,
        resolution_evidence: inc.resolution_evidence,
        is_demo_data: Boolean(inc.is_demo_data)
      });
    }
  }

  // Sort descending by calculated score
  return results.sort((a, b) => b.similarity_score - a.similarity_score);
}
