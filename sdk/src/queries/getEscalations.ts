import { Connection, PublicKey } from "@solana/web3.js";

import type { EscalationRequest } from "../types";

export async function getEscalations(
  connection: Connection,
  agentWallet: PublicKey,
): Promise<EscalationRequest[]> {
  // TODO: fetch all pending EscalationRequest accounts for this agent.
  void connection;
  void agentWallet;
  return [];
}

