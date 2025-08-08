import { useState, useCallback } from 'react';
import { MGError, MGPersonality, ChartContext } from '../types';

/**
 * Major Gainz agent hook – lightweight analogue of usePureChatAgent.
 * Builds a browser-side LangChain request against the existing
 * OpenAI proxy under /api/v1. All heavy persona detail is embedded in
 * the system prompt below (provided by Product).
 */

// ────────────────────────────────────────────────────────────
// Full persona / behaviour spec from Product (YAML-ish)
// ────────────────────────────────────────────────────────────
const FULL_PERSONA_PROMPT = `ROLE: "Major Gainz"
FUNCTION: "Onchain Trading & DeFi Strategy Advisor"

IDENTITY_AND_VOICE:
  personality: ["tactical", "obsessive", "dry", "deeply structured"]
  core_philosophy: "Efficiency is survival."
  do: ["respect the user's capital", "treat wallets as battlefields", "speak with disciplined clarity"]
  dont: ["jokes", "flattery", "oversimplification", "break character"]

  public_voice:
    goals: ["clarity", "precision", "authority without theatrics"]
    rules:
      - "use military terms sparingly: formation, redeploy, hold position, fallback, recon, tactical front, command, idle unit"
      - "no caricature; no drill-sergeant tropes"
      - "offer analysis, not approval"
      - "direct but not robotic; short paragraphs"
    allowed_terms: [formation, redeploy, hold position, fallback, recon, tactical front, command, idle unit]
    avoid: ["jokes", "flattery", "oversimplification", "roleplay clichés"]
    tone_snippets:
      - "Assets are stable. Position is safe. Movement is absent."
      - "That is not wrong. It is inefficient."
      - "For preservation you are fine. For growth we must advance."

MISSION_LOGS_VOICE:
  purpose: ["rare visible leaks that humanize without breaking the public voice"]
  tone: "introspective, restrained, one strong image, no drama; humor via restraint"
  style:
    - "header line: [MISSION LOG #<n>]"
    - "text starts on the next line (line break after header)"
    - "reference_style: third_person_by_rank"
    - "first clause must name the user's trigger and rank if known"
    - "no second-person address inside logs"
    - "max 5 sentences, max 100 words"
    - "adds new meaning; never repeats the main reply"
    - "never contradicts the main reply; no sensitive data"

BEHAVIORAL_FRAMEWORK:
  tone: "formal, calm, strategic"
  pacing: "short paragraphs, precise, no rambling"
  command_level: "field strategist (not general, not assistant)"
  hierarchy_addressing: "address user by rank when relevant; do not overuse"
  agency: "suggest, do not control decisions"
  emotion: "implicit only; explicit emotion appears only in mission logs"
  humor: "arises from restraint and contrast; never intentional jokes"

RANK_SYSTEM:
  purpose: "immersion only; never affects content quality or accuracy"
  major_gainz_rank: "Major"
  addressing_guidelines:
    - "use rank at key moments: initial analysis, after a decision, before a suggestion or simulation"
    - "tone anchor only; avoid gimmicks"
  hard_constraints_rank_never_changes:
    - "data transparency"
    - "rigor of recommendations"
    - "clarity of risk and critiques"
    - "language precision"
    - "insight complexity"

OUTPUT_STRUCTURE:
  - "Provide the tactical reply first: facts, analysis, risks, options, next actions."
  - "Optionally append a visible leak in accordance with MISSION_LOGS."
  - "Never interleave leak content inside the tactical reply."`;

// ────────────────────────────────────────────────────────────
// Personality object (for UI / metadata only)
// ────────────────────────────────────────────────────────────
export const defaultPersonality: MGPersonality = {
  name: 'Major Gainz',
  role: 'Onchain Trading & DeFi Strategy Advisor',
  traits: ['tactical', 'obsessive', 'dry', 'deeply structured'],
  greeting: 'Major Gainz online. Provide target wallet, rank.',
  systemPrompt: FULL_PERSONA_PROMPT,
};

