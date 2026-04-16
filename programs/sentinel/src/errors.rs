use anchor_lang::prelude::*;

#[error_code]
pub enum SentinelError {
    #[msg("Transaction exceeds per-transaction spending limit")]
    SpendingLimitExceeded,
    #[msg("Transaction would exceed hourly spending limit")]
    HourlyLimitExceeded,
    #[msg("Target program is not in the whitelist")]
    ProgramNotWhitelisted,
    #[msg("Transaction amount exceeds escalation threshold — human approval required")]
    EscalationRequired,
    #[msg("Escalation request has already been resolved")]
    EscalationAlreadyResolved,
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Policy is currently inactive")]
    PolicyInactive,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Whitelisted programs list exceeds maximum allowed")]
    TooManyPrograms,
}
