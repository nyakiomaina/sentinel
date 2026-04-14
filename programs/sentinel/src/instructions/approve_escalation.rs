use anchor_lang::prelude::*;
use crate::state::{Policy, EscalationRequest};

#[derive(Accounts)]
pub struct ApproveEscalation<'info> {
    pub owner: Signer<'info>,

    #[account(
        has_one = owner,
    )]
    pub policy: Account<'info, Policy>,

    #[account(
        mut,
        constraint = escalation.policy == policy.key(),
    )]
    pub escalation: Account<'info, EscalationRequest>,
}

pub fn approve_escalation(ctx: Context<ApproveEscalation>, approved: bool) -> Result<()> {
    // TODO: verify owner matches `policy.owner`.
    // TODO: check escalation not already resolved.
    // TODO: set resolved fields.
    // TODO: emit `EscalationResolved`.
    Ok(())
}
