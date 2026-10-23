"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  OperatorShell,
  type OperatorBundleProps,
} from "@/components/dashboard/shell/operator-shell";
import { useOperatorUI } from "@/components/dashboard/shell/operator-context";
import { DeskModalShell } from "@/components/dashboard/modals/modal-primitives";
import { Icon } from "@/components/icons";
import { useLiveCountUp } from "@/lib/live/use-live-count-up";
import {
  createDeskColumnHelper,
  useDeskTable,
  type SortingState,
} from "@/lib/dashboard/table";
import { useSettings } from "@/lib/settings/use-settings";
import {
  settingsTabs,
  events,
  channelNames,
  securityIssues,
  notificationIssues,
  passwordIssues,
  renewalDays,
  type SettingsWorkspace,
  type SettingsTab,
  type SettingsCommand,
  type ProfileInput,
  type PlatformInput,
  type SecurityInput,
  type NotificationsInput,
  type Channel,
} from "@/lib/settings/model";
import { ProfileForm, PlatformForm } from "./settings-forms";
import { AvatarCrop } from "./avatar-crop";
const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n),
  stamp = (s: string) => s.replace("T", " ").slice(0, 19) + " UTC";
const tabLabels: Record<SettingsTab, string> = {
  profile: "Operator profile",
  connections: "Deriv accounts",
  platform: "Platform defaults",
  security: "Security",
  notifications: "Notifications",
  integrations: "API & integrations",
  billing: "Billing",
};
type Kind =
  | "profile"
  | "avatar"
  | "email"
  | "role"
  | "addConnection"
  | "connection"
  | "connectionTest"
  | "platform"
  | "password"
  | "backup"
  | "twoFactor"
  | "security"
  | "ip"
  | "session"
  | "revokeAll"
  | "notifications"
  | "channel"
  | "channelTest"
  | "generateKey"
  | "keyReveal"
  | "revokeKey"
  | "integration"
  | "integrationTest"
  | "upgrade"
  | "cancel"
  | "payment"
  | "invoice"
  | "usage"
  | "export"
  | "audit"
  | "help";
