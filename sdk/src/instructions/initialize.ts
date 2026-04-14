import { PublicKey } from "@solana/web3.js";

import type { PolicyParams } from "../types";

export async function initializeGuardrail(
  agentWallet: PublicKey,
  params: PolicyParams,
): Promise<string> {
  // TODO: build initialize_guardrail tx (owner creates Policy PDA).
  void agentWallet;
  void params;
  return "TODO";
}

