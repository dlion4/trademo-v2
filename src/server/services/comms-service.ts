import { getInvestorManagerBundle } from "./investor-manager-service";
import { getAnalyticsSource } from "./analytics-service";
import { audiencePlan, assertCommsInvariant } from "@/lib/comms/model";
import type { CommsBundle, Campaign, CommsTemplate } from "@/lib/comms/types";
export function getCommsBundle(): CommsBundle {
  const roster = getInvestorManagerBundle(),
    pools = getAnalyticsSource().pools;
  const asOf = "2026-10-23T08:45:00Z";
  const contacts = roster.investors.map((i, index) => ({
    id: i.id,
    name: i.name,
    email: i.email,
    status: i.status,
    packages: i.holdings.map((h) => h.packageCode),
    primaryPackage: i.holdings[0]?.packageCode ?? "No active package",
    packageStartDate:
      pools
        .find((p) => p.code === i.holdings[0]?.packageCode)
        ?.startsAt.slice(0, 10) ?? "Not scheduled",
    packageStartDates: Object.fromEntries(
      i.holdings.map((h) => [
        h.packageCode,
        pools.find((p) => p.code === h.packageCode)?.startsAt.slice(0, 10) ??
          "Not scheduled",
      ]),
    ),
    investment: i.holdings.reduce((n, h) => n + h.capital, 0),
    earnings: i.holdings.reduce((n, h) => n + h.profit, 0),
    wallet: i.wallet.available,
    consent: {
      in_app: true,
      email: index % 7 !== 0,
      telegram: index % 4 === 0,
      sms: index % 5 === 0,
    },
  }));
  const definitions = [
    [
      "Welcome to tradeMO",
      "Welcome to tradeMO, {name}",
      "Hi {name},\n\nWelcome to tradeMO. Your recorded investment is **{investment}** in {package}. Review your allocation and account permissions before trading begins on {packageStartDate}.\n\nCapital is at risk; returns are not guaranteed.",
      "Onboarding",
    ],
    [
      "Package Booking Confirmation",
      "Your {package} booking review",
      "Hi {name},\n\nYour recorded investment is {investment}. Check your package terms and the scheduled start date, {packageStartDate}.\n\n- Review your capital allocation\n- Confirm your beneficiary details securely\n\n[View packages](/dashboard/packages)",
      "Packages",
    ],
    [
      "Trading Started",
      "{package} trading-cycle update",
      "Hi {name},\n\nThe recorded start date for {package} is {packageStartDate}. Your allocation is {investment}.\n\nWe will share execution and settlement updates. Trading outcomes and returns are not guaranteed.",
      "Packages",
    ],
    [
      "Weekly Earnings Update",
      "{name}, your earnings review",
      "Hi {name},\n\nYour recorded earnings are **{earnings}** ({roi} on recorded investment). Available wallet balance: {wallet}. Earned profit is not necessarily settled cash.\n\n[Review analytics](/dashboard/analytics)",
      "Reports",
    ],
    [
      "Payout Processed",
      "Your payout status review",
      "Hi {name},\n\nReview your payout request and provider reference in the payout desk. Your available wallet record is {wallet}. This message does not establish a bank settlement.\n\n[Payout operations](/dashboard/withdrawals)",
      "Payments",
    ],
    [
      "Guardian Alert",
      "{package} risk-control notice",
      "Hi {name},\n\nA risk-control review has been requested for {package}. Check the execution ledger and current mandate before taking action.\n\nThis notice does not guarantee that losses were prevented.",
      "Risk",
    ],
    [
      "Package Completed",
      "{package} cycle settlement review",
      "Hi {name},\n\nThe {package} cycle is ready for settlement review. Recorded earnings: {earnings}. Confirm the final ledger and eligibility before requesting a payout.\n\n[View treasury](/dashboard/funds)",
      "Packages",
    ],
    [
      "KYC Review Outcome",
      "Your account verification review",
      "Hi {name},\n\nYour verification submission has a review update. Check your account for the specific decision and any required documents. Never share passwords or private keys in a message.\n\n[Investor roster](/dashboard/investors)",
      "Compliance",
    ],
  ];
  const templates: CommsTemplate[] = definitions.map(
    ([name, subject, body, category], i) => ({
      id: `tpl_${i + 1}`,
      name,
      subject,
      body,
      category,
      version: 1,
      updatedAt: "2026-10-20T09:00:00Z",
    }),
  );
  const subjects = [
    "Question about PKG-03 payout",
    "Need to update bank details",
    "Thanks for the earnings update",
    "When will this cycle settle?",
    "Understanding my wallet balance",
    "Please explain the latest risk notice",
    "Package allocation question",
    "KYC document follow-up",
  ];
  const threads = contacts.slice(0, 16).map((c, i) => {
    const updatedAt = new Date(
      Date.parse(asOf) - (i * 36 + 4) * 60000,
    ).toISOString();
    const replied = i % 5 === 2;
    return {
      id: `thread_${i + 1}`,
      contactId: c.id,
      subject: subjects[i % 8].replace("PKG-03", c.packages[0] ?? "package"),
      pool: c.packages[0] ?? "none",
      status:
        i === 15
          ? ("archived" as const)
          : replied
            ? ("replied" as const)
            : i % 3 === 0
              ? ("unread" as const)
              : ("read" as const),
      updatedAt,
      posts: [
        {
          id: `post_${i}_in`,
          time: new Date(Date.parse(updatedAt) - 300000).toISOString(),
          direction: "incoming" as const,
          body:
            i % 8 === 1
              ? "I need to update my bank details. What is the secure process? I will not send credentials in chat."
              : "Could you clarify my package cycle and payout timing? I would like to review the current ledger before taking action.",
          state: "received" as const,
        },
        ...(replied
          ? [
              {
                id: `post_${i}_out`,
                time: updatedAt,
                direction: "outgoing" as const,
                body: "Please review the package and settlement desk. Final payout timing depends on eligibility and provider confirmation; no returns or timing are guaranteed.",
                state: "queued_demo" as const,
              },
            ]
          : []),
      ],
    };
  });
  const s: CommsBundle = {
    mode: "demo",
    asOf,
    revision: 0,
    contacts,
    pools: roster.pools.map((p) => ({ code: p.code, name: p.name })),
    templates,
    threads,
    campaigns: [],
    deliveries: [],
    tests: [],
    channelConfig: {
      in_app: { enabled: true, label: "In-app demo queue" },
      email: { enabled: true, label: "Email demo adapter" },
      telegram: { enabled: false, label: "Telegram not configured" },
      sms: { enabled: false, label: "SMS not configured" },
    },
    audit: [
      {
        id: "comms_opening",
        time: asOf,
        action: "snapshot",
        reference: "opening_snapshot",
        detail:
          "Synthetic communication and engagement records; no provider connection.",
        revision: 0,
      },
    ],
  };
  for (let index = 0; index < 12; index++) {
    const t = templates[[2, 5, 3, 0, 1, 4, 6, 7][index % 8]],
      createdAt = new Date(
        Date.parse(asOf) - index * 2 * 86400000 - 3600000,
      ).toISOString();
    const campaign: Campaign = {
      id: `camp_seed_${index + 1}`,
      type:
        index < 3
          ? "announcement"
          : index % 3 === 0
            ? "trade_result"
            : index % 3 === 1
              ? "report"
              : "guardian",
      status: "simulated",
      createdAt,
      scheduledFor: null,
      subject:
        index === 0
          ? "PKG-01 Trading Started"
          : index === 1
            ? "Guardian review — package operations"
            : index === 2
              ? "Monthly earnings review"
              : t.subject,
      body: t.body,
      audience:
        index % 3 === 0
          ? { type: "packages", ids: [], packages: ["PKG-01"] }
          : { type: "all", ids: [], packages: [] },
      channels: index % 2 === 0 ? ["in_app", "email"] : ["in_app"],
      templateId: t.id,
      templateVersion: t.version,
      templateName: "",
      saveTemplate: false,
      contactIds: [],
      parentId: null,
    };
    const plan = audiencePlan(s, campaign);
    campaign.contactIds = [...new Set(plan.rows.map((r) => r.contactId))];
    s.campaigns.push(campaign);
    plan.rows.forEach((r, j) => {
      const delivered = j % 19 !== 18;
      const open =
        delivered && (index === 0 ? j < plan.rows.length - 2 : j % 5 !== 0);
      s.deliveries.push({
        id: `seed_delivery_${index}_${j}`,
        campaignId: campaign.id,
        contactId: r.contactId,
        channel: r.channel,
        status: delivered ? "delivered" : "failed",
        attempts: 1,
        createdAt,
        deliveredAt: delivered
          ? new Date(Date.parse(createdAt) + 10000).toISOString()
          : null,
        openedAt: open
          ? new Date(Date.parse(createdAt) + 60000).toISOString()
          : null,
        clickedAt:
          open && j % 4 === 0
            ? new Date(Date.parse(createdAt) + 90000).toISOString()
            : null,
        repliedAt:
          delivered && r.channel === "in_app" && j % 3 === 0
            ? new Date(Date.parse(createdAt) + 120000).toISOString()
            : null,
        failure: delivered ? null : "seeded_provider_failure",
      });
    });
  }
  for (const [k, status, date] of [
    ["draft", "draft", null],
    ["due", "scheduled", "2026-10-23T08:00:00Z"],
    ["future", "scheduled", "2026-10-24T17:00:00Z"],
  ] as const) {
    s.campaigns.push({
      id: `camp_${k}`,
      type: "report",
      status,
      createdAt: "2026-10-22T15:00:00Z",
      scheduledFor: date,
      subject: "Cycle settlement follow-up for {name}",
      body: templates[3].body,
      audience: { type: "all", ids: [], packages: [] },
      channels: ["in_app"],
      templateId: templates[3].id,
      templateVersion: templates[3].version,
      templateName: "",
      saveTemplate: false,
      contactIds: [],
      parentId: null,
    });
  }
  assertCommsInvariant(s);
  return s;
}
