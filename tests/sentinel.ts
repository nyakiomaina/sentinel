import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

describe("sentinel", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // TODO: load IDL and create program client
  const program = {} as Program;

  const owner = Keypair.generate();
  const agent = Keypair.generate();
  const targetProgram = new PublicKey("11111111111111111111111111111111");

  describe("initialize_guardrail", () => {
    it("creates policy, verifies all fields", async () => {
      // TODO: call initialize_guardrail
      // TODO: fetch policy PDA and assert all fields
      void program;
      void owner;
      void agent;
      void targetProgram;
    });
  });

  describe("update_policy", () => {
    it("updates limits, verifies changes", async () => {
      // TODO
    });
  });

  describe("execute_guarded: approved", () => {
    it("tx within limits passes", async () => {
      // TODO
    });
  });

  describe("execute_guarded: spending limit", () => {
    it("tx over limit blocked", async () => {
      // TODO
    });
  });

  describe("execute_guarded: hourly limit", () => {
    it("cumulative over limit blocked", async () => {
      // TODO
    });
  });

  describe("execute_guarded: whitelist", () => {
    it("non-whitelisted program blocked", async () => {
      // TODO
    });
  });

  describe("execute_guarded: escalation", () => {
    it("large tx creates EscalationRequest", async () => {
      // TODO
    });
  });

  describe("approve_escalation", () => {
    it("owner approves, is_resolved set", async () => {
      // TODO
    });
  });

  describe("reject_escalation", () => {
    it("owner rejects, was_approved false", async () => {
      // TODO
    });
  });
});

