use anchor_lang::prelude::*;

#[error_code]
pub enum SentinelError {
    SpendingLimitExceeded,
    HourlyLimitExceeded,
    ProgramNotWhitelisted,
    EscalationRequired,
    EscalationAlreadyResolved,
    Unauthorized,
    PolicyInactive,
    InvalidAmount,
}
