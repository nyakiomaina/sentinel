# Sentinel

**On-chain policy enforcement for AI agents on Solana.**

AI agents on Solana trade on DEXs, manage LP positions, and move capital at
machine speed. Today they hold a keypair and can sign *anything*. Sentinel is
an open-source Anchor program that sits between an agent and the runtime and
validates every action against a configurable policy — *before* it executes.

## The four guardrails

| # | Guardrail | What it does |
|---|-----------|--------------|
| 1 | **Spending limits** | Per-tx cap + rolling hourly cap, reset via Solana's clock sysvar. |
| 2 | **Program whitelist** | Agent can only invoke programs the owner has approved (e.g. Jupiter, Raydium). |
| 3 | **On-chain audit log** | Every check emits an `ActionApproved` / `ActionBlocked` event — verifiable, indexable. |
| 4 | **Escalation threshold** | Actions above a defined size are held; the owner must issue an `EscalationTicket` PDA before they can execute. |

Plus a pause kill-switch and `has_one` owner checks on every mutating call.

## Architecture

```
┌────────────────┐     plain English       ┌──────────────────┐
│   Owner (human)│────────rule────────────▶│  @sentinel/ai    │
└────────────────┘                         │ (Claude tool-use)│
                                           └────────┬─────────┘
                                                    │ PolicySpec
                                                    ▼
┌────────────────┐   guard(amount, target)  ┌──────────────────┐
│  AI Agent      │──────────────────────────▶│ Sentinel program │
│ (any framework)│◀──── throws if blocked ──│  (Anchor, Rust)  │
└────────────────┘                           └────────┬─────────┘
       ▲                                              │ emits
       │ proceeds only if approved                    ▼
       │                                    ┌──────────────────┐
       └────── real swap / LP / transfer ──▶│  Solana runtime  │
                                            └──────────────────┘
```

## Repository layout

```
programs/sentinel/   Anchor program — the four guardrails
sdk/                 @sentinel/sdk — one-line TypeScript integration
ai/                  @sentinel/ai  — plain-English → PolicySpec compiler
demo/                End-to-end demo agent
tests/               Anchor integration tests
```

## One-line integration

```ts
import { Sentinel } from "@sentinel/sdk";

const sentinel = await Sentinel.load(connection, wallet, policyPda, idl);

// Before every agent action:
await sentinel.guard({ amount: 50_000_000n, targetProgram: JUPITER });
// ...proceed with the real swap...
```

If Sentinel blocks the action, `guard` throws — agents **fail closed** by
default. The guard call itself lands on-chain, updates the rolling counter,
and emits an audit event.

## Plain-English configuration

```ts
import { PolicyCompiler } from "@sentinel/ai";

const compiler = new PolicyCompiler({ apiKey: process.env.ANTHROPIC_API_KEY! });
const spec = await compiler.compile(
  "my agent trades on Jupiter with a max of 500 USDC per hour, " +
  "max 100 USDC per tx, and anything above 250 USDC must be escalated"
);

await Sentinel.initialize(connection, wallet, agentPubkey, spec, idl);
```

The compiler uses Claude with a strict tool-use schema, so the LLM is
*forced* to return a typed `PolicySpec` — it cannot emit free-form text or
hallucinate program IDs outside a fixed allowlist. An offline regex fallback
(`compileOffline`) is included for deterministic tests and demos.

## Build & test

```bash
pnpm install
anchor build
anchor test
pnpm --filter @sentinel/demo start   # requires solana-test-validator
```

## Why Solana

Sub-cent transaction fees mean per-action policy checking adds negligible
cost to every agent operation. On Ethereum each guardrail check would cost
dollars, making this model impractical at scale. Solana's clock sysvar also
gives Sentinel a free, deterministic rolling window without oracles.

## Public good

Sentinel is reusable infrastructure, not an application. Any developer
building an AI agent on Solana — whether using Solana Agent Kit, a custom
keypair setup, or any other framework — can integrate Sentinel with a single
function call. One open-source security primitive the whole Solana agent
ecosystem can build on, audit, and extend.

## License

Apache-2.0
