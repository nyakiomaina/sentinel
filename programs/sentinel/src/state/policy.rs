use anchor_lang::prelude::*;
use crate::errors::SentinelError;

pub const MAX_WHITELISTED_PROGRAMS: usize = 20;

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
    pub const SPACE: usize =
        8   // discriminator
        + 32  // owner
        + 32  // agent_wallet
        + 8   // max_tx_lamports
        + 8   // max_hourly_lamports
        + 8   // spent_this_hour
        + 8   // hour_window_start
        + 4 + (32 * MAX_WHITELISTED_PROGRAMS) // whitelisted_programs
        + 8   // escalation_threshold_lamports
        + 1   // is_active
        + 1;  // bump

    pub fn validate(&self) -> Result<()> {
        require!(
            self.whitelisted_programs.len() <= MAX_WHITELISTED_PROGRAMS,
            SentinelError::TooManyPrograms
        );
        Ok(())
    }
}
