import { Connection, PublicKey } from "@solana/web3.js";

import type { Policy } from "../types";

export async function getPolicy(connection: Connection, agentWallet: PublicKey): Promise<Policy> {
  // TODO: derive Policy PDA, fetch account data, decode into `Policy`.
  void connection;
  void agentWallet;
  throw new Error("TODO");
}

