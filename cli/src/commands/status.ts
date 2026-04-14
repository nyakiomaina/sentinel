import { Command } from "commander";
import { Connection, PublicKey } from "@solana/web3.js";

import { SentinelClient } from "@sentinel-protocol/sdk";

import { readConfig } from "../utils/config";
import { loadKeypairFromFile } from "../utils/wallet";
import { printAuditTable, printError, printPolicySummary } from "../utils/display";

export function registerStatusCommand(program: Command) {
  program
    .command("status")
    .description("Show policy status and recent activity for an agent")
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

      // TODO: fetch Policy account data.
      const policy = await client.getPolicy(new PublicKey(agentAddress));
      // TODO: fetch last 20 audit events.
      const events = await client.getAuditLog(new PublicKey(agentAddress), 20);

      printPolicySummary(policy);
      printAuditTable(events);
      // TODO: print spending this hour vs limit and pending escalation count.
    });
}

