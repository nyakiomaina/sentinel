import { Command } from "commander";
import { Connection, PublicKey } from "@solana/web3.js";

import { SentinelClient } from "@sentinel-protocol/sdk";

import { readConfig } from "../utils/config";
import { loadKeypairFromFile } from "../utils/wallet";
import { printError, printSuccess } from "../utils/display";

export function registerUpdateCommand(program: Command) {
  program
    .command("update")
    .description('Update an agent policy with new natural-language rules')
    .argument("<agentAddress>", "Agent wallet address")
    .argument("<rules>", 'New natural-language rules (wrap in quotes)')
    .action(async (agentAddress: string, rules: string) => {
      const cfg = readConfig();
      if (!cfg) {
        printError("Not connected. Run `sentinel connect --keypair <path>` first.");
        process.exitCode = 1;
        return;
      }

      const wallet = loadKeypairFromFile(cfg.keypairPath);
      const connection = new Connection("https://api.devnet.solana.com");
      const client = new SentinelClient(connection, wallet);

      // TODO: parse rules into structured updates and call updatePolicy.
      const sig = await client.updatePolicy(new PublicKey(agentAddress), {});
      printSuccess(`Policy update submitted. Tx: ${sig}`);
      void rules;
    });
}

