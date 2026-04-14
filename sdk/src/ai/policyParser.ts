import Anthropic from "@anthropic-ai/sdk";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

import type { PolicyParams } from "../types";

// Known program name → pubkey map (expand as needed)
const KNOWN_PROGRAMS: Record<string, string> = {
  jupiter: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  raydium: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  orca: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  marinade: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
};

type ToolOutput = {
  max_tx_lamports: number;
  max_hourly_lamports: number;
  whitelisted_programs: string[];
  escalation_threshold_lamports: number;
};

export async function parsePolicy(naturalLanguage: string): Promise<PolicyParams> {
  // TODO: validate env configuration (e.g. `ANTHROPIC_API_KEY`) and provide helpful errors.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const client = new Anthropic({ apiKey });

  const tool = {
    name: "emit_policy_params",
    description:
      "Convert a natural-language policy to strict PolicyParams. " +
      "All amounts must be returned as lamports (integer). " +
      "Use only known program names or base58 program IDs.",
    input_schema: {
      type: "object" as const,
      required: [
        "max_tx_lamports",
        "max_hourly_lamports",
        "whitelisted_programs",
        "escalation_threshold_lamports",
      ],
      properties: {
        max_tx_lamports: { type: "number" as const },
        max_hourly_lamports: { type: "number" as const },
        escalation_threshold_lamports: { type: "number" as const },
        whitelisted_programs: {
          type: "array" as const,
          items: { type: "string" as const },
        },
      },
    },
  };

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 1024,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [
      {
        role: "user",
        content:
          `Parse this Sentinel policy and emit lamports + program IDs.\n\n` +
          `Policy:\n${naturalLanguage}\n\n` +
          `Known program aliases:\n${JSON.stringify(KNOWN_PROGRAMS, null, 2)}`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return tool output");
  }

  const out = toolUse.input as ToolOutput;
  const whitelistedPrograms = out.whitelisted_programs.map((p) => {
    const mapped = KNOWN_PROGRAMS[p.toLowerCase()];
    return new PublicKey(mapped ?? p);
  });

  return {
    maxTxLamports: new BN(out.max_tx_lamports),
    maxHourlyLamports: new BN(out.max_hourly_lamports),
    whitelistedPrograms,
    escalationThresholdLamports: new BN(out.escalation_threshold_lamports),
  };
}

