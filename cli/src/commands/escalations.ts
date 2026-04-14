import { Command } from "commander";
import { Connection, PublicKey } from "@solana/web3.js";

import { SentinelClient } from "@sentinel-protocol/sdk";

import { readConfig } from "../utils/config";
import { loadKeypairFromFile } from "../utils/wallet";
import { printError, printEscalationTable, printSuccess } from "../utils/display";

export function registerEscalationsCommand(program: Command) {
  const cmd = program.command("escalations").description("Manage pending escalations");

  cmd
    .command("list")
    .description("List pending escalations for an agent")
    .argument("<agentAddress>", "Agent wallet address")
    .action(async (agentAddress: string) => {
      const cfg = readConfig();
      if (!cfg) {
        printError("Not connected. Run `sentinel connect --keypair <path>` first.");
        process.exitCode = 1;
        return;
      }

      const wallet = loadKeypairFromFile(cfg.keypairPath);
      const connection = new Connection("https://api.devnet.solana.com");
      const client = new SentinelClient(connection, wallet);

      const escalations = await client.getPendingEscalations(new PublicKey(agentAddress));
      printEscalationTable(escalations);
    });

  cmd
    .command("approve")
    .description("Approve a held escalation")
    .argument("<escalationId>", "Escalation PDA address")
    .action(async (escalationId: string) => {
      const cfg = readConfig();
      if (!cfg) {
        printError("Not connected. Run `sentinel connect --keypair <path>` first.");
        process.exitCode = 1;
        return;
      }

      const wallet = loadKeypairFromFile(cfg.keypairPath);
      const connection = new Connection("https://api.devnet.solana.com");
      const client = new SentinelClient(connection, wallet);

      const sig = await client.approveEscalation(new PublicKey(escalationId), true);
      printSuccess(`Escalation approved. Tx: ${sig}`);
    });

  cmd
    .command("reject")
    .description("Reject a held escalation")
    .argument("<escalationId>", "Escalation PDA address")
    .action(async (escalationId: string) => {
      const cfg = readConfig();
      if (!cfg) {
        printError("Not connected. Run `sentinel connect --keypair <path>` first.");
        process.exitCode = 1;
        return;
      }

      const wallet = loadKeypairFromFile(cfg.keypairPath);
      const connection = new Connection("https://api.devnet.solana.com");
      const client = new SentinelClient(connection, wallet);

      const sig = await client.approveEscalation(new PublicKey(escalationId), false);
      printSuccess(`Escalation rejected. Tx: ${sig}`);
    });
}

