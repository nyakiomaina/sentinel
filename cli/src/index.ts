import { Command } from "commander";
import { readFileSync } from "node:fs";
import path from "node:path";

import { registerProtectCommand } from "./commands/protect";
import { registerStatusCommand } from "./commands/status";
import { registerUpdateCommand } from "./commands/update";
import { registerEscalationsCommand } from "./commands/escalations";
import { registerConnectCommand } from "./commands/connect";

function readVersion(): string {
  const pkgPath = path.join(__dirname, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version ?? "0.0.0";
}

export type Network = "devnet" | "mainnet-beta";

export interface GlobalOptions {
  network: Network;
  keypair?: string;
}

export async function main(argv: string[]) {
  const program = new Command();

  program
    .name("sentinel")
    .description("Sentinel CLI — protect AI agent wallets from your terminal")
    .version(readVersion())
    .option("--network <network>", "devnet|mainnet-beta", "devnet")
    .option("--keypair <path>", "Path to Solana keypair JSON");

  registerConnectCommand(program);
  registerProtectCommand(program);
  registerStatusCommand(program);
  registerUpdateCommand(program);
  registerEscalationsCommand(program);

  await program.parseAsync(argv);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main(process.argv);

