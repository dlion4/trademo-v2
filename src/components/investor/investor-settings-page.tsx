"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { InvestorShell } from "./investor-shell";
import "@/styles/pages/investor-settings.css";
import {
  INITIAL_ALERT_RULES,
  INITIAL_BENEFICIARIES,
  INITIAL_KYC_DOCS,
  INITIAL_KYC_HISTORY,
  INITIAL_NOTIFICATION_LOGS,
  INITIAL_PAYOUT_HISTORY,
  INITIAL_PAYOUT_METHODS,
  INITIAL_SECURITY_EVENTS,
  INITIAL_SESSIONS,
  type AlertRuleItem,
  type BeneficiaryItem,
  type KycDocumentItem,
  type KycHistoryItem,
  type NotificationLogItem,
  type PayoutHistoryItem,
  type PayoutMethodItem,
  type SecurityEventItem,
  type SessionItem,
  type SettingsSection,
} from "./investor-settings-data";
import { InvestorSettingsModalHost, type ActiveModalState } from "./investor-settings-modals";

export function InvestorSettingsPage() {
  const [section, setSection] = useState<SettingsSection>("profile");
  const [miniTab, setMiniTab] = useState<Record<SettingsSection, string>>({
    profile: "personal",
    security: "auth",
    notifications: "matrix",
    payouts: "mode",
    kyc: "tier",
  });
  const [modal, setModal] = useState<ActiveModalState>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Profile state
  const [avatarInitials, setAvatarInitials] = useState("DK");
  const [currentRole, setCurrentRole] = useState<"Investor" | "Operator">("Investor");
  const [fullName, setFullName] = useState("Daniel Kamau");
  const [email, setEmail] = useState("daniel.kamau@trademo.io");
  const [phone, setPhone] = useState("+254 712 345 889");
  const [timezone, setTimezone] = useState("Africa/Nairobi (UTC+3)");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [taxResidency, setTaxResidency] = useState("Kenya (KE)");
  const [taxPin, setTaxPin] = useState("A009482112Z");
  const [profileSaved, setProfileSaved] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryItem[]>(INITIAL_BENEFICIARIES);

  // Security state
  const [twoFaEnabled, setTwoFaEnabled] = useState(true);
  const [twoFaMethod, setTwoFaMethod] = useState("TOTP Authenticator");
  const [sessions, setSessions] = useState<SessionItem[]>(INITIAL_SESSIONS);
  const [sessionSearch, setSessionSearch] = useState("");
  const [securityEvents] = useState<SecurityEventItem[]>(INITIAL_SECURITY_EVENTS);

  // Notifications state
  const [notifMatrix, setNotifMatrix] = useState<Record<string, { email: boolean; sms: boolean; push: boolean; inApp: boolean }>>({
    "Pool Opens & Capacity": { email: true, sms: false, push: true, inApp: true },
    "Settlements & Payouts": { email: true, sms: true, push: true, inApp: true },
    "Guardian Risk Alerts": { email: true, sms: true, push: true, inApp: true },
    "Security & Logins": { email: true, sms: true, push: true, inApp: true },
    "Referral Rewards": { email: false, sms: false, push: true, inApp: true },
  });
  const [alertRules, setAlertRules] = useState<AlertRuleItem[]>(INITIAL_ALERT_RULES);
  const [notifLogs, setNotifLogs] = useState<NotificationLogItem[]>(INITIAL_NOTIFICATION_LOGS);

  // Payouts state
  const [payoutMode, setPayoutMode] = useState<"compound" | "split" | "withdraw" | "hold">("split");
  const [minThreshold, setMinThreshold] = useState("250");
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethodItem[]>(INITIAL_PAYOUT_METHODS);
  const [payoutHistory] = useState<PayoutHistoryItem[]>(INITIAL_PAYOUT_HISTORY);

  // KYC state
  const [kycTier, setKycTier] = useState("Tier 2 (Verified)");
  const [kycDocs, setKycDocs] = useState<KycDocumentItem[]>(INITIAL_KYC_DOCS);
  const [kycHistory, setKycHistory] = useState<KycHistoryItem[]>(INITIAL_KYC_HISTORY);

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.device.toLowerCase().includes(sessionSearch.toLowerCase()) ||
          s.location.toLowerCase().includes(sessionSearch.toLowerCase()) ||
          s.ip.includes(sessionSearch)
      ),
    [sessions, sessionSearch]
  );

  const otherSessionCount = sessions.filter((s) => !s.isCurrent).length;

  const setCurrentMiniTab = (tab: string) => {
    setMiniTab((prev) => ({ ...prev, [section]: tab }));
  };

  return (
    <InvestorShell
      activeNav="settings"
      rootClass="page-investor-settings"
      investorName={fullName}
      investorSinceLabel="Member since Jan 2026"
      poolBookValue={148250}
      monthRoi={4.82}
      walletBalance={12450}
      unread={3}
      quickActions={[
        { key: "security", label: "Change Password", icon: "lock" },
        { key: "payout", label: "Add Payout Rail", icon: "wallet" },
        { key: "kyc", label: "Upgrade KYC", icon: "shield" },
      ]}
      onNavigate={() => {}}
      onOpenDrawer={() => {}}
      onQuickAction={(key) => {
        if (key === "security") setModal({ type: "change-password" });
        if (key === "payout") setModal({ type: "add-payout-method" });
        if (key === "kyc") setModal({ type: "kyc-upgrade" });
      }}
      onOpenNotifications={() => setSection("notifications")}
    >
      <div className="iset-root">
        {/* ── Header Banner ── */}
        <div className="iset-header">
          <div className="iset-header-left">
            <button
              type="button"
              className="iset-avatar"
              title="Edit Profile Monogram"
              onClick={() => setModal({ type: "avatar" })}
            >
              {avatarInitials}
            </button>
            <div>
              <div className="iset-title-row">
                <h1 className="iset-title">{fullName}</h1>
                <span className="iset-badge iset-badge--accent">{currentRole} Workspace</span>
                <span className="iset-badge iset-badge--win">{kycTier}</span>
              </div>
              <p className="iset-subtitle">
                {email} · {timezone} · Base {baseCurrency}
              </p>
            </div>
          </div>

          <div className="iset-header-actions">
            <button className="iset-btn" onClick={() => setModal({ type: "role-switch" })}>
              <Icon name="refresh" size={14} />
              Switch Role
            </button>
            <button className="iset-btn" onClick={() => setModal({ type: "export-bundle" })}>
              <Icon name="download" size={14} />
              Export Bundle
            </button>
            <div className="iset-dropdown">
              <button className="iset-btn iset-btn--primary" onClick={() => setDropdownOpen((v) => !v)}>
                Quick Actions
                <Icon name="chevronDown" size={14} />
              </button>
              {dropdownOpen && (
                <div className="iset-dropdown-menu" onMouseLeave={() => setDropdownOpen(false)}>
                  <button className="iset-dropdown-item" onClick={() => { setDropdownOpen(false); setModal({ type: "change-password" }); }}>
                    Change Password
                  </button>
                  <button className="iset-dropdown-item" onClick={() => { setDropdownOpen(false); setModal({ type: "add-payout-method" }); }}>
                    Add Payout Method
                  </button>
                  <button className="iset-dropdown-item" onClick={() => { setDropdownOpen(false); setModal({ type: "test-notification" }); }}>
                    Test Notification
                  </button>
                  <button className="iset-dropdown-item" onClick={() => { setDropdownOpen(false); setModal({ type: "kyc-upgrade" }); }}>
                    Upgrade KYC Tier
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Primary Section Tabs ── */}
        <div className="iset-tabs-bar" role="tablist">
          {[
            { id: "profile", label: "Profile & Identity", badge: `${beneficiaries.length}` },
            { id: "security", label: "Security & Access", badge: `${sessions.length}` },
            { id: "notifications", label: "Notifications", badge: `${alertRules.length}` },
            { id: "payouts", label: "Payout Preferences", badge: `${payoutMethods.length}` },
            { id: "kyc", label: "KYC & Verification", badge: `${kycDocs.length}` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={section === t.id}
              className={`iset-tab-btn ${section === t.id ? "is-active" : ""}`}
              onClick={() => setSection(t.id as SettingsSection)}
            >
              <span>{t.label}</span>
              <span className="iset-tab-badge">{t.badge}</span>
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1: PROFILE
            ═══════════════════════════════════════════════════════════════ */}
        {section === "profile" && (
          <div className="iset-panel">
            <div className="iset-minitabs">
              {[
                { id: "personal", label: "Personal Details" },
                { id: "beneficiaries", label: `Beneficiaries & Linked (${beneficiaries.length})` },
                { id: "tax", label: "Tax & Residency" },
              ].map((m) => (
                <button
                  key={m.id}
                  className={`iset-minitab-btn ${miniTab.profile === m.id ? "is-active" : ""}`}
                  onClick={() => setCurrentMiniTab(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {miniTab.profile === "personal" && (
              <div className="iset-card">
                <div className="iset-card-header">
                  <div>
                    <h2 className="iset-card-title">Personal Profile</h2>
                    <p className="iset-card-desc">Manage your investor identity, contact channels, and display preferences.</p>
                  </div>
                  <button
                    className="iset-btn iset-btn--primary"
                    onClick={() => {
                      setProfileSaved(true);
                      setTimeout(() => setProfileSaved(false), 2000);
                    }}
                  >
                    {profileSaved ? "✓ Saved" : "Save Changes"}
                  </button>
                </div>
                <div className="iset-form-grid">
                  <div className="iset-field">
                    <label className="iset-label">Full Legal Name</label>
                    <input className="iset-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="iset-field">
                    <label className="iset-label">Primary Email</label>
                    <input className="iset-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="iset-field">
                    <label className="iset-label">Phone Number</label>
                    <input className="iset-input iset-mono" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="iset-field">
                    <label className="iset-label">Timezone</label>
                    <select className="iset-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      <option>Africa/Nairobi (UTC+3)</option>
                      <option>UTC (UTC+0)</option>
                      <option>America/New_York (UTC-5)</option>
                      <option>Europe/London (UTC+0)</option>
                    </select>
                  </div>
                  <div className="iset-field">
                    <label className="iset-label">Base Reporting Currency</label>
                    <select className="iset-select" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
                      <option>USD</option>
                      <option>KES</option>
                      <option>EUR</option>
                      <option>USDC</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {miniTab.profile === "beneficiaries" && (
              <div className="iset-card">
                <div className="iset-card-header">
                  <div>
                    <h2 className="iset-card-title">Beneficiaries & Linked Accounts</h2>
                    <p className="iset-card-desc">Designated estate beneficiaries and co-investment settlement accounts.</p>
                  </div>
                  <button className="iset-btn iset-btn--primary" onClick={() => setModal({ type: "beneficiary" })}>
                    + Add Beneficiary
                  </button>
                </div>
                <div className="iset-table-wrap">
                  <table className="iset-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Relationship</th>
                        <th>Rail</th>
                        <th>Account</th>
                        <th>Allocation</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {beneficiaries.map((b) => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 600 }}>{b.name}</td>
                          <td>{b.relationship}</td>
                          <td>{b.rail}</td>
                          <td className="iset-mono">{b.accountMask}</td>
                          <td className="iset-mono">{b.allocationPct}%</td>
                          <td>
                            <span className={`iset-badge ${b.status === "Verified" ? "iset-badge--win" : "iset-badge--warn"}`}>
                              {b.status}
                            </span>
                          </td>
                          <td>
                            <button className="iset-btn iset-btn--sm" onClick={() => setModal({ type: "beneficiary", item: b })}>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {miniTab.profile === "tax" && (
              <div className="iset-card">
                <div className="iset-card-header">
                  <div>
                    <h2 className="iset-card-title">Tax & Residency</h2>
                    <p className="iset-card-desc">Used for automated withholding tax calculations and year-end statements.</p>
                  </div>
                </div>
                <div className="iset-form-grid">
                  <div className="iset-field">
                    <label className="iset-label">Tax Residency Country</label>
                    <input className="iset-input" value={taxResidency} onChange={(e) => setTaxResidency(e.target.value)} />
                  </div>
                  <div className="iset-field">
                    <label className="iset-label">Tax Identification Number (PIN)</label>
                    <input className="iset-input iset-mono" value={taxPin} onChange={(e) => setTaxPin(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2: SECURITY
            ═══════════════════════════════════════════════════════════════ */}
        {section === "security" && (
          <div className="iset-panel">
            <div className="iset-minitabs">
              {[
                { id: "auth", label: "Authentication & 2FA" },
                { id: "sessions", label: `Active Sessions (${sessions.length})` },
                { id: "audit", label: `Security Audit Log (${securityEvents.length})` },
              ].map((m) => (
                <button
                  key={m.id}
                  className={`iset-minitab-btn ${miniTab.security === m.id ? "is-active" : ""}`}
                  onClick={() => setCurrentMiniTab(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {miniTab.security === "auth" && (
              <div className="iset-card">
                <div className="iset-card-header">
                  <div>
                    <h2 className="iset-card-title">Authentication & Two-Factor Posture</h2>
                    <p className="iset-card-desc">Protect withdrawals, API keys, and role switches with hardware or TOTP 2FA.</p>
                  </div>
                  <span className={`iset-badge ${twoFaEnabled ? "iset-badge--win" : "iset-badge--loss iset-pulse-weak"}`}>
                    {twoFaEnabled ? `2FA Active (${twoFaMethod})` : "2FA Disabled (Weak)"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button className="iset-btn" onClick={() => setModal({ type: "change-password" })}>
                    Change Password
                  </button>
                  {twoFaEnabled ? (
                    <button className="iset-btn iset-btn--danger" onClick={() => setModal({ type: "disable-2fa" })}>
                      Disable 2FA
                    </button>
                  ) : (
                    <button className="iset-btn iset-btn--primary" onClick={() => setModal({ type: "setup-2fa" })}>
                      Enable 2FA
                    </button>
                  )}
                </div>
              </div>
            )}

            {miniTab.security === "sessions" && (
              <div className="iset-card">
                <div className="iset-table-toolbar">
                  <input
                    className="iset-input iset-table-search"
                    placeholder="Filter by device, IP, or location..."
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                  />
                  {otherSessionCount > 0 && (
                    <button className="iset-btn iset-btn--danger" onClick={() => setModal({ type: "revoke-all-sessions" })}>
                      Revoke All Other ({otherSessionCount})
                    </button>
                  )}
                </div>
                <div className="iset-table-wrap">
                  <table className="iset-table">
                    <thead>
                      <tr>
                        <th>Device</th>
                        <th>IP Address</th>
                        <th>Location</th>
                        <th>Last Active</th>
                        <th>Risk</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>
                            {s.device} {s.isCurrent && <span className="iset-badge iset-badge--accent">Current</span>}
                          </td>
                          <td className="iset-mono">{s.ip}</td>
                          <td>{s.location}</td>
                          <td>{s.lastActive}</td>
                          <td>
                            <span className={`iset-badge ${s.risk === "Low" ? "iset-badge--win" : s.risk === "Medium" ? "iset-badge--warn" : "iset-badge--loss iset-pulse-weak"}`}>
                              {s.risk}
                            </span>
                          </td>
                          <td>
                            <button className="iset-btn iset-btn--sm" onClick={() => setModal({ type: "session-drawer", item: s })}>
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {miniTab.security === "audit" && (
              <div className="iset-card">
                <div className="iset-table-wrap">
                  <table className="iset-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Event</th>
                        <th>IP</th>
                        <th>Device</th>
                        <th>Outcome</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {securityEvents.map((ev) => (
                        <tr key={ev.id}>
                          <td className="iset-mono">{ev.timestamp}</td>
                          <td style={{ fontWeight: 600 }}>{ev.event}</td>
                          <td className="iset-mono">{ev.ip}</td>
                          <td>{ev.device}</td>
                          <td>
                            <span className={`iset-badge ${ev.outcome === "Success" ? "iset-badge--win" : ev.outcome === "Warning" ? "iset-badge--warn" : "iset-badge--loss"}`}>
                              {ev.outcome}
                            </span>
                          </td>
                          <td>
                            <button className="iset-btn iset-btn--sm" onClick={() => setModal({ type: "security-event", item: ev })}>
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3: NOTIFICATIONS
            ═══════════════════════════════════════════════════════════════ */}
        {section === "notifications" && (
          <div className="iset-panel">
            <div className="iset-minitabs">
              {[
                { id: "matrix", label: "Channel Matrix" },
                { id: "rules", label: `Alert Rules (${alertRules.length})` },
                { id: "history", label: `Delivery History (${notifLogs.length})` },
              ].map((m) => (
                <button
                  key={m.id}
                  className={`iset-minitab-btn ${miniTab.notifications === m.id ? "is-active" : ""}`}
                  onClick={() => setCurrentMiniTab(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {miniTab.notifications === "matrix" && (
              <div className="iset-card">
                <div className="iset-card-header">
                  <div>
                    <h2 className="iset-card-title">Notification Channel Matrix</h2>
                    <p className="iset-card-desc">Control which channels receive each category of investor alerts.</p>
                  </div>
                  <button className="iset-btn" onClick={() => setModal({ type: "test-notification" })}>
                    Send Test Alert
                  </button>
                </div>
                <div className="iset-table-wrap">
                  <table className="iset-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Email</th>
                        <th>SMS</th>
                        <th>Push</th>
                        <th>In-App</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(notifMatrix).map(([cat, channels]) => (
                        <tr key={cat}>
                          <td style={{ fontWeight: 600 }}>{cat}</td>
                          {(["email", "sms", "push", "inApp"] as const).map((ch) => (
                            <td key={ch}>
                              <label className="iset-switch">
                                <input
                                  type="checkbox"
                                  checked={channels[ch]}
                                  onChange={() =>
                                    setNotifMatrix((prev) => ({
                                      ...prev,
                                      [cat]: { ...prev[cat], [ch]: !prev[cat][ch] },
                                    }))
                                  }
                                />
                                <span className="iset-switch-track" />
                              </label>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {miniTab.notifications === "rules" && (
              <div className="iset-card">
                <div className="iset-card-header">
                  <div>
                    <h2 className="iset-card-title">Custom Alert Rules</h2>
                    <p className="iset-card-desc">Automated threshold triggers across portfolio, Guardian risk, and FX.</p>
                  </div>
                  <button className="iset-btn iset-btn--primary" onClick={() => setModal({ type: "alert-rule" })}>
                    + New Alert Rule
                  </button>
                </div>
                <div className="iset-table-wrap">
                  <table className="iset-table">
                    <thead>
                      <tr>
                        <th>Rule Name</th>
                        <th>Metric</th>
                        <th>Condition</th>
                        <th>Channels</th>
                        <th>Enabled</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertRules.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.name}</td>
                          <td>{r.metric}</td>
                          <td className="iset-mono">{r.condition}</td>
                          <td>{r.channels.join(", ")}</td>
                          <td>
                            <label className="iset-switch">
                              <input
                                type="checkbox"
                                checked={r.enabled}
                                onChange={() =>
                                  setAlertRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)))
                                }
                              />
                              <span className="iset-switch-track" />
                            </label>
                          </td>
                          <td>
                            <button className="iset-btn iset-btn--sm" onClick={() => setModal({ type: "alert-rule", item: r })}>
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {miniTab.notifications === "history" && (
              <div className="iset-card">
                <div className="iset-table-wrap">
                  <table className="iset-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Category</th>
                        <th>Channel</th>
                        <th>Subject</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifLogs.map((l) => (
                        <tr key={l.id}>
                          <td className="iset-mono">{l.timestamp}</td>
                          <td>{l.category}</td>
                          <td>{l.channel}</td>
                          <td style={{ fontWeight: 600 }}>{l.subject}</td>
                          <td>
                            <span className={`iset-badge ${l.status === "Delivered" ? "iset-badge--win" : "iset-badge--loss"}`}>
                              {l.status}
                            </span>
                          </td>
                          <td>
                            <button className="iset-btn iset-btn--sm" onClick={() => setModal({ type: "notification-drawer", item: l })}>
                              Payload
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 4: PAYOUT PREFERENCES
            ═══════════════════════════════════════════════════════════════ */}
        {section === "payouts" && (
          <div className="iset-panel">
            <div className="iset-minitabs">
              {[
                { id: "mode", label: "Distribution Mode" },
                { id: "methods", label: `Payment Methods (${payoutMethods.length})` },
                { id: "history", label: `Payout History (${payoutHistory.length})` },
              ].map((m) => (
                <button
                  key={m.id}
                  className={`iset-minitab-btn ${miniTab.payouts === m.id ? "is-active" : ""}`}
                  onClick={() => setCurrentMiniTab(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {miniTab.payouts === "mode" && (
              <div className="iset-card">
                <div className="iset-card-header">
                  <div>
                    <h2 className="iset-card-title">Settlement Distribution Mode</h2>
                    <p className="iset-card-desc">Choose how realized pool profits are handled at each settlement cycle.</p>
                  </div>
                </div>
                <div className="iset-radio-grid" style={{ marginBottom: "1rem" }}>
                  {[
                    { id: "compound", title: "Auto-Compound 100%", desc: "Reinvest all realized profits into active pools." },
                    { id: "split", title: "Split 50% / 50%", desc: "Compound 50% and sweep 50% to default payout rail." },
                    { id: "withdraw", title: "Auto-Withdraw 100%", desc: "Sweep all realized profits to default payout rail." },
                    { id: "hold", title: "Manual Hold in Wallet", desc: "Keep profits in USD wallet until manually withdrawn." },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`iset-radio-card ${payoutMode === opt.id ? "is-selected" : ""}`}
                      onClick={() => setPayoutMode(opt.id as typeof payoutMode)}
                    >
                      <strong>{opt.title}</strong>
                      <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="iset-field" style={{ maxWidth: 280 }}>
                  <label className="iset-label">Minimum Auto-Sweep Threshold (USD)</label>
                  <input className="iset-input iset-mono" value={minThreshold} onChange={(e) => setMinThreshold(e.target.value)} />
                </div>
              </div>
            )}

            {miniTab.payouts === "methods" && (
              <div className="iset-card">
                <div className="iset-card-header">
                  <div>
                    <h2 className="iset-card-title">Connected Payout Rails</h2>
                    <p className="iset-card-desc">Manage bank wires, mobile money, and on-chain settlement wallets.</p>
                  </div>
                  <button className="iset-btn iset-btn--primary" onClick={() => setModal({ type: "add-payout-method" })}>
                    + Add Payout Method
                  </button>
                </div>
                <div className="iset-table-wrap">
                  <table className="iset-table">
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Rail</th>
                        <th>Account</th>
                        <th>Fee</th>
                        <th>Daily Limit</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutMethods.map((pm) => (
                        <tr key={pm.id}>
                          <td style={{ fontWeight: 600 }}>
                            {pm.label} {pm.isDefault && <span className="iset-badge iset-badge--accent">Default</span>}
                          </td>
                          <td>{pm.rail}</td>
                          <td className="iset-mono">{pm.accountMask}</td>
                          <td className="iset-mono">{pm.fee}</td>
                          <td className="iset-mono">{pm.dailyLimit}</td>
                          <td>
                            <span className={`iset-badge ${pm.status === "Verified" ? "iset-badge--win" : pm.status === "Pending" ? "iset-badge--warn" : "iset-badge--neutral"}`}>
                              {pm.status}
                            </span>
                          </td>
                          <td>
                            <button className="iset-btn iset-btn--sm" onClick={() => setModal({ type: "payout-method-drawer", item: pm })}>
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {miniTab.payouts === "history" && (
              <div className="iset-card">
                <div className="iset-table-wrap">
                  <table className="iset-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Gross</th>
                        <th>Fee</th>
                        <th>Net</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutHistory.map((ph) => (
                        <tr key={ph.id}>
                          <td className="iset-mono" style={{ fontWeight: 600 }}>{ph.reference}</td>
                          <td className="iset-mono">{ph.date}</td>
                          <td>{ph.method}</td>
                          <td className="iset-mono">{ph.grossAmount.toFixed(2)} {ph.currency}</td>
                          <td className="iset-mono">{ph.fee.toFixed(2)}</td>
                          <td className="iset-mono" style={{ fontWeight: 600 }}>{ph.netAmount.toFixed(2)} {ph.currency}</td>
                          <td>
                            <span className={`iset-badge ${ph.status === "Settled" ? "iset-badge--win" : "iset-badge--warn"}`}>
                              {ph.status}
                            </span>
                          </td>
                          <td>
                            <button className="iset-btn iset-btn--sm" onClick={() => setModal({ type: "payout-receipt", item: ph })}>
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 5: KYC / VERIFICATION
            ═══════════════════════════════════════════════════════════════ */}
        {section === "kyc" && (
          <div className="iset-panel">
            <div className="iset-minitabs">
              {[
                { id: "tier", label: "Verification Tier" },
                { id: "docs", label: `Documents (${kycDocs.length})` },
                { id: "history", label: `Verification History (${kycHistory.length})` },
              ].map((m) => (
                <button
                  key={m.id}
                  className={`iset-minitab-btn ${miniTab.kyc === m.id ? "is-active" : ""}`}
                  onClick={() => setCurrentMiniTab(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {miniTab.kyc === "tier" && (
              <div className="iset-card">
                <div className="iset-card-header">
                  <div>
                    <h2 className="iset-card-title">Current Level: {kycTier}</h2>
                    <p className="iset-card-desc">Daily withdrawal limit: $100,000 · Full access to public & institutional pools.</p>
                  </div>
                  <button className="iset-btn iset-btn--primary" onClick={() => setModal({ type: "kyc-upgrade" })}>
                    Request Tier Upgrade
                  </button>
                </div>
                <div className="iset-badge iset-badge--win">✓ Identity, Residency, Tax & AML Screening Cleared</div>
              </div>
            )}

            {miniTab.kyc === "docs" && (
              <div className="iset-card">
                <div className="iset-kyc-grid">
                  {kycDocs.map((doc) => (
                    <div key={doc.id} className="iset-kyc-doc-card">
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.375rem" }}>
                          <strong style={{ fontSize: "0.8125rem" }}>{doc.title}</strong>
                          <span className={`iset-badge ${doc.status === "Approved" ? "iset-badge--win" : doc.status === "Pending Review" ? "iset-badge--warn" : "iset-badge--loss"}`}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="iset-mono" style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                          {doc.fileName}
                        </div>
                      </div>
                      <button className="iset-btn iset-btn--sm" onClick={() => setModal({ type: "kyc-doc", item: doc })}>
                        View / Re-upload
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {miniTab.kyc === "history" && (
              <div className="iset-card">
                <div className="iset-table-wrap">
                  <table className="iset-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Tier</th>
                        <th>Reviewer</th>
                        <th>Outcome</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kycHistory.map((kh) => (
                        <tr key={kh.id}>
                          <td className="iset-mono">{kh.timestamp}</td>
                          <td style={{ fontWeight: 600 }}>{kh.action}</td>
                          <td>{kh.tier}</td>
                          <td>{kh.reviewer}</td>
                          <td>
                            <span className={`iset-badge ${kh.outcome === "Approved" ? "iset-badge--win" : kh.outcome === "Submitted" ? "iset-badge--accent" : "iset-badge--warn"}`}>
                              {kh.outcome}
                            </span>
                          </td>
                          <td style={{ color: "var(--text-secondary)" }}>{kh.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── All 18 Modals, Multistep Wizards & Drawers ── */}
      <InvestorSettingsModalHost
        modal={modal}
        onClose={() => setModal(null)}
        avatarInitials={avatarInitials}
        onUpdateAvatar={setAvatarInitials}
        currentRole={currentRole}
        onSwitchRole={setCurrentRole}
        onSaveBeneficiary={(item) =>
          setBeneficiaries((prev) => {
            const exists = prev.some((b) => b.id === item.id);
            return exists ? prev.map((b) => (b.id === item.id ? item : b)) : [item, ...prev];
          })
        }
        onPasswordChanged={() => {}}
        onEnable2FA={(m) => {
          setTwoFaEnabled(true);
          setTwoFaMethod(m);
        }}
        onDisable2FA={() => setTwoFaEnabled(false)}
        onRevokeSession={(id) => setSessions((prev) => prev.filter((s) => s.id !== id))}
        onRevokeAllSessions={() => setSessions((prev) => prev.filter((s) => s.isCurrent))}
        otherSessionCount={otherSessionCount}
        onSaveAlertRule={(rule) =>
          setAlertRules((prev) => {
            const exists = prev.some((r) => r.id === rule.id);
            return exists ? prev.map((r) => (r.id === rule.id ? rule : r)) : [rule, ...prev];
          })
        }
        onResendNotification={(id) =>
          setNotifLogs((prev) => prev.map((l) => (l.id === id ? { ...l, status: "Delivered" } : l)))
        }
        onAddPayoutMethod={(pm) => setPayoutMethods((prev) => [pm, ...prev])}
        onSetDefaultPayoutMethod={(id) =>
          setPayoutMethods((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })))
        }
        onRemovePayoutMethod={(id) => setPayoutMethods((prev) => prev.filter((p) => p.id !== id))}
        onSubmitKycUpgrade={(tier) => {
          setKycTier(`${tier} (Pending)`);
          setKycHistory((prev) => [
            {
              id: `kh-${Date.now()}`,
              timestamp: "2026-11-14 09:00",
              action: "Tier Upgrade Requested",
              tier,
              reviewer: "Automated Intake",
              outcome: "Submitted",
              note: "Submitted via KYC Upgrade Wizard.",
            },
            ...prev,
          ]);
        }}
        onReuploadKycDoc={(id, fileName) =>
          setKycDocs((prev) =>
            prev.map((d) => (d.id === id ? { ...d, fileName, status: "Pending Review" } : d))
          )
        }
        onExportBundle={() => {}}
      />
    </InvestorShell>
  );
}
