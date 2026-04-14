use anchor_lang::prelude::*;

/// Emitted when an agent action passes all guardrail checks.
#[event]
pub struct TransactionApproved {
    pub agent: Pubkey,
    pub amount: u64,
    pub target_program: Pubkey,
    pub timestamp: i64,
}

/// Emitted when an agent action is blocked by any guardrail.
#[event]
pub struct TransactionBlocked {
    pub agent: Pubkey,
    pub amount: u64,
    pub reason: String,
    pub timestamp: i64,
}

/// Emitted when a high-value action creates an escalation request.
#[event]
pub struct EscalationCreated {
    pub agent: Pubkey,
    pub amount: u64,
    pub escalation_id: Pubkey,
    pub timestamp: i64,
}

/// Emitted when an owner approves or rejects an escalation.
#[event]
pub struct EscalationResolved {
    pub escalation_id: Pubkey,
    pub approved: bool,
    pub timestamp: i64,
}

/// Emitted when a policy is created or updated.
#[event]
pub struct PolicyUpdated {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub timestamp: i64,
}
