/**
 * @sentinel/ai — compile plain-English rules into a Sentinel PolicySpec.
 *
 * Example:
 *
 *   const ai = new PolicyCompiler({ apiKey: process.env.ANTHROPIC_API_KEY! });
 *   const spec = await ai.compile(
 *     "my agent trades on Jupiter with a max of 500 USDC per hour and should never touch any other protocol"
 *   );
 *   // -> { maxPerTx, maxPerHour, escalationThreshold, whitelist: [JUPITER] }
 *
 * The compiler uses Claude with a strict tool-use schema so that the LLM
 * cannot emit free-form output — it is forced to return a typed policy.
 */

import Anthropic from "@anthropic-ai/sdk";
import { PublicKey } from "@solana/web3.js";
import { KNOWN_PROGRAMS, PolicySpec } from "@sentinel/sdk";

/** Program aliases the LLM is allowed to reference by name. */
export const PROGRAM_ALIASES: Record<string, PublicKey> = {
  jupiter: KNOWN_PROGRAMS.JUPITER,
  raydium: KNOWN_PROGRAMS.RAYDIUM_AMM,
  token: KNOWN_PROGRAMS.TOKEN_PROGRAM,
  system: KNOWN_PROGRAMS.SYSTEM,
};

export interface CompileOptions {
  /** Decimals for the unit the user is quoting (USDC = 6). */
  decimals?: number;
}

const POLICY_TOOL = {
  name: "emit_policy",
  description:
    "Emit a strict Sentinel policy object parsed from the user's natural-language rule.",
  input_schema: {
    type: "object",
    required: ["max_per_tx", "max_per_hour", "escalation_threshold", "programs"],
    properties: {
      max_per_tx: {
        type: "number",
        description: "Maximum value for a single transaction, in the user's quoted unit (e.g. USDC).",
      },
      max_per_hour: {
        type: "number",
        description: "Maximum total value the agent can move in a rolling hour, in the user's quoted unit.",
      },
      escalation_threshold: {
        type: "number",
        description:
          "Any single action >= this value requires explicit owner approval before it can execute. Set >= max_per_tx to disable.",
      },
      programs: {
        type: "array",
        items: { type: "string", enum: Object.keys(PROGRAM_ALIASES) },
        description: "Allowed target programs, referenced by lowercase alias.",
      },
      rationale: {
        type: "string",
        description: "One-sentence explanation of the mapping for the audit log.",
      },
    },
  },
} as const;

export class PolicyCompiler {
  private client: Anthropic;
  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model ?? "claude-opus-4-6";
  }
  private model: string;

  async compile(rule: string, opts: CompileOptions = {}): Promise<PolicySpec & { rationale: string }> {
    const decimals = opts.decimals ?? 6; // default USDC
    const scale = 10n ** BigInt(decimals);

    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      tools: [POLICY_TOOL as any],
      tool_choice: { type: "tool", name: "emit_policy" } as any,
      system:
        "You translate natural-language access-control rules for Solana AI agents into strict Sentinel policies. Always call the emit_policy tool. If the user does not specify a value, pick a conservative default (favor smaller limits, smaller whitelists). Never invent programs not listed in the enum.",
      messages: [{ role: "user", content: rule }],
    });

    const toolUse = resp.content.find((b: any) => b.type === "tool_use") as any;
    if (!toolUse) throw new Error("LLM did not emit a policy");
    const p = toolUse.input as {
      max_per_tx: number;
      max_per_hour: number;
      escalation_threshold: number;
      programs: string[];
      rationale?: string;
    };

    const toBase = (n: number) => BigInt(Math.round(n * Number(scale)));
    const whitelist = p.programs.map((alias) => {
      const pk = PROGRAM_ALIASES[alias];
      if (!pk) throw new Error(`unknown program alias: ${alias}`);
      return pk;
    });

    return {
      maxPerTx: toBase(p.max_per_tx),
      maxPerHour: toBase(p.max_per_hour),
      escalationThreshold: toBase(p.escalation_threshold),
      whitelist,
      rationale: p.rationale ?? "",
    };
  }
}

/**
 * Deterministic fallback compiler — zero LLM, regex-based. Used in tests and
 * as an offline fallback. Handles the common "trade on X, max N USDC per hour"
 * pattern so demos work without an API key.
 */
export function compileOffline(rule: string, decimals = 6): PolicySpec {
  const scale = 10 ** decimals;
  const lower = rule.toLowerCase();

  const hour = lower.match(/([\d,.]+)\s*(usdc|sol)?\s*per\s*hour/);
  const perTx = lower.match(/max(?:imum)?\s*(?:of\s*)?([\d,.]+)\s*(usdc|sol)?\s*per\s*tx/);
  const escal = lower.match(/escalat\w*\s*(?:above|at|over)?\s*([\d,.]+)/);

  const parseAmt = (s: string) => BigInt(Math.round(parseFloat(s.replace(/,/g, "")) * scale));

  const maxPerHour = hour ? parseAmt(hour[1]) : 1000n * BigInt(scale);
  const maxPerTx = perTx ? parseAmt(perTx[1]) : maxPerHour / 4n;
  const escalationThreshold = escal ? parseAmt(escal[1]) : maxPerTx;

  const whitelist: PublicKey[] = [];
  for (const [alias, pk] of Object.entries(PROGRAM_ALIASES)) {
    if (lower.includes(alias)) whitelist.push(pk);
  }
  if (whitelist.length === 0) whitelist.push(KNOWN_PROGRAMS.JUPITER);

  return { maxPerTx, maxPerHour, escalationThreshold, whitelist };
}
