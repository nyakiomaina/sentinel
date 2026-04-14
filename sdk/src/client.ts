import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import type { AuditEvent, EscalationRequest, Policy, PolicyParams } from "./types";

export class SentinelClient {
  constructor(
    private readonly connection: Connection,
    private readonly wallet: Keypair,
  ) {}

  async initialize(
    agentWallet: PublicKey,
    policyParamsOrNaturalLanguage: PolicyParams | string,
  ): Promise<string> {
    // TODO: if `policyParamsOrNaturalLanguage` is a string, call `parsePolicy()` to get `PolicyParams`.
    // TODO: build and send `initialize_guardrail` transaction.
    return "TODO";
  }

  async updatePolicy(agentWallet: PublicKey, updates: Partial<PolicyParams>): Promise<string> {
    // TODO: build and send `update_policy` transaction.
    return "TODO";
  }

  async executeGuarded(
    agentWallet: PublicKey,
    targetProgram: PublicKey,
    amount: number,
  ): Promise<string> {
    // TODO: build and send `execute_guarded` transaction.
    return "TODO";
  }

  async approveEscalation(escalationId: PublicKey, approved: boolean): Promise<string> {
    // TODO: build and send `approve_escalation` transaction.
    return "TODO";
  }

  async getPolicy(agentWallet: PublicKey): Promise<Policy> {
    // TODO: fetch Policy PDA data.
    throw new Error("TODO");
  }

  async getAuditLog(agentWallet: PublicKey, limit?: number): Promise<AuditEvent[]> {
    // TODO: fetch indexed events from Helius.
    return [];
  }

  async getPendingEscalations(agentWallet: PublicKey): Promise<EscalationRequest[]> {
    // TODO: fetch pending EscalationRequests.
    return [];
  }
}
