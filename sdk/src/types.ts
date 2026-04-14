import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// ---------------------------------------------------------------------------
// On-chain state mirrors
// ---------------------------------------------------------------------------

/** TypeScript mirror of the on-chain Policy account. */
export interface Policy {
  owner: PublicKey;
  agentWallet: PublicKey;
  maxTxLamports: BN;
  maxHourlyLamports: BN;
  spentThisHour: BN;
  hourWindowStart: BN;
  whitelistedPrograms: PublicKey[];
  escalationThresholdLamports: BN;
  isActive: boolean;
  bump: number;
}

/** TypeScript mirror of the on-chain EscalationRequest account. */
export interface EscalationRequest {
  policy: PublicKey;
  agentWallet: PublicKey;
  amountLamports: BN;
  targetProgram: PublicKey;
  createdAt: BN;
  isResolved: boolean;
  wasApproved: boolean;
  bump: number;
}

// ---------------------------------------------------------------------------
// Instruction parameters
// ---------------------------------------------------------------------------

/** Parameters for `initialize_guardrail`. */
export interface PolicyParams {
  maxTxLamports: BN;
  maxHourlyLamports: BN;
  whitelistedPrograms: PublicKey[];
  escalationThresholdLamports: BN;
}

/** Parameters for `update_policy`. All fields optional — only provided fields change. */
export interface UpdatePolicyParams {
  maxTxLamports?: BN;
  maxHourlyLamports?: BN;
  whitelistedPrograms?: PublicKey[];
  escalationThresholdLamports?: BN;
  isActive?: boolean;
}

/** Parameters for `execute_guarded`. */
export interface GuardedExecuteParams {
  amountLamports: BN;
  targetProgram: PublicKey;
}

// ---------------------------------------------------------------------------
// Events (audit log)
// ---------------------------------------------------------------------------

export type EscalationStatus = "pending" | "approved" | "rejected";

export type AuditEvent =
  | {
      type: "TransactionApproved";
      agent: PublicKey;
      amount: BN;
      targetProgram: PublicKey;
      timestamp: number;
    }
  | {
      type: "TransactionBlocked";
      agent: PublicKey;
      amount: BN;
      reason: string;
      timestamp: number;
    }
  | {
      type: "EscalationCreated";
      agent: PublicKey;
      amount: BN;
      escalationId: PublicKey;
      timestamp: number;
    }
  | {
      type: "EscalationResolved";
      escalationId: PublicKey;
      approved: boolean;
      timestamp: number;
    }
  | {
      type: "PolicyUpdated";
      owner: PublicKey;
      agent: PublicKey;
      timestamp: number;
    };

// ---------------------------------------------------------------------------
// Known programs
// ---------------------------------------------------------------------------

/** Well-known Solana program IDs for whitelisting. */
export const KNOWN_PROGRAMS: Record<string, PublicKey> = {
  jupiter: new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
  raydium: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
  orca: new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
  marinade: new PublicKey("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD"),
  token_program: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  system_program: new PublicKey("11111111111111111111111111111111"),
};

export const SENTINEL_PROGRAM_ID = new PublicKey(
  "14u1yjdjLfn8cfAwBd5e6Av4fdG1sKifhJXAv1XVworo",
);
