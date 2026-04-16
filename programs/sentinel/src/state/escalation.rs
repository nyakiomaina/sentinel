use anchor_lang::prelude::*;

#[account]
pub struct EscalationRequest {
    pub policy: Pubkey,
    pub agent_wallet: Pubkey,
    pub amount_lamports: u64,
    pub target_program: Pubkey,
    pub created_at: i64,
    pub is_resolved: bool,
    pub was_approved: bool,
    pub bump: u8,
}

impl EscalationRequest {
    pub const SPACE: usize =
        8   // anchor discriminator
        + 32  // policy
        + 32  // agent_wallet
        + 8   // amount_lamports
        + 32  // target_program
        + 8   // created_at
        + 1   // is_resolved
        + 1   // was_approved
        + 1;  // bump
}
