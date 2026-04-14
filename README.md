# Sentinel

Open-source on-chain policy enforcement for AI agent wallets on Solana.

## Problem

AI agents can transact faster than humans can monitor. When an agent wallet is compromised, misconfigured, or simply behaves unexpectedly, it can move funds before the owner notices.

## Solution

Sentinel is an on-chain enforcement layer that sits between an AI agent wallet and the actions it wants to take. The owner configures explicit policy constraints (spending limits, hourly caps, and program allowlists). Each agent action is checked on-chain in a strict order; high-risk actions can be held for explicit owner approval via an escalation flow.
