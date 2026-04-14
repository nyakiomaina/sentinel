import { Keypair } from "@solana/web3.js";

async function main() {
  // TODO: generate and fund a test agent wallet, then print its pubkey.
  const kp = Keypair.generate();
  console.log(kp.publicKey.toBase58());
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();

