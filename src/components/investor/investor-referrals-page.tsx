"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon, type IconName } from "@/components/icons";
import { createDeskColumnHelper, useDeskTable, type SortingState } from "@/lib/dashboard/table";
import {
  MAX_EXPORTS,
  MAX_INVITES_PER_SEND,
  MAX_SENT_INVITES,
  MAX_SUPPORT_DRAFTS,
  channelLabel,
  claimDraftError,
  claimableRewards,
  creditTotals,
  csvOf,
  dayName,
  destinationLabel,
  exportMatrix,
  goalDraftError,
  goalProgress,
  historyTotals,
  inviteDraftError,
  inviteFunnel,
  leaderboardView,
  money,
  pct,
  preferencesDraftError,
  relativeTo,
  rewardKindLabel,
  rewardStatusTone,
  rewardTotals,
  round2,
  shortDateOf,
  stageIndex,
  stageLabel,
  statusLabel,
  statusTone,
  streakClaimError,
  streakProgress,
  topicLabel,
  clockShort,
  type Campaign,
  type ExportFormat,
  type ExportScope,
  type InviteMilestone,
  type LeaderPeriod,
  type LeaderRow,
  type PayoutDestination,
  type ReferralCommand,
  type ReferralInvite,
  type ReferralPreferences,
  type ReferralWorkspace,
  type RewardCard,
  type ShareChannel,
  type StreakDay,
  type StreakTier,
  type SupportTopic,
} from "@/lib/investor/referrals";
import { useReferrals } from "@/lib/investor/use-referrals";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  InvestorShell,
  type InvestorDrawerTab,
  type InvestorNavKey,
  type InvestorQuickAction,
} from "./investor-shell";

/* ── Dialog registry ── */

type Kind =
  | "shareWizard"
  | "inviteWizard"
  | "claimWizard"
  | "streakWizard"
  | "preferencesWizard"
  | "exportWizard"
  | "supportWizard"
  | "programRules"
  | "codePanel"
  | "inviteLedger"
  | "inviteDetail"
  | "pendingInvites"
  | "revokeInvite"
  | "shareHistory"
  | "streakCalendar"
  | "streakTiers"
  | "freezes"
  | "rewardDetail"
  | "credits"
  | "campaigns"
  | "joinCampaign"
  | "goal"
  | "leaderboardRules"
  | "rankHistory"
  | "historyDetail"
  | "auditTrail"
  | "boundaries"
  | "resetRewards"
  | "terms";

const titles: Record<Kind, string> = {
  shareWizard: "Share your referral link",
  inviteWizard: "Invite by email",
  claimWizard: "Claim a reward",
  streakWizard: "Check in for today",
  preferencesWizard: "Referral preferences",
  exportWizard: "Export the statement",
  supportWizard: "Ask the rewards desk",
  programRules: "How the ladder pays",
  codePanel: "Your referral code",
  inviteLedger: "Referee ledger",
  inviteDetail: "Referee detail",
  pendingInvites: "Invites you have sent",
  revokeInvite: "Withdraw this invite",
  shareHistory: "Share history",
  streakCalendar: "Streak calendar",
  streakTiers: "Streak tiers",
  freezes: "Streak freezes",
  rewardDetail: "Reward detail",
  credits: "Credit queue",
  campaigns: "Live campaigns",
  joinCampaign: "Join this campaign",
  goal: "Referral goal",
  leaderboardRules: "How the board is ranked",
  rankHistory: "Your rank movement",
  historyDetail: "Reward entry",
  auditTrail: "Rewards desk audit",
  boundaries: "What this desk can and cannot do",
  resetRewards: "Reset the demo rewards",
  terms: "Programme terms",
};

const wizardSteps: Partial<Record<Kind, readonly string[]>> = {
  shareWizard: ["Channel", "Message", "Confirm"],
  inviteWizard: ["Recipients", "Note", "Confirm"],
  claimWizard: ["Reward", "Destination", "Confirm"],
  streakWizard: ["Check-in", "Bonus", "Confirm"],
  preferencesWizard: ["Alerts", "Payout & sharing", "Confirm"],
  exportWizard: ["Scope", "Format", "Confirm"],
  supportWizard: ["Topic", "Message", "Confirm"],
};

const modalSize: Partial<Record<Kind, "sm" | "md" | "lg" | "xl">> = {
  shareWizard: "lg",
  inviteWizard: "lg",
  claimWizard: "lg",
  streakWizard: "md",
  preferencesWizard: "lg",
  exportWizard: "md",
  supportWizard: "md",
  programRules: "lg",
  codePanel: "md",
  inviteLedger: "xl",
  inviteDetail: "lg",
  pendingInvites: "md",
  revokeInvite: "sm",
  shareHistory: "md",
  streakCalendar: "lg",
  streakTiers: "md",
  freezes: "md",
  rewardDetail: "md",
  credits: "lg",
  campaigns: "lg",
  joinCampaign: "sm",
  goal: "md",
  leaderboardRules: "md",
  rankHistory: "md",
  historyDetail: "md",
  auditTrail: "lg",
  boundaries: "lg",
  resetRewards: "sm",
  terms: "lg",
};

const quickActions: InvestorQuickAction[] = [
  { key: "share", label: "Share the link", short: "Share", icon: "link" },
  { key: "invite", label: "Invite by email", short: "Invite", icon: "send" },
  { key: "claimall", label: "Claim everything", short: "Claim", icon: "gift" },
  { key: "streak", label: "Daily check-in", short: "Streak", icon: "flame" },
  { key: "board", label: "Leaderboard", short: "Board", icon: "trophy" },
  { key: "export", label: "Export statement", short: "Export", icon: "download" },
  { key: "support", label: "Ask the desk", short: "Support", icon: "mail" },
];

const sections = [
  { key: "program", label: "Program", id: "rf-program" },
  { key: "streak", label: "Streaks", id: "rf-streak" },
  { key: "rewards", label: "Rewards", id: "rf-rewards" },
  { key: "board", label: "Leaderboard", id: "rf-board" },
  { key: "history", label: "History", id: "rf-history" },
] as const;

const shareChannels: { key: ShareChannel; label: string; hint: string; icon: IconName }[] = [
  { key: "copy", label: "Copy link", hint: "Paste it anywhere — WhatsApp, Slack, email", icon: "copy" },
  { key: "whatsapp", label: "WhatsApp", hint: "Opens WhatsApp with the invite pre-filled", icon: "globe" },
  { key: "telegram", label: "Telegram", hint: "Shares to a chat or your community channel", icon: "send" },
  { key: "twitter", label: "Twitter / X", hint: "Posts the invite with your code", icon: "trendUp" },
  { key: "email", label: "Email", hint: "Sends from your verified address", icon: "mail" },
];

const exportScopes: { key: ExportScope; label: string; hint: string }[] = [
  { key: "invites", label: "Referee ledger", hint: "Every referee, stage, status and amount earned" },
  { key: "rewards", label: "Reward queue", hint: "Available, claimed and locked cards" },
  { key: "leaderboard", label: "Leaderboard", hint: "Ranks, referrals, earnings and movement" },
  { key: "history", label: "Reward history", hint: "The settled statement, line by line" },
  { key: "credits", label: "Credit queue", hint: "What is queued for the next 09:00 batch" },
];

const exportFormats: { key: ExportFormat; label: string; hint: string }[] = [
  { key: "csv", label: "CSV", hint: "Opens in any spreadsheet" },
  { key: "json", label: "JSON", hint: "Structured, one object per row" },
  { key: "pdf", label: "PDF", hint: "Print-ready statement" },
];

const supportTopics: { key: SupportTopic; label: string; hint: string }[] = [
  { key: "referral", label: "A referee question", hint: "A signup, code or link did not work" },
  { key: "reward", label: "A missing reward", hint: "A milestone cleared but no credit landed" },
  { key: "streak", label: "Streak problem", hint: "A day was logged but the counter reset" },
  { key: "payout", label: "Payout destination", hint: "Wallet or bonus credit, fees, timing" },
  { key: "other", label: "Something else", hint: "Anything the rewards desk should know" },
];

const periods: { key: LeaderPeriod; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
  { key: "all", label: "All time" },
];

const dayTone = (state: StreakDay["state"]) =>
  state === "done" ? "is-done" : state === "today" ? "is-today" : state === "missed" ? "is-missed" : "is-upcoming";

const tierTone = (status: StreakTier["status"]) =>
  status === "reached" ? "is-reached" : status === "next" ? "is-next" : "is-locked";

/* ── Primitives ── */

function SectionHead({
  code,
  title,
  hint,
  aside,
}: {
  code: string;
  title: string;
  hint: string;
  aside?: ReactNode;
}) {
  return (
    <header className="rf-section-head">
      <div>
        <span className="rf-section-code">{code}</span>
        <h2>{title}</h2>
        <p>{hint}</p>
      </div>
      {aside ? <div className="rf-section-aside">{aside}</div> : null}
    </header>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
  decimals = 0,
  prefix = "",
  suffix = "",
  delay = 0,
  big = false,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "is-pos" | "is-neg" | "is-accent" | "is-cut";
  decimals?: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
  big?: boolean;
}) {
  const shown = useLiveCountUp(value);
  return (
    <div
      className={`rf-figure ${big ? "is-big" : ""}`}
      style={{ "--rf-delay": `${delay}ms` } as CSSProperties}
    >
      <span className="rf-figure__label">{label}</span>
      <b className={`rf-figure__value mono ${tone ?? ""}`}>
        {prefix}
        {shown.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}
        {suffix}
      </b>
      {hint ? <span className="rf-figure__hint">{hint}</span> : null}
    </div>
  );
}

function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="rf-kv">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Tag({ children, tone = "" }: { children: ReactNode; tone?: string }) {
  return <span className={`rf-tag ${tone}`.trim()}>{children}</span>;
}

function Bar({ value, target, tone = "" }: { value: number; target: number; tone?: string }) {
  const pctValue = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <span className={`rf-bar ${tone}`} aria-hidden="true">
      <span className="rf-bar__fill" style={{ width: `${pctValue}%` }} />
    </span>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`rf-toggle ${checked ? "is-on" : ""} ${disabled ? "is-locked" : ""}`}>
      <span className="rf-toggle__text">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="rf-toggle__track" aria-hidden="true">
        <span className="rf-toggle__thumb" />
      </span>
    </label>
  );
}

function LadderPip({
  milestone,
  index,
}: {
  milestone: InviteMilestone;
  index: number;
}) {
  const done = Boolean(milestone.at);
  return (
    <span
      className={`rf-pip ${done ? "is-done" : "is-open"}`}
      title={`${milestone.label} · ${money(milestone.amount, 0)}${done ? "" : " · not cleared"}`}
      style={{ "--rf-delay": `${index * 50}ms` } as CSSProperties}
    >
      <Icon name={done ? "check" : "clock"} size={11} />
      <b className="mono">{money(milestone.amount, 0)}</b>
    </span>
  );
}

/* ── Page ── */

