//! Sentinel — on-chain policy enforcement for AI agents on Solana.
//!
//! Sentinel sits between an AI agent and the Solana runtime. Every agent
//! action is checked against a configurable on-chain policy before it can
//! execute. Four guardrails are enforced:
//!
//!   1. Spending limits (per-tx + rolling hourly cap)
//!   2. Program whitelist (agent can only touch approved programs)
//!   3. On-chain audit log (every check emitted as an event)
//!   4. Escalation threshold (large actions held for owner approval)

use anchor_lang::prelude::*;

declare_id!("14u1yjdjLfn8cfAwBd5e6Av4fdG1sKifhJXAv1XVworo");

const MAX_WHITELIST: usize = 16;
const HOUR_SECONDS: i64 = 3_600;

#[program]
pub mod sentinel {
    use super::*;

    /// Initialize a policy account for an agent. Called once by the owner.
    pub fn initialize_policy(
        ctx: Context<InitializePolicy>,
        agent: Pubkey,
        max_per_tx: u64,
        max_per_hour: u64,
        escalation_threshold: u64,
        whitelist: Vec<Pubkey>,
    ) -> Result<()> {
        require!(whitelist.len() <= MAX_WHITELIST, SentinelError::WhitelistTooLarge);
        require!(max_per_tx <= max_per_hour, SentinelError::InvalidLimits);

        let policy = &mut ctx.accounts.policy;
        policy.owner = ctx.accounts.owner.key();
        policy.agent = agent;
        policy.max_per_tx = max_per_tx;
        policy.max_per_hour = max_per_hour;
        policy.escalation_threshold = escalation_threshold;
        policy.whitelist_len = whitelist.len() as u8;
        for (i, p) in whitelist.iter().enumerate() {
            policy.whitelist[i] = *p;
        }
        policy.window_start = Clock::get()?.unix_timestamp;
        policy.window_spent = 0;
        policy.total_actions = 0;
        policy.total_blocked = 0;
        policy.paused = false;
        policy.bump = ctx.bumps.policy;

        emit!(PolicyInitialized {
            owner: policy.owner,
            agent: policy.agent,
            max_per_tx,
            max_per_hour,
            escalation_threshold,
        });
        Ok(())
    }

    /// Update policy parameters. Owner-only. The AI config layer calls this
    /// after parsing a natural-language rule into concrete parameters.
    pub fn update_policy(
        ctx: Context<UpdatePolicy>,
        max_per_tx: Option<u64>,
        max_per_hour: Option<u64>,
        escalation_threshold: Option<u64>,
        whitelist: Option<Vec<Pubkey>>,
        paused: Option<bool>,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        if let Some(v) = max_per_tx { policy.max_per_tx = v; }
        if let Some(v) = max_per_hour { policy.max_per_hour = v; }
        if let Some(v) = escalation_threshold { policy.escalation_threshold = v; }
        if let Some(v) = paused { policy.paused = v; }
        if let Some(list) = whitelist {
            require!(list.len() <= MAX_WHITELIST, SentinelError::WhitelistTooLarge);
            policy.whitelist = [Pubkey::default(); MAX_WHITELIST];
            policy.whitelist_len = list.len() as u8;
            for (i, p) in list.iter().enumerate() {
                policy.whitelist[i] = *p;
            }
        }
        require!(policy.max_per_tx <= policy.max_per_hour, SentinelError::InvalidLimits);

        emit!(PolicyUpdated {
            owner: policy.owner,
            agent: policy.agent,
            max_per_tx: policy.max_per_tx,
            max_per_hour: policy.max_per_hour,
            escalation_threshold: policy.escalation_threshold,
            paused: policy.paused,
        });
        Ok(())
    }

