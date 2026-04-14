import chalk from "chalk";
import Table from "cli-table3";

import type { AuditEvent, EscalationRequest, Policy } from "@sentinel-protocol/sdk";

export function printPolicySummary(policy: Policy): void {
  const table = new Table({ head: ["Field", "Value"] });
  table.push(
    ["Owner", policy.owner.toBase58()],
    ["Agent", policy.agentWallet.toBase58()],
    ["Max / tx", policy.maxTxLamports.toString()],
    ["Max / hour", policy.maxHourlyLamports.toString()],
    ["Spent this hour", policy.spentThisHour.toString()],
    ["Escalation threshold", policy.escalationThresholdLamports.toString()],
    ["Whitelisted", policy.whitelistedPrograms.map((p) => p.toBase58()).join(", ")],
    ["Active", policy.isActive ? chalk.green("yes") : chalk.red("no")],
  );
  console.log(table.toString());
}

export function printAuditTable(events: AuditEvent[]): void {
  const table = new Table({ head: ["Time", "Action", "Amount", "Result"] });

  for (const e of events) {
    if (e.type === "TransactionApproved") {
      table.push([new Date(e.timestamp * 1000).toISOString(), "execute_guarded", e.amount.toString(), chalk.green("APPROVED")]);
    } else if (e.type === "TransactionBlocked") {
      table.push([new Date(e.timestamp * 1000).toISOString(), "execute_guarded", e.amount.toString(), chalk.red(`BLOCKED: ${e.reason}`)]);
    } else if (e.type === "EscalationCreated") {
      table.push([new Date(e.timestamp * 1000).toISOString(), "escalation", e.amount.toString(), chalk.yellow("ESCALATION")]);
    } else if (e.type === "EscalationResolved") {
      table.push([new Date(e.timestamp * 1000).toISOString(), "escalation", "-", e.approved ? chalk.green("APPROVED") : chalk.red("REJECTED")]);
    } else if (e.type === "PolicyUpdated") {
      table.push([new Date(e.timestamp * 1000).toISOString(), "policy", "-", "UPDATED"]);
    }
  }

  console.log(table.toString());
}

export function printEscalationTable(escalations: EscalationRequest[]): void {
  const table = new Table({ head: ["ID", "Amount", "Target", "Time"] });
  for (const e of escalations) {
    table.push([
      e.policy.toBase58(),
      e.amountLamports.toString(),
      e.targetProgram.toBase58(),
      new Date(Number(e.createdAt.toString()) * 1000).toISOString(),
    ]);
  }
  console.log(table.toString());
}

export function printSuccess(message: string): void {
  console.log(chalk.green(message));
}

export function printError(message: string): void {
  console.error(chalk.red(message));
}

