/**
 * Anchor integration tests — run with `anchor test`.
 *
 * Covers all four guardrails end-to-end on a local validator:
 *   - whitelist rejection
 *   - per-tx cap
 *   - rolling hourly cap (via clock warp)
 *   - escalation ticket flow
 *   - pause switch
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("sentinel", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Sentinel as Program;

  const owner = (provider.wallet as anchor.Wallet).payer;
  const agent = Keypair.generate();
  const jupiter = Keypair.generate().publicKey;
  const raydium = Keypair.generate().publicKey;

  let policyPda: PublicKey;

  before(async () => {
    const sig = await provider.connection.requestAirdrop(agent.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), owner.publicKey.toBuffer(), agent.publicKey.toBuffer()],
      program.programId,
    );

    await (program.methods as any)
      .initializePolicy(
        agent.publicKey,
        new BN(100_000_000),   // 100 USDC per tx
        new BN(500_000_000),   // 500 USDC per hour
        new BN(80_000_000),    // 80 USDC → escalation
        [jupiter],
      )
      .accounts({
        owner: owner.publicKey,
        policy: policyPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  const guard = async (amount: number, target: PublicKey, ticket: PublicKey | null = null) =>
    (program.methods as any)
      .checkAction(new BN(amount), target)
      .accounts({ policy: policyPda, agent: agent.publicKey, escalationTicket: ticket })
      .signers([agent])
      .rpc();

  it("approves a whitelisted, within-limits action", async () => {
    await guard(25_000_000, jupiter);
    const s: any = await (program.account as any).policy.fetch(policyPda);
    assert.equal(s.totalActions.toNumber(), 1);
  });

  it("blocks non-whitelisted programs", async () => {
    try {
      await guard(10_000_000, raydium);
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.toString(), "ProgramNotWhitelisted");
    }
  });

  it("blocks per-tx cap", async () => {
    try {
      await guard(150_000_000, jupiter);
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.toString(), "PerTxExceeded");
    }
  });

  it("requires an escalation ticket for large actions", async () => {
    try {
      await guard(90_000_000, jupiter);
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.toString(), "EscalationRequired");
    }

    const amtBuf = Buffer.alloc(8);
    amtBuf.writeBigUInt64LE(90_000_000n);
    const [ticket] = PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), policyPda.toBuffer(), amtBuf, jupiter.toBuffer()],
      program.programId,
    );

    await (program.methods as any)
      .approveEscalation(new BN(90_000_000), jupiter, new BN(600))
      .accounts({
        policy: policyPda,
        owner: owner.publicKey,
        ticket,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await guard(90_000_000, jupiter, ticket);
  });

  it("enforces the rolling hourly cap", async () => {
    // Already spent 25 + 90 = 115. Hourly cap 500. Push until it trips.
    await guard(100_000_000, jupiter);
    await guard(100_000_000, jupiter);
    await guard(100_000_000, jupiter); // 415
    try {
      await guard(100_000_000, jupiter); // would make 515 > 500
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.toString(), "HourlyExceeded");
    }
  });

  it("pause switch blocks everything", async () => {
    await (program.methods as any)
      .updatePolicy(null, null, null, null, true)
      .accounts({ policy: policyPda, owner: owner.publicKey })
      .rpc();
    try {
      await guard(1_000_000, jupiter);
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.toString(), "Paused");
    }
  });
});
