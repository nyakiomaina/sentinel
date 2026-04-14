use anchor_lang::prelude::*;

/// On-chain policy account that governs what a specific AI agent wallet is
/// allowed to do.
#[account]
pub struct Policy {
    pub owner: Pubkey,
    pub agent_wallet: Pubkey,
    pub max_tx_lamports: u64,
    pub max_hourly_lamports: u64,
    pub spent_this_hour: u64,
    pub hour_window_start: i64,
    pub whitelisted_programs: Vec<Pubkey>,
    pub escalation_threshold_lamports: u64,
    pub is_active: bool,
    pub bump: u8,
}

impl Policy {
    pub const fn space() -> usize {
        // NOTE: this is a conservative size estimate for a variable-length Vec.
        // Business logic and precise sizing will be finalized in Phase 2.
        8  // discriminator
        + 32 // owner
        + 32 // agent_wallet
        + 8  // max_tx_lamports
        + 8  // max_hourly_lamports
        + 8  // spent_this_hour
        + 8  // hour_window_start
        + 4 + (32 * 32) // whitelisted_programs (assume up to 32 entries for now)
        + 8  // escalation_threshold_lamports
        + 1  // is_active
        + 1  // bump
    }

    pub fn validate(&self) -> Result<()> {
        Ok(())
    }
}
