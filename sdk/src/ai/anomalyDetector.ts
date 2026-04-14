import type { AuditEvent } from "../types";

export interface AnomalyAlert {
  kind: string;
  message: string;
}

export async function detectAnomalies(events: AuditEvent[]): Promise<AnomalyAlert[]> {
  // TODO: analyze audit log and return anomaly alerts.
  void events;
  return [];
}

