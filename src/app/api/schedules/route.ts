import { NextResponse } from "next/server";

import type { CreateSchedulePayloadDTO } from "@/lib/schedules/types";
import * as desk from "@/server/services/dashboard-mock-service";
import * as scheduler from "@/server/services/schedules-mock-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  if (view === "bundle") {
    const year = Number(searchParams.get("year") ?? 2026);
    const month = Number(searchParams.get("month") ?? 9);
    return NextResponse.json(scheduler.getTradeSchedulerBundle(year, month));
  }
  return NextResponse.json(desk.getUpcomingSchedules());
}

export async function POST(request: Request) {
  const body = await request.json();

  // Support both D-2 full payload (`startTime` / `initialStake`) and D-1 legacy wizard (`executeAt` / `stake`)
  const normalized: CreateSchedulePayloadDTO = {
    name: body.name ?? "Martingale-R10-Evening",
    date: body.date ?? "2026-10-19",
    endDate: body.endDate ?? null,
    startTime: body.startTime ?? body.executeAt ?? "15:00",
    endTime: body.endTime ?? body.windowEnd ?? "16:00",
    symbol: body.symbol ?? "R_10",
    contractType: body.contractType,
    strategy: body.strategy ?? "Martingale",
    scriptRef: body.scriptRef ?? null,
    initialStake: Number(body.initialStake ?? body.stake ?? 35),
    maxTrades: Number(body.maxTrades ?? 8),
    packageCodes: body.packageCodes ?? body.packageIds ?? ["PKG-01", "PKG-02"],
    packageAllocation: body.packageAllocation ?? body.allocationSplit ?? { "PKG-01": 60, "PKG-02": 40 },
    recurrence:
      body.recurrence === "session_overlap" ? "weekdays" : (body.recurrence ?? "weekdays"),
    cronExpression: body.cronExpression ?? null,
    stopLoss: Number(body.stopLoss ?? 500),
    takeProfit: Number(body.takeProfit ?? 1000),
    maxDrawdown: Number(body.maxDrawdown ?? 5.0),
    cooldownLosses: Number(body.cooldownLosses ?? 3),
    cooldownDurationSec: Number(body.cooldownDurationSec ?? body.cooldownDuration ?? 300),
    assignedBotCode: body.assignedBotCode,
    runImmediately: Boolean(body.runImmediately),
    notes: body.notes,
  };

  const created = scheduler.createScheduleSequence(normalized);
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  if (Array.isArray(body.ids)) {
    return NextResponse.json(scheduler.bulkUpdateSchedules(body));
  }
  return NextResponse.json(scheduler.patchScheduleSequence(body));
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  return NextResponse.json(scheduler.deleteScheduleSequence(id));
}
