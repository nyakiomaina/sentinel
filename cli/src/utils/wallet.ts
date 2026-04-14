import { readFileSync } from "node:fs";

import { Keypair } from "@solana/web3.js";

export function loadKeypairFromFile(filePath: string): Keypair {
  const raw = readFileSync(filePath, "utf8");
  const secret = Uint8Array.from(JSON.parse(raw) as number[]);
  return Keypair.fromSecretKey(secret);
}