const titles: Record<Kind, string> = {
  profile: "Review operator profile",
  avatar: "Crop & preview avatar",
  email: "Email verification request preview",
  role: "Investor role preview",
  addConnection: "Prepare Deriv OAuth connection",
  connection: "Review connection action",
  connectionTest: "Connection configuration check",
  platform: "Review platform defaults",
  password: "Password change demonstration",
  backup: "Demo backup-code preview",
  twoFactor: "Two-factor change request",
  security: "Review session & access policy",
  ip: "Add whitelist address",
  session: "Review session revocation",
  revokeAll: "Request revocation of all sessions",
  notifications: "Review notification routing",
  channel: "Configure notification channel",
  channelTest: "Channel delivery preflight",
  generateKey: "Generate nonfunctional demo key",
  keyReveal: "One-time demo key display",
  revokeKey: "Review API key revocation",
  integration: "Prepare integration draft",
  integrationTest: "Integration configuration check",
  upgrade: "Review Team upgrade request",
  cancel: "Subscription cancellation request",
  payment: "Demo payment reference",
  invoice: "Invoice source evidence",
  usage: "Subscription usage methodology",
  export: "Export settings workspace",
  audit: "Local settings decision history",
  help: "Identity & integration boundaries",
};
const wizards: Kind[] = [
  "profile",
  "email",
  "role",
  "addConnection",
  "connection",
  "platform",
  "password",
  "twoFactor",
  "security",
  "session",
  "revokeAll",
  "notifications",
  "generateKey",
  "revokeKey",
  "integration",
  "upgrade",
  "cancel",
  "payment",
  "export",
];
type Invoice = SettingsWorkspace["billing"]["invoices"][number];
const col = createDeskColumnHelper<Invoice>();
function Panel({
  number,
  title,
  description,
  actions,
  children,
}: {
  number: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="st-panel">
      <div className="st-panel-head">
        <div>
          <span className="st-section-code">{number}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
function Balance({ value }: { value: number }) {
  const n = useLiveCountUp(value);
  return <strong className="mono">{money(n)}</strong>;
}
function SettingsDesk({
  initial,
  initialTab,
}: {
  initial: SettingsWorkspace;
  initialTab: SettingsTab;
}) {
  const { data, mutation } = useSettings(initial),
    { pushToast } = useOperatorUI();
  const [tab, setTab] = useState<SettingsTab>(initialTab),
    [modal, setModal] = useState<{ kind: Kind; id?: string } | null>(null),
    [drawer, setDrawer] = useState(false),
    [drawerTab, setDrawerTab] = useState("summary"),
    [step, setStep] = useState(0),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [profileDraft, setProfileDraft] = useState<ProfileInput>(initial.profile),
    [platformDraft, setPlatformDraft] = useState<PlatformInput>(
      initial.platform,
    ),
    [securityDraft, setSecurityDraft] = useState<SecurityInput>({
      timeout: initial.security.timeout,
      whitelistEnabled: initial.security.whitelistEnabled,
      ips: initial.security.ips,
    }),
    [notificationsDraft, setNotificationsDraft] = useState<NotificationsInput>(
      initial.notifications,
    ),
    [email, setEmail] = useState(""),
    [login, setLogin] = useState("VRTC200001"),
    [accountType, setAccountType] = useState<"Real" | "Demo">("Demo"),
    [connectionAction, setConnectionAction] = useState<
      "refresh" | "reconnect" | "disconnect" | "primary"
    >("disconnect"),
    [twoFactorAction, setTwoFactorAction] = useState<
      "disable_2fa" | "reconfigure_2fa"
    >("reconfigure_2fa"),
    [password, setPassword] = useState({ current: "", next: "", confirm: "" }),
    [verify, setVerify] = useState(""),
    [secret, setSecret] = useState(""),
    [backupCodes, setBackupCodes] = useState<string[]>([]),
    [ip, setIp] = useState(""),
    [ipLabel, setIpLabel] = useState(""),
    [channel, setChannel] = useState<Channel>("email"),
    [telegram, setTelegram] = useState(initial.notifications.telegramHandle),
    [webhook, setWebhook] = useState("https://alerts.example.com/trademo"),
    [keyName, setKeyName] = useState("Reporting preview"),
    [scopes, setScopes] = useState<("read" | "trade")[]>(["read"]),
    [endpoint, setEndpoint] = useState(""),
    [reference, setReference] = useState(""),
    [brand, setBrand] = useState<"Visa" | "Mastercard">("Visa"),
    [last4, setLast4] = useState("4242"),
    [format, setFormat] = useState("json"),
    [sort, setSort] = useState<SortingState>([{ id: "date", desc: true }]);
  const disabled = busy || mutation.isPending,
    overlay = !!modal || drawer;
  const connection = data.connections.find((c) => c.id === modal?.id),
    integration = data.integrations.find((i) => i.id === modal?.id),
    key = data.apiKeys.find((k) => k.id === modal?.id),
    session = data.security.sessions.find((s) => s.id === modal?.id),
    invoice = data.billing.invoices.find((i) => i.id === modal?.id);
  const callback = useRef(() => {});
  function clearSensitive() {
    setPassword({ current: "", next: "", confirm: "" });
    setVerify("");
    setSecret("");
    setBackupCodes([]);
  }
  useEffect(() => {
    callback.current = () => {
      if (!busy && !mutation.isPending) {
        setModal(null);
        setDrawer(false);
        setPassword({ current: "", next: "", confirm: "" });
        setVerify("");
        setSecret("");
        setBackupCodes([]);
      }
    };
  }, [busy, mutation.isPending]);
  useEffect(() => {
    if (!overlay) return;
    const prior = document.activeElement as HTMLElement | null,
      old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const layer = document.querySelector(
      ".page-dashboard-settings .st-local-layer",
    );
    const nodes = () =>
      Array.from(
        layer?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ) ?? [],
      ).filter((n) => n.getClientRects().length);
    nodes()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") callback.current();
      if (e.key === "Tab") {
        const ns = nodes();
        if (e.shiftKey && document.activeElement === ns[0]) {
          e.preventDefault();
          ns.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === ns.at(-1)) {
          e.preventDefault();
          ns[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
      prior?.focus();
    };
  }, [overlay, modal?.kind, drawer]);
  useEffect(() => {
    if (modal && step > 0)
      document
        .querySelector<HTMLElement>(
          ".page-dashboard-settings .st-local-layer button:not(:disabled)",
        )
        ?.focus();
  }, [step, modal]);
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor("date", { header: "Invoice date" }),
        col.accessor("description", { header: "Description" }),
        col.accessor("amount", { header: "Amount" }),
        col.accessor("status", { header: "Source status" }),
      ]),
    [],
  );
  const table = useDeskTable({
    data: data.billing.invoices,
    columns,
    state: { sorting: sort },
    onSortingChange: (u) => setSort(typeof u === "function" ? u(sort) : u),
  });
  function selectTab(next: SettingsTab) {
    setTab(next);
    history.replaceState(null, "", `/dashboard/settings?tab=${next}`);
  }
  function open(kind: Kind, id?: string) {
    clearSensitive();
    setDrawer(false);
    setModal({ kind, id });
    setStep(0);
    setConfirmed(false);
    setError("");
    if (kind === "addConnection") {
      setLogin("VRTC200001");
      setAccountType("Demo");
    }
    if (kind === "generateKey") {
      setKeyName("Reporting preview");
      setScopes(["read"]);
    }
    if (kind === "integration") {
      const x = data.integrations.find((i) => i.id === id);
      setEndpoint(x?.endpoint || "https://hooks.example.com/trademo/events");
      setReference(x?.reference || "vault://demo/integration");
    }
    if (kind === "ip") {
      setIp("");
      setIpLabel("");
    }
    if (kind === "channel") {
      setTelegram(notificationsDraft.telegramHandle);
      setWebhook(
        notificationsDraft.webhookUrl || "https://alerts.example.com/trademo",
      );
    }
  }
  async function run(command: SettingsCommand, keep = false) {
    setError("");
    try {
      await mutation.mutateAsync(command);
      if (!keep) {
        setModal(null);
        setDrawer(false);
        clearSensitive();
      }
      pushToast({
        tone: "success",
        title: "Settings preview updated locally; no external action performed",
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Local action failed");
      return false;
    }
  }
  function download(value: string, name: string, type = "application/json") {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function invoicePdf(item: Invoice) {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf"),
        doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("tradeMO / DEMO INVOICE", 20, 25);
      doc.setFontSize(10);
      [
        item.id,
        `${item.date} / ${item.description}`,
        `Source status: ${item.status} / Amount: ${money(item.amount)}`,
        `Profile reference: ${data.profile.username}`,
        `Snapshot: ${data.asOf}`,
        "Synthetic source evidence only. Not a tax invoice or proof of payment.",
        "No payment was processed or verified by this frontend.",
      ].forEach((t, i) => doc.text(t, 20, 45 + i * 12));
      doc.save(`${item.id}-demo.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF generation failed");
    } finally {
      setBusy(false);
    }
  }
  async function exportWorkspace() {
    setBusy(true);
    try {
      if (format === "json")
        download(
          JSON.stringify(data, null, 2),
          "operator-settings-workspace.json",
        );
      else {
        const { jsPDF } = await import("jspdf"),
          doc = new jsPDF();
        doc.setFontSize(14);
        doc.text("tradeMO / SETTINGS / DEMO", 18, 22);
        doc.setFontSize(10);
        const lines = [
          `Profile: ${data.profile.fullName} / ${data.profile.username}`,
          `Timezone: ${data.profile.timezone}`,
          `Connection slots: ${data.connections.length}`,
          `Source plan: ${data.billing.plan} / ${money(data.billing.price)} per month`,
          `Two-factor source/request state: ${data.security.twoFactor}`,
          `Local revision: ${data.revision} / ${data.audit.length} decisions`,
          `Snapshot: ${data.asOf}`,
          "No provider execution, authentication, delivery or billing change.",
        ];
        lines.forEach((t, i) => doc.text(t, 18, 42 + i * 12));
        doc.save("operator-settings-summary.pdf");
      }
      setModal(null);
      setDrawer(false);
      clearSensitive();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }
  const securityProblems = securityIssues(data, securityDraft),
    notificationProblems = notificationIssues(notificationsDraft);
  let blocking = "";
  if (modal?.kind === "password")
    blocking =
      passwordIssues(password.current, password.next, password.confirm)[0] ??
      "";
  if (modal?.kind === "security") blocking = securityProblems[0] ?? "";
  if (modal?.kind === "notifications") blocking = notificationProblems[0] ?? "";
  if (
    modal?.kind === "generateKey" &&
    (keyName.trim().length < 3 || !scopes.length)
  )
    blocking = "Name the demo key and select at least one scope";
  if (modal?.kind === "payment" && !/^\d{4}$/.test(last4))
    blocking = "Use only four demo digits, never a full card number";
  if (modal?.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    blocking = "Enter a syntactically valid new demo email address";
  if (
    modal?.kind === "integration" &&
    integration?.type === "webhook" &&
    !/^https:\/\/(?![^/]*@)[^/#?\s]+\.[^/#?\s]+(?:\/[^#\s]*)?$/.test(endpoint)
  )
    blocking = "Use a public HTTPS endpoint without credentials or a fragment";
  if (
    modal?.kind === "integration" &&
    integration?.type === "webhook" &&
    !/^vault:\/\/[A-Za-z0-9_/-]{3,70}$/.test(reference)
  )
    blocking =
      "Use a vault:// secret-manager reference, never a signing secret";
  async function submit() {
    if (!modal) return;
    switch (modal.kind) {
      case "profile":
        return void run({ kind: "profile", value: profileDraft });
      case "email":
        return void run({ kind: "emailRequest", email });
      case "role":
        return void run({ kind: "role" });
      case "platform":
        return void run({ kind: "platform", value: platformDraft });
      case "security":
        return void run({ kind: "security", value: securityDraft });
      case "password":
        if (
          !passwordIssues(password.current, password.next, password.confirm)
            .length
        )
          return void run({ kind: "securityEvent", event: "password_preview" });
        return;
      case "twoFactor":
        if (verify !== "000000") {
          setError(
            "Use the explicitly labeled demo code 000000. Do not enter a real authenticator code.",
          );
          return;
        }
        return void run({ kind: "securityEvent", event: twoFactorAction });
      case "session":
        return void run({ kind: "revokeSession", id: modal.id! });
      case "revokeAll":
        return void run({ kind: "revokeSession", id: null });
      case "notifications":
        return void run({ kind: "notifications", value: notificationsDraft });
      case "addConnection":
        return void run({ kind: "addConnection", loginId: login, accountType });
      case "connection":
        return void run({
          kind: "connection",
          id: modal.id!,
          action: connectionAction,
        });
      case "revokeKey":
        return void run({ kind: "revokeKey", id: modal.id! });
      case "integration":
        return void run({
          kind: "integration",
          id: modal.id!,
          endpoint,
          reference,
        });
      case "upgrade":
        return void run({ kind: "billing", action: "upgrade_team" });
      case "cancel":
        return void run({ kind: "billing", action: "cancel_at_renewal" });
      case "payment":
        return void run({ kind: "payment", brand, last4 });
      case "export":
        return void exportWorkspace();
      case "generateKey": {
        const bytes = crypto.getRandomValues(new Uint8Array(24)),
          raw =
            "demo_trademo_" +
            Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        if (
          await run(
            {
              kind: "generateKey",
              name: keyName,
              prefix: raw.slice(0, 21),
              scopes,
            },
            true,
          )
        ) {
          setSecret(raw);
          setModal({ kind: "keyReveal" });
          setStep(0);
        }
        return;
      }
    }
  }
  const confirmation = (
    <label className="st-check mt-3">
      <input
        type="checkbox"
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
      />
      I understand this is a local frontend preview. No authentication, provider
      token, channel delivery, payment or live platform policy is changed.
    </label>
  );
  const modalFooter = (
    <>
      <button
        className="st-btn"
        disabled={disabled}
        onClick={() => (step ? setStep(step - 1) : callback.current())}
      >
        {step ? "Back" : "Close"}
      </button>
      {modal && wizards.includes(modal.kind) && (
        <button
          className="st-btn st-primary"
          disabled={disabled || !!blocking || (step === 2 && !confirmed)}
          onClick={() => (step < 2 ? setStep(step + 1) : void submit())}
        >
          {disabled
            ? "Working…"
            : step < 2
              ? "Continue →"
              : modal.kind === "export"
                ? "Download settings evidence"
                : "Confirm local preview"}
        </button>
      )}
    </>
  );
  const lastCheck = (target: string) =>
    data.checks.find((c) => c.target === target);
  return (
    <div className="st-canvas">
      <header className="st-header">
        <div>
          <div className="st-eyebrow">
            <span className="st-tag mono">D-15</span>OPERATOR CONSOLE /
            WORKSPACE POLICY
          </div>
          <h1>Settings & preferences</h1>
          <p>
            Your identity, connections and operating defaults. Keep every
            permission deliberate.
          </p>
        </div>
        <div className="st-actions">
          <button
            className="st-btn"
            onClick={() => {
              setModal(null);
              setDrawerTab("summary");
              setDrawer(true);
            }}
          >
            <Icon name="layers" size={14} />
            Settings inspector
          </button>
          <button className="st-btn st-primary" onClick={() => open("export")}>
            Export settings
          </button>
        </div>
      </header>
      <div className="st-mode-banner">
        <div>
          <b>FRONTEND SETTINGS WORKSPACE</b>
          <span>
            Source snapshots · session-only edits · no credentials or payments
            processed
          </span>
        </div>
        <button className="st-link" onClick={() => open("help")}>
          Integration boundaries ↗
        </button>
      </div>
      <div className="st-overview">
        <div>
          <span>OPERATOR IDENTITY</span>
          <b>{data.profile.fullName}</b>
          <small>
            {data.profile.role} / {data.profile.timezone}
          </small>
        </div>
        <div>
          <span>CONNECTION SOURCE</span>
          <b>
            {
              data.connections.filter((c) => c.status === "source_connected")
                .length
            }{" "}
            source-connected
          </b>
          <small>
            {data.connections.length} / {data.billing.plan === "Team" ? 5 : 2}{" "}
            slots
          </small>
        </div>
        <div>
          <span>SECURITY POSTURE</span>
          <b>
            2FA{" "}
            {data.security.twoFactor === "source_enabled"
              ? "enabled at source"
              : "change preview pending"}
          </b>
          <small>No real session enforcement</small>
        </div>
        <div>
          <span>SUBSCRIPTION SOURCE</span>
          <b>
            {data.billing.plan} / {money(data.billing.price)} mo
          </b>
          <small>{renewalDays(data)} source days to renewal</small>
        </div>
      </div>
      <nav className="st-tabs" role="tablist" aria-label="Settings sections">
        {settingsTabs.map((t, i) => (
          <button
            role="tab"
            id={`settings-tab-${t}`}
            aria-controls={`settings-panel-${t}`}
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => selectTab(t)}
            onKeyDown={(e) => {
              if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 6
                      : (i + (e.key === "ArrowRight" ? 1 : 6)) % 7;
                selectTab(settingsTabs[next]);
                document
                  .getElementById(`settings-tab-${settingsTabs[next]}`)
                  ?.focus();
              }
            }}
          >
            <span className="mono">0{i + 1}</span>
            {tabLabels[t]}
          </button>
        ))}
      </nav>
      <div
        key={tab}
        className="st-tab-content"
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
      >
        {tab === "profile" && (
          <Panel
            number="01 / OPERATOR PROFILE"
            title="Identity & public profile"
            description="Editable operator details, public bio and contact preferences. Email changes remain subject to future verification."
          >
            <div className="st-profile-layout">
              <aside className="st-profile-card">
                <div className="st-avatar">
                  {data.profile.avatar ? (
                    <Image
                      src={data.profile.avatar}
                      width={112}
                      height={112}
                      unoptimized
                      alt="Locally cropped operator avatar"
                    />
                  ) : (
                    <span>
                      {data.profile.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                  )}
                </div>
                <h3>{data.profile.fullName}</h3>
                <span className="st-tag">
                  {data.profile.role.toUpperCase()}
                </span>
                <p className="mono">@{data.profile.username}</p>
                <button className="st-btn" onClick={() => open("avatar")}>
                  Upload & crop avatar
                </button>
                <div className="st-profile-notes">
                  <b>PUBLIC PROFILE</b>
                  <p>
                    Display name, avatar and bio are presentation details. A
                    local role preview does not grant authorization.
                  </p>
                  <Link className="st-link" href="/investor">
                    Open investor view ↗
                  </Link>
                </div>
              </aside>
              <div className="st-form-wrap">
                <ProfileForm
                  key={JSON.stringify({
                    fullName: data.profile.fullName,
                    timezone: data.profile.timezone,
                    phone: data.profile.phone,
                    bio: data.profile.bio,
                  })}
                  profile={data.profile}
                  onReview={(v) => {
                    setProfileDraft(v);
                    open("profile");
                  }}
                  onEmail={() => {
                    setEmail("");
                    open("email");
                  }}
                  onRole={() => open("role")}
                />
              </div>
            </div>
          </Panel>
        )}
        {tab === "connections" && (
          <Panel
            number="02 / DERIV CONNECTIONS"
            title="Provider accounts"
            description="Source account metadata only. No Deriv access token is stored, refreshed, authorized or sent by this page."
            actions={
              <button
                className="st-btn st-primary"
                onClick={() => open("addConnection")}
              >
                + Add Deriv account
              </button>
            }
          >
            <div className="st-connection-list">
              {data.connections.map((c) => (
                <article className="st-connection" key={c.id}>
                  <div className="st-connection-head">
                    <div className="st-actions">
                      <span
                        className={`st-status-dot ${c.status === "source_connected" ? "on" : ""}`}
                      />
                      <h3 className="mono">{c.loginId}</h3>
                      <span className="st-tag">
                        {c.accountType} / {c.currency}
                      </span>
                      {c.primary && (
                        <span className="st-tag">PRIMARY SOURCE</span>
                      )}
                    </div>
                    <span className="st-status">
                      {c.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="st-connection-metrics">
                    <div>
                      <small>Recorded balance</small>
                      {c.balance === null ? (
                        <strong>Not available</strong>
                      ) : (
                        <Balance value={c.balance} />
                      )}
                    </div>
                    <div>
                      <small>Last source activity</small>
                      <b>
                        {c.lastActivity
                          ? stamp(c.lastActivity)
                          : "No source activity"}
                      </b>
                    </div>
                    <div>
                      <small>Source/request permissions</small>
                      <b>{c.permissions.join(" · ")}</b>
                    </div>
                  </div>
                  <div className="st-actions">
                    {(
                      [
                        ["refresh", "Refresh token request"],
                        ["reconnect", "Reconnect request"],
                        ["disconnect", "Disconnect locally"],
                        ["primary", "Set primary preview"],
                      ] as [typeof connectionAction, string][]
                    ).map(([a, label]) => (
                      <button
                        className="st-btn"
                        key={a}
                        disabled={
                          (a === "disconnect" && c.status === "disconnected") ||
                          (a === "primary" &&
                            (c.primary || c.status !== "source_connected"))
                        }
                        onClick={() => {
                          setConnectionAction(a);
                          open("connection", c.id);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      className="st-link"
                      onClick={() => open("connectionTest", c.id)}
                    >
                      Test configuration ↗
                    </button>
                  </div>
                  {lastCheck(c.id) && (
                    <small className="st-check-result">
                      Last local check: configuration only /{" "}
                      {stamp(lastCheck(c.id)!.time)}. No WebSocket ping.
                    </small>
                  )}
                </article>
              ))}
            </div>
            <div className="st-note st-inset">
              Pro allows 2 connection slots; Team allows 5. A pending upgrade
              does not unlock a source entitlement. Prepared OAuth metadata is
              not an authorized account.
            </div>
          </Panel>
        )}
        {tab === "platform" && (
          <Panel
            number="03 / PLATFORM CONFIGURATION"
            title="Operating defaults"
            description="Default split, investment limits, payout preferences, cadence and package guardrails. Existing agreements are unchanged."
          >
            <div className="st-form-wrap">
              <PlatformForm
                key={JSON.stringify(data.platform)}
                value={data.platform}
                onReview={(v) => {
                  setPlatformDraft(v);
                  open("platform");
                }}
              />
            </div>
          </Panel>
        )}
        {tab === "security" && (
          <Panel
            number="04 / SECURITY & ACCESS"
            title="Account protection"
            description="Source posture and reviewable access preferences. Demo password/2FA flows never alter real authentication."
            actions={
              <button className="st-btn" onClick={() => open("password")}>
                Change password preview
              </button>
            }
          >
            <div className="st-security-top">
              <div>
                <span className="st-tag">AUTHENTICATOR / SOURCE</span>
                <h3>Two-factor authentication</h3>
                <p>
                  {data.security.twoFactor.replaceAll("_", " ")} ·
                  source-enabled authenticator app
                </p>
                <div className="st-actions">
                  <button className="st-btn" onClick={() => open("backup")}>
                    View demo backup codes
                  </button>
                  <button
                    className="st-btn"
                    onClick={() => {
                      setTwoFactorAction("reconfigure_2fa");
                      open("twoFactor");
                    }}
                  >
                    Reconfigure preview
                  </button>
                  <button
                    className="st-link"
                    onClick={() => {
                      setTwoFactorAction("disable_2fa");
                      open("twoFactor");
                    }}
                  >
                    Disable request ↗
                  </button>
                </div>
              </div>
              <div className="st-security-context">
                <b>DEMO INPUTS ONLY</b>
                <p>
                  Never enter a real password, authenticator code, recovery
                  code, token, card number or signing secret. Real controls
                  require recent authentication on the server.
                </p>
              </div>
            </div>
            <div className="st-form-wrap">
              <div className="st-form-grid">
                <label className="st-field">
                  Session timeout preference
                  <select
                    className="form-select"
                    aria-label="Session timeout"
                    value={securityDraft.timeout}
                    onChange={(e) =>
                      setSecurityDraft({
                        ...securityDraft,
                        timeout: e.target.value as SecurityInput["timeout"],
                      })
                    }
                  >
                    {[
                      ["15", "15 minutes"],
                      ["30", "30 minutes"],
                      ["60", "1 hour"],
                      ["240", "4 hours"],
                      ["never", "Never · high-risk preference"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="st-field">
                  <span>Network allowlist</span>
                  <label className="st-check">
                    <input
                      type="checkbox"
                      checked={securityDraft.whitelistEnabled}
                      onChange={(e) =>
                        setSecurityDraft({
                          ...securityDraft,
                          whitelistEnabled: e.target.checked,
                        })
                      }
                    />
                    Enable whitelist preference
                  </label>
                  <small className="st-muted">
                    Current documentation fixture IP: {data.security.fixtureIp}
                  </small>
                </div>
              </div>
              <div className="st-section-head mt-4">
                <h3>IP whitelist entries</h3>
                <button className="st-btn" onClick={() => open("ip")}>
                  + Add IP address
                </button>
              </div>
              {securityDraft.ips.map((ip, i) => (
                <div className="st-record" key={i}>
                  <div>
                    <b className="mono">{ip.address}</b>
                    <small>{ip.label}</small>
                  </div>
                  <button
                    className="st-link"
                    onClick={() =>
                      setSecurityDraft({
                        ...securityDraft,
                        ips: securityDraft.ips.filter((_, n) => n !== i),
                      })
                    }
                  >
                    Remove address
                  </button>
                </div>
              ))}
              {!securityDraft.ips.length && (
                <div className="st-note">
                  No entries remain. Add the current fixture address before
                  enabling whitelist mode.
                </div>
              )}
              <div className="st-form-footer">
                <span className="st-muted">
                  Network enforcement is not active in this frontend.
                </span>
                <button
                  className="st-btn st-primary"
                  onClick={() => open("security")}
                >
                  Review security settings
                </button>
              </div>
            </div>
            <div className="st-subsection-head">
              <h3>Active source sessions</h3>
              <button className="st-link" onClick={() => open("revokeAll")}>
                Revoke all sessions preview
              </button>
            </div>
            <div className="table-responsive">
              <table className="table st-table">
                <thead>
                  <tr>
                    {[
                      "Device",
                      "Documentation IP",
                      "Started / UTC",
                      "Local request",
                      "Action",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.security.sessions.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.device}</b>
                        {s.current && (
                          <small className="st-cell-sub">
                            Current fixture session
                          </small>
                        )}
                      </td>
                      <td className="mono">{s.ip}</td>
                      <td>{stamp(s.startedAt)}</td>
                      <td>{s.state.replaceAll("_", " ")}</td>
                      <td>
                        <button
                          className="st-link"
                          disabled={s.state === "revoke_requested"}
                          onClick={() => open("session", s.id)}
                        >
                          Review revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
        {tab === "notifications" && (
          <Panel
            number="05 / NOTIFICATION CHANNELS"
            title="Routing & delivery preferences"
            description="Configure channel metadata and event routing. No email, Telegram message, browser push or webhook is sent."
            actions={
              <button
                className="st-btn st-primary"
                onClick={() => open("notifications")}
              >
                Review notification settings
              </button>
            }
          >
            <div className="st-channel-grid">
              {channelNames.map((c) => (
                <article className="st-channel" key={c}>
                  <div className="st-section-head">
                    <h3>{c[0].toUpperCase() + c.slice(1)}</h3>
                    <label className="st-check">
                      <input
                        type="checkbox"
                        aria-label={`Enable ${c} channel`}
                        checked={notificationsDraft.enabled[c]}
                        onChange={(e) =>
                          setNotificationsDraft((v) => ({
                            ...v,
                            enabled: { ...v.enabled, [c]: e.target.checked },
                            routes: Object.fromEntries(
                              events.map((event) => [
                                event.id,
                                {
                                  ...v.routes[event.id],
                                  [c]: e.target.checked
                                    ? v.routes[event.id][c]
                                    : false,
                                },
                              ]),
                            ) as NotificationsInput["routes"],
                          }))
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <p>
                    {c === "email"
                      ? data.profile.email
                      : c === "telegram"
                        ? notificationsDraft.telegramHandle
                        : c === "push"
                          ? "Browser push preference / no subscription"
                          : notificationsDraft.webhookUrl ||
                            "No endpoint configured"}
                  </p>
                  <span className="st-tag">
                    {c === "email"
                      ? "SOURCE VERIFIED"
                      : c === "telegram"
                        ? "SOURCE HANDLE / NO DELIVERY"
                        : c === "push"
                          ? "PREFERENCE ONLY"
                          : "DRAFT ENDPOINT"}
                  </span>
                  <div className="st-actions mt-3">
                    <button
                      className="st-link"
                      onClick={() => {
                        setChannel(c);
                        open("channel");
                      }}
                    >
                      Configure
                    </button>
                    <button
                      className="st-link"
                      onClick={() => {
                        setChannel(c);
                        open("channelTest", c);
                      }}
                    >
                      Test preflight
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <div className="table-responsive st-routing-wrap">
              <table className="table st-table st-routing">
                <thead>
                  <tr>
                    <th>Event observation</th>
                    {channelNames.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td>{e.label}</td>
                      {channelNames.map((c) => (
                        <td key={c}>
                          <input
                            type="checkbox"
                            aria-label={`${e.label} via ${c}`}
                            checked={notificationsDraft.routes[e.id][c]}
                            disabled={!notificationsDraft.enabled[c]}
                            onChange={(ev) =>
                              setNotificationsDraft((v) => ({
                                ...v,
                                routes: {
                                  ...v.routes,
                                  [e.id]: {
                                    ...v.routes[e.id],
                                    [c]: ev.target.checked,
                                  },
                                },
                              }))
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              className="st-routing-mobile"
              aria-label="Notification routing by event"
            >
              {events.map((e) => (
                <div key={e.id}>
                  <b>{e.label}</b>
                  <div>
                    {channelNames.map((c) => (
                      <label key={c} className="st-check">
                        <input
                          type="checkbox"
                          aria-label={`${e.label} via ${c} mobile`}
                          checked={notificationsDraft.routes[e.id][c]}
                          disabled={!notificationsDraft.enabled[c]}
                          onChange={(ev) =>
                            setNotificationsDraft((v) => ({
                              ...v,
                              routes: {
                                ...v.routes,
                                [e.id]: {
                                  ...v.routes[e.id],
                                  [c]: ev.target.checked,
                                },
                              },
                            }))
                          }
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="st-note st-inset">
              At least one enabled Guardian route must remain. Existing
              observations in D-14 and D-10 are not filtered, delivered or
              changed by these preferences. Preflight uses saved metadata only.
            </div>
          </Panel>
        )}
        {tab === "integrations" && (
          <>
            <Panel
              number="06 / PERSONAL API ACCESS"
              title="API key inventory"
              description="Masked source records and nonfunctional generated demo keys. No usable API secret is stored or revealed by the service."
              actions={
                <button
                  className="st-btn st-primary"
                  onClick={() => open("generateKey")}
                >
                  + Generate demo key
                </button>
              }
            >
              <div className="table-responsive">
                <table className="table st-table st-key-table">
                  <thead>
                    <tr>
                      {[
                        "Key / scope",
                        "Masked prefix",
                        "Created / last use",
                        "Local state",
                        "Action",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.apiKeys.map((k) => (
                      <tr key={k.id}>
                        <td>
                          <b>{k.name}</b>
                          <small className="st-cell-sub">
                            {k.scopes.join(" · ")}
                          </small>
                        </td>
                        <td className="mono">{k.prefix}••••••••</td>
                        <td>
                          {k.createdAt.slice(0, 10)}
                          <small className="st-cell-sub">
                            {k.lastUsed ? stamp(k.lastUsed) : "Never observed"}
                          </small>
                        </td>
                        <td>{k.state.replaceAll("_", " ")}</td>
                        <td>
                          <button
                            className="st-link"
                            disabled={k.state === "revoke_requested"}
                            onClick={() => open("revokeKey", k.id)}
                          >
                            Review revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel
              number="06 / WEBHOOKS & WORKFLOWS"
              title="Integration preparations"
              description="Source integration references and local drafts. No OAuth flow, webhook registration, signing-secret update or account connection is performed."
            >
              <div className="st-integrations">
                {data.integrations.map((i) => (
                  <article className="st-integration" key={i.id}>
                    <div>
                      <span className="st-tag">{i.type.toUpperCase()}</span>
                      <h3>{i.name}</h3>
                      <p>{i.status.replaceAll("_", " ")}</p>
                      <small className="mono">
                        {i.type === "webhook"
                          ? i.endpoint
                          : "Account authorization required in production"}
                      </small>
                    </div>
                    <div className="st-actions">
                      <button
                        className="st-btn"
                        onClick={() => open("integration", i.id)}
                      >
                        {i.status === "not_configured"
                          ? "Prepare connection"
                          : "Edit draft"}
                      </button>
                      <button
                        className="st-link"
                        onClick={() => open("integrationTest", i.id)}
                      >
                        Test preflight
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </>
        )}
        {tab === "billing" && (
          <>
            <Panel
              number="07 / BILLING & SUBSCRIPTION"
              title="Plan & account usage"
              description="Source billing observations and local change requests. No checkout, card collection, charge or cancellation is performed."
              actions={
                <button className="st-btn" onClick={() => open("usage")}>
                  Usage methodology
                </button>
              }
            >
              <div className="st-billing">
                <div className="st-plan">
                  <span className="st-tag">CURRENT SOURCE PLAN</span>
                  <h3>
                    {data.billing.plan}{" "}
                    <span>{money(data.billing.price)} / month</span>
                  </h3>
                  <p>
                    Renews {data.billing.renewsAt.slice(0, 10)} ·{" "}
                    {renewalDays(data)} days from source snapshot
                  </p>
                  <p>
                    {data.billing.payment.brand} ••••{" "}
                    {data.billing.payment.last4} / source payment method
                  </p>
                  <div className="st-actions">
                    <button
                      className="st-btn st-primary"
                      onClick={() => open("upgrade")}
                    >
                      Review Team / $79 mo
                    </button>
                    <button className="st-link" onClick={() => open("cancel")}>
                      Cancel request
                    </button>
                    <button className="st-link" onClick={() => open("payment")}>
                      Payment reference
                    </button>
                  </div>
                  {data.billing.request !== "none" && (
                    <div className="st-note mt-3">
                      Pending local preview:{" "}
                      {data.billing.request.replaceAll("_", " ")}
                      <button
                        className="st-link ms-2"
                        onClick={() =>
                          void run({ kind: "billing", action: "clear_request" })
                        }
                      >
                        Clear local request
                      </button>
                    </div>
                  )}
                  {data.billing.paymentDraft && (
                    <small className="st-muted">
                      Draft reference: {data.billing.paymentDraft.brand} ••••{" "}
                      {data.billing.paymentDraft.last4} (source unchanged)
                    </small>
                  )}
                </div>
                <div className="st-usage">
                  {data.billing.usage.map((u) => (
                    <div className="st-usage-row" key={u.label}>
                      <div>
                        <span>{u.label}</span>
                        <b className="mono">
                          {u.used} / {u.limit ?? "no limit"}
                        </b>
                      </div>
                      {u.limit && (
                        <div className="st-meter">
                          <span
                            style={{
                              width: `${Math.min(100, (u.used / u.limit) * 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel
              number="07 / INVOICE HISTORY"
              title="Billing source documents"
              description="Readable demo PDFs from the invoice DTOs. Source paid status is not a verified payment receipt."
            >
              <div className="table-responsive">
                <table className="table st-table">
                  <thead>
                    <tr>
                      {table.getHeaderGroups()[0]?.headers.map((h) => (
                        <th key={h.id}>
                          <button onClick={h.column.getToggleSortingHandler()}>
                            {String(h.column.columnDef.header)}{" "}
                            {h.column.getIsSorted() === "desc" ? "↓" : "↕"}
                          </button>
                        </th>
                      ))}
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map(({ original: i }) => (
                      <tr key={i.id}>
                        <td className="mono">{i.date}</td>
                        <td>
                          <b>{i.description}</b>
                          <small className="st-cell-sub">{i.id}</small>
                        </td>
                        <td>{money(i.amount)}</td>
                        <td>
                          <span className="st-tag">{i.status} / SOURCE</span>
                        </td>
                        <td>
                          <div className="st-actions">
                            <button
                              className="st-link"
                              onClick={() => open("invoice", i.id)}
                            >
                              Inspect
                            </button>
                            <button
                              className="st-link"
                              disabled={disabled}
                              onClick={() => void invoicePdf(i)}
                            >
                              Download demo PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
      <section>
        <div className="st-section-head">
          <h2>Settings workbench</h2>
          <span className="st-muted">REVIEW / PREPARE / DOCUMENT</span>
        </div>
        <div className="st-workbench">
          {(
            [
              ["addConnection", "Prepare provider connection"],
              ["security", "Review access policy"],
              ["generateKey", "Create a demo API key"],
              ["upgrade", "Compare subscription plans"],
              ["export", "Export settings evidence"],
              ["audit", "Review local decisions"],
            ] as [Kind, string][]
          ).map(([kind, label]) => (
            <button key={kind} onClick={() => open(kind)}>
              <Icon name="layers" size={15} />
              {label}
              <Icon name="arrowRight" size={13} />
            </button>
          ))}
        </div>
      </section>
      <footer className="st-footer">
        <span>
          LOCAL SETTINGS DEMO / no authentication · no delivery · no billing
          changes
        </span>
        <Link href="/dashboard/bots">Bot policies ↗</Link>
        <Link href="/dashboard/deposits">Deposit reviews ↗</Link>
        <Link href="/dashboard/logs">Audit workspace ↗</Link>
        <button className="st-link" onClick={() => open("help")}>
          Integration guide ↗
        </button>
      </footer>
      {modal && (
        <div className="st-local-layer">
          <DeskModalShell
            code="D15"
            eyebrow="OPERATOR SETTINGS / LOCAL PREVIEW"
            title={titles[modal.kind]}
            subtitle="Changes affect this session only. Identity, provider authorization, delivery and billing require authenticated backend integration."
            size="xl"
            onClose={() => callback.current()}
            steps={
              wizards.includes(modal.kind)
                ? ["Prepare", "Review impact", "Acknowledge"]
                : undefined
            }
            currentStep={step}
            footer={modalFooter}
          >
            {error && (
              <div className="st-error mb-3" role="alert">
                {error}
              </div>
            )}
            {blocking && (
              <div className="st-error mb-3" role="alert">
                {blocking}
              </div>
            )}
            {modal.kind === "profile" && step < 2 && (
              <>
                <h3>{profileDraft.fullName}</h3>
                <dl className="st-policy">
                  <div>
                    <dt>Timezone</dt>
                    <dd>{profileDraft.timezone}</dd>
                  </div>
                  <div>
                    <dt>Phone preference</dt>
                    <dd>{profileDraft.phone}</dd>
                  </div>
                  <div>
                    <dt>Public bio</dt>
                    <dd>{profileDraft.bio || "No public bio"}</dd>
                  </div>
                </dl>
                <p className="st-muted mt-3">
                  Email, username and server role are not changed by this
                  profile update.
                </p>
              </>
            )}
            {modal.kind === "avatar" && (
              <AvatarCrop
                onApply={(url) => void run({ kind: "avatar", dataUrl: url })}
              />
            )}
            {modal.kind === "email" && step < 2 && (
              <>
                <label className="st-field">
                  New demo email address
                  <input
                    aria-label="New demo email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <div className="st-note mt-3">
                  Current source email stays {data.profile.email}. Confirmation
                  records a local preview only. No verification email is sent,
                  address verified or login identity changed.
                </div>
              </>
            )}
            {modal.kind === "role" && step < 2 && (
              <>
                <h3>Operator + investor presentation preview</h3>
                <p>
                  Add an investor-facing role badge in this workspace. This does
                  not grant backend permissions, satisfy KYC, subscribe to a
                  package or invest funds.
                </p>
                <Link className="st-btn" href="/investor">
                  Inspect investor dashboard ↗
                </Link>
              </>
            )}
            {modal.kind === "addConnection" && step < 2 && (
              <>
                <div className="st-form-grid">
                  <label className="st-field">
                    Source account type
                    <select
                      className="form-select"
                      aria-label="New Deriv account type"
                      value={accountType}
                      onChange={(e) => {
                        const type = e.target.value as "Real" | "Demo";
                        setAccountType(type);
                        setLogin(type === "Demo" ? "VRTC200001" : "CR200001");
                      }}
                    >
                      <option>Demo</option>
                      <option>Real</option>
                    </select>
                  </label>
                  <label className="st-field">
                    Account login ID
                    <input
                      className="form-control"
                      aria-label="New Deriv login ID"
                      value={login}
                      onChange={(e) => setLogin(e.target.value.toUpperCase())}
                    />
                  </label>
                </div>
                <div className="st-note mt-3">
                  Prepares metadata with Read/Trade scopes. No token is entered
                  or requested. Production must generate OAuth state, use an
                  allowlisted callback and validate returned account/scopes
                  server-side. A prepared record has no balance and is not
                  connected.
                </div>
                <p className="st-muted mt-3">
                  Source plan {data.billing.plan}: {data.connections.length}/
                  {data.billing.plan === "Team" ? 5 : 2} slots used. A local
                  upgrade request does not change entitlement.
                </p>
              </>
            )}
            {modal.kind === "connection" && connection && step < 2 && (
              <>
                <h3>
                  {connection.loginId} · {connectionAction} request
                </h3>
                <p>
                  Current local metadata:{" "}
                  {connection.status.replaceAll("_", " ")} /{" "}
                  {connection.permissions.join(", ")}
                </p>
                <div className="st-note">
                  {connectionAction === "disconnect"
                    ? "Marks this record disconnected and removes its primary flag locally. It does not revoke a token or stop bots on any other page."
                    : connectionAction === "primary"
                      ? "Selects a primary preview from source-connected metadata only; it does not redirect bot execution."
                      : "Changes status to OAuth prepared, not connected. No token is rotated and no OAuth flow is launched. Reauthorization must occur securely on the backend."}
                </div>
              </>
            )}
            {modal.kind === "connectionTest" && connection && (
              <>
                <h3>{connection.loginId}</h3>
                <p>
                  Check saved metadata and record an explicit configuration-only
                  result. No WebSocket opens, no ping is sent and no measured
                  latency is fabricated.
                </p>
                <button
                  className="st-btn st-primary"
                  disabled={disabled}
                  onClick={() =>
                    void run(
                      {
                        kind: "check",
                        target: connection.id,
                        targetType: "connection",
                      },
                      true,
                    )
                  }
                >
                  Run local configuration check
                </button>
                {lastCheck(connection.id) && (
                  <div className="st-note mt-3" role="status">
                    Result: {lastCheck(connection.id)!.result} /{" "}
                    {stamp(lastCheck(connection.id)!.time)}. Provider
                    availability remains unverified.
                  </div>
                )}
              </>
            )}
            {modal.kind === "platform" && step < 2 && (
              <>
                <dl className="st-policy">
                  {Object.entries(platformDraft).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>
                        {typeof v === "boolean"
                          ? v
                            ? "Enabled preference"
                            : "Disabled preference"
                          : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="st-note mt-3">
                  These are defaults, not deployed controls. No D-14 Guardian
                  policy, deposit verification, package split or payout
                  automation is changed. Auto-approval and auto-verification
                  preferences require independent authorization and
                  reconciliation before production use.
                </div>
              </>
            )}
            {modal.kind === "password" && step < 2 && (
              <>
                <div className="st-note mb-3">
                  Use <b>demo-current</b> as the demonstration current password.
                  Never enter your real password. This only validates a draft;
                  no identity provider or password hash is changed.
                </div>
                {step === 0 ? (
                  <div className="st-form-grid">
                    {(["current", "next", "confirm"] as const).map((k) => (
                      <label className="st-field" key={k}>
                        Demo {k === "next" ? "new" : k} password
                        <input
                          className="form-control"
                          aria-label={`Demo ${k} password`}
                          type="password"
                          autoComplete="off"
                          maxLength={128}
                          value={password[k]}
                          onChange={(e) =>
                            setPassword({ ...password, [k]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p>
                    Demo password structure passed validation. No password text
                    is included in the workspace, API command, audit record or
                    export. Closing clears the draft fields.
                  </p>
                )}
              </>
            )}
            {modal.kind === "backup" && (
              <>
                <div className="st-note mb-3">
                  Nonfunctional demonstration codes only. Source recovery codes
                  are never fetched. Enter <b>000000</b> below to demonstrate a
                  future recent-authentication check.
                </div>
                {!backupCodes.length ? (
                  <>
                    <label className="st-field">
                      Demo confirmation code
                      <input
                        className="form-control"
                        aria-label="Backup demo confirmation"
                        value={verify}
                        onChange={(e) => setVerify(e.target.value)}
                        maxLength={6}
                        inputMode="numeric"
                      />
                    </label>
                    <button
                      className="st-btn st-primary mt-3"
                      disabled={disabled || verify !== "000000"}
                      onClick={async () => {
                        if (
                          await run(
                            { kind: "securityEvent", event: "backup_preview" },
                            true,
                          )
                        )
                          setBackupCodes(
                            Array.from(
                              { length: 8 },
                              () =>
                                "DEMO-" +
                                Array.from(
                                  crypto.getRandomValues(new Uint8Array(4)),
                                  (b) => b.toString(16).padStart(2, "0"),
                                )
                                  .join("")
                                  .toUpperCase(),
                            ),
                          );
                      }}
                    >
                      Reveal demo-only codes
                    </button>
                  </>
                ) : (
                  <>
                    <div className="st-code-grid">
                      {backupCodes.map((c) => (
                        <code key={c}>{c}</code>
                      ))}
                    </div>
                    <button
                      className="st-btn mt-3"
                      onClick={() =>
                        download(
                          "NONFUNCTIONAL DEMO RECOVERY CODES\n\n" +
                            backupCodes.join("\n"),
                          "demo-recovery-codes.txt",
                          "text/plain",
                        )
                      }
                    >
                      Download demo codes
                    </button>
                    <p className="st-muted mt-3">
                      Cleared on close. These cannot authenticate or recover an
                      account.
                    </p>
                  </>
                )}
              </>
            )}
            {modal.kind === "twoFactor" && (
              <>
                <h3>
                  {twoFactorAction === "disable_2fa"
                    ? "Request 2FA disable preview"
                    : "Prepare authenticator reconfiguration"}
                </h3>
                <div className="st-error mb-3">
                  No real authenticator is disabled, enrolled or rotated. No QR
                  provisioning secret is issued. Source authentication remains
                  unchanged.
                </div>
                <label className="st-field">
                  Demo recent-auth code · enter 000000
                  <input
                    className="form-control"
                    aria-label="Two-factor demo code"
                    value={verify}
                    maxLength={6}
                    inputMode="numeric"
                    onChange={(e) => setVerify(e.target.value)}
                  />
                </label>
                <p className="st-muted mt-3">
                  A real production flow must validate recent authentication, a
                  current factor and recovery policy server-side before changing
                  enrollment.
                </p>
              </>
            )}
            {modal.kind === "security" && step < 2 && (
              <>
                <dl className="st-policy">
                  <div>
                    <dt>Session timeout preference</dt>
                    <dd>
                      {securityDraft.timeout === "never"
                        ? "Never (high risk)"
                        : securityDraft.timeout + " minutes"}
                    </dd>
                  </div>
                  <div>
                    <dt>Whitelist preference</dt>
                    <dd>
                      {securityDraft.whitelistEnabled ? "Enabled" : "Disabled"}
                    </dd>
                  </div>
                  <div>
                    <dt>Addresses</dt>
                    <dd>
                      {securityDraft.ips.map((i) => i.address).join(", ") ||
                        "None"}
                    </dd>
                  </div>
                </dl>
                {securityProblems.map((p, i) => (
                  <p key={i} className="text-loss">
                    {p}
                  </p>
                ))}
                <div className="st-note mt-3">
                  Saving does not expire sessions, log you out or enforce IP
                  access. Documentation-only fixture addresses are used.
                  Enabling a whitelist requires retaining the current fixture
                  address to prevent modeled lockout.
                </div>
              </>
            )}
            {modal.kind === "ip" && (
              <>
                <div className="st-form-grid">
                  <label className="st-field">
                    Individual IP address
                    <input
                      className="form-control"
                      aria-label="Whitelist IP address"
                      value={ip}
                      onChange={(e) => setIp(e.target.value)}
                    />
                  </label>
                  <label className="st-field">
                    Address label
                    <input
                      className="form-control"
                      aria-label="Whitelist IP label"
                      value={ipLabel}
                      onChange={(e) => setIpLabel(e.target.value)}
                      maxLength={40}
                    />
                  </label>
                </div>
                <div className="st-note mt-3">
                  IPv4 or IPv6 only; no CIDR ranges. Added to the unsaved
                  access-policy draft. Review security settings separately to
                  save.
                </div>
                <button
                  className="st-btn st-primary mt-3"
                  onClick={() => {
                    const next = {
                      ...securityDraft,
                      ips: [
                        ...securityDraft.ips,
                        { address: ip, label: ipLabel },
                      ],
                    };
                    const issues = securityIssues(data, next);
                    if (issues.length) setError(issues.join("; "));
                    else {
                      setSecurityDraft(next);
                      setModal(null);
                      pushToast({
                        tone: "info",
                        title:
                          "Address added to access-policy draft; review security settings to save",
                      });
                    }
                  }}
                >
                  Add address to draft
                </button>
              </>
            )}
            {(modal.kind === "session" || modal.kind === "revokeAll") &&
              step < 2 && (
                <>
                  <h3>
                    {modal.kind === "revokeAll"
                      ? "All source sessions"
                      : session?.device}
                  </h3>
                  <p>
                    {modal.kind === "revokeAll"
                      ? `${data.security.sessions.length} session records will show a local revocation request.`
                      : `${session?.ip} / ${session?.current ? "Current fixture session" : "Secondary source session"}`}
                  </p>
                  <div className="st-error">
                    This records revoke_requested locally, not revoked. No
                    cookie, server session, API token or provider authorization
                    is invalidated. You remain signed in. Real sign-out requires
                    a server acknowledgement.
                  </div>
                </>
              )}
            {modal.kind === "notifications" && step < 2 && (
              <>
                <h3>Routing changes across {events.length} event types</h3>
                <dl className="st-policy">
                  {channelNames.map((c) => (
                    <div key={c}>
                      <dt>{c}</dt>
                      <dd>
                        {notificationsDraft.enabled[c]
                          ? `${events.filter((e) => notificationsDraft.routes[e.id][c]).length} selected routes`
                          : "Disabled preference"}
                      </dd>
                    </div>
                  ))}
                </dl>
                {notificationProblems.map((p, i) => (
                  <p key={i} className="text-loss">
                    {p}
                  </p>
                ))}
                <p className="st-muted mt-3">
                  No credentials, browser permission, delivery worker or channel
                  subscription is configured by saving these preferences.
                </p>
              </>
            )}
            {modal.kind === "channel" && (
              <>
                <h3>{channel} channel metadata</h3>
                {channel === "email" ? (
                  <p>
                    Source verified address: {data.profile.email}. Use the
                    profile’s email-change preview to prepare a future
                    verification request.
                  </p>
                ) : channel === "push" ? (
                  <div className="st-note">
                    Push is a preference only. No browser permission prompt,
                    service worker subscription, endpoint or VAPID key is
                    generated. Production must register a real service worker
                    and obtain explicit consent.
                  </div>
                ) : channel === "telegram" ? (
                  <label className="st-field">
                    Demo Telegram handle
                    <input
                      className="form-control"
                      aria-label="Telegram handle"
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                    />
                  </label>
                ) : (
                  <label className="st-field">
                    Public HTTPS webhook URL
                    <input
                      className="form-control"
                      aria-label="Notification webhook URL"
                      value={webhook}
                      onChange={(e) => setWebhook(e.target.value)}
                    />
                  </label>
                )}
                <button
                  className="st-btn st-primary mt-3"
                  onClick={() => {
                    setNotificationsDraft({
                      ...notificationsDraft,
                      telegramHandle: telegram,
                      webhookUrl: webhook,
                    });
                    setModal(null);
                    pushToast({
                      tone: "info",
                      title:
                        "Channel metadata added to draft; review notification settings to save",
                    });
                  }}
                >
                  Apply channel metadata to draft
                </button>
              </>
            )}
            {modal.kind === "channelTest" && (
              <>
                <h3>{channel} / saved channel preflight</h3>
                <p>
                  This validates saved channel metadata only. Draft edits are
                  excluded. It sends no test message, email, push or HTTP
                  request.
                </p>
                <button
                  className="st-btn st-primary"
                  disabled={disabled}
                  onClick={() =>
                    void run(
                      { kind: "check", target: channel, targetType: "channel" },
                      true,
                    )
                  }
                >
                  Check saved channel configuration
                </button>
                {lastCheck(channel) && (
                  <div className="st-note mt-3" role="status">
                    {lastCheck(channel)!.result} /{" "}
                    {stamp(lastCheck(channel)!.time)}. Delivery unverified.
                  </div>
                )}
              </>
            )}
            {modal.kind === "generateKey" && step < 2 && (
              <>
                <label className="st-field">
                  Demo key name
                  <input
                    className="form-control"
                    aria-label="Demo API key name"
                    value={keyName}
                    maxLength={50}
                    onChange={(e) => setKeyName(e.target.value)}
                  />
                </label>
                <div className="st-actions mt-3">
                  {(["read", "trade"] as const).map((s) => (
                    <label className="st-check" key={s}>
                      <input
                        type="checkbox"
                        aria-label={`Demo key ${s} scope`}
                        checked={scopes.includes(s)}
                        onChange={() =>
                          setScopes(
                            scopes.includes(s)
                              ? scopes.filter((x) => x !== s)
                              : [...scopes, s],
                          )
                        }
                      />
                      {s}
                    </label>
                  ))}
                </div>
                <div className="st-note mt-3">
                  Generates a cryptographically random, explicitly nonfunctional{" "}
                  <code>demo_trademo_</code> value. It grants no access. Only a
                  masked prefix and scope labels enter workspace state; the full
                  value is shown once and cleared on close.
                </div>
              </>
            )}
            {modal.kind === "keyReveal" && (
              <>
                <div className="st-error mb-3">
                  DEMO ONLY / this value cannot authenticate API requests. It is
                  not a real personal API key.
                </div>
                <label className="st-field">
                  One-time demo value
                  <textarea
                    className="form-control st-source"
                    aria-label="One-time demo API value"
                    rows={3}
                    readOnly
                    value={secret}
                  />
                </label>
                <button
                  className="st-btn mt-3"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(secret);
                      pushToast({
                        tone: "success",
                        title: "Nonfunctional demo value copied",
                      });
                    } catch {
                      setError(
                        "Clipboard unavailable. Select and copy the displayed demo value manually.",
                      );
                    }
                  }}
                >
                  Copy demo value
                </button>
                <p className="st-muted mt-3">
                  Raw value is absent from API reads, workspace JSON and audit.
                  After closing, only the metadata remains in this session.
                </p>
              </>
            )}
            {modal.kind === "revokeKey" && step < 2 && (
              <>
                <h3>{key?.name}</h3>
                <p className="mono">{key?.prefix}••••••••</p>
                <div className="st-note">
                  Sets a local revocation-request flag. It does not invalidate a
                  server API key or stop any client. Production must revoke
                  credentials server-side and acknowledge completion.
                </div>
              </>
            )}
            {modal.kind === "integration" && integration && step < 2 && (
              <>
                <h3>{integration.name}</h3>
                {integration.type === "webhook" ? (
                  <div className="st-form-grid">
                    <label className="st-field">
                      Public HTTPS endpoint
                      <input
                        className="form-control"
                        aria-label="Integration endpoint"
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                      />
                    </label>
                    <label className="st-field">
                      Secret-manager reference · not a secret
                      <input
                        className="form-control"
                        aria-label="Integration secret reference"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="st-note">
                    Prepare a {integration.name} authorization preference. No
                    account access or OAuth redirect occurs. Production must
                    supply a provider-specific consent flow, scoped tokens,
                    callback validation and revocation.
                  </div>
                )}
                <p className="st-muted mt-3">
                  No signing secret is entered or revealed. Endpoint validation
                  does not establish reachability or defeat DNS rebinding;
                  production delivery must enforce allowlists, SSRF protections,
                  signatures and retries.
                </p>
              </>
            )}
            {modal.kind === "integrationTest" && integration && (
              <>
                <h3>{integration.name}</h3>
                <p>
                  Checks prepared/source metadata only, not credentials, webhook
                  signatures, endpoint reachability or OAuth validity.
                </p>
                <button
                  className="st-btn st-primary"
                  disabled={disabled}
                  onClick={() =>
                    void run(
                      {
                        kind: "check",
                        target: integration.id,
                        targetType: "integration",
                      },
                      true,
                    )
                  }
                >
                  Run integration preflight
                </button>
                {lastCheck(integration.id) && (
                  <div className="st-note mt-3" role="status">
                    {lastCheck(integration.id)!.result} /{" "}
                    {stamp(lastCheck(integration.id)!.time)}. Nothing delivered.
                  </div>
                )}
              </>
            )}
            {modal.kind === "upgrade" && step < 2 && (
              <>
                <div className="st-plan-comparison">
                  <div>
                    <span className="st-tag">SOURCE PRO</span>
                    <h3>$29 / month</h3>
                    <p>10 bots · 2 connections · 50 schedules · 5 packages</p>
                  </div>
                  <div>
                    <span className="st-tag">PROPOSED TEAM</span>
                    <h3>$79 / month</h3>
                    <p>25 bots · 5 connections · 150 schedules · 15 packages</p>
                  </div>
                </div>
                <div className="st-note mt-3">
                  Illustrative plan catalog. Confirming creates an upgrade
                  request preview only. No proration, tax, checkout or charge is
                  calculated; current plan, renewal and entitlements stay
                  unchanged.
                </div>
              </>
            )}
            {modal.kind === "cancel" && step < 2 && (
              <>
                <h3>Prepare cancellation at renewal</h3>
                <p>
                  Source renewal: {data.billing.renewsAt.slice(0, 10)}. This
                  does not cancel the real subscription, refund payment or
                  remove access. A local pending request can be cleared from the
                  billing panel.
                </p>
                <div className="st-note">
                  Production requires verified billing-provider acknowledgement
                  and clear effective-date/refund terms. No actual cancellation
                  has been submitted.
                </div>
              </>
            )}
            {modal.kind === "payment" && step < 2 && (
              <>
                <div className="st-note mb-3">
                  Demo reference only. Never enter a full card number, CVV or
                  banking credentials. A real payment update belongs in a
                  provider-hosted checkout flow.
                </div>
                <div className="st-form-grid">
                  <label className="st-field">
                    Demo brand
                    <select
                      className="form-select"
                      aria-label="Demo payment brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value as typeof brand)}
                    >
                      <option>Visa</option>
                      <option>Mastercard</option>
                    </select>
                  </label>
                  <label className="st-field">
                    Last four demo digits
                    <input
                      className="form-control"
                      aria-label="Demo payment last four"
                      inputMode="numeric"
                      maxLength={4}
                      value={last4}
                      onChange={(e) => setLast4(e.target.value)}
                    />
                  </label>
                </div>
              </>
            )}
            {modal.kind === "invoice" && invoice && (
              <>
                <h3>
                  {invoice.id} / {invoice.description}
                </h3>
                <dl className="st-policy">
                  <div>
                    <dt>Invoice date</dt>
                    <dd>{invoice.date}</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd>{money(invoice.amount)}</dd>
                  </div>
                  <div>
                    <dt>Source status</dt>
                    <dd>{invoice.status}</dd>
                  </div>
                </dl>
                <p className="st-muted mt-3">
                  Synthetic source evidence, not a tax invoice, certified
                  billing-provider document or proof that funds settled.
                </p>
                <button
                  className="st-btn st-primary"
                  disabled={disabled}
                  onClick={() => void invoicePdf(invoice)}
                >
                  Download source demo PDF
                </button>
              </>
            )}
            {modal.kind === "usage" && (
              <>
                <p>
                  Usage is a fixed billing-cycle fixture, not a live count of
                  D-14 edits, D-13 schedules or shell activity. Current source
                  plan stays {data.billing.plan} despite pending local requests.
                </p>
                {data.billing.usage.map((u) => (
                  <div className="st-record" key={u.label}>
                    <b>{u.label}</b>
                    <span>
                      {u.used} / {u.limit ?? "no limit"}
                    </span>
                  </div>
                ))}
                <p className="st-muted mt-3">
                  Renewal countdown is anchored to source {stamp(data.asOf)},
                  not a fabricated live billing event. Authoritative usage,
                  proration and entitlements must come from billing services.
                </p>
              </>
            )}
            {modal.kind === "export" && step < 2 && (
              <>
                <label className="st-field">
                  Settings evidence format
                  <select
                    className="form-select"
                    aria-label="Settings export format"
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                  >
                    <option value="json">
                      JSON / complete structured workspace
                    </option>
                    <option value="pdf">
                      PDF / readable configuration summary
                    </option>
                  </select>
                </label>
                <div className="st-note mt-3">
                  Includes all saved session data, not unsaved form drafts. JSON
                  contains profile/contact fields, fixture IPs, cropped avatar,
                  masked key metadata and integration references. It never
                  contains raw demo keys, password drafts or backup codes.
                  Authorize and minimize real exports server-side.
                </div>
              </>
            )}
            {modal.kind === "audit" && (
              <>
                <p>
                  Local append-only decisions. No real D-12 security audit is
                  mutated and reload clears all session edits.
                </p>
                {data.audit.map((a, i) => (
                  <div className="st-record" key={i}>
                    <div>
                      <b>{a.action}</b>
                      <small>{stamp(a.time)}</small>
                      <p>{a.detail}</p>
                    </div>
                  </div>
                ))}
                {!data.audit.length && (
                  <div className="st-note">
                    No local settings decisions recorded yet. Review a profile
                    or preference change to begin.
                  </div>
                )}
                <button
                  className="st-btn mt-3"
                  onClick={() =>
                    download(
                      JSON.stringify(data.audit, null, 2),
                      "settings-local-audit.json",
                    )
                  }
                >
                  Download local decisions
                </button>
              </>
            )}
            {modal.kind === "help" && (
              <ul className="st-methodology">
                <li>
                  Seven settings sections use a structured SSR snapshot and
                  TanStack Query/Form/Table. All changes are session-only and
                  reset on reload; other workspaces are not mutated.
                </li>
                <li>
                  Source connection/security/billing statuses are fixture
                  observations, not real authorization or provider
                  acknowledgements. Prepared OAuth records are never described
                  as newly connected accounts.
                </li>
                <li>
                  No real password, TOTP seed, recovery code, provider token,
                  payment credential or signing secret is collected. Demo-only
                  credential inputs remain ephemeral and are excluded from
                  workspace state and exports.
                </li>
                <li>
                  Diagnostic tests are configuration-only. No WebSocket ping,
                  email, Telegram, browser push, webhook request, real latency
                  or delivery confirmation is fabricated.
                </li>
                <li>
                  Platform defaults do not deploy changes to D-14 bot controls,
                  package terms, deposit review or payout automation. Higher
                  default Guardian thresholds require explicit reconciliation
                  with execution hard caps.
                </li>
                <li>
                  Before production, add account-scoped authenticated
                  reads/writes, recent-auth checks, verified email/2FA
                  enrollment, provider OAuth state/callback validation,
                  authoritative sessions, SSRF-safe delivery and hosted billing
                  flows.
                </li>
              </ul>
            )}
            {wizards.includes(modal.kind) && step === 2 && (
              <>
                <div className="st-note">
                  Review the intended local effect. Server-side authority,
                  verification and provider acknowledgement are not implemented
                  by this preview.
                </div>
                {confirmation}
              </>
            )}
          </DeskModalShell>
        </div>
      )}
      {drawer && (
        <div
          className="st-local-layer st-drawer-layer"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) callback.current();
          }}
        >
          <aside
            className="st-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Settings right inspector"
          >
            <header>
              <div>
                <span className="st-section-code">
                  D15 / SETTINGS INSPECTOR
                </span>
                <h2>{data.profile.username}</h2>
              </div>
              <button
                className="st-icon-button"
                aria-label="Close settings inspector"
                onClick={() => callback.current()}
              >
                <Icon name="close" size={17} />
              </button>
            </header>
            <nav>
              {["summary", "security", "checks"].map((t) => (
                <button
                  key={t}
                  aria-pressed={drawerTab === t}
                  className={drawerTab === t ? "active" : ""}
                  onClick={() => setDrawerTab(t)}
                >
                  {t}
                </button>
              ))}
            </nav>
            <div className="st-drawer-body">
              {drawerTab === "summary" && (
                <>
                  <div className="st-dossier">
                    <div>
                      <small>PROFILE / SOURCE</small>
                      <b>{data.profile.fullName}</b>
                      <p>{data.profile.email}</p>
                    </div>
                    <div>
                      <small>SETTINGS CONTEXT</small>
                      <b>{tabLabels[tab]}</b>
                      <p>
                        {data.profile.timezone} / revision {data.revision}
                      </p>
                    </div>
                    <div>
                      <small>BILLING / SOURCE</small>
                      <b>
                        {data.billing.plan} / {money(data.billing.price)} mo
                      </b>
                      <p>{data.billing.request.replaceAll("_", " ")}</p>
                    </div>
                  </div>
                  <button className="st-btn mt-3" onClick={() => open("audit")}>
                    Inspect local decisions
                  </button>
                </>
              )}
              {drawerTab === "security" && (
                <>
                  <dl className="st-policy">
                    <div>
                      <dt>2FA source/request</dt>
                      <dd>{data.security.twoFactor}</dd>
                    </div>
                    <div>
                      <dt>Timeout preference</dt>
                      <dd>{data.security.timeout}</dd>
                    </div>
                    <div>
                      <dt>Revocation requests</dt>
                      <dd>
                        {
                          data.security.sessions.filter(
                            (s) => s.state === "revoke_requested",
                          ).length
                        }
                      </dd>
                    </div>
                  </dl>
                  <div className="st-note mt-3">
                    These are preferences and local requests, not proof of real
                    enforcement.
                  </div>
                  <button
                    className="st-btn mt-3"
                    onClick={() => open("security")}
                  >
                    Review access policy
                  </button>
                </>
              )}
              {drawerTab === "checks" && (
                <>
                  {data.checks.map((c) => (
                    <div className="st-record" key={c.id}>
                      <div>
                        <b>
                          {c.kind} / {c.target}
                        </b>
                        <small>{stamp(c.time)}</small>
                        <p>{c.result} · no delivery or network test</p>
                      </div>
                    </div>
                  ))}
                  {!data.checks.length && (
                    <div className="st-note">
                      No configuration preflights recorded. Use a connection,
                      channel or integration check to inspect saved metadata.
                    </div>
                  )}
                </>
              )}
            </div>
            <footer>
              <button className="st-btn" onClick={() => open("help")}>
                Integration boundaries
              </button>
              <button
                className="st-btn st-primary"
                onClick={() => open("export")}
              >
                Export saved settings
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
export function SettingsPage({
  operatorBundle,
  initial,
  initialTab,
}: {
  operatorBundle: OperatorBundleProps;
  initial: SettingsWorkspace;
  initialTab: SettingsTab;
}) {
  return (
    <OperatorShell rootClass="page-dashboard-settings" bundle={operatorBundle}>
      {() => <SettingsDesk initial={initial} initialTab={initialTab} />}
    </OperatorShell>
  );
}
