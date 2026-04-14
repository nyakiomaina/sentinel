import { PublicKey } from "@solana/web3.js";

export async function approveEscalation(
  escalationId: PublicKey,
  approved: boolean,
): Promise<string> {
  // TODO: build approve_escalation tx (owner resolves held escalation).
  void escalationId;
  void approved;
  return "TODO";
}

