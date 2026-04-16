use anchor_lang::prelude::*;
use crate::errors::SentinelError;
use crate::events::EscalationCreated;
use crate::state::{EscalationRequest, Policy};

#[derive(Accounts)]
#[instruction(amount_lamports: u64, target_program: Pubkey, seed_timestamp: i64)]
pub struct CreateEscalation<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(
        seeds = [b"policy", agent.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, Policy>,

    #[account(
        init,
        payer = agent,
        space = EscalationRequest::SPACE,
        seeds = [b"escalation", policy.key().as_ref(), &seed_timestamp.to_le_bytes()],
        bump,
    )]
    pub escalation: Account<'info, EscalationRequest>,

    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn create_escalation(
    ctx: Context<CreateEscalation>,
    amount_lamports: u64,
    target_program: Pubkey,
    _seed_timestamp: i64,
) -> Result<()> {
    let policy = &ctx.accounts.policy;

    require!(policy.is_active, SentinelError::PolicyInactive);
    require!(
        amount_lamports > policy.escalation_threshold_lamports,
        SentinelError::InvalidAmount
    );

    let on_chain_time = ctx.accounts.clock.unix_timestamp;

    let escalation = &mut ctx.accounts.escalation;
    escalation.policy = policy.key();
    escalation.agent_wallet = ctx.accounts.agent.key();
    escalation.amount_lamports = amount_lamports;
    escalation.target_program = target_program;
    escalation.created_at = on_chain_time;
    escalation.is_resolved = false;
    escalation.was_approved = false;
    escalation.bump = ctx.bumps.escalation;

    emit!(EscalationCreated {
        agent: ctx.accounts.agent.key(),
        amount: amount_lamports,
        escalation_id: escalation.key(),
        timestamp: on_chain_time,
    });

    Ok(())
}