    /// Core guardrail. Agent calls this via CPI (or directly) immediately
    /// before performing its intended action. If Sentinel approves, the
    /// counter is updated and the caller proceeds. If not, the tx fails.
    ///
    /// * `amount`         — value the agent is about to move (lamports, token base units, USDC µ, etc.)
    /// * `target_program` — program the agent intends to invoke next
    pub fn check_action(
        ctx: Context<CheckAction>,
        amount: u64,
        target_program: Pubkey,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let now = Clock::get()?.unix_timestamp;

        // Guardrail 0: pause switch (owner kill-switch).
        if policy.paused {
            policy.total_blocked = policy.total_blocked.saturating_add(1);
            emit!(ActionBlocked {
                agent: policy.agent,
                amount,
                target_program,
                reason: BlockReason::Paused as u8,
                timestamp: now,
            });
            return err!(SentinelError::Paused);
        }

        // Guardrail 1a: per-tx cap.
        if amount > policy.max_per_tx {
            policy.total_blocked = policy.total_blocked.saturating_add(1);
            emit!(ActionBlocked {
                agent: policy.agent,
                amount,
                target_program,
                reason: BlockReason::PerTxExceeded as u8,
                timestamp: now,
            });
            return err!(SentinelError::PerTxExceeded);
        }

        // Guardrail 2: program whitelist.
        let wl_len = policy.whitelist_len as usize;
        let allowed = policy.whitelist[..wl_len].iter().any(|p| *p == target_program);
        if !allowed {
            policy.total_blocked = policy.total_blocked.saturating_add(1);
            emit!(ActionBlocked {
                agent: policy.agent,
                amount,
                target_program,
                reason: BlockReason::ProgramNotWhitelisted as u8,
                timestamp: now,
            });
            return err!(SentinelError::ProgramNotWhitelisted);
        }

        // Rolling window reset using Solana clock sysvar.
        if now.saturating_sub(policy.window_start) >= HOUR_SECONDS {
            policy.window_start = now;
            policy.window_spent = 0;
        }

        // Guardrail 1b: rolling hourly cap.
        let new_spent = policy.window_spent.saturating_add(amount);
        if new_spent > policy.max_per_hour {
            policy.total_blocked = policy.total_blocked.saturating_add(1);
            emit!(ActionBlocked {
                agent: policy.agent,
                amount,
                target_program,
                reason: BlockReason::HourlyExceeded as u8,
                timestamp: now,
            });
            return err!(SentinelError::HourlyExceeded);
        }

        // Guardrail 4: escalation threshold — large actions require a
        // pre-approved EscalationTicket from the owner.
        if amount >= policy.escalation_threshold {
            let ticket = ctx
                .accounts
                .escalation_ticket
                .as_ref()
                .ok_or(SentinelError::EscalationRequired)?;
            require_keys_eq!(ticket.policy, policy.key(), SentinelError::EscalationRequired);
            require!(!ticket.consumed, SentinelError::EscalationRequired);
            require!(ticket.amount >= amount, SentinelError::EscalationRequired);
            require_keys_eq!(ticket.target_program, target_program, SentinelError::EscalationRequired);
            require!(now <= ticket.expires_at, SentinelError::EscalationRequired);
            // Mark ticket consumed.
            let ticket_acct = ctx.accounts.escalation_ticket.as_mut().unwrap();
            ticket_acct.consumed = true;
        }

        // All checks passed — commit state + audit log.
        policy.window_spent = new_spent;
        policy.total_actions = policy.total_actions.saturating_add(1);

        emit!(ActionApproved {
            agent: policy.agent,
            amount,
            target_program,
            window_spent: policy.window_spent,
            timestamp: now,
        });
        Ok(())
    }

    /// Owner pre-approves a high-value action. Produces an EscalationTicket
    /// PDA the agent must present on its next `check_action` call.
    pub fn approve_escalation(
        ctx: Context<ApproveEscalation>,
        amount: u64,
        target_program: Pubkey,
        ttl_seconds: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let ticket = &mut ctx.accounts.ticket;
        ticket.policy = ctx.accounts.policy.key();
        ticket.amount = amount;
        ticket.target_program = target_program;
        ticket.expires_at = now.saturating_add(ttl_seconds);
        ticket.consumed = false;
        ticket.bump = ctx.bumps.ticket;

        emit!(EscalationApproved {
            policy: ticket.policy,
            amount,
            target_program,
            expires_at: ticket.expires_at,
        });
        Ok(())
    }

