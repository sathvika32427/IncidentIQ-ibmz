import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';
import { findSimilarIncidents } from './similarity.js';

const apiKey = process.env.GEMINI_API_KEY || '';
const aiClient = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface RecommendationResult {
  mode: 'rule-based' | 'ai-assisted';
  suggested_step: string;
  rationale: string;
  supporting_evidence: string;
  related_historical_incident_id?: string;
  similarity_percentage?: number;
  previous_outcome?: string;
  warning?: string;
  ai_status: AIAvailability;
  cautionary_failed_steps?: string[];
  reusable_procedure?: string;
  side_by_side?: {
    rule_based: {
      step: string;
      rationale: string;
      evidence: string;
    };
    ai_assisted?: {
      step: string;
      rationale: string;
      evidence: string;
      nuances: string;
    };
  };
}

export interface AIAvailability {
  state: 'checking' | 'available' | 'configured-unavailable' | 'configured-unverified' | 'not-configured';
  message?: string;
  lastCheckedAt?: string;
}

const AI_MODEL = 'gemini-2.5-flash';
export function isAIAvailable(): boolean {
  return aiAvailability.state === 'available';
}

export function getAIAvailability(): AIAvailability {
  return { ...aiAvailability };
}

let aiAvailability: AIAvailability = apiKey.trim()
  ? { state: 'configured-unverified', message: 'Gemini is configured; response has not yet been verified.' }
  : { state: 'not-configured', message: 'GEMINI_API_KEY is not configured.' };
let lastAIStatusCheck = 0;
let aiStatusCheck: Promise<AIAvailability> | null = null;

function safeAIError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Unknown AI service error');
  return (apiKey ? message.split(apiKey).join('[redacted]') : message).slice(0, 240);
}

function noteAIResponse(success: boolean, error?: unknown): void {
  lastAIStatusCheck = Date.now();
  aiAvailability = success
    ? { state: 'available', message: 'Gemini responded successfully.', lastCheckedAt: new Date().toISOString() }
    : {
        state: 'configured-unavailable',
        message: safeAIError(error),
        lastCheckedAt: new Date().toISOString()
      };
  if (!success) console.warn('[IncidentIQ] Gemini request failed:', aiAvailability.message);
}

export async function verifyAIAvailability(): Promise<AIAvailability> {
  if (!aiClient || !apiKey.trim()) {
    aiAvailability = { state: 'not-configured', message: 'GEMINI_API_KEY is not configured.' };
    return getAIAvailability();
  }

  if (Date.now() - lastAIStatusCheck < 60_000 && aiAvailability.state !== 'configured-unverified') {
    return getAIAvailability();
  }
  if (aiStatusCheck) return aiStatusCheck;

  aiStatusCheck = (async () => {
    try {
      const response = await aiClient.models.generateContent({
        model: AI_MODEL,
        contents: 'Reply with the single word OK.'
      });
      if (!response.text?.trim()) throw new Error('Gemini returned an empty response.');
      noteAIResponse(true);
    } catch (error) {
      noteAIResponse(false, error);
    }
    return getAIAvailability();
  })();

  try {
    return await aiStatusCheck;
  } finally {
    aiStatusCheck = null;
  }
}

