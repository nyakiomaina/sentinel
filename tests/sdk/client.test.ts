import { describe, it } from "mocha";
import { expect } from "chai";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import { SentinelClient } from "../../sdk/src/client";

describe("SentinelClient", () => {
  it("constructs", async () => {
    const client = new SentinelClient(new Connection("https://api.devnet.solana.com"), Keypair.generate());
    expect(client).to.be.ok;
  });

  it("initialize returns placeholder", async () => {
    const client = new SentinelClient(new Connection("https://api.devnet.solana.com"), Keypair.generate());
    const sig = await client.initialize(new PublicKey("11111111111111111111111111111111"), {
      maxTxLamports: { toString: () => "0" } as any,
      maxHourlyLamports: { toString: () => "0" } as any,
      whitelistedPrograms: [],
      escalationThresholdLamports: { toString: () => "0" } as any,
    });
    expect(sig).to.equal("TODO");
  });
});

