use anchor_lang::prelude::*;
use crate::state::Policy;

/// Optional-field update. Only provided fields are changed.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateParams {
    pub max_tx_lamports: Option<u64>,
    pub max_hourly_lamports: Option<u64>,
    pub whitelisted_programs: Option<Vec<Pubkey>>,
    pub escalation_threshold_lamports: Option<u64>,
    pub is_active: Option<bool>,
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
    )]
    pub policy: Account<'info, Policy>,
}

pub fn update_policy(ctx: Context<UpdatePolicy>, params: UpdateParams) -> Result<()> {
    // TODO: verify signer matches `policy.owner`.
    // TODO: update only provided fields.
    // TODO: validate invariants via `Policy::validate()`.
    // TODO: emit `PolicyUpdated`.
    Ok(())
}
