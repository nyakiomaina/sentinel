import { Connection, PublicKey } from "@solana/web3.js";

import type { AuditEvent } from "../types";

export async function getAuditLog(
  connection: Connection,
  agentWallet: PublicKey,
  heliusApiKey: string,
  limit: number = 50,
): Promise<AuditEvent[]> {
  // TODO: fetch from the Helius API filtered by agent wallet and program ID.
  // TODO: map the response to `AuditEvent` and sort by timestamp desc.
  void connection;
  void agentWallet;
  void heliusApiKey;
  void limit;
  return [];
}

