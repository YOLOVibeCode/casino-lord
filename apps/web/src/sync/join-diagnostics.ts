export interface JoinTrace {
  at: string;
  event: string;
  detail?: string;
}

export interface JoinDiagnosticReport {
  phase: string;
  tableCode: string;
  href: string;
  syncUrl: string;
  online: boolean;
  connectionState: string;
  rejectReason: string | null;
  playerId: string | null;
  traces: JoinTrace[];
  userAgent: string;
}

export function createJoinTrace(event: string, detail?: string): JoinTrace {
  const trace: JoinTrace = { at: new Date().toISOString(), event };
  if (detail !== undefined && detail !== "") {
    trace.detail = detail;
  }
  return trace;
}

export function appendJoinTrace(traces: JoinTrace[], event: string, detail?: string): JoinTrace[] {
  return [...traces.slice(-39), createJoinTrace(event, detail)];
}

export function formatJoinDiagnostics(report: JoinDiagnosticReport): string {
  const lines = [
    `phase=${report.phase}`,
    `table=${report.tableCode}`,
    `href=${report.href}`,
    `syncUrl=${report.syncUrl}`,
    `online=${report.online ? "yes" : "no"}`,
    `connection=${report.connectionState}`,
    `reject=${report.rejectReason ?? "-"}`,
    `playerId=${report.playerId ?? "-"}`,
    `ua=${report.userAgent}`,
    "traces:",
    ...report.traces.map((t) => `${t.at} ${t.event}${t.detail ? ` ${t.detail}` : ""}`),
  ];
  return lines.join("\n");
}
