use anchor_lang::prelude::*;
use crate::errors::SentinelError;
use crate::events::PolicyUpdated;
use crate::state::{Policy, MAX_WHITELISTED_PROGRAMS};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeParams {
    pub max_tx_lamports: u64,
    pub max_hourly_lamports: u64,
    pub whitelisted_programs: Vec<Pubkey>,
    pub escalation_threshold_lamports: u64,
}

#[derive(Accounts)]
pub struct InitializeGuardrail<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub agent_wallet: SystemAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = Policy::SPACE,
        seeds = [b"policy", agent_wallet.key().as_ref()],
        bump,
    )]
    pub policy: Account<'info, Policy>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_guardrail(ctx: Context<InitializeGuardrail>, params: InitializeParams) -> Result<()> {
    require!(
        params.whitelisted_programs.len() <= MAX_WHITELISTED_PROGRAMS,
        SentinelError::TooManyPrograms
    );

    let policy = &mut ctx.accounts.policy;
    policy.owner = ctx.accounts.owner.key();
    policy.agent_wallet = ctx.accounts.agent_wallet.key();
    policy.max_tx_lamports = params.max_tx_lamports;
    policy.max_hourly_lamports = params.max_hourly_lamports;
    policy.whitelisted_programs = params.whitelisted_programs;
    policy.escalation_threshold_lamports = params.escalation_threshold_lamports;
    policy.spent_this_hour = 0;
    policy.hour_window_start = 0;
    policy.is_active = true;
    policy.bump = ctx.bumps.policy;

    emit!(PolicyUpdated {
        owner: policy.owner,
        agent: policy.agent_wallet,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
