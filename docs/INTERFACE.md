# Sentinel Interface Contract

Both team members build against this. Never change without telling each other first.

## Policy account (on-chain state)

```rust
// Rust — programs/sentinel/src/state/policy.rs
pub struct Policy {
    pub owner: Pubkey,                        // wallet that controls this policy
    pub agent_wallet: Pubkey,                 // the agent being guarded
    pub max_tx_lamports: u64,                 // max per single transaction
    pub max_hourly_lamports: u64,             // rolling 1-hour cap
    pub spent_this_hour: u64,                 // running total this window
    pub hour_window_start: i64,               // unix timestamp of window start
    pub whitelisted_programs: Vec<Pubkey>,    // allowed CPI targets
    pub escalation_threshold_lamports: u64,   // hold tx if above this
    pub is_active: bool,                      // owner can pause
    pub bump: u8,                             // PDA bump seed
}
```

```typescript
// TypeScript mirror — sdk/src/types.ts
export interface Policy {
  owner: PublicKey
  agentWallet: PublicKey
  maxTxLamports: BN
  maxHourlyLamports: BN
  spentThisHour: BN
  hourWindowStart: BN
  whitelistedPrograms: PublicKey[]
  escalationThresholdLamports: BN
  isActive: boolean
  bump: number
}
```

## PDA derivation

```
Policy PDA:      seeds = ["policy", agent_wallet.pubkey]
Escalation PDA:  seeds = ["escalation", policy.pubkey, timestamp_as_le_bytes]
```

## Instructions

### `initialize_guardrail`

```
Accounts:  owner (Signer, mut), agent_wallet (SystemAccount),
           policy (Account<Policy>, init, PDA), system_program
Params:    max_tx_lamports, max_hourly_lamports,
           whitelisted_programs, escalation_threshold_lamports
Success:   Policy PDA created, is_active = true
Emits:     PolicyUpdated
```

### `update_policy`

```
Accounts:  owner (Signer, must match policy.owner), policy (mut)
Params:    all Policy config fields as Option<T> — only update provided
Success:   Policy fields updated
Emits:     PolicyUpdated
```

### `execute_guarded`

```
Accounts:  agent (Signer, must match policy.agent_wallet),
           policy (mut), clock (Sysvar<Clock>),
           escalation (init_if_needed)
Params:    amount_lamports: u64, target_program: Pubkey

Check order (strictly in this sequence):
  1. policy.is_active == true               → else PolicyInactive
  2. target_program in whitelisted_programs → else ProgramNotWhitelisted
  3. amount > escalation_threshold          → create EscalationRequest, EscalationRequired
  4. amount > max_tx_lamports               → SpendingLimitExceeded
  5. if clock.unix_timestamp > hour_window_start + 3600 → reset counter
  6. spent_this_hour + amount > max_hourly  → HourlyLimitExceeded
  7. update spent_this_hour += amount
  8. emit TransactionApproved

On any error: emit TransactionBlocked { reason: error_string }
```

### `approve_escalation`

```
Accounts:  owner (Signer, must match policy.owner),
           policy, escalation (mut)
Params:    approved: bool
Success:   escalation.is_resolved = true, escalation.was_approved = approved
Emits:     EscalationResolved
```

## Events

```typescript
// sdk/src/types.ts — AuditEvent union type
type AuditEvent =
  | { type: "TransactionApproved"; agent: PublicKey; amount: BN; targetProgram: PublicKey; timestamp: number }
  | { type: "TransactionBlocked";  agent: PublicKey; amount: BN; reason: string; timestamp: number }
  | { type: "EscalationCreated";   agent: PublicKey; amount: BN; escalationId: PublicKey; timestamp: number }
  | { type: "EscalationResolved";  escalationId: PublicKey; approved: boolean; timestamp: number }
  | { type: "PolicyUpdated";       owner: PublicKey; agent: PublicKey; timestamp: number }
```

## AI policy parser — Claude tool schema

```typescript
// sdk/src/ai/policyParser.ts
// Claude receives natural language, must return this exact shape
{
  max_tx_lamports: number,           // e.g. 500_000_000 for 0.5 SOL
  max_hourly_lamports: number,
  whitelisted_programs: string[],    // base58 pubkeys or known names
  escalation_threshold_lamports: number
}

// Known program name → pubkey map (expand as needed)
const KNOWN_PROGRAMS = {
  "jupiter":   "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  "raydium":   "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "orca":      "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  "marinade":  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
}
```

## CLI commands reference

```bash
sentinel connect --keypair ~/.config/solana/id.json
sentinel protect <AGENT_ADDRESS> "only trade on Jupiter, max 0.5 SOL per tx, max 2 SOL per hour"
sentinel status <AGENT_ADDRESS>
sentinel update <AGENT_ADDRESS> "increase hourly limit to 5 SOL"
sentinel escalations list <AGENT_ADDRESS>
sentinel escalations approve <ESCALATION_ID>
sentinel escalations reject <ESCALATION_ID>
sentinel status <AGENT_ADDRESS> --network mainnet-beta
```

## SDK usage reference

```typescript
import { SentinelClient } from "@sentinel-protocol/sdk"
import { Connection, Keypair } from "@solana/web3.js"
import BN from "bn.js"

const connection = new Connection("https://api.devnet.solana.com")
const wallet = Keypair.fromSecretKey(/* your key */)
const sentinel = new SentinelClient(connection, wallet)

await sentinel.initialize(
  agentWallet.publicKey,
  "only trade on Jupiter, max 0.5 SOL per tx, max 2 SOL per hour"
)

await sentinel.executeGuarded(agentWallet.publicKey, targetProgram, 1_000_000)

const policy = await sentinel.getPolicy(agentWallet.publicKey)
const log = await sentinel.getAuditLog(agentWallet.publicKey, 20)
const pending = await sentinel.getPendingEscalations(agentWallet.publicKey)
await sentinel.approveEscalation(escalationId, true)
```
