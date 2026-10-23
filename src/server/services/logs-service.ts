import { ledgerTrades } from "./trade-log-service";
import { getDepositLogsBundle } from "./deposits-service";
import { getPayoutBundle } from "./payouts-service";
import { getInvestorManagerBundle } from "./investor-manager-service";
import { getCommsBundle } from "./comms-service";
import { assertLogs } from "@/lib/logs/model";
import type { AuditEvent, LogsBundle, SystemKind } from "@/lib/logs/types";
export function getAuditLogsBundle(): LogsBundle {
  const roster = getInvestorManagerBundle(),
    asOf = "2026-10-23T10:00:00Z";
  const events: AuditEvent[] = [];
  const add = (
    e: Pick<
      AuditEvent,
      "id" | "createdAt" | "category" | "action" | "target" | "details"
    > &
      Partial<AuditEvent>,
  ) => {
    events.push({
      severity: "info",
      actorId: "service_platform",
      actorName: "Platform service",
      actorType: "service",
      investorId: null,
      ipAddress: "Server / masked fixture",
      userAgent: "tradeMO synthetic service",
      correlationId: `corr_${e.id}`,
      source: "seeded",
      metadata: {},
      systemKind: null,
      ...e,
    });
  };
  for (const t of ledgerTrades)
    add({
      id: `log_${t.id}`,
      createdAt: t.executedAt,
      category: "trade",
      action: t.isWin ? "contract_won" : "contract_lost",
      target: t.packageCode,
      details: `${t.botName} · ${t.symbol} · ${t.contractLabel} · contract ${t.derivContractId}`,
      actorId: t.botId,
      actorName: t.botName,
      actorType: "bot",
      metadata: {
        contractId: t.derivContractId,
        stake: t.stake,
        profit: t.profit,
        symbol: t.symbol,
        bot: t.botName,
        schedule: t.scheduleId,
        package: t.packageCode,
      },
    });
  for (const d of getDepositLogsBundle().deposits)
    add({
      id: `log_${d.id}`,
      createdAt: d.verifiedAt ?? d.submittedAt,
      category: "deposit",
      action: `deposit_${d.status}`,
      target: d.id,
      details: `${d.investorName} · ${d.amount} USD · ${d.method} · ${d.pool}`,
      investorId: d.investorId,
      actorId: d.verifiedBy ?? d.investorId,
      actorName: d.verifiedBy ?? d.investorName,
      actorType: d.verifiedBy ? "operator" : "investor",
      severity: d.status === "failed" ? "warning" : "info",
      metadata: {
        amount: d.amount,
        method: d.method,
        reference: d.reference,
        package: d.pool,
        status: d.status,
      },
    });
  for (const p of getPayoutBundle().requests)
    add({
      id: `log_${p.id}`,
      createdAt: p.completedAt ?? p.requestedAt,
      category: "payout",
      action: `payout_${p.status}`,
      target: p.id,
      details: `${p.investorName} · ${p.amount} USD · ${p.method}`,
      investorId: p.investorId,
      actorId: p.investorId,
      actorName: p.investorName,
      actorType: "investor",
      severity: p.status === "failed" ? "warning" : "info",
      metadata: {
        amount: p.amount,
        fee: p.fee,
        method: p.method,
        status: p.status,
        providerOutcome: p.providerOutcome,
      },
    });
  const sessions: LogsBundle["sessions"] = [];
  roster.investors.forEach((investor, i) => {
    for (let k = 0; k < 4; k++) {
      const createdAt = new Date(
        Date.parse(asOf) - (i * 8 + k * 3 + 15) * 60000,
      ).toISOString();
      const action = [
        "login_success",
        "login_failed",
        "two_factor_passed",
        "password_reset_requested",
      ][k];
      add({
        id: `log_auth_${i}_${k}`,
        createdAt,
        category: "auth",
        action,
        target: `session_${i}`,
        details:
          k === 1
            ? "Invalid password in synthetic login attempt; no credentials retained."
            : k === 2
              ? "Authenticator challenge passed in fixture."
              : k === 3
                ? "Password reset requested; no real email sent."
                : "Seeded investor session established with 2FA.",
        actorId: investor.id,
        actorName: investor.name,
        actorType: "investor",
        investorId: investor.id,
        ipAddress: i % 2 ? "196.•••.•••.42" : "41.•••.•••.18",
        userAgent: "Mozilla/5.0 (synthetic browser)",
        severity: k === 1 ? (i % 9 === 0 ? "critical" : "warning") : "info",
        correlationId: `corr_session_${i}`,
        metadata: {
          sessionId: `session_${i}`,
          twoFactor: k !== 1,
          outcome: k === 1 ? "failed" : "observed",
        },
      });
    }
    sessions.push({
      id: `session_${i}`,
      investorId: investor.id,
      actorName: investor.name,
      createdAt: new Date(
        Date.parse(asOf) - (i * 8 + 20) * 60000,
      ).toISOString(),
      lastSeen: new Date(Date.parse(asOf) - (i * 8 + 10) * 60000).toISOString(),
      ipAddress: "41.•••.•••.18",
      state: "active",
    });
  });
  for (const c of getCommsBundle().campaigns)
    add({
      id: `log_comms_${c.id}`,
      createdAt: c.createdAt,
      category: "comm",
      action: `communication_${c.status}`,
      target: c.id,
      details: c.subject,
      actorId: "operator_seed",
      actorName: "Seed operator",
      actorType: "operator",
      metadata: {
        type: c.type,
        channels: c.channels.join(","),
        contacts: c.contactIds.length,
        state: c.status,
      },
    });
  const systemCounts: [SystemKind, number][] = [
    ["guardian", 10],
    ["reconciliation", 5],
    ["backup_daily", 7],
    ["backup_weekly", 4],
    ["cron", 50],
    ["webhook_failure", 10],
  ];
  for (const [kind, count] of systemCounts)
    for (let i = 0; i < count; i++) {
      const createdAt = new Date(
        Date.parse(asOf) -
          (kind === "backup_daily"
            ? i * 1440 + 80
            : kind === "backup_weekly"
              ? i * 10080 + 90
              : i * 17 + 30) *
            60000,
      ).toISOString();
      add({
        id: `log_${kind}_${i}`,
        createdAt,
        category: "system",
        action: kind,
        target:
          kind === "guardian"
            ? `PKG-0${(i % 3) + 1}`
            : kind === "webhook_failure"
              ? `delivery_demo_${i}`
              : kind === "cron"
                ? "reconcile_provider_records"
                : `run_demo_${kind}_${i}`,
        details:
          kind === "guardian"
            ? "Risk guard fixture: consecutive-loss threshold triggered a five-minute pause."
            : kind === "reconciliation"
              ? "Synthetic ledger check completed; observed difference USD 0.00."
              : kind.startsWith("backup")
                ? "Seeded backup manifest observation only; no actual storage object is exposed."
                : kind === "webhook_failure"
                  ? "Synthetic signed-webhook processing failure; inspect retry evidence before recovery."
                  : "Recorded cron fixture completed; no background job is executed by this page.",
        severity:
          kind === "guardian"
            ? "critical"
            : kind === "webhook_failure"
              ? "warning"
              : "info",
        systemKind: kind,
        correlationId:
          kind === "webhook_failure"
            ? `corr_webhook_${i}`
            : `corr_system_${kind}_${i}`,
        metadata: {
          outcome:
            kind === "webhook_failure"
              ? "failed"
              : kind === "guardian"
                ? "triggered"
                : "completed",
          durationMs: 120 + i * 17,
          differenceUsd: kind === "reconciliation" ? 0 : null,
          storageObject: kind.startsWith("backup")
            ? `demo-manifest/${createdAt.slice(0, 10)}`
            : null,
        },
      });
    }
  const api: LogsBundle["api"] = Array.from({ length: 150 }, (_, i) => {
    const webhook = i >= 100;
    const paths = [
      "/api/trades/buy",
      "/api/dashboard/workspace",
      "/api/deposits",
      "/api/comms",
      "/webhooks/stripe",
      "/webhooks/deriv",
    ];
    const path = webhook ? paths[4 + (i % 2)] : paths[i % 4],
      status =
        i % 17 === 0 ? 500 : i % 13 === 0 ? 429 : i % 4 === 0 ? 201 : 200,
      id = `api_access_${i}`,
      eventId = `log_${id}`,
      createdAt = new Date(Date.parse(asOf) - (i + 5) * 60000).toISOString();
    add({
      id: eventId,
      createdAt,
      category: "system",
      action: webhook ? "webhook_access" : "api_access",
      target: path,
      details: `${webhook || i % 4 === 0 ? "POST" : "GET"} ${path} · ${status} · ${12 + (i % 137)}ms`,
      severity: status >= 500 ? "critical" : status >= 400 ? "warning" : "info",
      correlationId: webhook ? `corr_webhook_${i % 10}` : `corr_api_${i}`,
      metadata: {
        method: webhook || i % 4 === 0 ? "POST" : "GET",
        status,
        latencyMs: 12 + (i % 137),
        direction: webhook ? "webhook" : "internal",
      },
    });
    return {
      id,
      createdAt,
      method: webhook || i % 4 === 0 ? "POST" : "GET",
      path,
      status,
      latencyMs: 12 + (i % 137),
      actor: webhook ? "External fixture" : "Internal fixture",
      direction: webhook ? "webhook" : "internal",
      eventId,
    };
  });
  const s: LogsBundle = {
    mode: "demo",
    asOf,
    revision: 0,
    events: events.sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    ),
    investors: roster.investors.map((i) => ({ id: i.id, name: i.name })),
    api,
    sessions,
    reviews: [],
    retries: [],
    archives: [
      {
        id: "archive_seed_october",
        createdAt: "2026-10-01T01:00:00Z",
        eventIds: events
          .filter((e) => e.createdAt.startsWith("2026-09"))
          .map((e) => e.id),
        from: "2026-09-01",
        to: "2026-09-30",
        reason: "Seeded prior-month manifest, not an actual cloud archive.",
        state: "manifest_only",
      },
    ],
    holds: [],
    retention: {
      financialYears: 7,
      authYears: 1,
      systemDays: 90,
      auditYears: 7,
      commYears: 7,
    },
    views: [],
    financialReceipts: ledgerTrades.map((t) => ({
      id: t.id,
      executedAt: t.executedAt,
      profit: t.profit,
      stake: t.stake,
      packageCode: t.packageCode,
    })),
  };
  assertLogs(s);
  return s;
}
