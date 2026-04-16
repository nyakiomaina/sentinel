use anchor_lang::prelude::*;
use crate::errors::SentinelError;
use crate::events::PolicyUpdated;
use crate::state::{Policy, MAX_WHITELISTED_PROGRAMS};

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
        has_one = owner @ SentinelError::Unauthorized,
    )]
    pub policy: Account<'info, Policy>,
}

pub fn update_policy(ctx: Context<UpdatePolicy>, params: UpdateParams) -> Result<()> {
    let policy = &mut ctx.accounts.policy;

    if let Some(max_tx) = params.max_tx_lamports {
        policy.max_tx_lamports = max_tx;
    }
    if let Some(max_hourly) = params.max_hourly_lamports {
        policy.max_hourly_lamports = max_hourly;
    }
    if let Some(programs) = params.whitelisted_programs {
        require!(
            programs.len() <= MAX_WHITELISTED_PROGRAMS,
            SentinelError::TooManyPrograms
        );
        policy.whitelisted_programs = programs;
    }
    if let Some(threshold) = params.escalation_threshold_lamports {
        policy.escalation_threshold_lamports = threshold;
    }
    if let Some(active) = params.is_active {
        policy.is_active = active;
    }

    emit!(PolicyUpdated {
        owner: policy.owner,
        agent: policy.agent_wallet,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
