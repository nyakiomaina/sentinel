import { Command } from "commander";
import { Connection, PublicKey } from "@solana/web3.js";

import { SentinelClient } from "@sentinel-protocol/sdk";

import { readConfig } from "../utils/config";
import { loadKeypairFromFile } from "../utils/wallet";
import { printError, printSuccess } from "../utils/display";

export function registerProtectCommand(program: Command) {
  program
    .command("protect")
    .description('Protect an agent wallet with a natural-language policy')
    .argument("<agentAddress>", "Agent wallet address")
    .argument("<rules>", 'Natural-language rules (wrap in quotes)')
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

      // TODO: call `SentinelClient.initialize()` with natural language string.
      const sig = await client.initialize(new PublicKey(agentAddress), rules);
      printSuccess(`Agent protected. Tx: ${sig}`);
      // TODO: print parsed rules summary and policy PDA.
    });
}

