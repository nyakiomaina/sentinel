use anchor_lang::prelude::*;
use crate::state::Policy;

#[derive(Accounts)]
#[instruction(amount_lamports: u64, target_program: Pubkey)]
pub struct ExecuteGuarded<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [b"policy", agent.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, Policy>,

    pub clock: Sysvar<'info, Clock>,
}

pub fn execute_guarded(
    ctx: Context<ExecuteGuarded>,
    amount_lamports: u64,
    target_program: Pubkey,
) -> Result<()> {
    // TODO: check active
    // TODO: check whitelist
    // TODO: check escalation threshold
    // TODO: check tx limit
    // TODO: reset/check hourly window
    // TODO: update counter
    // TODO: emit event
    Ok(())
}
