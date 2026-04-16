use anchor_lang::prelude::*;
use crate::errors::SentinelError;
use crate::events::EscalationResolved;
use crate::state::{Policy, EscalationRequest};

#[derive(Accounts)]
pub struct ApproveEscalation<'info> {
    pub owner: Signer<'info>,

    #[account(
        has_one = owner @ SentinelError::Unauthorized,
    )]
    pub policy: Account<'info, Policy>,

    #[account(
        mut,
        constraint = escalation.policy == policy.key(),
    )]
    pub escalation: Account<'info, EscalationRequest>,
}

pub fn approve_escalation(ctx: Context<ApproveEscalation>, approved: bool) -> Result<()> {
    let escalation = &mut ctx.accounts.escalation;

    require!(!escalation.is_resolved, SentinelError::EscalationAlreadyResolved);

    escalation.is_resolved = true;
    escalation.was_approved = approved;

    emit!(EscalationResolved {
        escalation_id: escalation.key(),
        approved,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
