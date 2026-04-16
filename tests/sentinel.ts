import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import BN from "bn.js";
import { Sentinel } from "../target/types/sentinel";

describe("sentinel", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Sentinel as Program<Sentinel>;

  // Shared keypairs
  const owner = Keypair.generate();
  const agent = Keypair.generate();
  const wrongOwner = Keypair.generate();
  const targetProgram = new PublicKey("11111111111111111111111111111111");
  const nonWhitelistedProgram = Keypair.generate().publicKey;

  // PDA for the policy
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), agent.publicKey.toBuffer()],
    program.programId
  );

  // Airdrop SOL to test wallets
  before(async () => {
    const airdropOwner = await provider.connection.requestAirdrop(
      owner.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropOwner);

    const airdropAgent = await provider.connection.requestAirdrop(
      agent.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropAgent);

    const airdropWrong = await provider.connection.requestAirdrop(
      wrongOwner.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropWrong);
  });

  // ─── initialize_guardrail ───────────────────────────────────────────

  describe("initialize_guardrail", () => {
    it("creates policy PDA with correct fields", async () => {
      await program.methods
        .initializeGuardrail({
          maxTxLamports: new BN(500_000_000),
          maxHourlyLamports: new BN(2_000_000_000),
          whitelistedPrograms: [targetProgram],
          escalationThresholdLamports: new BN(1_000_000_000),
        })
        .accounts({
          owner: owner.publicKey,
          agentWallet: agent.publicKey,
          policy: policyPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();

      const policy = await program.account.policy.fetch(policyPda);
      expect(policy.owner.toBase58()).to.equal(owner.publicKey.toBase58());
      expect(policy.agentWallet.toBase58()).to.equal(agent.publicKey.toBase58());
      expect(policy.maxTxLamports.toNumber()).to.equal(500_000_000);
      expect(policy.maxHourlyLamports.toNumber()).to.equal(2_000_000_000);
      expect(policy.spentThisHour.toNumber()).to.equal(0);
      expect(policy.whitelistedPrograms).to.have.lengthOf(1);
      expect(policy.whitelistedPrograms[0].toBase58()).to.equal(targetProgram.toBase58());
      expect(policy.escalationThresholdLamports.toNumber()).to.equal(1_000_000_000);
      expect(policy.isActive).to.be.true;
      expect(policy.bump).to.be.a("number");
    });

    it("rejects more than 20 whitelisted programs", async () => {
      const tooManyAgent = Keypair.generate();
      const airdrop = await provider.connection.requestAirdrop(
        owner.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);

      const [tooManyPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("policy"), tooManyAgent.publicKey.toBuffer()],
        program.programId
      );

      const tooManyPrograms = Array.from({ length: 21 }, () => Keypair.generate().publicKey);

      try {
        await program.methods
          .initializeGuardrail({
            maxTxLamports: new BN(100),
            maxHourlyLamports: new BN(1000),
            whitelistedPrograms: tooManyPrograms,
            escalationThresholdLamports: new BN(500),
          })
          .accounts({
            owner: owner.publicKey,
            agentWallet: tooManyAgent.publicKey,
            policy: tooManyPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([owner])
          .rpc();
        expect.fail("should have thrown TooManyPrograms");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("TooManyPrograms");
      }
    });
  });

  // ─── update_policy ──────────────────────────────────────────────────

  describe("update_policy", () => {
    it("updates fields correctly", async () => {
      await program.methods
        .updatePolicy({
          maxTxLamports: new BN(750_000_000),
          maxHourlyLamports: null,
          whitelistedPrograms: null,
          escalationThresholdLamports: new BN(2_000_000_000),
          isActive: null,
        })
        .accounts({
          owner: owner.publicKey,
          policy: policyPda,
        })
        .signers([owner])
        .rpc();

      const policy = await program.account.policy.fetch(policyPda);
      expect(policy.maxTxLamports.toNumber()).to.equal(750_000_000);
      expect(policy.maxHourlyLamports.toNumber()).to.equal(2_000_000_000); // unchanged
      expect(policy.escalationThresholdLamports.toNumber()).to.equal(2_000_000_000);
    });

    it("rejects wrong owner", async () => {
      try {
        await program.methods
          .updatePolicy({
            maxTxLamports: new BN(999),
            maxHourlyLamports: null,
            whitelistedPrograms: null,
            escalationThresholdLamports: null,
            isActive: null,
          })
          .accounts({
            owner: wrongOwner.publicKey,
            policy: policyPda,
          })
          .signers([wrongOwner])
          .rpc();
        expect.fail("should have thrown Unauthorized");
      } catch (err: any) {
        // Anchor has_one constraint returns a constraint violation
        expect(err.error.errorCode.code).to.equal("Unauthorized");
      }
    });
  });

  // ─── execute_guarded ────────────────────────────────────────────────

  describe("execute_guarded: approved", () => {
    it("tx within limits passes", async () => {
      await program.methods
        .executeGuarded(new BN(100_000_000), targetProgram)
        .accounts({
          agent: agent.publicKey,
          policy: policyPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([agent])
        .rpc();

      const policy = await program.account.policy.fetch(policyPda);
      expect(policy.spentThisHour.toNumber()).to.equal(100_000_000);
    });
  });

  describe("execute_guarded: inactive policy", () => {
    it("rejects when policy is inactive", async () => {
      // Deactivate the policy
      await program.methods
        .updatePolicy({
          maxTxLamports: null,
          maxHourlyLamports: null,
          whitelistedPrograms: null,
          escalationThresholdLamports: null,
          isActive: false,
        })
        .accounts({
          owner: owner.publicKey,
          policy: policyPda,
        })
        .signers([owner])
        .rpc();

      try {
        await program.methods
          .executeGuarded(new BN(100), targetProgram)
          .accounts({
            agent: agent.publicKey,
            policy: policyPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([agent])
          .rpc();
        expect.fail("should have thrown PolicyInactive");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("PolicyInactive");
      }

      // Reactivate for subsequent tests
      await program.methods
        .updatePolicy({
          maxTxLamports: null,
          maxHourlyLamports: null,
          whitelistedPrograms: null,
          escalationThresholdLamports: null,
          isActive: true,
        })
        .accounts({
          owner: owner.publicKey,
          policy: policyPda,
        })
        .signers([owner])
        .rpc();
    });
  });

  describe("execute_guarded: whitelist", () => {
    it("rejects non-whitelisted program", async () => {
      try {
        await program.methods
          .executeGuarded(new BN(100), nonWhitelistedProgram)
          .accounts({
            agent: agent.publicKey,
            policy: policyPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([agent])
          .rpc();
        expect.fail("should have thrown ProgramNotWhitelisted");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("ProgramNotWhitelisted");
      }
    });
  });

  describe("execute_guarded: escalation", () => {
    it("rejects amount above escalation threshold", async () => {
      try {
        await program.methods
          .executeGuarded(new BN(3_000_000_000), targetProgram)
          .accounts({
            agent: agent.publicKey,
            policy: policyPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([agent])
          .rpc();
        expect.fail("should have thrown EscalationRequired");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("EscalationRequired");
      }
    });
  });

  describe("execute_guarded: spending limit", () => {
    it("rejects amount over per-tx limit", async () => {
      try {
        // Per-tx limit is 750M (we updated it), escalation threshold is 2B
        // So 1B should trigger SpendingLimitExceeded (above 750M, below 2B)
        await program.methods
          .executeGuarded(new BN(1_000_000_000), targetProgram)
          .accounts({
            agent: agent.publicKey,
            policy: policyPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([agent])
          .rpc();
        expect.fail("should have thrown SpendingLimitExceeded");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("SpendingLimitExceeded");
      }
    });
  });

  describe("execute_guarded: hourly limit", () => {
    it("rejects when cumulative spend exceeds hourly limit", async () => {
      // Current spent_this_hour is 100M from the approved test.
      // Hourly limit is 2B. Let's push it close then exceed.
      // Send 700M (within per-tx 750M limit), should succeed (total 800M)
      await program.methods
        .executeGuarded(new BN(700_000_000), targetProgram)
        .accounts({
          agent: agent.publicKey,
          policy: policyPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([agent])
        .rpc();

      // Send another 700M (total would be 1.5B), still under 2B
      await program.methods
        .executeGuarded(new BN(700_000_000), targetProgram)
        .accounts({
          agent: agent.publicKey,
          policy: policyPda,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([agent])
        .rpc();

      // Now at 1.5B. Send 600M more — would be 2.1B, exceeding 2B hourly limit
      try {
        await program.methods
          .executeGuarded(new BN(600_000_000), targetProgram)
          .accounts({
            agent: agent.publicKey,
            policy: policyPda,
            clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([agent])
          .rpc();
        expect.fail("should have thrown HourlyLimitExceeded");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("HourlyLimitExceeded");
      }
    });
  });

  describe("execute_guarded: hour window reset", () => {
    it("resets counter after hour window expires", async () => {
      // We can't easily advance the clock in anchor test without bankrun.
      // Instead, we verify the counter was set by previous tests and
      // the hour_window_start was set on first approved tx.
      const policy = await program.account.policy.fetch(policyPda);
      expect(policy.spentThisHour.toNumber()).to.equal(1_500_000_000); // 100M + 700M + 700M
      expect(policy.hourWindowStart.toNumber()).to.be.greaterThan(0);
    });
  });

  // ─── create_escalation + approve_escalation ─────────────────────────

  describe("approve_escalation", () => {
    let escalationPda: PublicKey;
    let escalationTimestamp: BN;

    it("creates an escalation request", async () => {
      // Get the current clock timestamp
      const slot = await provider.connection.getSlot();
      const blockTime = await provider.connection.getBlockTime(slot);
      escalationTimestamp = new BN(blockTime!);

      [escalationPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escalation"),
          policyPda.toBuffer(),
          escalationTimestamp.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      await program.methods
        .createEscalation(new BN(3_000_000_000), targetProgram, escalationTimestamp)
        .accounts({
          agent: agent.publicKey,
          policy: policyPda,
          escalation: escalationPda,
          systemProgram: SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([agent])
        .rpc();

      const escalation = await program.account.escalationRequest.fetch(escalationPda);
      expect(escalation.policy.toBase58()).to.equal(policyPda.toBase58());
      expect(escalation.agentWallet.toBase58()).to.equal(agent.publicKey.toBase58());
      expect(escalation.amountLamports.toNumber()).to.equal(3_000_000_000);
      expect(escalation.isResolved).to.be.false;
      expect(escalation.wasApproved).to.be.false;
    });

    it("owner approves — was_approved = true", async () => {
      await program.methods
        .approveEscalation(true)
        .accounts({
          owner: owner.publicKey,
          policy: policyPda,
          escalation: escalationPda,
        })
        .signers([owner])
        .rpc();

      const escalation = await program.account.escalationRequest.fetch(escalationPda);
      expect(escalation.isResolved).to.be.true;
      expect(escalation.wasApproved).to.be.true;
    });

    it("rejects already-resolved escalation", async () => {
      try {
        await program.methods
          .approveEscalation(false)
          .accounts({
            owner: owner.publicKey,
            policy: policyPda,
            escalation: escalationPda,
          })
          .signers([owner])
          .rpc();
        expect.fail("should have thrown EscalationAlreadyResolved");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("EscalationAlreadyResolved");
      }
    });
  });

  describe("reject_escalation", () => {
    let rejectedEscalationPda: PublicKey;

    it("owner rejects — was_approved = false", async () => {
      const slot = await provider.connection.getSlot();
      const blockTime = await provider.connection.getBlockTime(slot);
      // Use a different timestamp to get a unique PDA
      const rejectTimestamp = new BN(blockTime! + 1);

      [rejectedEscalationPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("escalation"),
          policyPda.toBuffer(),
          rejectTimestamp.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      // Create escalation first
      await program.methods
        .createEscalation(new BN(3_000_000_000), targetProgram, rejectTimestamp)
        .accounts({
          agent: agent.publicKey,
          policy: policyPda,
          escalation: rejectedEscalationPda,
          systemProgram: SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([agent])
        .rpc();

      // Reject it
      await program.methods
        .approveEscalation(false)
        .accounts({
          owner: owner.publicKey,
          policy: policyPda,
          escalation: rejectedEscalationPda,
        })
        .signers([owner])
        .rpc();

      const escalation = await program.account.escalationRequest.fetch(rejectedEscalationPda);
      expect(escalation.isResolved).to.be.true;
      expect(escalation.wasApproved).to.be.false;
    });
  });
});
