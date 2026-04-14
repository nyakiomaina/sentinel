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
        // TODO: create a new `Policy` PDA for `agent_wallet` with the requested limits/whitelist.
        instructions::initialize::initialize_guardrail(ctx, params)
    }

    pub fn update_policy(ctx: Context<UpdatePolicy>, params: UpdateParams) -> Result<()> {
        // TODO: owner-only update to a policy; apply only provided fields and emit `PolicyUpdated`.
        instructions::update_policy::update_policy(ctx, params)
    }

    pub fn execute_guarded(
        ctx: Context<ExecuteGuarded>,
        amount_lamports: u64,
        target_program: Pubkey,
    ) -> Result<()> {
        // TODO: enforce the policy check order and emit `TransactionApproved` or `TransactionBlocked`.
        instructions::execute_guarded::execute_guarded(ctx, amount_lamports, target_program)
    }

    pub fn approve_escalation(
        ctx: Context<ApproveEscalation>,
        approved: bool,
    ) -> Result<()> {
        // TODO: owner resolves an escalation request and emits `EscalationResolved`.
        instructions::approve_escalation::approve_escalation(ctx, approved)
    }
}

