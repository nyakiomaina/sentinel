use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("14u1yjdjLfn8cfAwBd5e6Av4fdG1sKifhJXAv1XVworo");

#[program]
pub mod sentinel {
    use super::*;

    pub fn initialize_guardrail(
        ctx: Context<InitializeGuardrail>,
        params: InitializeParams,
    ) -> Result<()> {
        instructions::initialize::initialize_guardrail(ctx, params)
    }

    pub fn update_policy(ctx: Context<UpdatePolicy>, params: UpdateParams) -> Result<()> {
        instructions::update_policy::update_policy(ctx, params)
    }

    pub fn execute_guarded(
        ctx: Context<ExecuteGuarded>,
        amount_lamports: u64,
        target_program: Pubkey,
    ) -> Result<()> {
        instructions::execute_guarded::execute_guarded(ctx, amount_lamports, target_program)
    }

    pub fn create_escalation(
        ctx: Context<CreateEscalation>,
        amount_lamports: u64,
        target_program: Pubkey,
        seed_timestamp: i64,
    ) -> Result<()> {
        instructions::create_escalation::create_escalation(ctx, amount_lamports, target_program, seed_timestamp)
    }

    pub fn approve_escalation(
        ctx: Context<ApproveEscalation>,
        approved: bool,
    ) -> Result<()> {
        instructions::approve_escalation::approve_escalation(ctx, approved)
    }
}

