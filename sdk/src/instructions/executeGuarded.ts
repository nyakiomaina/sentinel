import { PublicKey } from "@solana/web3.js";

export async function executeGuarded(
  agentWallet: PublicKey,
  targetProgram: PublicKey,
  amountLamports: number,
): Promise<string> {
  // TODO: build execute_guarded tx (agent signer) and send it.
  void agentWallet;
  void targetProgram;
  void amountLamports;
  return "TODO";
}

