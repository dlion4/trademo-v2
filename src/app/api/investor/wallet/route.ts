import { NextResponse } from "next/server";
import { z } from "zod";

import {
  filterTransactions,
  newestFirst,
  withRunningBalance,
  type WalletWorkspace,
} from "@/lib/investor/wallet";
import { getWalletWorkspace } from "@/server/services/investor-wallet-service";

export const dynamic = "force-dynamic";

const sections = [
  "workspace",
  "balance",
  "lifetime",
  "transactions",
  "payouts",
  "recent-payouts",
  "methods",
  "depositRails",
  "payoutRails",
  "limits",
  "preferences",
  "exports",
  "profile",
  "audit",
] as const;

const schema = z
  .object({
    section: z.enum(sections).default("workspace"),
    type: z
      .enum(["deposit", "investment", "earning", "payout", "fee", "refund"])
      .optional(),
    method: z.string().max(30).optional(),
    from: z.string().max(10).optional(),
    to: z.string().max(10).optional(),
    q: z.string().max(60).optional(),
    page: z.coerce.number().int().min(1).max(50).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
    limit: z.coerce.number().int().min(1).max(25).optional(),
  })
  .strict();

/**
 * Read-only projection for the I-7 wallet page.
 *
 * There is deliberately no write handler: deposits, payout requests and saved
 * methods are validated and stored as an audited local preview, so mutations
 * answer 405. The eventual writes are `POST /api/wallet/deposit`,
 * `POST /api/wallet/payout`, `POST /api/wallet/payment-methods`,
 * `DELETE /api/wallet/payment-methods/:id` and
 * `POST /api/wallet/payment-methods/:id/default`.
 */
export function GET(request: Request) {
  const json = (value: unknown, status = 200) =>
    NextResponse.json(value, {
      status,
      headers: { "Cache-Control": "no-store" },
    });

  const url = new URL(request.url);
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (seen.has(key))
      return json({ error: `Duplicate query parameter: ${key}` }, 400);
    seen.add(key);
  }

  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success)
    return json({ error: "Invalid query", issues: parsed.error.issues }, 400);

  const query = parsed.data;
  const workspace: WalletWorkspace = getWalletWorkspace();
  const filters = {
    types: query.type ? [query.type] : [],
    methods: query.method ? [query.method] : [],
    from: query.from ?? "",
    to: query.to ?? "",
    query: query.q ?? "",
  };

  switch (query.section) {
    case "balance":
      return json(workspace.balance);
    case "lifetime":
      return json(workspace.lifetime);
    case "transactions": {
      const rows = newestFirst(
        filterTransactions(workspace.transactions, filters),
      ).map((row) => ({ ...row }));
      if (!query.page && !query.pageSize) return json(rows);
      const pageSize = query.pageSize ?? 10;
      const page = query.page ?? 1;
      const start = (page - 1) * pageSize;
      return json({
        page,
        pageSize,
        total: rows.length,
        hasMore: start + pageSize < rows.length,
        rows: rows.slice(start, start + pageSize),
      });
    }
    case "payouts":
      return json({
        all: workspace.payouts,
        recent: workspace.payouts.slice(0, query.limit ?? 5),
      });
    case "recent-payouts":
      return json(workspace.payouts.slice(0, query.limit ?? 5));
    case "methods":
      return json(workspace.methods);
    case "depositRails":
      return json(workspace.depositRails);
    case "payoutRails":
      return json(workspace.payoutRails);
    case "limits":
      return json(workspace.limits);
    case "preferences":
      return json(workspace.preferences);
    case "exports":
      return json(workspace.exports);
    case "profile":
      return json(workspace.profile);
    case "audit":
      return json(workspace.audit);
    default:
      return json({
        ...workspace,
        transactions: withRunningBalance(
          workspace.transactions,
          workspace.balance.openingBalance,
        ),
      });
  }
}
