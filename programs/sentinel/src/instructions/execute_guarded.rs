use anchor_lang::prelude::*;
use crate::errors::SentinelError;
use crate::events::{TransactionApproved, TransactionBlocked};
use crate::state::Policy;

#[derive(Accounts)]
#[instruction(amount_lamports: u64, target_program: Pubkey)]
pub struct ExecuteGuarded<'info> {
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
    let policy = &mut ctx.accounts.policy;
    let agent = ctx.accounts.agent.key();
    let timestamp = ctx.accounts.clock.unix_timestamp;

    // 1. Policy must be active
    if !policy.is_active {
        emit!(TransactionBlocked {
            agent,
            amount: amount_lamports,
            reason: "Policy inactive".to_string(),
            timestamp,
        });
        return err!(SentinelError::PolicyInactive);
    }

    // 2. Amount must be > 0
    if amount_lamports == 0 {
        emit!(TransactionBlocked {
            agent,
            amount: 0,
            reason: "Amount must be greater than zero".to_string(),
            timestamp,
        });
        return err!(SentinelError::InvalidAmount);
    }

    // 3. Target program must be whitelisted
    if !policy.whitelisted_programs.contains(&target_program) {
        emit!(TransactionBlocked {
            agent,
            amount: amount_lamports,
            reason: "Program not whitelisted".to_string(),
            timestamp,
        });
        return err!(SentinelError::ProgramNotWhitelisted);
    }

    // 4. Escalation threshold (checked BEFORE spending limits)
    if amount_lamports > policy.escalation_threshold_lamports {
        emit!(TransactionBlocked {
            agent,
            amount: amount_lamports,
            reason: "Escalation required".to_string(),
            timestamp,
        });
        return err!(SentinelError::EscalationRequired);
    }

    // 5. Per-transaction limit
    if amount_lamports > policy.max_tx_lamports {
        emit!(TransactionBlocked {
            agent,
            amount: amount_lamports,
            reason: "Exceeds per-tx limit".to_string(),
            timestamp,
        });
        return err!(SentinelError::SpendingLimitExceeded);
    }

    // 6. Reset hour window if expired
    if timestamp > policy.hour_window_start.checked_add(3600).ok_or(SentinelError::InvalidAmount)? {
        policy.spent_this_hour = 0;
        policy.hour_window_start = timestamp;
    }

    // 7. Hourly limit
    let new_total = policy
        .spent_this_hour
        .checked_add(amount_lamports)
        .ok_or(SentinelError::InvalidAmount)?;
    if new_total > policy.max_hourly_lamports {
        emit!(TransactionBlocked {
            agent,
            amount: amount_lamports,
            reason: "Exceeds hourly limit".to_string(),
            timestamp,
        });
        return err!(SentinelError::HourlyLimitExceeded);
    }

    // 8. Update counter
    policy.spent_this_hour = new_total;

    // 9. Approve
    emit!(TransactionApproved {
        agent,
        amount: amount_lamports,
        target_program,
        timestamp,
    });

    Ok(())
}