export function InvestorReferralsPage({
  initial,
  initialAction,
}: {
  initial: ReferralWorkspace;
  initialAction?: string;
}) {
  const router = useRouter();
  const desk = useReferrals(initial);
  const {
    workspace,
    codeAndStats,
    streak: streakQuery,
    rewards: rewardsQuery,
    leaderboard: boardQuery,
    history: historyQuery,
  } = desk;

  const chrome = useRef<{
    pushToast: (toast: {
      tone: "success" | "info" | "warning" | "error";
      title: string;
      detail?: string;
    }) => void;
  } | null>(null);
  const pushToast = useCallback(
    (toast: {
      tone: "success" | "info" | "warning" | "error";
      title: string;
      detail?: string;
    }) => chrome.current?.pushToast(toast),
    [],
  );

  const actionMap: Record<string, Kind> = {
    share: "shareWizard",
    invite: "inviteWizard",
    claim: "claimWizard",
    claimall: "claimWizard",
    streak: "streakWizard",
    checkin: "streakWizard",
    preferences: "preferencesWizard",
    settings: "preferencesWizard",
    export: "exportWizard",
    support: "supportWizard",
    rules: "programRules",
    program: "programRules",
    code: "codePanel",
    ledger: "inviteLedger",
    invites: "inviteLedger",
    referee: "inviteDetail",
    pending: "pendingInvites",
    shares: "shareHistory",
    calendar: "streakCalendar",
    tiers: "streakTiers",
    freezes: "freezes",
    reward: "rewardDetail",
    credits: "credits",
    campaigns: "campaigns",
    campaign: "joinCampaign",
    goal: "goal",
    board: "leaderboardRules",
    ranking: "leaderboardRules",
    rank: "rankHistory",
    history: "historyDetail",
    audit: "auditTrail",
    help: "boundaries",
    reset: "resetRewards",
    terms: "terms",
  };

  const [modal, setModal] = useState<{ kind: Kind } | null>(() => {
    const kind = initialAction ? actionMap[initialAction] : undefined;
    return kind ? { kind } : null;
  });
  const [wizardStep, setWizardStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<"share" | "streak" | "board" | null>(null);
  const [activeNav, setActiveNav] = useState<InvestorNavKey>("referrals");
  const [activeSection, setActiveSection] = useState<string>("program");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  /* Selections */
  const [selectedInviteId, setSelectedInviteId] = useState(initial.invites[0]?.id ?? "");
  const [selectedRewardId, setSelectedRewardId] = useState(
    initial.rewards.find((row) => row.status === "available")?.id ?? "",
  );
  const [selectedHistoryId, setSelectedHistoryId] = useState(initial.history[0]?.id ?? "");
  const [selectedCreditId, setSelectedCreditId] = useState(initial.credits[0]?.id ?? "");
  const [selectedSentId, setSelectedSentId] = useState(initial.sent[0]?.id ?? "");
  const [selectedCampaignId, setSelectedCampaignId] = useState(initial.campaigns[0]?.id ?? "");

  /* Drafts */
  const [shareChannel, setShareChannel] = useState<ShareChannel>(
    initial.preferences.shareDefault,
  );
  const [shareTarget, setShareTarget] = useState("");
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [claimTargetId, setClaimTargetId] = useState(
    initial.rewards.find((row) => row.status === "available")?.id ?? "all",
  );
  const [claimDestination, setClaimDestination] = useState<PayoutDestination>(
    initial.preferences.payoutDestination,
  );
  const [draftPrefs, setDraftPrefs] = useState<ReferralPreferences>(initial.preferences);
  const [goalTarget, setGoalTarget] = useState(initial.goal.target);
  const [goalDeadline, setGoalDeadline] = useState(initial.goal.deadline);
  const [exportScope, setExportScope] = useState<ExportScope>("invites");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [supportTopic, setSupportTopic] = useState<SupportTopic>("reward");
  const [supportMessage, setSupportMessage] = useState("");
  const [ledgerStage, setLedgerStage] = useState<"all" | ReferralInvite["status"]>("all");
  const [rankSorting, setRankSorting] = useState<SortingState>([]);

  /* ── Derived ── */

  const data = workspace;
  const asOf = data.asOf;
  const stats = data.stats;
  const program = data.program;
  const invites = data.invites;
  const streakState = data.streak;
  const rewards = data.rewards;
  const campaigns = data.campaigns;
  const prefs = data.preferences;
  const credits = data.credits;

  const codeSection = codeAndStats.data;
  const streakSection = streakQuery.data;
  const rewardSection = rewardsQuery.data;
  const boardSection = boardQuery.data;
  const historySection = historyQuery.data;

  const progress = streakSection?.view ?? streakProgress(streakState);
  const board = boardSection?.view ?? leaderboardView(data.leaderboard);
  const funnel = codeSection?.funnel ?? inviteFunnel(invites);
  const totals = rewardSection?.totals ?? rewardTotals(rewards);
  const claimable = rewardSection?.claimable ?? claimableRewards(rewards, asOf);
  const claimableTotal =
    rewardSection?.claimableTotal ?? round2(claimable.reduce((sum, row) => sum + row.amount, 0));
  const creditInfo = rewardSection?.creditTotals ?? creditTotals(credits);
  const historyRows = historySection?.rows ?? data.history;
  const historyInfo = historySection?.totals ?? historyTotals(data.history, credits);
  const camp = useMemo(() => ({
    active: campaigns.filter((row) => row.status === "active"),
    upcoming: campaigns.filter((row) => row.status === "upcoming"),
    ended: campaigns.filter((row) => row.status === "ended"),
    joined: campaigns.filter((row) => row.joined && row.status !== "ended").length,
  }), [campaigns]);
  const goalView = goalProgress(data.goal, stats);

  const selectedInvite = invites.find((row) => row.id === selectedInviteId) ?? invites[0];
  const selectedReward = rewards.find((row) => row.id === selectedRewardId) ?? rewards[0];
  const selectedHistory =
    data.history.find((row) => row.id === selectedHistoryId) ?? data.history[0];
  const selectedCredit = credits.find((row) => row.id === selectedCreditId) ?? credits[0];
  const selectedSent = data.sent.find((row) => row.id === selectedSentId);
  const selectedCampaign =
    campaigns.find((row) => row.id === selectedCampaignId) ?? campaigns[0];

  const ledgerRows = useMemo(
    () =>
      ledgerStage === "all" ? invites : invites.filter((row) => row.status === ledgerStage),
    [invites, ledgerStage],
  );

  const inviteDraftEmails = useMemo(
    () =>
      inviteEmails
        .split(/[\s,;\n]+/)
        .map((row) => row.trim())
        .filter(Boolean),
    [inviteEmails],
  );

  const inviteError = inviteDraftError({
    emails: inviteDraftEmails,
    note: inviteNote,
    ownEmail: data.profile.email,
  });

  const goalError = goalDraftError({ target: goalTarget, deadline: goalDeadline });

  const prefsError = preferencesDraftError({ preferences: draftPrefs, asOf });

  const claimCandidate = rewards.find((row) => row.id === claimTargetId) ?? null;
  const claimError =
    claimTargetId === "all"
      ? claimable.length
        ? ""
        : "Nothing is claimable right now"
      : claimDraftError(claimCandidate, asOf);

  const streakError = streakClaimError(streakState, asOf);
  const exportPreview = useMemo(() => exportMatrix(data, exportScope), [data, exportScope]);

  const heroClaimable = useLiveCountUp(claimableTotal);
  const heroEarned = useLiveCountUp(stats.earned);
  const heroStreak = useLiveCountUp(streakState.current);

  /* ── Chrome, dialogs, mutations ── */

  function open(kind: Kind, patch?: () => void) {
    setError("");
    setWizardStep(0);
    setConfirmed(false);
    patch?.();
    setModal({ kind });
  }

  function close() {
    setModal(null);
    setWizardStep(0);
    setConfirmed(false);
    setError("");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
        setDrawer(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wizardFor = modal ? wizardSteps[modal.kind] : undefined;
  const wizard = wizardFor ? [...wizardFor] : undefined;
  const lastStep = wizard ? wizard.length - 1 : 0;

  function scrollTo(id: string) {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function jumpTo(key: string, id: string) {
    setActiveSection(key);
    scrollTo(id);
  }

  async function run(
    command: ReferralCommand,
    opts?: { title?: string; detail?: string; keep?: boolean; tone?: "success" | "info" | "warning" | "error" },
  ) {
    setBusy(true);
    setError("");
    try {
      await desk.command.mutateAsync(command);
      pushToast({
        tone: opts?.tone ?? "success",
        title: opts?.title ?? "Rewards desk updated",
        detail:
          opts?.detail ??
          "Held in this demo snapshot. No payout was triggered and nothing left the building.",
      });
      if (!opts?.keep) close();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That change could not be applied");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string, kind?: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ tone: "success", title: `${label} copied`, detail: value });
    } catch {
      pushToast({
        tone: "info",
        title: `${label}: ${value}`,
        detail: "Clipboard access was blocked — select the value and copy it by hand.",
      });
    }
    if (kind) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2200);
    }
  }

  function download(value: BlobPart, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function claimDaily() {
    try {
      await desk.claimDailyBonus.mutateAsync();
      pushToast({
        tone: "success",
        title: `${money(streakState.bonusPerDay, 2)} added to the queue`,
        detail: `Day ${streakState.current} · next check-in window opens 00:00 UTC`,
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The bonus could not be claimed");
    }
  }

  async function claimEverything() {
    setBusy(true);
    setError("");
    try {
      await desk.claimAll.mutateAsync();
      pushToast({
        tone: "success",
        title: `${money(claimableTotal, 2)} claimed`,
        detail: `${claimable.length} reward${claimable.length === 1 ? "" : "s"} queued for the 09:00 UTC batch · destination ${destinationLabel(prefs.payoutDestination)}`,
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nothing could be claimed");
    } finally {
      setBusy(false);
    }
  }

  async function claimOne(reward: RewardCard) {
    try {
      await desk.claimReward.mutateAsync(reward.id);
      pushToast({
        tone: "success",
        title: `${money(reward.amount, 2)} claimed`,
        detail: `${reward.title} · queued for ${program.settlementWindow}`,
      });
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That reward could not be claimed");
    }
  }

  async function advance() {
    if (!modal) return;
    if (modal.kind === "shareWizard") {
      setWizardStep((step) => step + 1);
      return;
    }
    setWizardStep((step) => step + 1);
  }

  const stepBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "inviteWizard" && wizardStep === 0) return inviteError;
    if (modal.kind === "claimWizard" && wizardStep === 0) return claimError;
    if (modal.kind === "streakWizard" && wizardStep === 0) return streakError;
    if (modal.kind === "preferencesWizard" && wizardStep === 1) return prefsError;
    if (modal.kind === "supportWizard" && wizardStep === 1)
      return supportMessage.trim().length >= 12
        ? ""
        : "Tell the desk what happened in at least 12 characters";
    if (modal.kind === "exportWizard" && wizardStep === 0)
      return exportPreview.rows.length ? "" : "That statement has no rows to export";
    return "";
  })();

  const needsAck = modal?.kind === "resetRewards";

  const submitBlockingError = (() => {
    if (!modal) return "";
    if (modal.kind === "inviteWizard") return inviteError;
    if (modal.kind === "claimWizard") return claimError;
    if (modal.kind === "streakWizard") return streakError;
    if (modal.kind === "preferencesWizard") return prefsError;
    if (modal.kind === "supportWizard")
      return supportMessage.trim().length >= 12 ? "" : "Add a message first";
    return "";
  })();

  const submitLabel = !modal
    ? "Done"
    : modal.kind === "shareWizard"
      ? "Share it"
      : modal.kind === "inviteWizard"
        ? "Send invites"
        : modal.kind === "claimWizard"
          ? claimTargetId === "all"
            ? `Claim ${money(claimableTotal, 2)}`
            : `Claim ${money(claimCandidate?.amount ?? 0, 2)}`
          : modal.kind === "streakWizard"
            ? `Claim ${money(streakState.bonusPerDay, 2)}`
            : modal.kind === "preferencesWizard"
              ? "Save preferences"
              : modal.kind === "exportWizard"
                ? "Generate file"
                : modal.kind === "supportWizard"
                  ? "Send to desk"
                  : modal.kind === "resetRewards"
                    ? "Reset the desk"
                    : "Close";

  async function submit() {
    if (!modal) return;

    if (modal.kind === "shareWizard") {
      await copy(
        program.link,
        `${channelLabel(shareChannel)} link`,
      );
      await run(
        { kind: "share", channel: shareChannel, target: shareTarget.trim() || undefined },
        {
          title: `Shared via ${channelLabel(shareChannel)}`,
          detail: shareTarget.trim()
            ? `${program.link} · to ${shareTarget.trim()}`
            : `${program.link} · the invite is on your clipboard`,
        },
      );
      return;
    }

    if (modal.kind === "inviteWizard") {
      const ok = await run(
        { kind: "sendInvites", emails: inviteDraftEmails, note: inviteNote.trim() },
        {
          title: `${inviteDraftEmails.length} invite${inviteDraftEmails.length === 1 ? "" : "s"} queued`,
          detail: "Held as local drafts — nothing is emailed from this demo.",
        },
      );
      if (ok) {
        setInviteEmails("");
        setInviteNote("");
      }
      return;
    }

    if (modal.kind === "claimWizard") {
      if (claimTargetId === "all") {
        await claimEverything();
        return;
      }
      if (claimCandidate) await claimOne(claimCandidate);
      return;
    }

    if (modal.kind === "streakWizard") {
      await claimDaily();
      return;
    }

    if (modal.kind === "preferencesWizard") {
      await run(
        {
          kind: "savePreferences",
          milestoneAlerts: draftPrefs.milestoneAlerts,
          weeklySummary: draftPrefs.weeklySummary,
          autoClaim: draftPrefs.autoClaim,
          marketing: draftPrefs.marketing,
          leaderboardVisible: draftPrefs.leaderboardVisible,
          freezeAutoUse: draftPrefs.freezeAutoUse,
          payoutDestination: draftPrefs.payoutDestination,
          shareDefault: draftPrefs.shareDefault,
        },
        {
          title: "Preferences saved",
          detail: `${destinationLabel(draftPrefs.payoutDestination)} · ${draftPrefs.autoClaim ? "auto-claim on" : "manual claims"}`,
        },
      );
      setShareChannel(draftPrefs.shareDefault);
      return;
    }

    if (modal.kind === "exportWizard") {
      const ok = await run(
        {
          kind: "exportReport",
          scope: exportScope,
          format: exportFormat,
          count: exportPreview.rows.length,
        },
        {
          title: `${exportPreview.title} · ${exportFormat.toUpperCase()}`,
          detail: `${exportPreview.rows.length} rows generated in this session.`,
          keep: true,
        },
      );
      if (!ok) return;
      if (exportFormat === "csv") {
        download(csvOf(exportPreview), `trademo-referrals-${exportScope}-${asOf.slice(0, 10)}.csv`, "text/csv");
      } else if (exportFormat === "json") {
        download(
          JSON.stringify({ scope: exportScope, generatedAt: asOf, ...exportPreview }, null, 2),
          `trademo-referrals-${exportScope}-${asOf.slice(0, 10)}.json`,
          "application/json",
        );
      }
      close();
      return;
    }

    if (modal.kind === "supportWizard") {
      const ok = await run(
        { kind: "support", topic: supportTopic, message: supportMessage.trim() },
        {
          title: "Draft logged for the desk",
          detail: `${topicLabel(supportTopic)} · ${supportMessage.trim().length} characters`,
        },
      );
      if (ok) setSupportMessage("");
      return;
    }

    if (modal.kind === "resetRewards") {
      await run(
        { kind: "resetRewards" },
        {
          title: "Rewards desk reset",
          detail: "Claims, invites, shares and exports cleared — the snapshot is back to Sunday 25 Oct.",
        },
      );
      return;
    }

    if (modal.kind === "joinCampaign" && selectedCampaign) {
      await run(
        { kind: "joinCampaign", id: selectedCampaign.id },
        {
          title: `Joined ${selectedCampaign.name}`,
          detail: `${money(selectedCampaign.bonus, 0)} bonus · ${selectedCampaign.requires}`,
        },
      );
      return;
    }

    if (modal.kind === "revokeInvite" && selectedSent) {
      await run(
        { kind: "revokeInvite", id: selectedSent.id },
        {
          title: "Invite withdrawn",
          detail: `${selectedSent.email} · the link stops working immediately`,
        },
      );
      return;
    }

    if (modal.kind === "goal") {
      if (goalError) {
        setError(goalError);
        return;
      }
      await run(
        { kind: "setGoal", target: goalTarget, deadline: goalDeadline },
        {
          title: "Goal updated",
          detail: `${goalTarget} qualified referees by ${shortDateOf(goalDeadline)}`,
        },
      );
      return;
    }

    if (modal.kind === "freezes") {
      await run(
        { kind: "useFreeze" },
        {
          title: "Freeze armed",
          detail: "One missed day is protected — the run continues at the same count.",
        },
      );
      return;
    }

    if (modal.kind === "streakTiers" || modal.kind === "programRules" || modal.kind === "terms") {
      if (modal.kind === "terms") {
        await run(
          { kind: "acknowledge", scope: "terms" },
          {
            title: "Terms acknowledged",
            detail: `Programme ${program.code} · cap ${money(program.maxPerReferral, 0)} per referee`,
            tone: "info",
          },
        );
        return;
      }
    }

    if (modal.kind === "leaderboardRules") {
      await run(
        { kind: "acknowledge", scope: "leaderboard" },
        {
          title: "Ranking rules acknowledged",
          detail: "Monthly board · resets 1st 00:00 UTC · top three share a 10% bonus pool",
          tone: "info",
        },
      );
      return;
    }

    close();
  }

  const modalFooter = (
    <>
      {wizard && wizardStep === lastStep && needsAck ? (
        <label className="rf-check rf-ack">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            aria-label="Confirm this local preview"
          />
          Clear every claim, invite, share and export in this session.
        </label>
      ) : null}
      {wizard ? (
        <span className="rf-muted">Demo desk · nothing is emailed or texted</span>
      ) : null}
      <button type="button" className="rf-btn" onClick={close}>
        Close
      </button>
      {wizard && wizardStep > 0 ? (
        <button
          type="button"
          className="rf-btn"
          onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
        >
          <Icon name="arrowLeft" size={13} /> Back
        </button>
      ) : null}
      {wizard && wizardStep < lastStep ? (
        <button
          type="button"
          className="rf-btn rf-btn--primary"
          onClick={() => void advance()}
          disabled={busy || Boolean(stepBlockingError)}
          data-action="wizard-next"
        >
          Continue <Icon name="arrowRight" size={13} />
        </button>
      ) : null}
      {wizard && wizardStep === lastStep ? (
        <button
          type="button"
          className="rf-btn rf-btn--primary"
          disabled={busy || (needsAck && !confirmed) || Boolean(submitBlockingError)}
          onClick={() => void submit()}
          data-action="wizard-submit"
        >
          {busy ? "Working…" : submitLabel}
        </button>
      ) : null}
      {!wizard && modal && ["joinCampaign", "revokeInvite", "goal", "freezes", "resetRewards", "terms", "leaderboardRules"].includes(modal.kind) ? (
        <button
          type="button"
          className="rf-btn rf-btn--primary"
          disabled={busy || (needsAck && !confirmed)}
          onClick={() => void submit()}
          data-action="dialog-submit"
        >
          {busy ? "Working…" : submitLabel === "Close"
            ? modal.kind === "joinCampaign"
              ? "Join the campaign"
              : modal.kind === "revokeInvite"
                ? "Withdraw invite"
                : modal.kind === "goal"
                  ? "Save goal"
                  : modal.kind === "freezes"
                    ? "Use a freeze"
                    : modal.kind === "terms"
                      ? "Acknowledge terms"
                      : modal.kind === "leaderboardRules"
                        ? "Got it"
                        : "Reset the desk"
            : submitLabel}
        </button>
      ) : null}
    </>
  );

  /* ── Leaderboard table ── */

  const rankColumn = useMemo(() => createDeskColumnHelper<LeaderRow>(), []);
  const rankColumns = useMemo(
    () =>
      rankColumn.columns([
        rankColumn.accessor("rank", { header: "Rank" }),
        rankColumn.accessor("alias", { header: "Referrer" }),
        rankColumn.accessor("referrals", { header: "Referrals" }),
        rankColumn.accessor("earned", { header: "Earned" }),
      ]),
    [rankColumn],
  );

  const rankTable = useDeskTable({
    data: board.rows,
    columns: rankColumns,
    state: { sorting: rankSorting },
    onSortingChange: setRankSorting,
  });

  /* ── Render ── */

  return (
    <InvestorShell
      rootClass="page-investor-referrals"
      investorName={data.profile.displayName}
      investorSinceLabel={`Investor since ${data.profile.joinedAt.slice(0, 10)}`}
      poolBookValue={data.profile.committed}
      monthRoi={data.profile.monthRoiPct}
      walletBalance={data.profile.wallet}
      unread={data.profile.unread}
      activeNav={activeNav}
      detailHref="/investor/pools/pkg_02"
      bookHref="/investor/pools/pkg_02/book"
      quickActions={quickActions}
      onNavigate={(key) => {
        setActiveNav(key);
        if (key === "overview") return router.push("/investor");
        if (key === "pools" || key === "detail" || key === "upcoming") return router.push("/investor/pools");
        if (key === "book") return router.push("/investor/pools/pkg_02/book");
        if (key === "live") return router.push("/investor/live");
        if (key === "portfolio" || key === "earnings") return router.push("/investor/investments");
        if (key === "wallet") return router.push("/investor/wallet");
        if (key === "calculator") return router.push("/investor/calculator");
        if (key === "notifications") return router.push("/investor/notifications");
        if (key === "activity") return jumpTo("history", "rf-history");
        if (key === "settings") return open("preferencesWizard");
        if (key === "referrals") return jumpTo("program", "rf-program");
        return setDrawer("share");
      }}
      onOpenDrawer={(tab: InvestorDrawerTab) =>
        setDrawer(tab === "portfolio" ? "board" : tab === "activity" ? "streak" : "share")
      }
      onQuickAction={(key) => {
        if (key === "share") return open("shareWizard");
        if (key === "invite") return open("inviteWizard");
        if (key === "claimall") return open("claimWizard", () => setClaimTargetId("all"));
        if (key === "streak") return open("streakWizard");
        if (key === "board") return open("leaderboardRules");
        if (key === "export") return open("exportWizard");
        if (key === "support") return open("supportWizard");
      }}
      onChromeReady={(chromeApi) => {
        chrome.current = chromeApi;
      }}
      onOpenNotifications={() => router.push("/investor/notifications")}
    >
      <div className="rf-page">
        <header className="rf-hero">
          <div className="rf-hero__main">
            <span className="rf-eyebrow">I-10 · INVESTOR WORKSPACE / REWARDS DESK</span>
            <h1>Referrals &amp; rewards</h1>
            <p className="rf-lede">
              One code, four rungs, a daily streak and a monthly board. The ladder
              pays $5 → $10 → $25 → $50 per referee, capped at $90; the streak pays
              $2 a day once you are through seven; and the rewards desk holds every
              credit until you claim it. Everything below reads from one Sunday
              morning snapshot, so the wallet balance, the referee lanes and the
              settled credits always agree.
            </p>

            <div className="rf-code-card">
              <div className="rf-code-card__main">
                <span className="rf-panel-label">Your referral code</span>
                <button
                  type="button"
                  className={`rf-code ${copied === "code" ? "is-copied" : ""}`}
                  onClick={() => void copy(program.code, "Referral code", "code")}
                  title="Copy the code"
                >
                  <span className="mono">{program.code}</span>
                  <span className="rf-code__icon">
                    <Icon name={copied === "code" ? "check" : "copy"} size={15} />
                  </span>
                </button>
                <p className="rf-code-card__link mono">{program.link}</p>
                <div className="rf-code-card__actions">
                  <button
                    type="button"
                    className="rf-btn rf-btn--primary"
                    onClick={() => open("shareWizard")}
                  >
                    <Icon name="link" size={13} /> Share the link
                  </button>
                  <button
                    type="button"
                    className="rf-btn"
                    onClick={() => void copy(program.link, "Referral link", "link")}
                  >
                    <Icon name={copied === "link" ? "check" : "copy"} size={13} /> Copy link
                  </button>
                  <button type="button" className="rf-btn" onClick={() => open("codePanel")}>
                    <Icon name="target" size={13} /> Code card
                  </button>
                </div>
              </div>
              <div className="rf-code-card__side">
                <div className="rf-share-row">
                  {shareChannels.map((channel) => (
                    <button
                      key={channel.key}
                      type="button"
                      className="rf-share-btn"
                      title={channel.hint}
                      onClick={() =>
                        open("shareWizard", () => {
                          setShareChannel(channel.key);
                          setShareTarget("");
                        })
                      }
                    >
                      <Icon name={channel.icon} size={15} />
                      <span>{channel.label}</span>
                    </button>
                  ))}
                </div>
                <p className="rf-code-card__note">
                  <Icon name="info" size={12} /> Your link carries a 30-day cookie.
                  A referee who signs up inside 30 days is always yours, even if they
                  come back from a different device.
                </p>
              </div>
            </div>

            <div className="rf-hero__figures">
              <Figure label="Total earned" value={stats.earned} prefix="$" decimals={0} tone="is-pos" hint="Lifetime, settled" delay={40} />
              <Figure label="Referees" value={stats.total} hint={`${stats.qualified} qualified · ${stats.pending} pending`} delay={90} />
              <Figure
                label="Claimable now"
                value={claimableTotal}
                prefix="$"
                decimals={0}
                tone="is-accent"
                hint={`${claimable.length} card${claimable.length === 1 ? "" : "s"} ready`}
                delay={140}
              />
              <Figure label="Streak" value={streakState.current} suffix=" days" hint={`Best run ${streakState.best} days`} tone="is-accent" delay={190} />
              <Figure label="Your rank" value={board.you?.rank ?? 12} hint="Monthly board" delay={240} />
            </div>
          </div>

          <aside className="rf-hero__side">
            <div className="rf-hero__panel">
              <span className="rf-panel-label">Today at a glance</span>
              <ul className="rf-today">
                <li>
                  <span className="rf-today__icon is-flame">
                    <Icon name="flame" size={14} />
                  </span>
                  <span className="rf-today__text">
                    <strong>Day {streakState.current} of the run</strong>
                    <small className="mono">
                      {streakState.todayClaimed
                        ? "checked in — bonus claimed"
                        : `${money(streakState.bonusPerDay, 2)} waiting`}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="rf-icon-btn"
                    aria-label="Claim today's bonus"
                    onClick={() => open("streakWizard")}
                    disabled={Boolean(streakError)}
                  >
                    <Icon name="check" size={13} />
                  </button>
                </li>
                <li>
                  <span className="rf-today__icon is-gift">
                    <Icon name="gift" size={14} />
                  </span>
                  <span className="rf-today__text">
                    <strong>{claimable.length} rewards ready</strong>
                    <small className="mono">{money(claimableTotal, 2)} claimable</small>
                  </span>
                  <button
                    type="button"
                    className="rf-icon-btn"
                    aria-label="Open the claim wizard"
                    onClick={() => open("claimWizard", () => setClaimTargetId("all"))}
                    disabled={!claimable.length}
                  >
                    <Icon name="gift" size={13} />
                  </button>
                </li>
                <li>
                  <span className="rf-today__icon is-pool">
                    <Icon name="pool" size={14} />
                  </span>
                  <span className="rf-today__text">
                    <strong>PKG-02 closes 25 Oct</strong>
                    <small className="mono">00:18 UTC · $5,000 min slot</small>
                  </span>
                  <Link className="rf-icon-btn" href="/investor/pools/pkg_02" aria-label="Open PKG-02">
                    <Icon name="arrowRight" size={13} />
                  </Link>
                </li>
              </ul>
              <button type="button" className="rf-link-btn" onClick={() => open("programRules")}>
                How the ladder pays <Icon name="arrowRight" size={12} />
              </button>
            </div>

            <div className="rf-hero__panel">
              <span className="rf-panel-label">Rewards desk</span>
              <div className="rf-mini-actions">
                <button type="button" onClick={() => open("credits")}>
                  <Icon name="wallet" size={14} /> Credits {credits.length}
                </button>
                <button type="button" onClick={() => open("campaigns")}>
                  <Icon name="bolt" size={14} /> Campaigns {camp.active.length}
                </button>
                <button type="button" onClick={() => open("pendingInvites")}>
                  <Icon name="send" size={14} /> Sent {data.sent.length}
                </button>
                <button type="button" onClick={() => open("goal")}>
                  <Icon name="target" size={14} /> Goal {Math.round(goalView.pct)}%
                </button>
              </div>
            </div>
          </aside>
        </header>

        {/* ── section jump bar ── */}
        <nav className="rf-jump" aria-label="Referral sections">
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              className={activeSection === section.key ? "is-active" : ""}
              aria-current={activeSection === section.key ? "true" : undefined}
              onClick={() => jumpTo(section.key, section.id)}
            >
              {section.label}
              <span className="rf-jump__count mono">
                {section.key === "program"
                  ? stats.total
                  : section.key === "streak"
                    ? streakState.current
                    : section.key === "rewards"
                      ? claimable.length
                      : section.key === "board"
                        ? `#${board.you?.rank ?? 12}`
                        : historyRows.length}
              </span>
            </button>
          ))}
        </nav>

        {/* ── 1 · referral program ── */}
        <section className="rf-section" id="rf-program">
          <SectionHead
            code="1 / Referral program"
            title="Your code, your ladder"
            hint="Share the code, and each referee pays you in four steps. The ladder stops at $90 per referee however far they go."
            aside={
              <>
                <button type="button" className="rf-btn" onClick={() => open("shareHistory")}>
                  <Icon name="clock" size={13} /> Shares {data.shares.length}
                </button>
                <button type="button" className="rf-btn" onClick={() => open("inviteLedger")}>
                  <Icon name="users" size={13} /> Referees {stats.total}
                </button>
                <button
                  type="button"
                  className="rf-btn rf-btn--primary"
                  onClick={() => open("inviteWizard")}
                >
                  <Icon name="send" size={13} /> Invite by email
                </button>
              </>
            }
          />

          <div className="rf-program">
            <div className="rf-ladder">
              {program.levels.map((level, index) => (
                <article
                  key={level.key}
                  className="rf-rung"
                  style={{ "--rf-delay": `${index * 60}ms` } as CSSProperties}
                >
                  <span className="rf-rung__index mono">0{index + 1}</span>
                  <div className="rf-rung__body">
                    <strong>{level.label}</strong>
                    <p>{level.detail}</p>
                    <small className="rf-muted">{level.payAt}</small>
                  </div>
                  <b className="rf-rung__amount mono">{money(level.amount, 0)}</b>
                </article>
              ))}
              <div className="rf-ladder__cap">
                <span className="mono">MAX</span>
                <b className="mono">{money(program.maxPerReferral, 0)}</b>
                <small>per referee, across all four rungs</small>
              </div>
            </div>

            <div className="rf-program__side">
              <div className="rf-stat-grid">
                <div className="rf-stat">
                  <span>Total invited</span>
                  <b className="mono">{stats.total}</b>
                  <small>8 joined since 12 Sep</small>
                </div>
                <div className="rf-stat is-good">
                  <span>Qualified</span>
                  <b className="mono">{stats.qualified}</b>
                  <small>deposit cleared</small>
                </div>
                <div className="rf-stat is-wait">
                  <span>Pending</span>
                  <b className="mono">{stats.pending}</b>
                  <small>awaiting first deposit</small>
                </div>
                <div className="rf-stat is-cut">
                  <span>Lapsed</span>
                  <b className="mono">{stats.lapsed}</b>
                  <small>30 days dormant</small>
                </div>
              </div>

              <div className="rf-earned">
                <div>
                  <span className="rf-panel-label">Earned to date</span>
                  <b className="rf-earned__value mono">${heroEarned.toLocaleString("en-US")}</b>
                  <small className="rf-muted">
                    {pct(stats.conversionPct, 1)} of referees qualified · {money(stats.avgPerReferral, 2)} average
                  </small>
                </div>
                <div className="rf-earned__bar">
                  <Bar value={stats.earned} target={stats.earned + stats.pipeline} tone="is-good" />
                  <span className="rf-muted mono">
                    {money(stats.pipeline, 0)} still on the table across live referees
                  </span>
                </div>
              </div>

              <div className="rf-funnel">
                <span className="rf-panel-label">Where referees stop</span>
                {funnel.map((step) => (
                  <div key={step.key} className="rf-funnel__row">
                    <span>{step.label}</span>
                    <Bar value={step.count} target={Math.max(1, funnel[0].count)} />
                    <b className="mono">{step.count}</b>
                    <small className="rf-muted mono">{pct(step.pct, 0)}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rf-invites">
            <div className="rf-invites__head">
              <h3>Recent referees</h3>
              <div className="rf-chip-row">
                {([
                  ["all", "All 8"],
                  ["qualified", "Qualified"],
                  ["pending", "Pending"],
                  ["lapsed", "Lapsed"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`rf-chip ${ledgerStage === key ? "is-active" : ""}`}
                    onClick={() => setLedgerStage(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rf-invite-list">
              {ledgerRows.map((row, index) => (
                <article
                  key={row.id}
                  className={`rf-invite ${statusTone(row.status)}`}
                  style={{ "--rf-delay": `${index * 50}ms` } as CSSProperties}
                >
                  <span className="rf-invite__avatar mono">{row.alias.slice(0, 2).toUpperCase()}</span>
                  <div className="rf-invite__body">
                    <div className="rf-invite__top">
                      <strong>{row.alias}</strong>
                      <Tag tone={statusTone(row.status)}>{statusLabel(row.status)}</Tag>
                      <span className="rf-invite__meta mono">
                        {row.country} · joined {shortDateOf(row.joinedAt)}
                      </span>
                    </div>
                    <div className="rf-invite__pips">
                      {row.milestones.map((milestone, pipIndex) => (
                        <LadderPip key={milestone.key} milestone={milestone} index={pipIndex} />
                      ))}
                      <span className="rf-invite__stage rf-muted">{stageLabel(row.stage)}</span>
                    </div>
                  </div>
                  <div className="rf-invite__right">
                    <b className="mono">{money(row.earned, 0)}</b>
                    <small className="rf-muted">
                      {row.poolCode ? row.poolCode : "no slot yet"}
                    </small>
                    <button
                      type="button"
                      className="rf-btn rf-btn--sm"
                      onClick={() =>
                        open("inviteDetail", () => setSelectedInviteId(row.id))
                      }
                    >
                      Open
                    </button>
                  </div>
                </article>
              ))}
              {!ledgerRows.length ? (
                <p className="rf-muted rf-empty">No referee is in that state right now.</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── 2 · daily streaks ── */}
        <section className="rf-section" id="rf-streak">
          <SectionHead
            code="2 / Daily streaks"
            title="Twelve days, and a Sunday check-in"
            hint="Open the investor dashboard once a day to keep the run alive. After seven days every logged day pays $2; the tiers pay on top at 7, 14 and 30."
            aside={
              <>
                <button type="button" className="rf-btn" onClick={() => open("streakCalendar")}>
                  <Icon name="calendar" size={13} /> Full calendar
                </button>
                <button type="button" className="rf-btn" onClick={() => open("freezes")}>
                  <Icon name="shield" size={13} /> Freezes {streakState.freezes}
                </button>
                <button
                  type="button"
                  className="rf-btn rf-btn--primary"
                  onClick={() => open("streakWizard")}
                  disabled={Boolean(streakError)}
                  title={streakError || "Claim today's $2"}
                >
                  <Icon name="flame" size={13} /> Claim today&rsquo;s bonus
                </button>
              </>
            }
          />

          <div className="rf-streak">
            <div className="rf-streak__counter">
              <span className="rf-panel-label">Current run</span>
              <div className="rf-streak__number">
                <b className="mono">{heroStreak}</b>
                <span>days</span>
              </div>
              <p className="rf-muted">
                Started {shortDateOf(streakState.runStartedAt)} · best run {streakState.best} days
              </p>
              <div className="rf-streak__claim">
                <div>
                  <strong>
                    {streakState.todayClaimed
                      ? "Today is claimed"
                      : `${money(streakState.bonusPerDay, 2)} waiting for today`}
                  </strong>
                  <small className="rf-muted mono">
                    Window closes {shortDateOf(streakState.claimWindowEndsAt)} 00:00 UTC
                  </small>
                </div>
                <button
                  type="button"
                  className="rf-btn rf-btn--primary"
                  onClick={() => open("streakWizard")}
                  disabled={Boolean(streakError)}
                >
                  <Icon name="check" size={13} />{" "}
                  {streakState.todayClaimed ? "Already claimed" : "Check in"}
                </button>
              </div>
              {streakError ? <p className="rf-note">{streakError}</p> : null}
            </div>

            <div className="rf-streak__week">
              <div className="rf-week-head">
                <span className="rf-panel-label">This week · Mon 19 → Sun 25 Oct</span>
                <span className="rf-muted mono">
                  {progress.weeklyDone}/7 logged · {money(progress.weeklyBonus, 2)} earned
                </span>
              </div>
              <div className="rf-week">
                {streakState.days.map((day, index) => (
                  <div
                    key={day.key}
                    className={`rf-day ${dayTone(day.state)}`}
                    style={{ "--rf-delay": `${index * 60}ms` } as CSSProperties}
                  >
                    <span className="rf-day__label">{day.label}</span>
                    <span className="rf-day__cell">
                      {day.state === "done" || day.state === "today" ? (
                        <Icon name="check" size={15} />
                      ) : (
                        <Icon name="minus" size={13} />
                      )}
                    </span>
                    <span className="rf-day__date mono">{day.date.slice(8, 10)}</span>
                    <span className="rf-day__bonus mono">
                      {day.state === "done" ? money(day.bonus, 0) : day.state === "today" ? (streakState.todayClaimed ? money(day.bonus, 0) : "due") : "—"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rf-tier-strip">
                {streakState.tiers.map((tier) => (
                  <button
                    key={tier.days}
                    type="button"
                    className={`rf-tier ${tierTone(tier.status)}`}
                    onClick={() => open("streakTiers")}
                  >
                    <span className="rf-tier__days mono">{tier.days} days</span>
                    <b className="mono">{money(tier.amount, 0)}</b>
                    <small>
                      {tier.status === "reached"
                        ? `reached ${shortDateOf(tier.reachedAt ?? asOf)}`
                        : tier.status === "next"
                          ? `${Math.max(0, tier.days - streakState.current)} days to go`
                          : "locked"}
                    </small>
                  </button>
                ))}
              </div>

              <div className="rf-streak__progress">
                <div className="rf-streak__progress-top">
                  <span>{streakSection?.nextTierLabel ?? "Top tier reached"}</span>
                  <span className="mono rf-muted">{pct(progress.pctToNext, 0)}</span>
                </div>
                <Bar value={streakState.current} target={progress.nextTier?.days ?? 30} tone="is-accent" />
              </div>

              <ul className="rf-howto">
                <li>
                  <Icon name="check" size={12} /> Open any investor page once a day — the check-in
                  is the login itself, not a button you can forget.
                </li>
                <li>
                  <Icon name="check" size={12} /> One missed day breaks the run, unless a freeze is
                  armed ({streakState.freezes} left this month).
                </li>
                <li>
                  <Icon name="info" size={12} /> The $2 lands in the credit queue and settles in the
                  next 09:00 UTC batch with everything else.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── 3 · available rewards ── */}
        <section className="rf-section" id="rf-rewards">
          <SectionHead
            code="3 / Available rewards"
            title="What the desk owes you"
            hint="Four cards are open. Three can be claimed right now; the birthday credit opens at 10:00 UTC today."
            aside={
              <>
                <button type="button" className="rf-btn" onClick={() => open("credits")}>
                  <Icon name="wallet" size={13} /> Credit queue {credits.length}
                </button>
                <button type="button" className="rf-btn" onClick={() => open("campaigns")}>
                  <Icon name="bolt" size={13} /> Campaigns
                </button>
                <button
                  type="button"
                  className="rf-btn rf-btn--primary"
                  onClick={() => open("claimWizard", () => setClaimTargetId("all"))}
                  disabled={!claimable.length}
                >
                  <Icon name="gift" size={13} /> Claim all {money(claimableTotal, 2)}
                </button>
              </>
            }
          />

          <div className="rf-rewards">
            <div className="rf-reward-grid">
              {rewards.map((reward, index) => {
                const ready = claimable.some((row) => row.id === reward.id);
                const opensLater = Boolean(reward.availableFrom && reward.availableFrom > asOf);
                return (
                  <article
                    key={reward.id}
                    className={`rf-reward ${ready ? "is-ready" : opensLater ? "is-soon" : "is-locked"}`}
                    style={{ "--rf-delay": `${index * 70}ms` } as CSSProperties}
                  >
                    <header className="rf-reward__head">
                      <span className="rf-reward__icon">
                        <Icon
                          name={
                            reward.kind === "birthday"
                              ? "gift"
                              : reward.kind === "streak_tier"
                                ? "flame"
                                : reward.kind === "early_bird"
                                  ? "bolt"
                                  : "users"
                          }
                          size={16}
                        />
                      </span>
                      <div>
                        <strong>{reward.title}</strong>
                        <span className="rf-muted mono">{rewardKindLabel(reward.kind)}</span>
                      </div>
                      <b className="rf-reward__amount mono">{money(reward.amount, 2)}</b>
                    </header>
                    <p className="rf-reward__detail">{reward.detail}</p>
                    <div className="rf-reward__meta">
                      <Tag tone={rewardStatusTone(reward.status)}>
                        {opensLater ? "opens today" : ready ? "claimable" : reward.status}
                      </Tag>
                      <span className="rf-muted mono">{reward.requires}</span>
                    </div>
                    <div className="rf-reward__progress">
                      <Bar value={reward.progress} target={reward.target} tone={ready ? "is-good" : ""} />
                      <small className="rf-muted mono">
                        {reward.progress}/{reward.target} · {destinationLabel(reward.creditTo)}
                      </small>
                    </div>
                    <p className="rf-reward__hint">{reward.hint}</p>
                    <div className="rf-reward__actions">
                      {ready ? (
                        <button
                          type="button"
                          className="rf-btn rf-btn--primary rf-claim"
                          onClick={() => open("claimWizard", () => setClaimTargetId(reward.id))}
                        >
                          <Icon name="gift" size={13} /> Claim
                        </button>
                      ) : opensLater ? (
                        <button
                          type="button"
                          className="rf-btn"
                          onClick={() => open("rewardDetail", () => setSelectedRewardId(reward.id))}
                        >
                          <Icon name="clock" size={13} /> Claim on 25 Oct
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rf-btn"
                          onClick={() => open("rewardDetail", () => setSelectedRewardId(reward.id))}
                        >
                          <Icon name="eye" size={13} /> Details
                        </button>
                      )}
                      <button
                        type="button"
                        className="rf-btn rf-btn--ghost"
                        onClick={() => open("rewardDetail", () => setSelectedRewardId(reward.id))}
                      >
                        Why?
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="rf-rewards__side">
              <div className="rf-total-card">
                <span className="rf-panel-label">Claimable now</span>
                <b className="rf-total-card__value mono">${heroClaimable.toLocaleString("en-US")}</b>
                <ul className="rf-total-card__rows">
                  {claimable.map((row) => (
                    <li key={row.id}>
                      <span>{row.title}</span>
                      <b className="mono">{money(row.amount, 2)}</b>
                    </li>
                  ))}
                </ul>
                <div className="rf-total-card__foot">
                  <span className="rf-muted mono">
                    Plus {money(totals.available - claimableTotal, 2)} that opens later today
                  </span>
                  <button
                    type="button"
                    className="rf-link-btn"
                    onClick={() => open("credits")}
                  >
                    Queue <Icon name="arrowRight" size={12} />
                  </button>
                </div>
              </div>

              <div className="rf-campaigns-mini">
                <span className="rf-panel-label">Campaigns</span>
                {campaigns.slice(0, 3).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="rf-campaign-mini"
                    onClick={() =>
                      open(row.joined || row.status !== "active" ? "campaigns" : "joinCampaign", () =>
                        setSelectedCampaignId(row.id),
                      )
                    }
                  >
                    <span className="rf-campaign-mini__body">
                      <strong>{row.name}</strong>
                      <small className="rf-muted">
                        {row.status === "ended"
                          ? "ended"
                          : row.joined
                            ? "joined"
                            : `${row.progress}/${row.target} · ${row.requires}`}
                      </small>
                    </span>
                    <b className="mono">+{money(row.bonus, 0)}</b>
                  </button>
                ))}
                <button type="button" className="rf-link-btn" onClick={() => open("campaigns")}>
                  All campaigns <Icon name="arrowRight" size={12} />
                </button>
              </div>

              <div className="rf-goal-mini">
                <span className="rf-panel-label">Your goal</span>
                <div className="rf-goal-mini__top">
                  <b className="mono">
                    {goalView.current}/{goalView.target}
                  </b>
                  <span className="rf-muted">by {shortDateOf(data.goal.deadline)}</span>
                </div>
                <Bar value={goalView.current} target={goalView.target} tone="is-accent" />
                <button type="button" className="rf-link-btn" onClick={() => open("goal")}>
                  Adjust goal <Icon name="arrowRight" size={12} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4 · referral leaderboard ── */}
        <section className="rf-section" id="rf-board">
          <SectionHead
            code="4 / Referral leaderboard"
            title="Top referrers this month"
            hint="Ranks are by qualified referees, then by earned credits. The board resets at 00:00 UTC on the 1st and the top three share a 10% bonus pool."
            aside={
              <>
                <button type="button" className="rf-btn" onClick={() => open("rankHistory")}>
                  <Icon name="trendUp" size={13} /> Your movement
                </button>
                <button type="button" className="rf-btn" onClick={() => open("leaderboardRules")}>
                  <Icon name="info" size={13} /> How it works
                </button>
              </>
            }
          />

          <div className="rf-board">
            <div className="rf-board__table">
              <div className="rf-board__head">
                <div className="rf-chip-row">
                  {periods.map((row) => (
                    <button
                      key={row.key}
                      type="button"
                      className={`rf-chip ${desk.period === row.key ? "is-active" : ""}`}
                      onClick={() => desk.setPeriod(row.key)}
                    >
                      {row.label}
                    </button>
                  ))}
                </div>
                <span className="rf-muted mono">
                  Resets {shortDateOf(boardSection?.resetAt ?? "2026-11-01T00:00:00Z")} ·{" "}
                  {money(boardSection?.bonusPool ?? 0, 0)} bonus pool
                </span>
              </div>

              <div className="rf-table-wrap">
                <table className="rf-table">
                  <thead>
                    {rankTable.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th key={header.id} scope="col">
                            {header.isPlaceholder ? null : (
                              <button
                                type="button"
                                className="rf-sort"
                                onClick={header.column.getToggleSortingHandler()}
                                disabled={!header.column.getCanSort()}
                              >
                                {header.column.columnDef.header as string}
                                {header.column.getIsSorted() ? (
                                  <Icon name="chevronDown" size={11} />
                                ) : null}
                              </button>
                            )}
                          </th>
                        ))}
                        <th scope="col">
                          <span className="rf-muted">Movement</span>
                        </th>
                        <th scope="col" aria-label="Detail" />
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {rankTable.getRowModel().rows.map(({ original: row }, index) => {
                      const delta = row.previousRank - row.rank;
                      return (
                        <tr
                          key={row.rank}
                          className={`${row.you ? "is-you" : ""} ${row.rank <= 3 ? "is-podium" : ""}`}
                          style={{ "--rf-delay": `${index * 35}ms` } as CSSProperties}
                        >
                          <td data-label="Rank">
                            <span className={`rf-rank ${row.rank <= 3 ? `is-${row.rank}` : ""}`}>
                              {row.rank <= 3 ? <Icon name="trophy" size={13} /> : null}
                              <b className="mono">{row.rank}</b>
                            </span>
                          </td>
                          <td data-label="Referrer">
                            <span className="rf-board__alias">
                              <b>{row.alias}</b>
                              <small className="rf-muted">{row.country}</small>
                            </span>
                          </td>
                          <td data-label="Referrals">
                            <b className="mono">{row.referrals}</b>
                          </td>
                          <td data-label="Earned">
                            <b className="mono is-pos">{money(row.earned, 0)}</b>
                          </td>
                          <td data-label="Movement">
                            <span
                              className={`rf-delta ${delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat"}`}
                            >
                              {delta > 0 ? (
                                <>
                                  <Icon name="trendUp" size={12} /> {delta}
                                </>
                              ) : delta < 0 ? (
                                <>
                                  <Icon name="trendDown" size={12} /> {Math.abs(delta)}
                                </>
                              ) : (
                                "—"
                              )}
                            </span>
                          </td>
                          <td className="rf-table__action" data-label="Detail">
                            <button
                              type="button"
                              className="rf-btn rf-btn--sm"
                              title={`Why ${row.alias} sits at rank ${row.rank}`}
                              onClick={() => open("leaderboardRules")}
                            >
                              Rules
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="rf-board__you">
              <span className="rf-panel-label">Where you sit</span>
              <div className="rf-you">
                <span className="rf-you__rank mono">
                  <small>RANK</small>
                  {board.you?.rank ?? 12}
                </span>
                <div className="rf-you__body">
                  <strong>{board.you?.alias}</strong>
                  <small className="rf-muted">
                    {board.you?.referrals} qualified · {money(board.you?.earned ?? 0, 0)} earned
                  </small>
                </div>
                <span className="rf-you__star" title="You">
                  <Icon name="target" size={15} />
                </span>
              </div>
              <Kv
                rows={[
                  ["Gap to rank 11", board.gapToNext ? `${board.gapToNext} qualified` : "level on referees — behind on earnings"],
                  ["Top-10 cut", "6 qualified"],
                  ["Movement", `${board.movement.up} up · ${board.movement.down} down`],
                  ["Visibility", prefs.leaderboardVisible ? "Shown as Jane Investor" : "Masked as user_••••"],
                ]}
              />
              <p className="rf-note">
                <Icon name="info" size={12} /> You are level on referees with rank 11 but $215
                behind on credits — one more milestone clears both.
              </p>
              <div className="rf-drawer-actions">
                <button
                  type="button"
                  className="rf-btn rf-btn--primary"
                  onClick={() => open("shareWizard")}
                >
                  <Icon name="link" size={13} /> Close the gap
                </button>
                <button type="button" className="rf-btn" onClick={() => setDrawer("board")}>
                  Open drawer
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* ── 5 · reward history ── */}
        <section className="rf-section" id="rf-history">
          <SectionHead
            code="5 / Reward history"
            title="Every settled credit"
            hint="One line per credit, newest first, with the reference the wallet statement will show. Credits queue at 09:00 UTC and settle with the batch."
            aside={
              <>
                <button type="button" className="rf-btn" onClick={() => open("auditTrail")}>
                  <Icon name="terminal" size={13} /> Audit
                </button>
                <button type="button" className="rf-btn" onClick={() => open("exportWizard")}>
                  <Icon name="download" size={13} /> Export
                </button>
              </>
            }
          />

          <div className="rf-history">
            <div className="rf-history__table">
              <table className="rf-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Reward</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row, index) => (
                    <tr
                      key={row.id}
                      style={{ "--rf-delay": `${index * 40}ms` } as CSSProperties}
                      className={row.claimed ? "" : "is-queued"}
                    >
                      <td data-label="Date">
                        <span className="mono rf-muted">
                          {shortDateOf(row.at)} · {clockShort(row.at)} UTC
                        </span>
                      </td>
                      <td data-label="Reward">
                        <b>{row.title}</b>
                      </td>
                      <td data-label="Kind">
                        <Tag tone="is-plain">{rewardKindLabel(row.kind)}</Tag>
                      </td>
                      <td data-label="Reference">
                        <button
                          type="button"
                          className="rf-ref mono"
                          onClick={() => open("historyDetail", () => setSelectedHistoryId(row.id))}
                        >
                          {row.reference}
                        </button>
                      </td>
                      <td data-label="Amount">
                        <b className="mono is-pos">+{money(row.amount, 2)}</b>
                      </td>
                      <td data-label="Detail">
                        <span className="rf-muted">{row.detail}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <footer className="rf-history__foot">
                <span className="rf-muted mono">
                  {historySection?.total ?? data.history.length} entries ·{" "}
                  {money(historyInfo.claimed, 2)} settled · {money(historyInfo.queued, 2)} queued
                </span>
                <div className="rf-pager">
                  <button
                    type="button"
                    className="rf-btn rf-btn--sm"
                    disabled={desk.historyPage <= 1}
                    onClick={() => desk.setHistoryPage(Math.max(1, desk.historyPage - 1))}
                  >
                    <Icon name="arrowLeft" size={12} /> Prev
                  </button>
                  <span className="mono rf-muted">
                    Page {historySection?.page ?? 1} of {historySection?.pages ?? 1}
                  </span>
                  <button
                    type="button"
                    className="rf-btn rf-btn--sm"
                    disabled={(historySection?.page ?? 1) >= (historySection?.pages ?? 1)}
                    onClick={() => desk.setHistoryPage(desk.historyPage + 1)}
                  >
                    Next <Icon name="arrowRight" size={12} />
                  </button>
                </div>
              </footer>
            </div>

            <aside className="rf-history__side">
              <div className="rf-history__totals">
                <span className="rf-panel-label">Statement totals</span>
                <Figure label="Settled" value={historyInfo.claimed} prefix="$" decimals={2} tone="is-pos" />
                <Figure label="Queued" value={historyInfo.queued} prefix="$" decimals={2} tone="is-accent" />
                <Figure label="Referral earned" value={stats.earned} prefix="$" decimals={0} hint="Lifetime, all referees" />
              </div>

              <div className="rf-history__credits">
                <span className="rf-panel-label">Credit queue</span>
                {credits.slice(0, 3).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="rf-credit-mini"
                    onClick={() => open("credits", () => setSelectedCreditId(row.id))}
                  >
                    <span className="rf-credit-mini__body">
                      <strong className="mono">{row.reference}</strong>
                      <small className="rf-muted">{row.source}</small>
                    </span>
                    <span className="rf-credit-mini__right">
                      <b className="mono">{money(row.amount, 2)}</b>
                      <small className={`rf-status-dot ${row.status === "posted" ? "is-ok" : "is-wait"}`}>
                        {row.status}
                      </small>
                    </span>
                  </button>
                ))}
                <button type="button" className="rf-link-btn" onClick={() => open("credits")}>
                  All credits ({creditInfo.queued + creditInfo.posted > 0 ? credits.length : 0}){" "}
                  <Icon name="arrowRight" size={12} />
                </button>
              </div>

              <div className="rf-history__note">
                <p className="rf-note">
                  <Icon name="info" size={12} /> {money(stats.earned, 0)} is the lifetime referral
                  figure across all referees; this statement starts at the account opening on 12 Sep,
                  so the $100 streak tier and the $5 welcome credit sit alongside the referral lines.
                </p>
                <button type="button" className="rf-link-btn" onClick={() => open("terms")}>
                  Programme terms <Icon name="arrowRight" size={12} />
                </button>
              </div>
            </aside>
          </div>
        </section>

        {/* ── desk-level shortcuts ── */}
        <div className="rf-shortcuts">
          <button type="button" onClick={() => open("programRules")}>
            <Icon name="info" size={14} /> Ladder rules
          </button>
          <button type="button" onClick={() => open("codePanel")}>
            <Icon name="target" size={14} /> Code card
          </button>
          <button type="button" onClick={() => open("pendingInvites")}>
            <Icon name="send" size={14} /> Sent {data.sent.length}/{MAX_SENT_INVITES}
          </button>
          <button type="button" onClick={() => open("preferencesWizard")}>
            <Icon name="sliders" size={14} /> Preferences
          </button>
          <button type="button" onClick={() => open("exportWizard")}>
            <Icon name="download" size={14} /> Exports {data.exports.length}/{MAX_EXPORTS}
          </button>
          <button type="button" onClick={() => open("auditTrail")}>
            <Icon name="terminal" size={14} /> Audit {data.audit.length}
          </button>
          <button type="button" onClick={() => open("resetRewards")}>
            <Icon name="refresh" size={14} /> Reset demo
          </button>
          <button type="button" onClick={() => open("boundaries")}>
            <Icon name="info" size={14} /> What is real here
          </button>
        </div>

        {/* ── right drawer ── */}
        {drawer ? (
          <div className="rf-drawer-layer" role="presentation" onClick={() => setDrawer(null)}>
            <aside
              className="rf-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Referral desk drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="rf-drawer__head">
                <div>
                  <span className="rf-panel-label">Rewards desk</span>
                  <h2>
                    {drawer === "share"
                      ? "Share & invite"
                      : drawer === "streak"
                        ? "Streak desk"
                        : "Leaderboard"}
                  </h2>
                </div>
                <button
                  type="button"
                  className="rf-icon-btn"
                  aria-label="Close drawer"
                  onClick={() => setDrawer(null)}
                >
                  <Icon name="close" size={15} />
                </button>
              </header>

              <div className="rf-drawer__tabs" role="tablist">
                {(["share", "streak", "board"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={drawer === tab}
                    className={drawer === tab ? "is-active" : ""}
                    onClick={() => setDrawer(tab)}
                  >
                    {tab === "share" ? "Share" : tab === "streak" ? "Streak" : "Board"}
                  </button>
                ))}
              </div>

              <div className="rf-drawer__body">
                {drawer === "share" ? (
                  <>
                    <div className="rf-drawer__code">
                      <span className="rf-panel-label">Code</span>
                      <b className="mono">{program.code}</b>
                      <button
                        type="button"
                        className="rf-btn rf-btn--sm"
                        onClick={() => void copy(program.code, "Referral code", "code")}
                      >
                        <Icon name="copy" size={12} /> Copy
                      </button>
                    </div>
                    <div className="rf-drawer__list">
                      {shareChannels.map((channel) => (
                        <button
                          key={channel.key}
                          type="button"
                          className="rf-drawer__row"
                          onClick={() =>
                            open("shareWizard", () => {
                              setShareChannel(channel.key);
                              setShareTarget("");
                            })
                          }
                        >
                          <Icon name={channel.icon} size={14} />
                          <span>
                            <strong>{channel.label}</strong>
                            <small className="rf-muted">{channel.hint}</small>
                          </span>
                          <Icon name="chevronRight" size={13} />
                        </button>
                      ))}
                    </div>
                    <span className="rf-panel-label">Recent shares</span>
                    <ul className="rf-timeline">
                      {data.shares.slice(0, 4).map((row) => (
                        <li key={`${row.channel}-${row.at}`}>
                          <span className="rf-timeline__dot" />
                          <span>
                            <strong>{channelLabel(row.channel)}</strong>
                            <small className="rf-muted mono">
                              {shortDateOf(row.at)} · {row.target ?? "link copied"}
                            </small>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="rf-drawer-actions">
                      <button
                        type="button"
                        className="rf-btn rf-btn--primary"
                        onClick={() => open("inviteWizard")}
                      >
                        <Icon name="send" size={13} /> Invite by email
                      </button>
                      <button type="button" className="rf-btn" onClick={() => open("pendingInvites")}>
                        Sent invites
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "streak" ? (
                  <>
                    <div className="rf-drawer__streak">
                      <b className="mono">{streakState.current}</b>
                      <span>
                        <strong>day run</strong>
                        <small className="rf-muted">best {streakState.best} · {streakState.freezes} freeze left</small>
                      </span>
                    </div>
                    <div className="rf-week is-compact">
                      {streakState.days.map((day) => (
                        <div key={day.key} className={`rf-day ${dayTone(day.state)}`}>
                          <span className="rf-day__label">{day.label}</span>
                          <span className="rf-day__cell">
                            {day.state === "done" || day.state === "today" ? (
                              <Icon name="check" size={13} />
                            ) : (
                              <Icon name="minus" size={11} />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    <ul className="rf-timeline">
                      {streakState.tiers.map((tier) => (
                        <li key={tier.days}>
                          <span className={`rf-timeline__dot ${tierTone(tier.status)}`} />
                          <span>
                            <strong>
                              {tier.days}-day tier · {money(tier.amount, 0)}
                            </strong>
                            <small className="rf-muted">
                              {tier.status === "reached"
                                ? `reached ${shortDateOf(tier.reachedAt ?? asOf)}`
                                : tier.status === "next"
                                  ? `${Math.max(0, tier.days - streakState.current)} days away`
                                  : "locked"}
                            </small>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="rf-drawer-actions">
                      <button
                        type="button"
                        className="rf-btn rf-btn--primary"
                        onClick={() => open("streakWizard")}
                        disabled={Boolean(streakError)}
                      >
                        <Icon name="check" size={13} /> Check in
                      </button>
                      <button type="button" className="rf-btn" onClick={() => open("freezes")}>
                        Freezes
                      </button>
                      <button type="button" className="rf-btn" onClick={() => open("streakTiers")}>
                        Tiers
                      </button>
                    </div>
                  </>
                ) : null}

                {drawer === "board" ? (
                  <>
                    <div className="rf-drawer__you">
                      <span className="rf-you__rank mono">
                        <small>RANK</small>
                        {board.you?.rank ?? 12}
                      </span>
                      <span>
                        <strong>{board.you?.alias}</strong>
                        <small className="rf-muted">
                          {board.you?.referrals} qualified · {money(board.you?.earned ?? 0, 0)}
                        </small>
                      </span>
                    </div>
                    <ul className="rf-timeline">
                      {board.rows.slice(0, 5).map((row) => (
                        <li key={row.rank}>
                          <span className="rf-timeline__dot" />
                          <span>
                            <strong>
                              #{row.rank} {row.alias}
                            </strong>
                            <small className="rf-muted">
                              {row.referrals} refs · {money(row.earned, 0)}
                            </small>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="rf-drawer-actions">
                      <button
                        type="button"
                        className="rf-btn rf-btn--primary"
                        onClick={() => open("leaderboardRules")}
                      >
                        <Icon name="info" size={13} /> Ranking rules
                      </button>
                      <button type="button" className="rf-btn" onClick={() => open("rankHistory")}>
                        My movement
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        {/* ── modals ── */}
        {modal ? (
          <div className="rf-modal-layer">
            <DeskModalShell
              code="I-10"
              eyebrow="INVESTOR WORKSPACE / REWARDS DESK"
              title={titles[modal.kind]}
              subtitle="Claims, invites, sharing and preferences run through the same command contract the rewards API exposes — every write is validated before it touches the snapshot."
              size={modalSize[modal.kind] ?? "md"}
              onClose={close}
              steps={wizard}
              currentStep={wizardStep}
              footer={modalFooter}
            >
              {error ? (
                <p className="rf-error" role="alert">
                  {error}
                </p>
              ) : null}

              {/* ── share wizard ── */}
              {modal.kind === "shareWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="rf-modal-lede">
                      Pick the channel. Every channel copies the link first, then records
                      the share — nothing is posted on your behalf from this demo.
                    </p>
                    <div className="rf-option-grid">
                      {shareChannels.map((channel) => (
                        <button
                          key={channel.key}
                          type="button"
                          className={`rf-option ${shareChannel === channel.key ? "is-active" : ""}`}
                          onClick={() => setShareChannel(channel.key)}
                        >
                          <Icon name={channel.icon} size={16} />
                          <strong>{channel.label}</strong>
                          <small>{channel.hint}</small>
                        </button>
                      ))}
                    </div>
                    {shareChannel !== "copy" ? (
                      <label className="rf-field">
                        <span>
                          {shareChannel === "email"
                            ? "Send to"
                            : shareChannel === "telegram"
                              ? "Channel or handle"
                              : "Handle (optional)"}
                        </span>
                        <input
                          type="text"
                          value={shareTarget}
                          placeholder={
                            shareChannel === "email"
                              ? "friend@example.com"
                              : shareChannel === "telegram"
                                ? "@mycommunity"
                                : "@handle"
                          }
                          onChange={(event) => setShareTarget(event.target.value)}
                        />
                      </label>
                    ) : null}
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="rf-modal-lede">
                      This is the message that travels with your code. Edit the target,
                      then continue.
                    </p>
                    <div className="rf-message-preview mono">
                      <p>
                        Jane Investor invited you to tradeMO — pooled crypto and FX
                        strategies, booked by the slot.
                      </p>
                      <p>
                        Use my code <b>{program.code}</b> when you sign up and your first
                        deposit counts towards my ladder.
                      </p>
                      <p>{program.link}</p>
                    </div>
                    <div className="rf-modal-actions">
                      <button
                        type="button"
                        className="rf-btn rf-btn--sm"
                        onClick={() =>
                          void copy(
                            `${program.link} · code ${program.code}`,
                            "Invite message",
                          )
                        }
                      >
                        <Icon name="copy" size={12} /> Copy message
                      </button>
                      {shareTarget ? (
                        <span className="rf-muted mono">To: {shareTarget}</span>
                      ) : (
                        <span className="rf-muted">No target — the link goes to the clipboard</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Kv
                      rows={[
                        ["Channel", channelLabel(shareChannel)],
                        ["Target", shareTarget.trim() || "clipboard only"],
                        ["Code", program.code],
                        ["Cookie", `${program.cookieDays} days on the referee's device`],
                        ["Ladder cap", `${money(program.maxPerReferral, 0)} per referee`],
                        ["First credit", "$5 when they sign up"],
                      ]}
                    />
                    <p className="rf-modal-note">
                      <Icon name="info" size={13} /> The share is recorded on this snapshot;
                      the clipboard hand-off is real, the post is not.
                    </p>
                  </>
                )
              ) : null}

              {/* ── invite wizard ── */}
              {modal.kind === "inviteWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="rf-modal-lede">
                      Up to {MAX_INVITES_PER_SEND} addresses at a time, separated by commas
                      or new lines. You hold {data.sent.length} of {MAX_SENT_INVITES} open
                      invites.
                    </p>
                    <label className="rf-field">
                      <span>Email addresses</span>
                      <textarea
                        rows={5}
                        value={inviteEmails}
                        placeholder={"grace@example.com, brian@example.com"}
                        onChange={(event) => setInviteEmails(event.target.value)}
                      />
                      <small className="rf-muted mono">
                        {inviteDraftEmails.length}/{MAX_INVITES_PER_SEND} parsed
                      </small>
                    </label>
                    <div className="rf-chip-row">
                      {data.sent.slice(0, 2).map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          className="rf-chip"
                          onClick={() =>
                            setInviteEmails((prev) =>
                              prev.includes(row.email) ? prev : `${prev}${prev ? ", " : ""}${row.email}`,
                            )
                          }
                        >
                          <Icon name="plus" size={11} /> {row.email}
                        </button>
                      ))}
                    </div>
                    {inviteError && inviteDraftEmails.length ? (
                      <p className="rf-note is-warn">{inviteError}</p>
                    ) : null}
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="rf-modal-lede">
                      A short note travels with the invite. Keep it under 240 characters.
                    </p>
                    <label className="rf-field">
                      <span>Note</span>
                      <textarea
                        rows={4}
                        value={inviteNote}
                        placeholder="PKG-02 closes on Sunday — worth a look before it fills."
                        onChange={(event) => setInviteNote(event.target.value)}
                      />
                      <small className="rf-muted mono">{inviteNote.length}/240</small>
                    </label>
                    <div className="rf-invite-preview">
                      <span className="rf-panel-label">Preview</span>
                      <p className="mono">
                        {inviteDraftEmails.length
                          ? inviteDraftEmails.join(", ")
                          : "no recipients yet"}
                      </p>
                      <p>{inviteNote || "No note — the invite goes out bare."}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Kv
                      rows={[
                        ["Recipients", inviteDraftEmails.join(", ") || "—"],
                        ["Note", inviteNote || "none"],
                        ["Open invites after", `${data.sent.length + inviteDraftEmails.length}/${MAX_SENT_INVITES}`],
                        ["What they get", "The $5 signup rung counts for you, not them"],
                        ["Expiry", `${program.cookieDays} days`],
                      ]}
                    />
                    <p className="rf-modal-note">
                      <Icon name="alert" size={13} /> Nothing is emailed from this demo — the
                      invites land in your sent list as local drafts.
                    </p>
                  </>
                )
              ) : null}

              {/* ── claim wizard ── */}
              {modal.kind === "claimWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="rf-modal-lede">
                      Choose one card, or claim everything that is open right now.
                    </p>
                    <div className="rf-option-stack">
                      <button
                        type="button"
                        className={`rf-option-row ${claimTargetId === "all" ? "is-active" : ""}`}
                        onClick={() => setClaimTargetId("all")}
                      >
                        <Icon name="gift" size={15} />
                        <span>
                          <strong>Everything claimable</strong>
                          <small>
                            {claimable.length} card{claimable.length === 1 ? "" : "s"} ·{" "}
                            {claimable.map((row) => row.title).join(" · ") || "nothing open"}
                          </small>
                        </span>
                        <b className="mono">{money(claimableTotal, 2)}</b>
                      </button>
                      {rewards.map((reward) => {
                        const ready = claimable.some((row) => row.id === reward.id);
                        return (
                          <button
                            key={reward.id}
                            type="button"
                            className={`rf-option-row ${claimTargetId === reward.id ? "is-active" : ""}`}
                            onClick={() => setClaimTargetId(reward.id)}
                          >
                            <Icon name={ready ? "check" : "lock"} size={15} />
                            <span>
                              <strong>{reward.title}</strong>
                              <small>
                                {ready ? reward.requires : `${reward.requires} · opens ${shortDateOf(reward.availableFrom ?? asOf)}`}
                              </small>
                            </span>
                            <b className="mono">{money(reward.amount, 2)}</b>
                          </button>
                        );
                      })}
                    </div>
                    {claimError ? <p className="rf-note is-warn">{claimError}</p> : null}
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="rf-modal-lede">
                      Pick where the credit should land. The wallet settles in the next
                      09:00 UTC batch; bonus credit stays inside the platform.
                    </p>
                    <div className="rf-option-grid is-two">
                      {(["wallet", "bonus_credit"] as PayoutDestination[]).map((destination) => (
                        <button
                          key={destination}
                          type="button"
                          className={`rf-option ${claimDestination === destination ? "is-active" : ""}`}
                          onClick={() => setClaimDestination(destination)}
                        >
                          <Icon name={destination === "wallet" ? "wallet" : "vault"} size={16} />
                          <strong>{destinationLabel(destination)}</strong>
                          <small>
                            {destination === "wallet"
                              ? `Cash, withdrawable · ${program.settlementWindow}`
                              : "Stays as trading credit · no payout fee"}
                          </small>
                        </button>
                      ))}
                    </div>
                    <Kv
                      rows={[
                        ["Wallet available", money(data.profile.wallet, 2)],
                        ["Fee on payout", "$1.50 flat"],
                        ["Net if claimed to wallet", money(Math.max(0, (claimTargetId === "all" ? claimableTotal : (claimCandidate?.amount ?? 0)) - 1.5), 2)],
                      ]}
                    />
                  </>
                ) : (
                  <>
                    <Kv
                      rows={[
                        [
                          "Claiming",
                          claimTargetId === "all"
                            ? `${claimable.length} rewards`
                            : (claimCandidate?.title ?? "—"),
                        ],
                        ["Amount", money(claimTargetId === "all" ? claimableTotal : (claimCandidate?.amount ?? 0), 2)],
                        ["Destination", destinationLabel(claimDestination)],
                        ["Settles", program.settlementWindow],
                        ["Reference", "RW-20261025-0005"],
                      ]}
                    />
                    <p className="rf-modal-note">
                      <Icon name="info" size={13} /> The claim writes a queued credit and adds the
                      row to your statement. The wallet balance on the left updates with the
                      snapshot, not with a real transfer.
                    </p>
                  </>
                )
              ) : null}

              {/* ── streak wizard ── */}
              {modal.kind === "streakWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <div className="rf-checkin">
                      <span className="rf-checkin__number mono">{streakState.current}</span>
                      <div>
                        <strong>Day {streakState.current} · {dayName(asOf)} check-in</strong>
                        <small className="rf-muted mono">
                          Last activity {shortDateOf(streakState.lastActiveAt)}{" "}
                          {clockShort(streakState.lastActiveAt)} UTC
                        </small>
                      </div>
                    </div>
                    <div className="rf-week is-compact">
                      {streakState.days.map((day) => (
                        <div key={day.key} className={`rf-day ${dayTone(day.state)}`}>
                          <span className="rf-day__label">{day.label}</span>
                          <span className="rf-day__cell">
                            {day.state === "done" || day.state === "today" ? (
                              <Icon name="check" size={13} />
                            ) : (
                              <Icon name="minus" size={11} />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    {streakError ? <p className="rf-note is-warn">{streakError}</p> : null}
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <Kv
                      rows={[
                        ["Today's bonus", money(streakState.bonusPerDay, 2)],
                        ["This week", money(progress.weeklyBonus, 2)],
                        ["Next tier", streakSection?.nextTierLabel ?? "top tier reached"],
                        ["Freezes left", String(streakState.freezes)],
                        ["Settles", program.settlementWindow],
                      ]}
                    />
                    <p className="rf-modal-note">
                      <Icon name="info" size={13} /> The $2 keeps coming while the run is alive;
                      the tiers pay once when you cross 7, 14 and 30 days.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="rf-modal-lede">
                      Check in and {money(streakState.bonusPerDay, 2)} joins the credit queue.
                      Tomorrow the counter reads {streakState.current + 1}.
                    </p>
                    <Kv
                      rows={[
                        ["Streak after", `${streakState.current} → ${streakState.current + 1} days`],
                        ["Best run stays", `${streakState.best} days`],
                        ["Credit queue", `${credits.filter((row) => row.status === "queued").length} queued`],
                      ]}
                    />
                  </>
                )
              ) : null}

              {/* ── preferences wizard ── */}
              {modal.kind === "preferencesWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="rf-modal-lede">
                      Tell the desk which events are worth a message. Alerts never move money.
                    </p>
                    <div className="rf-toggle-stack">
                      <Toggle
                        label="Milestone alerts"
                        hint="A referee clears a rung"
                        checked={draftPrefs.milestoneAlerts}
                        onChange={(next) => setDraftPrefs((prev) => ({ ...prev, milestoneAlerts: next }))}
                      />
                      <Toggle
                        label="Weekly summary"
                        hint="Sunday 18:00 UTC · referrals, credits, streak"
                        checked={draftPrefs.weeklySummary}
                        onChange={(next) => setDraftPrefs((prev) => ({ ...prev, weeklySummary: next }))}
                      />
                      <Toggle
                        label="Campaign news"
                        hint="New bonuses and double-up weeks"
                        checked={draftPrefs.marketing}
                        onChange={(next) => setDraftPrefs((prev) => ({ ...prev, marketing: next }))}
                      />
                      <Toggle
                        label="Freeze auto-use"
                        hint="Spend a freeze automatically on a missed day"
                        checked={draftPrefs.freezeAutoUse}
                        onChange={(next) => setDraftPrefs((prev) => ({ ...prev, freezeAutoUse: next }))}
                      />
                    </div>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <span className="rf-panel-label">Payout destination</span>
                    <div className="rf-option-grid is-two">
                      {(["wallet", "bonus_credit"] as PayoutDestination[]).map((destination) => (
                        <button
                          key={destination}
                          type="button"
                          className={`rf-option ${draftPrefs.payoutDestination === destination ? "is-active" : ""}`}
                          onClick={() =>
                            setDraftPrefs((prev) => ({ ...prev, payoutDestination: destination }))
                          }
                        >
                          <Icon name={destination === "wallet" ? "wallet" : "vault"} size={16} />
                          <strong>{destinationLabel(destination)}</strong>
                          <small>
                            {destination === "wallet"
                              ? "Withdrawable cash, $1.50 per payout"
                              : "Trading credit, no fee, cannot be withdrawn"}
                          </small>
                        </button>
                      ))}
                    </div>
                    <div className="rf-toggle-stack">
                      <Toggle
                        label="Auto-claim rewards"
                        hint="Claim every available card as it unlocks"
                        checked={draftPrefs.autoClaim}
                        onChange={(next) => setDraftPrefs((prev) => ({ ...prev, autoClaim: next }))}
                      />
                      <Toggle
                        label="Show me on the leaderboard"
                        hint={draftPrefs.leaderboardVisible ? "Shown as Jane Investor" : "Shown as user_••••"}
                        checked={draftPrefs.leaderboardVisible}
                        onChange={(next) => setDraftPrefs((prev) => ({ ...prev, leaderboardVisible: next }))}
                      />
                    </div>
                    <span className="rf-panel-label">Default share channel</span>
                    <div className="rf-chip-row">
                      {shareChannels.map((channel) => (
                        <button
                          key={channel.key}
                          type="button"
                          className={`rf-chip ${draftPrefs.shareDefault === channel.key ? "is-active" : ""}`}
                          onClick={() =>
                            setDraftPrefs((prev) => ({ ...prev, shareDefault: channel.key }))
                          }
                        >
                          <Icon name={channel.icon} size={11} /> {channel.label}
                        </button>
                      ))}
                    </div>
                    {prefsError ? <p className="rf-note is-warn">{prefsError}</p> : null}
                  </>
                ) : (
                  <Kv
                    rows={[
                      ["Milestone alerts", draftPrefs.milestoneAlerts ? "on" : "off"],
                      ["Weekly summary", draftPrefs.weeklySummary ? "on" : "off"],
                      ["Campaign news", draftPrefs.marketing ? "on" : "off"],
                      ["Auto-claim", draftPrefs.autoClaim ? "on" : "manual"],
                      ["Destination", destinationLabel(draftPrefs.payoutDestination)],
                      ["Leaderboard", draftPrefs.leaderboardVisible ? "visible" : "masked"],
                      ["Default share", channelLabel(draftPrefs.shareDefault)],
                    ]}
                  />
                )
              ) : null}

              {/* ── export wizard ── */}
              {modal.kind === "exportWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="rf-modal-lede">
                      Pick the slice. The file is generated in this browser from the same
                      snapshot the page renders.
                    </p>
                    <div className="rf-option-stack">
                      {exportScopes.map((scope) => (
                        <button
                          key={scope.key}
                          type="button"
                          className={`rf-option-row ${exportScope === scope.key ? "is-active" : ""}`}
                          onClick={() => setExportScope(scope.key)}
                        >
                          <Icon name="file" size={15} />
                          <span>
                            <strong>{scope.label}</strong>
                            <small>{scope.hint}</small>
                          </span>
                          <b className="mono">
                            {exportMatrix(data, scope.key).rows.length} rows
                          </b>
                        </button>
                      ))}
                    </div>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <div className="rf-option-grid">
                      {exportFormats.map((format) => (
                        <button
                          key={format.key}
                          type="button"
                          className={`rf-option ${exportFormat === format.key ? "is-active" : ""}`}
                          onClick={() => setExportFormat(format.key)}
                        >
                          <Icon name="download" size={16} />
                          <strong>{format.label}</strong>
                          <small>{format.hint}</small>
                        </button>
                      ))}
                    </div>
                    <div className="rf-export-preview">
                      <span className="rf-panel-label">Preview</span>
                      <p className="mono rf-muted">
                        {exportPreview.header.join(" · ")}
                      </p>
                      <p className="mono">
                        {exportPreview.rows[0]?.join(" · ") ?? "no rows"}
                      </p>
                    </div>
                  </>
                ) : (
                  <Kv
                    rows={[
                      ["Statement", exportPreview.title],
                      ["Format", exportFormat.toUpperCase()],
                      ["Rows", String(exportPreview.rows.length)],
                      ["Generated from", `Snapshot ${shortDateOf(asOf)} ${clockShort(asOf)} UTC`],
                      ["Exports this session", `${data.exports.length}/${MAX_EXPORTS}`],
                    ]}
                  />
                )
              ) : null}

              {/* ── support wizard ── */}
              {modal.kind === "supportWizard" ? (
                wizardStep === 0 ? (
                  <>
                    <p className="rf-modal-lede">
                      What does the rewards desk need to look at?
                    </p>
                    <div className="rf-option-stack">
                      {supportTopics.map((topic) => (
                        <button
                          key={topic.key}
                          type="button"
                          className={`rf-option-row ${supportTopic === topic.key ? "is-active" : ""}`}
                          onClick={() => setSupportTopic(topic.key)}
                        >
                          <Icon name="mail" size={15} />
                          <span>
                            <strong>{topic.label}</strong>
                            <small>{topic.hint}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : wizardStep === 1 ? (
                  <>
                    <p className="rf-modal-lede">
                      Give the desk the details — reference numbers help. Minimum 12 characters.
                    </p>
                    <label className="rf-field">
                      <span>Message</span>
                      <textarea
                        rows={5}
                        value={supportMessage}
                        placeholder="The 14-day tier was reached on 8 Oct but never appeared in my credit queue."
                        onChange={(event) => setSupportMessage(event.target.value)}
                      />
                      <small className="rf-muted mono">{supportMessage.length}/1000</small>
                    </label>
                    <div className="rf-chip-row">
                      <button
                        type="button"
                        className="rf-chip"
                        onClick={() =>
                          setSupportMessage(
                            `Reward ${claimCandidate?.title ?? "detail"} (${claimCandidate?.id ?? "n/a"}) — reference ${data.history[0]?.reference ?? "n/a"}. `,
                          )
                        }
                      >
                        <Icon name="plus" size={11} /> Attach latest reference
                      </button>
                      <button
                        type="button"
                        className="rf-chip"
                        onClick={() => setSupportMessage(`Streak day ${streakState.current} did not register. `)}
                      >
                        <Icon name="plus" size={11} /> Streak context
                      </button>
                    </div>
                  </>
                ) : (
                  <Kv
                    rows={[
                      ["Topic", topicLabel(supportTopic)],
                      ["Message", `${supportMessage.trim().length} characters`],
                      ["Drafts this session", `${data.support.length}/${MAX_SUPPORT_DRAFTS}`],
                      ["Reply window", "One business day"],
                    ]}
                  />
                )
              ) : null}

              {/* ── program rules ── */}
              {modal.kind === "programRules" ? (
                <>
                  <p className="rf-modal-lede">
                    Four rungs, one cap. The ladder pays per referee as they move from
                    signup to a funded, retained account.
                  </p>
                  <ol className="rf-rule-list">
                    {program.levels.map((level) => (
                      <li key={level.key}>
                        <b className="mono">{money(level.amount, 0)}</b>
                        <span>
                          <strong>{level.label}</strong>
                          <small>{level.detail}</small>
                          <small className="rf-muted mono">{level.payAt}</small>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <Kv
                    rows={[
                      ["Cap per referee", money(program.maxPerReferral, 0)],
                      ["Cookie window", `${program.cookieDays} days`],
                      ["Settlement", program.settlementWindow],
                      ["Self-referral", "Blocked — the code cannot be used on your own email"],
                      ["Duplicate accounts", "Both accounts are voided and credits reversed"],
                      ["Lapsed referees", "Credits already paid stay paid; pending rungs expire"],
                    ]}
                  />
                  <div className="rf-modal-actions">
                    <button type="button" className="rf-btn" onClick={() => open("terms")}>
                      <Icon name="file" size={13} /> Full terms
                    </button>
                    <button type="button" className="rf-btn" onClick={() => open("inviteLedger")}>
                      <Icon name="users" size={13} /> See the ledger
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── code card ── */}
              {modal.kind === "codePanel" ? (
                <>
                  <p className="rf-modal-lede">
                    This is the code and the link. Both work on any device; the link is
                    what you want to paste.
                  </p>
                  <div className="rf-code-big">
                    <span className="mono">{program.code}</span>
                    <button
                      type="button"
                      className="rf-btn rf-btn--primary"
                      onClick={() => void copy(program.code, "Referral code", "code")}
                    >
                      <Icon name={copied === "code" ? "check" : "copy"} size={13} /> Copy code
                    </button>
                  </div>
                  <label className="rf-field">
                    <span>Referral link</span>
                    <input readOnly value={program.link} onFocus={(event) => event.currentTarget.select()} />
                  </label>
                  <div className="rf-modal-actions">
                    <button
                      type="button"
                      className="rf-btn"
                      onClick={() => void copy(program.link, "Referral link", "link")}
                    >
                      <Icon name={copied === "link" ? "check" : "copy"} size={13} /> Copy link
                    </button>
                    <button type="button" className="rf-btn" onClick={() => open("shareWizard")}>
                      <Icon name="link" size={13} /> Share it
                    </button>
                    <button type="button" className="rf-btn" onClick={() => open("programRules")}>
                      <Icon name="info" size={13} /> How it pays
                    </button>
                  </div>
                  <p className="rf-modal-note">
                    <Icon name="shield" size={13} /> Your code is tied to this account and cannot
                    be changed — it stays with the referees you already have.
                  </p>
                </>
              ) : null}

              {/* ── invite ledger ── */}
              {modal.kind === "inviteLedger" ? (
                <>
                  <p className="rf-modal-lede">
                    All {stats.total} referees, masked by design — you see the handle and
                    the country, never the address.
                  </p>
                  <div className="rf-chip-row">
                    {(["all", "qualified", "pending", "lapsed"] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`rf-chip ${ledgerStage === key ? "is-active" : ""}`}
                        onClick={() => setLedgerStage(key)}
                      >
                        {key === "all" ? "All" : statusLabel(key)}
                      </button>
                    ))}
                    <span className="rf-muted mono">{ledgerRows.length} rows</span>
                  </div>
                  <div className="rf-table-wrap">
                    <table className="rf-table">
                      <thead>
                        <tr>
                          <th scope="col">Referee</th>
                          <th scope="col">Stage</th>
                          <th scope="col">Status</th>
                          <th scope="col">Joined</th>
                          <th scope="col">Pool</th>
                          <th scope="col">Earned</th>
                          <th scope="col">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerRows.map((row) => (
                          <tr key={row.id} className={statusTone(row.status)}>
                            <td data-label="Referee">
                              <span className="rf-board__alias">
                                <b>{row.alias}</b>
                                <small className="rf-muted mono">{row.emailMasked}</small>
                              </span>
                            </td>
                            <td data-label="Stage">
                              <span className="rf-stage-line">
                                {row.milestones.map((milestone) => (
                                  <span
                                    key={milestone.key}
                                    className={`rf-stage-dot ${milestone.at ? "is-done" : ""}`}
                                    title={milestone.label}
                                  />
                                ))}
                                <small className="rf-muted">{stageLabel(row.stage)}</small>
                              </span>
                            </td>
                            <td data-label="Status">
                              <Tag tone={statusTone(row.status)}>{statusLabel(row.status)}</Tag>
                            </td>
                            <td data-label="Joined">
                              <span className="mono rf-muted">{shortDateOf(row.joinedAt)}</span>
                            </td>
                            <td data-label="Pool">
                              <span className="mono">{row.poolCode ?? "—"}</span>
                            </td>
                            <td data-label="Earned">
                              <b className="mono">{money(row.earned, 0)}</b>
                            </td>
                            <td data-label="Detail">
                              <button
                                type="button"
                                className="rf-btn rf-btn--sm"
                                onClick={() => open("inviteDetail", () => setSelectedInviteId(row.id))}
                              >
                                Open
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rf-modal-actions">
                    <button type="button" className="rf-btn" onClick={() => open("exportWizard", () => setExportScope("invites"))}>
                      <Icon name="download" size={13} /> Export ledger
                    </button>
                    <button type="button" className="rf-btn rf-btn--primary" onClick={() => open("inviteWizard")}>
                      <Icon name="send" size={13} /> Invite more
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── invite detail ── */}
              {modal.kind === "inviteDetail" && selectedInvite ? (
                <>
                  <div className="rf-referee">
                    <span className="rf-referee__avatar mono">
                      {selectedInvite.alias.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <strong>{selectedInvite.alias}</strong>
                      <small className="rf-muted mono">
                        {selectedInvite.emailMasked} · {selectedInvite.country}
                      </small>
                    </div>
                    <Tag tone={statusTone(selectedInvite.status)}>
                      {statusLabel(selectedInvite.status)}
                    </Tag>
                    <b className="mono">{money(selectedInvite.earned, 0)}</b>
                  </div>
                  <ul className="rf-timeline">
                    {selectedInvite.milestones.map((milestone) => (
                      <li key={milestone.key}>
                        <span className={`rf-timeline__dot ${milestone.at ? "is-done" : ""}`} />
                        <span>
                          <strong>
                            {milestone.label} · {money(milestone.amount, 0)}
                          </strong>
                          <small className="rf-muted">
                            {milestone.at
                              ? `cleared ${shortDateOf(milestone.at)} ${clockShort(milestone.at)} UTC`
                              : "not cleared yet"}
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Kv
                    rows={[
                      ["Joined", `${shortDateOf(selectedInvite.joinedAt)} · ${relativeTo(selectedInvite.joinedAt, asOf)}`],
                      ["Last activity", `${shortDateOf(selectedInvite.lastActivityAt)} · ${relativeTo(selectedInvite.lastActivityAt, asOf)}`],
                      ["Stage", `${stageLabel(selectedInvite.stage)} (${stageIndex(selectedInvite.stage) + 1} of 4 rungs)`],
                      ["Pool", selectedInvite.poolCode ?? "no booking yet"],
                      ["Still available", money(Math.max(0, program.maxPerReferral - selectedInvite.earned), 0)],
                    ]}
                  />
                  <p className="rf-modal-note">
                    <Icon name="info" size={13} /> {selectedInvite.note}
                  </p>
                  <div className="rf-modal-actions">
                    {selectedInvite.poolCode ? (
                      <Link
                        className="rf-btn"
                        href={`/investor/pools/${selectedInvite.poolCode === "PKG-02" ? "pkg_02" : selectedInvite.poolCode === "PKG-09" ? "pkg_09" : "pkg_01"}`}
                      >
                        <Icon name="pool" size={13} /> Open {selectedInvite.poolCode}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="rf-btn"
                      onClick={() => open("supportWizard", () => setSupportTopic("referral"))}
                    >
                      <Icon name="mail" size={13} /> Ask about this referee
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── pending invites ── */}
              {modal.kind === "pendingInvites" ? (
                <>
                  <p className="rf-modal-lede">
                    {data.sent.length} open invite{data.sent.length === 1 ? "" : "s"} of{" "}
                    {MAX_SENT_INVITES}. Withdrawing one kills the link immediately.
                  </p>
                  <div className="rf-sent-list">
                    {data.sent.map((row) => (
                      <div key={row.id} className="rf-sent">
                        <span className="rf-sent__icon">
                          <Icon name="mail" size={14} />
                        </span>
                        <span className="rf-sent__body">
                          <strong className="mono">{row.email}</strong>
                          <small className="rf-muted">{row.note || "no note"}</small>
                          <small className="rf-muted mono">
                            sent {shortDateOf(row.sentAt)} {clockShort(row.sentAt)} UTC · {row.status}
                          </small>
                        </span>
                        <button
                          type="button"
                          className="rf-btn rf-btn--sm"
                          onClick={() =>
                            open("revokeInvite", () => setSelectedSentId(row.id))
                          }
                        >
                          Withdraw
                        </button>
                      </div>
                    ))}
                    {!data.sent.length ? (
                      <p className="rf-muted rf-empty">No open invites — send one by email.</p>
                    ) : null}
                  </div>
                  <div className="rf-modal-actions">
                    <button type="button" className="rf-btn rf-btn--primary" onClick={() => open("inviteWizard")}>
                      <Icon name="send" size={13} /> New invite
                    </button>
                    <button type="button" className="rf-btn" onClick={() => open("shareHistory")}>
                      <Icon name="clock" size={13} /> Share log
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── revoke invite ── */}
              {modal.kind === "revokeInvite" && selectedSent ? (
                <>
                  <p className="rf-modal-lede">
                    Withdraw the invite to <b className="mono">{selectedSent.email}</b>?
                    The link stops working; if they already signed up, nothing changes.
                  </p>
                  <Kv
                    rows={[
                      ["Sent", `${shortDateOf(selectedSent.sentAt)} ${clockShort(selectedSent.sentAt)} UTC`],
                      ["Note", selectedSent.note || "none"],
                      ["Open invites after", `${Math.max(0, data.sent.length - 1)}/${MAX_SENT_INVITES}`],
                    ]}
                  />
                </>
              ) : null}

              {/* ── share history ── */}
              {modal.kind === "shareHistory" ? (
                <>
                  <p className="rf-modal-lede">
                    Every time the link left this account, in order. Channels only copy
                    the link in this demo — nothing is posted.
                  </p>
                  <ul className="rf-timeline">
                    {data.shares.map((row) => (
                      <li key={`${row.channel}-${row.at}`}>
                        <span className="rf-timeline__dot" />
                        <span>
                          <strong>{channelLabel(row.channel)}</strong>
                          <small className="rf-muted mono">
                            {shortDateOf(row.at)} {clockShort(row.at)} UTC ·{" "}
                            {row.target ?? "clipboard only"}
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="rf-modal-actions">
                    <button type="button" className="rf-btn rf-btn--primary" onClick={() => open("shareWizard")}>
                      <Icon name="link" size={13} /> Share again
                    </button>
                    <button type="button" className="rf-btn" onClick={() => open("exportWizard", () => setExportScope("credits"))}>
                      <Icon name="download" size={13} /> Export credits
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── streak calendar ── */}
              {modal.kind === "streakCalendar" ? (
                <>
                  <p className="rf-modal-lede">
                    The current run started {shortDateOf(streakState.runStartedAt)} and has
                    logged {streakState.daysLogged} days. Your best run is{" "}
                    {streakState.best} days, between 12 Aug and 10 Sep.
                  </p>
                  <div className="rf-week is-wide">
                    {streakState.days.map((day, index) => (
                      <div
                        key={day.key}
                        className={`rf-day ${dayTone(day.state)}`}
                        style={{ "--rf-delay": `${index * 60}ms` } as CSSProperties}
                      >
                        <span className="rf-day__label">{day.label}</span>
                        <span className="rf-day__cell">
                          {day.state === "done" || day.state === "today" ? (
                            <Icon name="check" size={15} />
                          ) : (
                            <Icon name="minus" size={13} />
                          )}
                        </span>
                        <span className="rf-day__date mono">{shortDateOf(day.date)}</span>
                        <span className="rf-day__bonus mono">{money(day.bonus, 0)}</span>
                      </div>
                    ))}
                  </div>
                  <Kv
                    rows={[
                      ["Current run", `${streakState.current} days`],
                      ["Best run", `${streakState.best} days`],
                      ["Days logged", String(streakState.daysLogged)],
                      ["Bonus per day", money(streakState.bonusPerDay, 2)],
                      ["Freezes", `${streakState.freezes} left`],
                      ["Window closes", `${shortDateOf(streakState.claimWindowEndsAt)} 00:00 UTC`],
                    ]}
                  />
                  <div className="rf-modal-actions">
                    <button type="button" className="rf-btn" onClick={() => open("streakTiers")}>
                      <Icon name="trophy" size={13} /> Tiers
                    </button>
                    <button type="button" className="rf-btn rf-btn--primary" onClick={() => open("streakWizard")}>
                      <Icon name="flame" size={13} /> Check in
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── streak tiers ── */}
              {modal.kind === "streakTiers" ? (
                <>
                  <p className="rf-modal-lede">
                    Tiers pay once per run. Crossing a tier does not reset the daily $2.
                  </p>
                  <div className="rf-tier-table">
                    {streakState.tiers.map((tier) => (
                      <div key={tier.days} className={`rf-tier-row ${tierTone(tier.status)}`}>
                        <b className="mono">{tier.days} days</b>
                        <span className="mono">{money(tier.amount, 0)}</span>
                        <span className="rf-muted">
                          {tier.status === "reached"
                            ? `reached ${shortDateOf(tier.reachedAt ?? asOf)}`
                            : tier.status === "next"
                              ? `${Math.max(0, tier.days - streakState.current)} days away`
                              : "locked until the run reaches it"}
                        </span>
                        <Tag tone={tier.status === "reached" ? "is-win" : tier.status === "next" ? "is-wait" : "is-plain"}>
                          {tier.status}
                        </Tag>
                      </div>
                    ))}
                  </div>
                  <p className="rf-modal-note">
                    <Icon name="info" size={13} /> The 30-day tier was last claimed on 15 Sep —
                    that is the $100 line in your statement.
                  </p>
                  <div className="rf-modal-actions">
                    <button type="button" className="rf-btn" onClick={() => open("rewardDetail", () => setSelectedRewardId("rw_streak_14"))}>
                      <Icon name="gift" size={13} /> Unclaimed 14-day tier
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── freezes ── */}
              {modal.kind === "freezes" ? (
                <>
                  <p className="rf-modal-lede">
                    A freeze protects one missed day so the run keeps its count. You hold{" "}
                    {streakState.freezes}; the next one lands at day 20.
                  </p>
                  <Kv
                    rows={[
                      ["Freezes left", String(streakState.freezes)],
                      ["Auto-use", prefs.freezeAutoUse ? "on" : "off"],
                      ["Protected until", streakState.frozenUntil ? shortDateOf(streakState.frozenUntil) : "not armed"],
                      ["Where they come from", "One per 10 days of run, one per campaign"],
                    ]}
                  />
                  <p className="rf-modal-note">
                    <Icon name="shield" size={13} /> Arming a freeze now covers the next missed
                    day only. It does not extend today&rsquo;s claim window.
                  </p>
                </>
              ) : null}

              {/* ── reward detail ── */}
              {modal.kind === "rewardDetail" && selectedReward ? (
                <>
                  <div className="rf-reward-head">
                    <span className="rf-reward__icon">
                      <Icon name="gift" size={18} />
                    </span>
                    <div>
                      <strong>{selectedReward.title}</strong>
                      <small className="rf-muted mono">{rewardKindLabel(selectedReward.kind)}</small>
                    </div>
                    <b className="mono rf-reward__amount">{money(selectedReward.amount, 2)}</b>
                  </div>
                  <p className="rf-modal-lede">{selectedReward.detail}</p>
                  <Kv
                    rows={[
                      ["Status", selectedReward.status],
                      ["Requires", selectedReward.requires],
                      ["Progress", `${selectedReward.progress}/${selectedReward.target}`],
                      ["Opens", selectedReward.availableFrom ? `${shortDateOf(selectedReward.availableFrom)} ${clockShort(selectedReward.availableFrom)} UTC` : "already open"],
                      ["Expires", selectedReward.expiresAt ? shortDateOf(selectedReward.expiresAt) : "never"],
                      ["Destination", destinationLabel(selectedReward.creditTo)],
                      ["Settles", program.settlementWindow],
                    ]}
                  />
                  <p className="rf-modal-note">
                    <Icon name="info" size={13} /> {selectedReward.hint}
                  </p>
                  <div className="rf-modal-actions">
                    {claimable.some((row) => row.id === selectedReward.id) ? (
                      <button
                        type="button"
                        className="rf-btn rf-btn--primary"
                        onClick={() => open("claimWizard", () => setClaimTargetId(selectedReward.id))}
                      >
                        <Icon name="gift" size={13} /> Claim {money(selectedReward.amount, 2)}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rf-btn"
                        onClick={() => open("supportWizard", () => setSupportTopic("reward"))}
                      >
                        <Icon name="mail" size={13} /> Ask the desk
                      </button>
                    )}
                    <button type="button" className="rf-btn" onClick={() => open("credits")}>
                      <Icon name="wallet" size={13} /> Credit queue
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── credit queue ── */}
              {modal.kind === "credits" ? (
                <>
                  <p className="rf-modal-lede">
                    Credits queue at 09:00 UTC and settle with the batch. Queued credits are
                    not yet spendable — they show in the wallet statement once posted.
                  </p>
                  <div className="rf-credit-summary">
                    <div>
                      <span className="rf-panel-label">Queued</span>
                      <b className="mono is-accent">{money(creditInfo.queued, 2)}</b>
                    </div>
                    <div>
                      <span className="rf-panel-label">Posted</span>
                      <b className="mono is-pos">{money(creditInfo.posted, 2)}</b>
                    </div>
                    <div>
                      <span className="rf-panel-label">Next batch</span>
                      <b className="mono">{program.settlementWindow}</b>
                    </div>
                  </div>
                  <div className="rf-table-wrap">
                    <table className="rf-table">
                      <thead>
                        <tr>
                          <th scope="col">Queued at</th>
                          <th scope="col">Reference</th>
                          <th scope="col">Source</th>
                          <th scope="col">Amount</th>
                          <th scope="col">Status</th>
                          <th scope="col">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credits.map((row) => (
                          <tr key={row.id} className={row.status === "queued" ? "is-queued" : ""}>
                            <td data-label="Queued at">
                              <span className="mono rf-muted">
                                {shortDateOf(row.at)} {clockShort(row.at)}
                              </span>
                            </td>
                            <td data-label="Reference">
                              <button
                                type="button"
                                className="rf-ref mono"
                                onClick={() => open("credits", () => setSelectedCreditId(row.id))}
                              >
                                {row.reference}
                              </button>
                            </td>
                            <td data-label="Source">
                              <span className="rf-muted">{row.source}</span>
                            </td>
                            <td data-label="Amount">
                              <b className="mono is-pos">+{money(row.amount, 2)}</b>
                            </td>
                            <td data-label="Status">
                              <Tag tone={row.status === "posted" ? "is-win" : "is-wait"}>{row.status}</Tag>
                            </td>
                            <td data-label="Detail">
                              <button
                                type="button"
                                className="rf-btn rf-btn--sm"
                                onClick={() => open("historyDetail", () => setSelectedHistoryId(data.history[0]?.id ?? ""))}
                              >
                                Statement
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {selectedCredit ? (
                    <p className="rf-modal-note">
                      <Icon name="info" size={13} /> {selectedCredit.reference} ·{" "}
                      {money(selectedCredit.amount, 2)} {selectedCredit.status} ·{" "}
                      {selectedCredit.source}
                    </p>
                  ) : null}
                  <div className="rf-modal-actions">
                    <button type="button" className="rf-btn" onClick={() => open("exportWizard", () => setExportScope("credits"))}>
                      <Icon name="download" size={13} /> Export queue
                    </button>
                    <Link className="rf-btn" href="/investor/wallet">
                      <Icon name="wallet" size={13} /> Open wallet
                    </Link>
                  </div>
                </>
              ) : null}

              {/* ── campaigns ── */}
              {modal.kind === "campaigns" ? (
                <>
                  <p className="rf-modal-lede">
                    Bonuses stack on top of the ladder. Joined campaigns show what is left
                    to clear; the rest can be joined from here.
                  </p>
                  <div className="rf-campaign-list">
                    {campaigns.map((campaign) => (
                      <CampaignRow
                        key={campaign.id}
                        campaign={campaign}
                        asOf={asOf}
                        onJoin={() => open("joinCampaign", () => setSelectedCampaignId(campaign.id))}
                      />
                    ))}
                  </div>
                  <p className="rf-modal-note">
                    <Icon name="info" size={13} /> Campaign bonuses are paid as separate
                    reward cards — they never change the $90 ladder cap.
                  </p>
                </>
              ) : null}

              {/* ── join campaign ── */}
              {modal.kind === "joinCampaign" && selectedCampaign ? (
                <>
                  <p className="rf-modal-lede">
                    Join <b>{selectedCampaign.name}</b>? You keep every credit you have
                    already earned.
                  </p>
                  <Kv
                    rows={[
                      ["Bonus", money(selectedCampaign.bonus, 0)],
                      ["Multiplier", `${selectedCampaign.multiplier}×`],
                      ["Requires", selectedCampaign.requires],
                      ["Progress", `${selectedCampaign.progress}/${selectedCampaign.target}`],
                      ["Ends", `${shortDateOf(selectedCampaign.endsAt)} 23:59 UTC`],
                    ]}
                  />
                </>
              ) : null}

              {/* ── goal ── */}
              {modal.kind === "goal" ? (
                <>
                  <p className="rf-modal-lede">
                    Set the number you are chasing. The goal only drives the progress strip
                    here — it never limits your ladder.
                  </p>
                  <div className="rf-goal-form">
                    <label className="rf-field">
                      <span>Qualified referees</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={goalTarget}
                        onChange={(event) => setGoalTarget(Number(event.target.value))}
                      />
                    </label>
                    <label className="rf-field">
                      <span>Deadline</span>
                      <input
                        type="date"
                        value={goalDeadline}
                        onChange={(event) => setGoalDeadline(event.target.value)}
                      />
                    </label>
                  </div>
                  {goalError ? <p className="rf-note is-warn">{goalError}</p> : null}
                  <Kv
                    rows={[
                      ["Now", `${stats.qualified} qualified`],
                      ["Target", `${goalTarget} qualified`],
                      ["Remaining", String(Math.max(0, goalTarget - stats.qualified))],
                      ["Average needed per week", String(Math.max(1, Math.ceil(Math.max(0, goalTarget - stats.qualified) / 10)))],
                    ]}
                  />
                </>
              ) : null}

              {/* ── leaderboard rules ── */}
              {modal.kind === "leaderboardRules" ? (
                <>
                  <p className="rf-modal-lede">
                    The board ranks on qualified referees first, then on credits earned.
                    Pending signups never count.
                  </p>
                  <ul className="rf-note-list">
                    <li>
                      <Icon name="check" size={13} />
                      <span>
                        <b>Ranking</b> — qualified referees, then earned credits as the
                        tie-breaker.
                      </span>
                    </li>
                    <li>
                      <Icon name="check" size={13} />
                      <span>
                        <b>Reset</b> — 00:00 UTC on the 1st of every month. Your lifetime
                        credits are never reset.
                      </span>
                    </li>
                    <li>
                      <Icon name="trophy" size={13} />
                      <span>
                        <b>Top-three bonus</b> — the podium shares a pool worth 10% of their
                        combined monthly credits ({money(boardSection?.bonusPool ?? 0, 0)} this month).
                      </span>
                    </li>
                    <li>
                      <Icon name="eye" size={13} />
                      <span>
                        <b>Privacy</b> — ranks 1–3 show their handle; everyone else is masked
                        unless they opt in. You are {prefs.leaderboardVisible ? "visible as Jane Investor" : "masked"}.
                      </span>
                    </li>
                  </ul>
                  <Kv
                    rows={[
                      ["Your rank", `#${board.you?.rank ?? 12}`],
                      ["In the top ten", board.inTopTen ? "yes" : "no"],
                      ["Gap to rank 11", board.gapToNext ? `${board.gapToNext} referees` : "level"],
                      ["Above you", board.nextAlias ?? "—"],
                    ]}
                  />
                </>
              ) : null}

              {/* ── rank history ── */}
              {modal.kind === "rankHistory" ? (
                <>
                  <p className="rf-modal-lede">
                    Where you sat at the end of each of the last four weeks. Movement is
                    measured at the Monday reset.
                  </p>
                  <ul className="rf-timeline">
                    {[
                      ["25 Oct", 12, 14, 5, 215],
                      ["18 Oct", 14, 16, 4, 175],
                      ["11 Oct", 16, 18, 3, 130],
                      ["4 Oct", 18, 21, 2, 90],
                    ].map(([label, rank, prev, refs, earned]) => (
                      <li key={String(label)}>
                        <span className="rf-timeline__dot is-done" />
                        <span>
                          <strong>
                            {label} · rank {String(rank)}{" "}
                            <span className="rf-muted mono">(from {String(prev)})</span>
                          </strong>
                          <small className="rf-muted">
                            {String(refs)} qualified · {money(Number(earned), 0)} earned
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="rf-modal-note">
                    <Icon name="trendUp" size={13} /> You have climbed six places since 4 Oct.
                    One more qualified referee clears rank 11.
                  </p>
                </>
              ) : null}

              {/* ── history detail ── */}
              {modal.kind === "historyDetail" && selectedHistory ? (
                <>
                  <div className="rf-reward-head">
                    <span className="rf-reward__icon">
                      <Icon name={selectedHistory.kind === "streak_tier" ? "flame" : "gift"} size={18} />
                    </span>
                    <div>
                      <strong>{selectedHistory.title}</strong>
                      <small className="rf-muted mono">
                        {rewardKindLabel(selectedHistory.kind)} · {selectedHistory.reference}
                      </small>
                    </div>
                    <b className="mono rf-reward__amount">
                      +{money(selectedHistory.amount, 2)}
                    </b>
                  </div>
                  <Kv
                    rows={[
                      ["Credited", `${shortDateOf(selectedHistory.at)} ${clockShort(selectedHistory.at)} UTC`],
                      ["Relative", relativeTo(selectedHistory.at, asOf)],
                      ["Reference", selectedHistory.reference],
                      ["Detail", selectedHistory.detail],
                      ["State", selectedHistory.claimed ? "settled" : "queued"],
                      ["Destination", destinationLabel(prefs.payoutDestination)],
                    ]}
                  />
                  <div className="rf-modal-actions">
                    <button
                      type="button"
                      className="rf-btn"
                      onClick={() => void copy(selectedHistory.reference, "Reference")}
                    >
                      <Icon name="copy" size={13} /> Copy reference
                    </button>
                    <Link className="rf-btn" href="/investor/wallet">
                      <Icon name="wallet" size={13} /> Wallet statement
                    </Link>
                  </div>
                </>
              ) : null}

              {/* ── audit trail ── */}
              {modal.kind === "auditTrail" ? (
                <>
                  <p className="rf-modal-lede">
                    Every write this desk has accepted in this session, newest first. The
                    seeded rows are the batch history from the days before the snapshot.
                  </p>
                  <ul className="rf-timeline">
                    {data.audit.map((row) => (
                      <li key={row.id}>
                        <span className="rf-timeline__dot" />
                        <span>
                          <strong>{row.action.replace(/_/g, " ")}</strong>
                          <small className="rf-muted">{row.detail}</small>
                          <small className="rf-muted mono">
                            {shortDateOf(row.at)} {clockShort(row.at)} UTC
                          </small>
                        </span>
                      </li>
                    ))}
                    {!data.audit.length ? (
                      <li className="rf-muted">No writes in this session yet.</li>
                    ) : null}
                  </ul>
                  <Kv
                    rows={[
                      ["Revision", String(data.revision)],
                      ["Exports", `${data.exports.length}/${MAX_EXPORTS}`],
                      ["Support drafts", `${data.support.length}/${MAX_SUPPORT_DRAFTS}`],
                      ["Open invites", `${data.sent.length}/${MAX_SENT_INVITES}`],
                    ]}
                  />
                </>
              ) : null}

              {/* ── terms ── */}
              {modal.kind === "terms" ? (
                <>
                  <p className="rf-modal-lede">{program.terms}</p>
                  <ul className="rf-note-list">
                    <li>
                      <Icon name="check" size={13} />
                      <span>
                        <b>Eligibility</b> — one account per person, KYC L1 or above, and no
                        self-referral.
                      </span>
                    </li>
                    <li>
                      <Icon name="check" size={13} />
                      <span>
                        <b>Clawback</b> — credits are reversed if the referee refunds their
                        deposit inside 14 days.
                      </span>
                    </li>
                    <li>
                      <Icon name="check" size={13} />
                      <span>
                        <b>Tax</b> — reward credits are gross of any tax you owe in Kenya.
                      </span>
                    </li>
                    <li>
                      <Icon name="alert" size={13} />
                      <span>
                        <b>Changes</b> — the desk gives 30 days&rsquo; notice before the ladder
                        amounts change.
                      </span>
                    </li>
                  </ul>
                  <Kv
                    rows={[
                      ["Programme", program.code],
                      ["Cap per referee", money(program.maxPerReferral, 0)],
                      ["Settlement", program.settlementWindow],
                      ["Cookie", `${program.cookieDays} days`],
                    ]}
                  />
                </>
              ) : null}

              {/* ── boundaries ── */}
              {modal.kind === "boundaries" ? (
                <>
                  <p className="rf-modal-lede">
                    This desk is a frontend-first demo on one structured snapshot. Here is
                    exactly what is real and what is previewed.
                  </p>
                  <ul className="rf-note-list">
                    <li>
                      <Icon name="check" size={13} />
                      <span>
                        <b>Real reads</b> — the wallet balance, the lifetime deposit total,
                        the referee pool codes and the settled payout reference come from the
                        I-1, I-6, I-7 and I-2 services.
                      </span>
                    </li>
                    <li>
                      <Icon name="check" size={13} />
                      <span>
                        <b>Validated writes</b> — claims, invites, shares, preferences, goals
                        and exports all run through the shared command schema before the
                        snapshot changes.
                      </span>
                    </li>
                    <li>
                      <Icon name="alert" size={13} />
                      <span>
                        <b>Not wired</b> — nothing is emailed or posted, and no money moves.
                        The clipboard hand-off is real; the message is not sent.
                      </span>
                    </li>
                    <li>
                      <Icon name="info" size={13} />
                      <span>
                        <b>Contract</b> — <code>POST /api/rewards/:id/claim</code>,{" "}
                        <code>POST /api/referrals/claim-daily</code> and{" "}
                        <code>GET /api/investor/referrals?section=…</code> are the endpoints
                        this page already speaks.
                      </span>
                    </li>
                  </ul>
                  <div className="rf-modal-actions">
                    <button type="button" className="rf-btn" onClick={() => open("auditTrail")}>
                      <Icon name="terminal" size={13} /> Audit trail
                    </button>
                    <button type="button" className="rf-btn" onClick={() => open("resetRewards")}>
                      <Icon name="refresh" size={13} /> Reset demo
                    </button>
                  </div>
                </>
              ) : null}

              {/* ── reset ── */}
              {modal.kind === "resetRewards" ? (
                <>
                  <p className="rf-modal-lede">
                    Put the desk back the way it was on Sunday morning: nothing claimed,
                    no invites sent, no shares recorded, no exports.
                  </p>
                  <Kv
                    rows={[
                      ["Claims to undo", String(claimable.length ? 0 : totals.claimedCount)],
                      ["Invites to clear", String(data.sent.length)],
                      ["Shares to clear", String(data.shares.length)],
                      ["Exports to clear", String(data.exports.length)],
                    ]}
                  />
                  <p className="rf-modal-note">
                    <Icon name="alert" size={13} /> This only resets this browser session&rsquo;s
                    snapshot. Seeded referees, history and the streak stay exactly as they are.
                  </p>
                </>
              ) : null}
            </DeskModalShell>
          </div>
        ) : null}
      </div>
    </InvestorShell>
  );
}

function CampaignRow({
  campaign,
  asOf,
  onJoin,
}: {
  campaign: Campaign;
  asOf: string;
  onJoin: () => void;
}) {
  return (
    <article className={`rf-campaign ${campaign.status === "ended" ? "is-ended" : campaign.joined ? "is-joined" : ""}`}>
      <header>
        <strong>{campaign.name}</strong>
        <Tag tone={campaign.status === "active" ? "is-win" : campaign.status === "upcoming" ? "is-wait" : "is-plain"}>
          {campaign.status}
        </Tag>
        <b className="mono">+{money(campaign.bonus, 0)}</b>
      </header>
      <p>{campaign.detail}</p>
      <div className="rf-campaign__meta">
        <span className="rf-muted mono">
          {campaign.multiplier}× · ends {shortDateOf(campaign.endsAt)}
        </span>
        <Bar value={campaign.progress} target={campaign.target} tone={campaign.joined ? "is-good" : ""} />
        <span className="rf-muted mono">
          {campaign.progress}/{campaign.target} · {campaign.requires}
        </span>
      </div>
      <footer>
        {campaign.status === "ended" ? (
          <span className="rf-muted">Closed {shortDateOf(campaign.endsAt)} · {relativeTo(campaign.endsAt, asOf)}</span>
        ) : campaign.joined ? (
          <Tag tone="is-win">
            <Icon name="check" size={11} /> Joined
          </Tag>
        ) : (
          <button type="button" className="rf-btn rf-btn--sm rf-btn--primary" onClick={onJoin}>
            <Icon name="plus" size={12} /> Join
          </button>
        )}
      </footer>
    </article>
  );
}