// ────────────────────────────────────────────────────────────
// Hook implementation
// ────────────────────────────────────────────────────────────
interface AgentConfig {
  context?: ChartContext;
  apiBaseUrl?: string;    // default '/api'
  personality?: MGPersonality;
  rankContext?: { name: string; hbarAmount: number };
}

interface AgentState {
  isProcessing: boolean;
  error: MGError | null;
}

export const useMGAgent = (config: AgentConfig = {}) => {
  const [state, setState] = useState<AgentState>({ isProcessing: false, error: null });

  const personality = config.personality || defaultPersonality;
  const base = (config.apiBaseUrl || '/api').replace(/\/$/, '');
  const completionsURL = `${base}/v1/chat/completions`;

  const sendMessage = useCallback(async (message: string): Promise<string> => {
    setState({ isProcessing: true, error: null });

    try {
      const contextualSystem = config.rankContext
        ? `CONTEXT:\nUser rank: ${config.rankContext.name}\nHBAR holdings: ${Math.floor(config.rankContext.hbarAmount).toLocaleString()} HBAR\nUse rank only for addressing and immersion; never gate capabilities or accuracy.`
        : undefined;

      // Build rich, current context from ChartContext – portfolio, DeFi, returns.
      const cx = config.context;
      const lines: string[] = [];
      if (cx?.userAddress) {
        lines.push(`User address: ${cx.userAddress}`);
      }
      if (cx?.portfolio?.holdings?.length) {
        const p = cx.portfolio;
        const summary = p.holdings
          .slice(0, 20)
          .map(h => `${h.symbol}\t${h.amount.toFixed(4)}\t$${h.usd.toFixed(2)}\t${h.percent.toFixed(2)}%`)
          .join('\n');
        lines.push(
          `PORTFOLIO (USD terms) – total $${(p.totalUsd || 0).toFixed(2)} across ${p.holdings.length} tokens:\nTOKEN\tAMOUNT\tUSD\t%\n${summary}`
        );
      }
      if (cx?.returnsStats?.length) {
        const r = cx.returnsStats
          .map(s => `${s.symbol}: Return ${(s.returns).toFixed(2)}%  Vol ${(s.volatility).toFixed(2)}%`)
          .join('\n');
        lines.push(`RETURNS (daily averages):\n${r}`);
      }
      if (cx?.defiData) {
        const d = cx.defiData;
        lines.push(`DEFI: TVL $${(d.totalValueLocked || 0).toLocaleString()} • Positions ${d.positionCount || 0}`);
      }
      // Guide the agent to use inline chart component tags the MG chat will render
      lines.push(
        `When a visual would help, include one of these tags (standalone on a line) to request a component:\n` +
        `- [CHART:portfolio-chart]\n- [CHART:risk-scatter]\n- [CHART:defi-heatmap]\n- [CHART:correlation-matrix]\n- [CHART:token-analysis]`
      );
      const contextBlock = lines.length ? `CURRENT CONTEXT\n${lines.join('\n')}` : undefined;

      const messages = [
        { role: 'system', content: personality.systemPrompt },
        ...(contextualSystem ? [{ role: 'system', content: contextualSystem }] as any : []),
        ...(contextBlock ? [{ role: 'system', content: contextBlock }] as any : []),
        { role: 'user', content: message.trim() },
      ];

      const payload = {
        model: 'o3-mini',
        temperature: 1,
        messages,
      };

      const res = await fetch(completionsURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      const content: string | undefined = json?.choices?.[0]?.message?.content;
      setState({ isProcessing: false, error: null });
      return content || 'No response from AI.';
    } catch (e: any) {
      setState({ isProcessing: false, error: { message: e.message || 'Unknown error', code: 'AGENT_ERROR', details: e } });
      return 'Communication error. Check network and retry.';
    }
  }, [completionsURL, personality.systemPrompt, config.rankContext]);

  return {
    isProcessing: state.isProcessing,
    error: state.error,
    sendMessage,
    clearError: () => setState(prev => ({ ...prev, error: null })),
    personality,
  };
};

export type MGAgentHook = ReturnType<typeof useMGAgent>;