// Generate dual-mode recommendation
export async function getRecommendations(incidentId: string): Promise<RecommendationResult> {
  const inc = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId) as any;
  if (!inc) {
    throw new Error('Incident not found');
  }

  // Linked evidence
  const linkedLogs = db.prepare(`
    SELECT l.*, lnk.reason 
    FROM incident_log_links lnk
    JOIN log_entries l ON lnk.log_line_id = l.line_id
    WHERE lnk.incident_id = ?
    ORDER BY l.line_id ASC
  `).all(incidentId) as any[];

  // Past actions
  const actions = db.prepare(`
    SELECT * FROM investigation_actions 
    WHERE incident_id = ? 
    ORDER BY timestamp ASC
  `).all(incidentId) as any[];

  // Similar historical incidents
  const similar = findSimilarIncidents({
    title: inc.title,
    description: inc.description,
    affected_system: inc.affected_system,
    category: inc.category,
    exclude_incident_id: incidentId
  });

  const bestMatch = similar.length > 0 ? similar[0] : null;

  // 1. Build transparent rule-based guidance and historical references.
  let ruleStep = 'Analyze primary daemon log stream and verify recent configuration changes.';
  let ruleRationale = 'Baseline triage step to isolate process vs network failure mode.';
  let ruleEvidence = linkedLogs.length > 0 
    ? `${linkedLogs.length} log evidence lines linked (e.g., Line #${linkedLogs[0].line_id}: ${linkedLogs[0].component})`
    : 'No direct log lines linked to this incident yet.';
  let cautionarySteps: string[] = [];

  if (bestMatch) {
    ruleStep = `Review the recorded investigation and outcome for ${bestMatch.incident_id} before choosing a next step.`;
    ruleRationale = `Keyword-frequency similarity is ${bestMatch.similarity_percentage}% (matched terms: ${bestMatch.matching_terms.join(', ')}). Historical actions and outcomes are references for human review, not proof that a prior fix applies.`;
    const failedActions = db.prepare(`
      SELECT description, failure_reason, notes
      FROM investigation_actions
      WHERE incident_id = ? AND result = 'Failed'
      ORDER BY timestamp ASC
    `).all(bestMatch.incident_id) as Array<{ description: string; failure_reason: string | null; notes: string | null }>;
    cautionarySteps = failedActions.map(action =>
      [action.description, action.failure_reason, action.notes].filter(Boolean).join(': ')
    );
  }

  const baseResult: RecommendationResult = {
    mode: 'rule-based',
    suggested_step: ruleStep,
    rationale: ruleRationale,
    supporting_evidence: ruleEvidence,
    related_historical_incident_id: bestMatch?.incident_id,
    similarity_percentage: bestMatch?.similarity_percentage,
    previous_outcome: bestMatch?.outcome_type || 'None',
    ai_status: getAIAvailability(),
    warning: undefined,
    cautionary_failed_steps: cautionarySteps,
    side_by_side: {
      rule_based: {
        step: ruleStep,
        rationale: ruleRationale,
        evidence: ruleEvidence
      }
    }
  };

  // 2. If AI Client is available, enrich with AI-Assisted Mode (never blocking core workflow)
  if (aiClient) {
    try {
      const promptText = `
You are an expert IBM Z / LinuxONE Enterprise Incident Response Architect for platform "IncidentIQ".
Provide actionable investigation advice for this incident based STRICTLY on the evidence provided.

INCIDENT:
- ID: ${inc.id}
- Title: ${inc.title}
- Severity: ${inc.severity}
- Affected System: ${inc.affected_system}
- Category: ${inc.category}
- Description: ${inc.description}

LINKED EVIDENCE:
${linkedLogs.map((l: any) => `Line ${l.line_id} [${l.component}]: ${l.content}`).slice(0, 10).join('\n') || 'None'}

HISTORICAL BEST MATCH:
${bestMatch ? `${bestMatch.incident_id}: ${bestMatch.title} (Outcome: ${bestMatch.outcome_type}, keyword-frequency similarity: ${bestMatch.similarity_percentage}%)` : 'None'}

Treat historical actions, outcomes, and similarity as references only. Do not claim a stored procedure will resolve this incident or that similarity validates a fix.

PAST RECORDED ACTIONS IN THIS INCIDENT:
${actions.map((a: any) => `Action: ${a.description} -> Result: ${a.result} (${a.notes || ''})`).join('\n') || 'None recorded yet'}

Return a concise JSON object with:
{
  "step": "Suggested precise next command or investigation action",
  "rationale": "Clear technical reason grounded in IBM Z / LinuxONE mechanics",
  "evidence": "Specific log line reference or pattern justification",
  "nuances": "Any risks or caveats regarding production impact or cross-partition isolation"
}
`;

      const response = await aiClient.models.generateContent({
        model: AI_MODEL,
        contents: promptText,
        config: {
          responseMimeType: 'application/json'
        }
      });

      if (response && response.text) {
        const aiParsed = JSON.parse(response.text);
        noteAIResponse(true);
        baseResult.mode = 'ai-assisted';
        baseResult.suggested_step = aiParsed.step || baseResult.suggested_step;
        baseResult.rationale = aiParsed.rationale || baseResult.rationale;
        baseResult.supporting_evidence = aiParsed.evidence || baseResult.supporting_evidence;
        baseResult.side_by_side!.ai_assisted = {
          step: aiParsed.step,
          rationale: aiParsed.rationale,
          evidence: aiParsed.evidence,
          nuances: aiParsed.nuances || 'Requires human verification before executing remediation commands.'
        };
      } else {
        throw new Error('Gemini returned an empty response.');
      }
    } catch (err: any) {
      noteAIResponse(false, err);
      baseResult.mode = 'rule-based';
      baseResult.ai_status = getAIAvailability();
      baseResult.warning = `AI assistance failed; showing a rule-based response instead. ${safeAIError(err)}`;
    }
  }

  if (!aiClient) {
    baseResult.ai_status = getAIAvailability();
    baseResult.warning = 'AI assistance unavailable — using rule-based mode.';
  }

  baseResult.ai_status = getAIAvailability();
  return baseResult;
}

