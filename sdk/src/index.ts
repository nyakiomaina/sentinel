/**
 * @sentinel/sdk — one-line policy enforcement for Solana AI agents.
 *
 * Usage:
 *
 *   import { Sentinel } from "@sentinel/sdk";
 *
 *   const sentinel = await Sentinel.load(connection, wallet, policyPda);
 *
 *   // Before every agent action:
 *   await sentinel.guard({ amount: 50_000_000n, targetProgram: JUPITER_PROGRAM_ID });
 *   // ...agent proceeds with its actual transaction...
 *
 * `guard` throws if Sentinel rejects the action, so agents fail-closed by
 * default. The call itself lands on-chain, updating the rolling counter and
 * emitting an audit event.
 */

import {
  AnchorProvider,
  Program,
  BN,
  Idl,
  Wallet,
} from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionSignature,
} from "@solana/web3.js";

export const SENTINEL_PROGRAM_ID = new PublicKey(
  "14u1yjdjLfn8cfAwBd5e6Av4fdG1sKifhJXAv1XVworo",
);

export interface PolicySpec {
  maxPerTx: bigint;
  maxPerHour: bigint;
  escalationThreshold: bigint;
  whitelist: PublicKey[];
}

export interface GuardArgs {
  amount: bigint;
  targetProgram: PublicKey;
  /** Optional pre-approved escalation ticket PDA for high-value actions. */
  escalationTicket?: PublicKey;
}

export interface PolicyState {
  owner: PublicKey;
  agent: PublicKey;
  maxPerTx: bigint;
  maxPerHour: bigint;
  escalationThreshold: bigint;
  windowStart: bigint;
  windowSpent: bigint;
  totalActions: bigint;
  totalBlocked: bigint;
  whitelist: PublicKey[];
  paused: boolean;
}

/** Derive the canonical policy PDA for (owner, agent). */
export function derivePolicyPda(
  owner: PublicKey,
  agent: PublicKey,
  programId: PublicKey = SENTINEL_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), owner.toBuffer(), agent.toBuffer()],
    programId,
  );
}

/** Derive an escalation ticket PDA. */
export function deriveTicketPda(
  policy: PublicKey,
  amount: bigint,
  targetProgram: PublicKey,
  programId: PublicKey = SENTINEL_PROGRAM_ID,
): [PublicKey, number] {
  const amtBuf = Buffer.alloc(8);
  amtBuf.writeBigUInt64LE(amount);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("ticket"), policy.toBuffer(), amtBuf, targetProgram.toBuffer()],
    programId,
  );
}

/**
 * High-level client. One instance = one policy account.
 */
export class Sentinel {
  constructor(
    public readonly program: Program,
    public readonly policy: PublicKey,
    public readonly agent: PublicKey,
  ) {}

  /** Load an existing policy by PDA. */
  static async load(
    connection: Connection,
    wallet: Wallet,
    policy: PublicKey,
    idl: Idl,
    programId: PublicKey = SENTINEL_PROGRAM_ID,
  ): Promise<Sentinel> {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    const program = new Program(idl, provider);
    const state = (await (program.account as any).policy.fetch(policy)) as any;
    return new Sentinel(program, policy, state.agent);
  }

  /** Initialize a brand-new policy. Owner-only; one per (owner, agent). */
  static async initialize(
    connection: Connection,
    wallet: Wallet,
    agent: PublicKey,
    spec: PolicySpec,
    idl: Idl,
    programId: PublicKey = SENTINEL_PROGRAM_ID,
  ): Promise<{ sentinel: Sentinel; sig: TransactionSignature; policy: PublicKey }> {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    const program = new Program(idl, provider);
    const [policy] = derivePolicyPda(wallet.publicKey, agent, programId);
    const sig = await (program.methods as any)
      .initializePolicy(
        agent,
        new BN(spec.maxPerTx.toString()),
        new BN(spec.maxPerHour.toString()),
        new BN(spec.escalationThreshold.toString()),
        spec.whitelist,
      )
      .accounts({
        owner: wallet.publicKey,
        policy,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { sentinel: new Sentinel(program, policy, agent), sig, policy };
  }

  /**
   * The one-line integration point for agents. Call this immediately before
   * the agent's real action. Throws if Sentinel blocks the call.
   */
  async guard(args: GuardArgs): Promise<TransactionSignature> {
    return (this.program.methods as any)
      .checkAction(new BN(args.amount.toString()), args.targetProgram)
      .accounts({
        policy: this.policy,
        agent: this.agent,
        escalationTicket: args.escalationTicket ?? null,
      })
      .rpc();
  }

  /** Owner pre-approves a high-value action. Returns the ticket PDA. */
  async approveEscalation(
    amount: bigint,
    targetProgram: PublicKey,
    ttlSeconds = 300,
  ): Promise<{ ticket: PublicKey; sig: TransactionSignature }> {
    const [ticket] = deriveTicketPda(this.policy, amount, targetProgram);
    const sig = await (this.program.methods as any)
      .approveEscalation(
        new BN(amount.toString()),
        targetProgram,
        new BN(ttlSeconds),
      )
      .accounts({
        policy: this.policy,
        owner: (this.program.provider as AnchorProvider).wallet.publicKey,
        ticket,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return { ticket, sig };
  }

  /** Update any subset of policy parameters. Owner-only. */
  async updatePolicy(patch: Partial<PolicySpec> & { paused?: boolean }) {
    return (this.program.methods as any)
      .updatePolicy(
        patch.maxPerTx != null ? new BN(patch.maxPerTx.toString()) : null,
        patch.maxPerHour != null ? new BN(patch.maxPerHour.toString()) : null,
        patch.escalationThreshold != null
          ? new BN(patch.escalationThreshold.toString())
          : null,
        patch.whitelist ?? null,
        patch.paused ?? null,
      )
      .accounts({
        policy: this.policy,
        owner: (this.program.provider as AnchorProvider).wallet.publicKey,
      })
      .rpc();
  }

  /** Fetch the raw policy state (decoded). */
  async fetchState(): Promise<PolicyState> {
    const s: any = await (this.program.account as any).policy.fetch(this.policy);
    return {
      owner: s.owner,
      agent: s.agent,
      maxPerTx: BigInt(s.maxPerTx.toString()),
      maxPerHour: BigInt(s.maxPerHour.toString()),
      escalationThreshold: BigInt(s.escalationThreshold.toString()),
      windowStart: BigInt(s.windowStart.toString()),
      windowSpent: BigInt(s.windowSpent.toString()),
      totalActions: BigInt(s.totalActions.toString()),
      totalBlocked: BigInt(s.totalBlocked.toString()),
      whitelist: (s.whitelist as PublicKey[]).slice(0, s.whitelistLen),
      paused: s.paused,
    };
  }
}

/** Known program IDs used in whitelists and demos. */
export const KNOWN_PROGRAMS = {
  JUPITER: new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
  RAYDIUM_AMM: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
  TOKEN_PROGRAM: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  SYSTEM: SystemProgram.programId,
};
