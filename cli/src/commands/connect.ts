import { Command } from "commander";
import { existsSync } from "node:fs";

import { writeConfig } from "../utils/config";
import { loadKeypairFromFile } from "../utils/wallet";
import { printError, printSuccess } from "../utils/display";

export function registerConnectCommand(program: Command) {
  program
    .command("connect")
    .description("Connect a wallet for Sentinel CLI usage")
    .requiredOption("--keypair <path>", "Path to Solana keypair JSON")
    .action((opts: { keypair: string }) => {
      const keypairPath = opts.keypair;
      if (!existsSync(keypairPath)) {
        printError(`Keypair file not found: ${keypairPath}`);
        process.exitCode = 1;
        return;
      }

      // TODO: validate the file is a valid Solana keypair JSON.
      const kp = loadKeypairFromFile(keypairPath);
      writeConfig({ keypairPath });
      printSuccess(`Connected wallet: ${kp.publicKey.toBase58()}`);
    });
}