    /// Owner emergency pause.
    pub fn set_paused(ctx: Context<UpdatePolicy>, paused: bool) -> Result<()> {
        ctx.accounts.policy.paused = paused;
        emit!(PolicyPaused { policy: ctx.accounts.policy.key(), paused });
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(agent: Pubkey)]
pub struct InitializePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Policy::SIZE,
        seeds = [b"policy", owner.key().as_ref(), agent.as_ref()],
        bump,
    )]
    pub policy: Account<'info, Policy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    #[account(mut, has_one = owner @ SentinelError::Unauthorized)]
    pub policy: Account<'info, Policy>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct CheckAction<'info> {
    #[account(mut)]
    pub policy: Account<'info, Policy>,
    /// The agent signing the action. Must match policy.agent.
    #[account(constraint = agent.key() == policy.agent @ SentinelError::Unauthorized)]
    pub agent: Signer<'info>,
    /// Optional escalation ticket (required only for high-value actions).
    #[account(mut)]
    pub escalation_ticket: Option<Account<'info, EscalationTicket>>,
}

#[derive(Accounts)]
#[instruction(amount: u64, target_program: Pubkey)]
pub struct ApproveEscalation<'info> {
    #[account(mut, has_one = owner @ SentinelError::Unauthorized)]
    pub policy: Account<'info, Policy>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + EscalationTicket::SIZE,
        seeds = [
            b"ticket",
            policy.key().as_ref(),
            &amount.to_le_bytes(),
            target_program.as_ref(),
        ],
        bump,
    )]
    pub ticket: Account<'info, EscalationTicket>,
    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
pub struct Policy {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub max_per_tx: u64,
    pub max_per_hour: u64,
    pub escalation_threshold: u64,
    pub window_start: i64,
    pub window_spent: u64,
    pub total_actions: u64,
    pub total_blocked: u64,
    pub whitelist: [Pubkey; MAX_WHITELIST],
    pub whitelist_len: u8,
    pub paused: bool,
    pub bump: u8,
}

impl Policy {
    pub const SIZE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + (32 * MAX_WHITELIST) + 1 + 1 + 1;
}

#[account]
pub struct EscalationTicket {
    pub policy: Pubkey,
    pub amount: u64,
    pub target_program: Pubkey,
    pub expires_at: i64,
    pub consumed: bool,
    pub bump: u8,
}

impl EscalationTicket {
    pub const SIZE: usize = 32 + 8 + 32 + 8 + 1 + 1;
}

// ---------------------------------------------------------------------------
// Events (on-chain audit log)
// ---------------------------------------------------------------------------

#[event]
pub struct PolicyInitialized {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub max_per_tx: u64,
    pub max_per_hour: u64,
    pub escalation_threshold: u64,
}

#[event]
pub struct PolicyUpdated {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub max_per_tx: u64,
    pub max_per_hour: u64,
    pub escalation_threshold: u64,
    pub paused: bool,
}

#[event]
pub struct PolicyPaused {
    pub policy: Pubkey,
    pub paused: bool,
}

#[event]
pub struct ActionApproved {
    pub agent: Pubkey,
    pub amount: u64,
    pub target_program: Pubkey,
    pub window_spent: u64,
    pub timestamp: i64,
}

#[event]
pub struct ActionBlocked {
    pub agent: Pubkey,
    pub amount: u64,
    pub target_program: Pubkey,
    pub reason: u8,
    pub timestamp: i64,
}

#[event]
pub struct EscalationApproved {
    pub policy: Pubkey,
    pub amount: u64,
    pub target_program: Pubkey,
    pub expires_at: i64,
}

#[repr(u8)]
pub enum BlockReason {
    Paused = 1,
    PerTxExceeded = 2,
    HourlyExceeded = 3,
    ProgramNotWhitelisted = 4,
    EscalationRequired = 5,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum SentinelError {
    #[msg("Caller is not authorized for this policy")]
    Unauthorized,
    #[msg("Whitelist exceeds maximum size")]
    WhitelistTooLarge,
    #[msg("max_per_tx must be <= max_per_hour")]
    InvalidLimits,
    #[msg("Policy is paused by owner")]
    Paused,
    #[msg("Amount exceeds per-transaction limit")]
    PerTxExceeded,
    #[msg("Amount would exceed rolling hourly limit")]
    HourlyExceeded,
    #[msg("Target program is not whitelisted")]
    ProgramNotWhitelisted,
    #[msg("Action requires owner escalation approval")]
    EscalationRequired,
}
