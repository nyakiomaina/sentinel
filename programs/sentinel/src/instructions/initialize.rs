use anchor_lang::prelude::*;
use crate::state::Policy;

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
        space = Policy::space(),
        seeds = [b"policy", agent_wallet.key().as_ref()],
        bump,
    )]
    pub policy: Account<'info, Policy>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_guardrail(ctx: Context<InitializeGuardrail>, params: InitializeParams) -> Result<()> {
    // TODO: initialize the `Policy` PDA with the provided policy config fields.
    // TODO: set `owner`, `agent_wallet`, and `bump`.
    // TODO: validate invariants via `Policy::validate()`.
    Ok(())
}
