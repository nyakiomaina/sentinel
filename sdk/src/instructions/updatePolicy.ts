import { PublicKey } from "@solana/web3.js";

import type { PolicyParams } from "../types";

export async function updatePolicy(
  agentWallet: PublicKey,
  updates: Partial<PolicyParams>,
): Promise<string> {
  // TODO: build update_policy tx (owner updates only provided fields).
  void agentWallet;
  void updates;
  return "TODO";
}