// Chatbot assistant function
export async function handleAssistantChat(params: {
  message: string;
  role: 'analyst' | 'manager' | 'reporter';
  userId: string;
  incidentId?: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<{ reply: string; source_incidents?: string[]; source_logs?: number[]; mode: 'rule-based' | 'ai-assisted' }> {
  const { message, role, incidentId } = params;
  const msgLower = message.toLowerCase();

  // Role restriction checks: Reporters cannot retrieve confidential analyst notes or escalation approval keys
  const isReporter = role === 'reporter';

  // Rule-based transparent retrieval mode
  if (!isAIAvailable() || !aiClient) {
    const status = getAIAvailability();
    const fallbackNotice = status.state === 'not-configured'
      ? 'AI assistance unavailable — using rule-based mode. This response is not AI-generated.\n\n'
      : status.state === 'configured-unavailable'
        ? `Gemini is configured but unavailable (${status.message || 'service error'}); using rule-based mode. This response is not AI-generated.\n\n`
        : 'AI has not been verified; using rule-based mode. This response is not AI-generated.\n\n';
    const ruleBasedReply = (reply: string) => `${fallbackNotice}${reply}`;

    if (msgLower.includes('how') && (msgLower.includes('work') || msgLower.includes('demo') || msgLower.includes('incidentiq'))) {
      return {
        mode: 'rule-based',
        reply: ruleBasedReply(`IncidentIQ is an incident memory and resolution platform intended for IBM Z and LinuxONE.\n\nWorkflow:\n1. Employee/Reporter submits an incident with observed symptoms.\n2. Analysts can search the LogHub Linux demonstration dataset and link relevant lines as evidence.\n3. Analysts record investigation actions and outcomes.\n4. When necessary, Analysts request Human Escalation with supporting evidence.\n5. Incident Managers review and approve/reject/return escalations from the dedicated queue.\n6. Stored procedures and outcomes are references for human review.`),
      };
    }

    if (msgLower.includes('similar') || msgLower.includes('history') || msgLower.includes('seen')) {
      const similar = findSimilarIncidents({
        title: message,
        description: message
      });

      if (similar.length > 0) {
        const top = similar.slice(0, 3);
        const matchSummary = top.map(s =>
          `• ${s.incident_id} ("${s.title}") - Keyword-frequency similarity: ${s.similarity_percentage}% (${s.similarity_label})${s.is_demo_data ? ' [seeded demo incident]' : ''}, Severity: ${s.severity}, Status: ${s.status}, Recorded outcome: ${s.outcome_type}; matched terms: ${s.matching_terms.join(', ')}`
        ).join('\n');

        return {
          mode: 'rule-based',
          reply: ruleBasedReply(`Here are keyword-matched incidents from IncidentIQ's memory database:\n\n${matchSummary}\n\nSimilarity is not proof a prior fix will work. Review recorded actions and outcomes in the Similar Incidents search tab.`),
          source_incidents: top.map(s => s.incident_id)
        };
      } else {
        return {
          mode: 'rule-based',
          reply: ruleBasedReply('No stored incident matched this query pattern.')
        };
      }
    }

    if (msgLower.includes('escalat')) {
      if (isReporter) {
        return {
          mode: 'rule-based',
          reply: ruleBasedReply('Incidents requiring elevated technical permissions are escalated by assigned Security Analysts to Incident Managers for review.')
        };
      }
      return {
        mode: 'rule-based',
        reply: ruleBasedReply('The escalation process requires an Analyst to record supporting log evidence and specify the technical escalation rationale. Incident Managers then review the request in the Escalation Queue to Approve, Reject, or Return for further investigation.')
      };
    }

    if (incidentId) {
      const inc = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId) as any;
      if (inc) {
        return {
          mode: 'rule-based',
          reply: ruleBasedReply(`Incident ${inc.id}: "${inc.title}" is currently [${inc.status}] with severity [${inc.severity}] on system ${inc.affected_system}.\nAssigned Analyst: ${inc.assigned_analyst_name || 'Unassigned'}.`),
          source_incidents: [inc.id]
        };
      }
    }

    // Default transparent response
    return {
      mode: 'rule-based',
      reply: ruleBasedReply(`IncidentIQ Assistant (Rule-Based Mode):\nI can help you search similar incidents, explain log evidence patterns, summarize recorded investigation actions, and explain the escalation workflow.\n\nTry asking:\n- "Show similar incidents for SSH brute force"\n- "What is the status of INC-Z-1042?"\n- "How does the manager escalation review process work?"`)
    };
  }

  // AI-Assisted Mode using Gemini
  try {
    const incidents = db.prepare('SELECT id, title, severity, status, affected_system, resolution_verified FROM incidents LIMIT 10').all() as any[];
    const safeIncidents = incidents.map(i => `${i.id}: ${i.title} [Status: ${i.status}, Severity: ${i.severity}]`).join('\n');

    const prompt = `
You are the IncidentIQ Assistant for IBM Z and LinuxONE enterprise operations.
User Role: ${role} (Enforce role restrictions: reporters cannot see internal manager/analyst secrets).

AVAILABLE RECENT INCIDENTS:
${safeIncidents}

USER QUERY:
${message}

Respond in concise, professional enterprise style. Never invent fake incidents. If something is unknown, say so clearly. Do not execute destructive actions.
`;

    const response = await aiClient.models.generateContent({
      model: AI_MODEL,
      contents: prompt
    });

    if (!response.text?.trim()) throw new Error('Gemini returned an empty response.');
    noteAIResponse(true);
    return {
      mode: 'ai-assisted',
      reply: response.text,
    };
  } catch (err: any) {
    noteAIResponse(false, err);
    return {
      mode: 'rule-based',
      reply: `AI assistance failed; this is a rule-based response, not AI-generated. ${safeAIError(err)}`,
    };
  }
}
