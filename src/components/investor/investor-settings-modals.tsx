"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import type {
  AlertRuleItem,
  BeneficiaryItem,
  KycDocumentItem,
  NotificationLogItem,
  PayoutHistoryItem,
  PayoutMethodItem,
  SecurityEventItem,
  SessionItem,
} from "./investor-settings-data";

export type ActiveModalState =
  | { type: "avatar" }
  | { type: "role-switch" }
  | { type: "beneficiary"; item?: BeneficiaryItem }
  | { type: "change-password" }
  | { type: "setup-2fa" }
  | { type: "disable-2fa" }
  | { type: "session-drawer"; item: SessionItem }
  | { type: "revoke-all-sessions" }
  | { type: "security-event"; item: SecurityEventItem }
  | { type: "alert-rule"; item?: AlertRuleItem }
  | { type: "notification-drawer"; item: NotificationLogItem }
  | { type: "test-notification" }
  | { type: "add-payout-method" }
  | { type: "payout-method-drawer"; item: PayoutMethodItem }
  | { type: "payout-receipt"; item: PayoutHistoryItem }
  | { type: "kyc-upgrade" }
  | { type: "kyc-doc"; item: KycDocumentItem }
  | { type: "export-bundle" }
  | null;

interface ModalHostProps {
  modal: ActiveModalState;
  onClose: () => void;
  avatarInitials: string;
  onUpdateAvatar: (initials: string) => void;
  currentRole: "Investor" | "Operator";
  onSwitchRole: (role: "Investor" | "Operator") => void;
  onSaveBeneficiary: (item: BeneficiaryItem) => void;
  onPasswordChanged: () => void;
  onEnable2FA: (method: string) => void;
  onDisable2FA: () => void;
  onRevokeSession: (id: string) => void;
  onRevokeAllSessions: () => void;
  otherSessionCount: number;
  onSaveAlertRule: (rule: AlertRuleItem) => void;
  onResendNotification: (id: string) => void;
  onAddPayoutMethod: (pm: PayoutMethodItem) => void;
  onSetDefaultPayoutMethod: (id: string) => void;
  onRemovePayoutMethod: (id: string) => void;
  onSubmitKycUpgrade: (targetTier: string) => void;
  onReuploadKycDoc: (id: string, fileName: string) => void;
  onExportBundle: (format: string) => void;
}

export function InvestorSettingsModalHost(props: ModalHostProps) {
  const { modal, onClose } = props;
  if (!modal) return null;

  return (
    <>
      {modal.type === "avatar" && (
        <AvatarModal
          initial={props.avatarInitials}
          onSave={(val) => {
            props.onUpdateAvatar(val);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "role-switch" && (
        <RoleSwitchWizard
          currentRole={props.currentRole}
          onConfirm={(role) => {
            props.onSwitchRole(role);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "beneficiary" && (
        <BeneficiaryModal
          item={modal.item}
          onSave={(item) => {
            props.onSaveBeneficiary(item);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "change-password" && (
        <ChangePasswordWizard
          onComplete={() => {
            props.onPasswordChanged();
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "setup-2fa" && (
        <Setup2FAWizard
          onComplete={(method) => {
            props.onEnable2FA(method);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "disable-2fa" && (
        <Disable2FAModal
          onConfirm={() => {
            props.onDisable2FA();
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "session-drawer" && (
        <SessionDrawer
          session={modal.item}
          onRevoke={() => {
            props.onRevokeSession(modal.item.id);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "revoke-all-sessions" && (
        <RevokeAllModal
          count={props.otherSessionCount}
          onConfirm={() => {
            props.onRevokeAllSessions();
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "security-event" && (
        <SecurityEventModal event={modal.item} onClose={onClose} />
      )}

      {modal.type === "alert-rule" && (
        <AlertRuleWizard
          item={modal.item}
          onSave={(rule) => {
            props.onSaveAlertRule(rule);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "notification-drawer" && (
        <NotificationDrawer
          log={modal.item}
          onResend={() => {
            props.onResendNotification(modal.item.id);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "test-notification" && (
        <TestNotificationModal onClose={onClose} />
      )}

      {modal.type === "add-payout-method" && (
        <AddPayoutMethodWizard
          onAdd={(pm) => {
            props.onAddPayoutMethod(pm);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "payout-method-drawer" && (
        <PayoutMethodDrawer
          method={modal.item}
          onSetDefault={() => {
            props.onSetDefaultPayoutMethod(modal.item.id);
            onClose();
          }}
          onRemove={() => {
            props.onRemovePayoutMethod(modal.item.id);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "payout-receipt" && (
        <PayoutReceiptModal item={modal.item} onClose={onClose} />
      )}

      {modal.type === "kyc-upgrade" && (
        <KycUpgradeWizard
          onSubmit={(tier) => {
            props.onSubmitKycUpgrade(tier);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "kyc-doc" && (
        <KycDocModal
          doc={modal.item}
          onReupload={(fileName) => {
            props.onReuploadKycDoc(modal.item.id, fileName);
            onClose();
          }}
          onClose={onClose}
        />
      )}

      {modal.type === "export-bundle" && (
        <ExportBundleModal
          onExport={(fmt) => {
            props.onExportBundle(fmt);
            onClose();
          }}
          onClose={onClose}
        />
      )}
    </>
  );
}

/* ── 1. Avatar Modal ── */
function AvatarModal({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (v: string) => void;
  onClose: () => void;
}) {
  const [initials, setInitials] = useState(initial);
  const presets = ["DK", "JK", "KM", "TR", "IV", "OP"];
  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Profile Monogram & Avatar</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="iset-modal-body">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
            <div className="iset-avatar" style={{ width: 64, height: 64, fontSize: "1.375rem" }}>
              {initials || "DK"}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Preview Monogram</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                Displayed in TopBar, Pool Allocations, and Audit Logs.
              </div>
            </div>
          </div>
          <div className="iset-field" style={{ marginBottom: "1rem" }}>
            <label className="iset-label">Custom Initials (max 2 chars)</label>
            <input
              className="iset-input"
              maxLength={2}
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase())}
            />
          </div>
          <div className="iset-label" style={{ marginBottom: "0.5rem" }}>Quick Presets</div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                className={`iset-btn iset-btn--sm ${initials === p ? "iset-btn--primary" : ""}`}
                onClick={() => setInitials(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="iset-modal-footer">
          <button className="iset-btn" onClick={onClose}>Cancel</button>
          <button className="iset-btn iset-btn--primary" onClick={() => onSave(initials || "DK")}>
            Save Monogram
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 2. Role Switch Multistep Wizard ── */
function RoleSwitchWizard({
  currentRole,
  onConfirm,
  onClose,
}: {
  currentRole: "Investor" | "Operator";
  onConfirm: (role: "Investor" | "Operator") => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const targetRole = currentRole === "Investor" ? "Operator" : "Investor";
  const [ack, setAck] = useState(false);

  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Workspace Role Switch Wizard</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-stepper">
            {["1. Role Comparison", "2. Permissions Check", "3. Confirm Switch"].map((label, idx) => (
              <div
                key={label}
                className={`iset-step ${step === idx + 1 ? "is-active" : step > idx + 1 ? "is-done" : ""}`}
              >
                <span className="iset-step-num">{step > idx + 1 ? "✓" : idx + 1}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <p className="iset-card-desc" style={{ marginBottom: "1rem" }}>
                You are switching from <strong>{currentRole}</strong> to <strong>{targetRole}</strong> workspace.
              </p>
              <div className="iset-form-grid">
                <div className="iset-card" style={{ padding: "0.875rem" }}>
                  <div className="iset-label">Current: {currentRole}</div>
                  <p style={{ fontSize: "0.8125rem", margin: "0.375rem 0 0", color: "var(--text-secondary)" }}>
                    Pool allocations, live earnings, wallet payouts, and KYC compliance.
                  </p>
                </div>
                <div className="iset-card" style={{ padding: "0.875rem", borderColor: "var(--accent)" }}>
                  <div className="iset-label" style={{ color: "var(--accent)" }}>Target: {targetRole}</div>
                  <p style={{ fontSize: "0.8125rem", margin: "0.375rem 0 0", color: "var(--text-secondary)" }}>
                    {targetRole === "Operator"
                      ? "Strategy deployment, bot editor, risk desk, and pool liquidity management."
                      : "Passive & active pool investments, automated compounding, and payouts."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="iset-badge iset-badge--win">✓ Dual-Role Authorization Active</div>
              <div className="iset-badge iset-badge--win">✓ Active Positions & Pending Payouts Unaffected</div>
              <div className="iset-badge iset-badge--accent">ℹ Navigation & Default Landing Route Will Update</div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }}>
                Confirm switching active workspace context to <strong>{targetRole}</strong>.
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                I understand this updates my active dashboard permissions and audit context.
              </label>
            </div>
          )}
        </div>
        <div className="iset-modal-footer">
          {step > 1 && <button className="iset-btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 3 ? (
            <button className="iset-btn iset-btn--primary" onClick={() => setStep(step + 1)}>Continue</button>
          ) : (
            <button className="iset-btn iset-btn--primary" disabled={!ack} onClick={() => onConfirm(targetRole)}>
              Switch to {targetRole}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 3. Beneficiary Modal ── */
function BeneficiaryModal({
  item,
  onSave,
  onClose,
}: {
  item?: BeneficiaryItem;
  onSave: (b: BeneficiaryItem) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [relationship, setRelationship] = useState(item?.relationship ?? "Spouse");
  const [rail, setRail] = useState(item?.rail ?? "Bank Wire");
  const [accountMask, setAccountMask] = useState(item?.accountMask ?? "");
  const [allocationPct, setAllocationPct] = useState(String(item?.allocationPct ?? 10));

  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">{item ? "Edit Beneficiary" : "Add Beneficiary / External Account"}</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-form-grid">
            <div className="iset-field">
              <label className="iset-label">Full Name / Entity</label>
              <input className="iset-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe" />
            </div>
            <div className="iset-field">
              <label className="iset-label">Relationship</label>
              <select className="iset-select" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                <option>Spouse</option>
                <option>Trust</option>
                <option>Corporate</option>
                <option>Sibling</option>
                <option>Advisor</option>
              </select>
            </div>
            <div className="iset-field">
              <label className="iset-label">Settlement Rail</label>
              <select className="iset-select" value={rail} onChange={(e) => setRail(e.target.value)}>
                <option>Bank Wire</option>
                <option>SWIFT</option>
                <option>M-Pesa</option>
                <option>USDC (Base)</option>
              </select>
            </div>
            <div className="iset-field">
              <label className="iset-label">Account / Wallet</label>
              <input className="iset-input" value={accountMask} onChange={(e) => setAccountMask(e.target.value)} placeholder="•••• 4821" />
            </div>
            <div className="iset-field">
              <label className="iset-label">Allocation %</label>
              <input className="iset-input" type="number" min={1} max={100} value={allocationPct} onChange={(e) => setAllocationPct(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="iset-modal-footer">
          <button className="iset-btn" onClick={onClose}>Cancel</button>
          <button
            className="iset-btn iset-btn--primary"
            disabled={!name.trim() || !accountMask.trim()}
            onClick={() =>
              onSave({
                id: item?.id ?? `ben-${Date.now()}`,
                name,
                relationship,
                rail,
                accountMask,
                allocationPct: Number(allocationPct) || 10,
                status: item?.status ?? "Pending",
                addedAt: item?.addedAt ?? "2026-11-14",
              })
            }
          >
            {item ? "Update Beneficiary" : "Add Beneficiary"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 4. Change Password Multistep Modal ── */
function ChangePasswordWizard({ onComplete, onClose }: { onComplete: () => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);

  const strength = newPw.length >= 12 ? "Strong" : newPw.length >= 8 ? "Moderate" : "Weak";

  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Change Account Password</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-stepper">
            {["1. Verify Current", "2. New Password", "3. Session Policy"].map((l, i) => (
              <div key={l} className={`iset-step ${step === i + 1 ? "is-active" : step > i + 1 ? "is-done" : ""}`}>
                <span className="iset-step-num">{step > i + 1 ? "✓" : i + 1}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="iset-field">
              <label className="iset-label">Current Password</label>
              <input
                type="password"
                className="iset-input"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div className="iset-field">
                <label className="iset-label">New Password</label>
                <input
                  type="password"
                  className="iset-input"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Minimum 12 characters"
                />
                <div>
                  <span className={`iset-badge ${strength === "Strong" ? "iset-badge--win" : strength === "Moderate" ? "iset-badge--warn" : "iset-badge--loss"}`}>
                    Strength: {strength}
                  </span>
                </div>
              </div>
              <div className="iset-field">
                <label className="iset-label">Confirm New Password</label>
                <input
                  type="password"
                  className="iset-input"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p style={{ fontSize: "0.875rem", margin: 0 }}>
                Your password is ready to be updated. Choose how to handle existing sessions:
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                <input type="checkbox" checked={revokeOthers} onChange={(e) => setRevokeOthers(e.target.checked)} />
                Sign out all other active devices immediately (Recommended)
              </label>
            </div>
          )}
        </div>
        <div className="iset-modal-footer">
          {step > 1 && <button className="iset-btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 3 ? (
            <button
              className="iset-btn iset-btn--primary"
              disabled={(step === 1 && !currentPw) || (step === 2 && (newPw.length < 8 || newPw !== confirmPw))}
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          ) : (
            <button className="iset-btn iset-btn--primary" onClick={onComplete}>Update Password</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 5. 2FA Setup Multistep Wizard (4 steps) ── */
function Setup2FAWizard({ onComplete, onClose }: { onComplete: (method: string) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState("TOTP Authenticator");
  const [code, setCode] = useState("");
  const recoveryCodes = ["TRD-9482-KLM", "TRD-1104-PZX", "TRD-7731-QWE", "TRD-5590-RTY", "TRD-3821-UIO", "TRD-6412-ASD"];

  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Two-Factor Authentication Setup</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-stepper">
            {["1. Method", "2. Configure", "3. Verify", "4. Recovery Codes"].map((l, i) => (
              <div key={l} className={`iset-step ${step === i + 1 ? "is-active" : step > i + 1 ? "is-done" : ""}`}>
                <span className="iset-step-num">{step > i + 1 ? "✓" : i + 1}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="iset-radio-grid">
              {["TOTP Authenticator", "Hardware Security Key (WebAuthn)"].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`iset-radio-card ${method === m ? "is-selected" : ""}`}
                  onClick={() => setMethod(m)}
                >
                  <strong>{m}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {m.includes("TOTP") ? "Google Authenticator, 1Password, or Authy" : "YubiKey, Touch ID, or Face ID passkey"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
              <div className="iset-badge iset-badge--accent" style={{ marginBottom: "0.75rem" }}>{method}</div>
              <div className="iset-mono" style={{ padding: "1rem", background: "var(--surface-sunken)", borderRadius: 8, border: "1px dashed var(--border-strong)" }}>
                SECRET KEY: JBSW Y3DP EHPK 3PXP
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                Scan or paste this setup key into your authenticator app.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="iset-field">
              <label className="iset-label">Enter 6-Digit Verification Code</label>
              <input
                className="iset-input iset-mono"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
            </div>
          )}

          {step === 4 && (
            <div>
              <p style={{ fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
                Save these one-time recovery codes in a secure password manager:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
                {recoveryCodes.map((c) => (
                  <div key={c} className="iset-mono" style={{ padding: "0.5rem", background: "var(--surface-sunken)", borderRadius: 6, fontSize: "0.8125rem", textAlign: "center" }}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="iset-modal-footer">
          {step > 1 && <button className="iset-btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 4 ? (
            <button
              className="iset-btn iset-btn--primary"
              disabled={step === 3 && code.length !== 6}
              onClick={() => setStep(step + 1)}
            >
              Continue
            </button>
          ) : (
            <button className="iset-btn iset-btn--primary" onClick={() => onComplete(method)}>
              Finish & Enable 2FA
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 6. Disable 2FA Modal ── */
function Disable2FAModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const [reason, setReason] = useState("Switching authenticator device");
  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Disable Two-Factor Authentication</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-badge iset-badge--loss" style={{ marginBottom: "0.75rem" }}>
            Warning: Disabling 2FA lowers your account security posture
          </div>
          <div className="iset-field">
            <label className="iset-label">Reason for disabling</label>
            <select className="iset-select" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option>Switching authenticator device</option>
              <option>Temporary troubleshooting</option>
              <option>Prefer hardware key only</option>
            </select>
          </div>
        </div>
        <div className="iset-modal-footer">
          <button className="iset-btn" onClick={onClose}>Keep 2FA Enabled</button>
          <button className="iset-btn iset-btn--danger" onClick={onConfirm}>Confirm Disable 2FA</button>
        </div>
      </div>
    </div>
  );
}

/* ── 7. Session Detail Drawer ── */
function SessionDrawer({ session, onRevoke, onClose }: { session: SessionItem; onRevoke: () => void; onClose: () => void }) {
  return (
    <div className="iset-drawer-backdrop" onClick={onClose}>
      <div className="iset-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="iset-drawer-header">
          <h3 className="iset-card-title">Session Geo-Trace & Fingerprint</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-drawer-body" style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div>
            <div className="iset-label">Device</div>
            <div style={{ fontWeight: 600 }}>{session.device}</div>
          </div>
          <div>
            <div className="iset-label">Browser & TLS</div>
            <div>{session.browser} · <span className="iset-mono">{session.tls}</span></div>
          </div>
          <div>
            <div className="iset-label">IP Address & ASN</div>
            <div className="iset-mono">{session.ip} ({session.asn})</div>
          </div>
          <div>
            <div className="iset-label">Location</div>
            <div>{session.location}</div>
          </div>
          <div>
            <div className="iset-label">Risk Assessment</div>
            <span className={`iset-badge ${session.risk === "Low" ? "iset-badge--win" : session.risk === "Medium" ? "iset-badge--warn" : "iset-badge--loss"}`}>
              {session.risk} Risk
            </span>
          </div>
        </div>
        <div className="iset-drawer-footer">
          <button className="iset-btn" onClick={onClose}>Close</button>
          {!session.isCurrent && (
            <button className="iset-btn iset-btn--danger" onClick={onRevoke}>Revoke This Session</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 8. Revoke All Sessions Modal ── */
function RevokeAllModal({ count, onConfirm, onClose }: { count: number; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Revoke All Other Sessions</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <p style={{ fontSize: "0.875rem", margin: 0 }}>
            This will immediately terminate <strong>{count}</strong> other active sessions across mobile and desktop devices. Your current session will remain signed in.
          </p>
        </div>
        <div className="iset-modal-footer">
          <button className="iset-btn" onClick={onClose}>Cancel</button>
          <button className="iset-btn iset-btn--danger" onClick={onConfirm}>Revoke {count} Sessions</button>
        </div>
      </div>
    </div>
  );
}

/* ── 9. Security Event Inspector Modal ── */
function SecurityEventModal({ event, onClose }: { event: SecurityEventItem; onClose: () => void }) {
  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Security Event Inspector</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div><strong>Event:</strong> {event.event}</div>
          <div><strong>Timestamp:</strong> <span className="iset-mono">{event.timestamp}</span></div>
          <div><strong>IP / Device:</strong> <span className="iset-mono">{event.ip}</span> · {event.device}</div>
          <div><strong>Outcome:</strong> {event.outcome}</div>
          <div style={{ padding: "0.75rem", background: "var(--surface-sunken)", borderRadius: 8, fontSize: "0.8125rem" }}>
            {event.details}
          </div>
        </div>
        <div className="iset-modal-footer">
          <button className="iset-btn iset-btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

/* ── 10. Alert Rule Multistep Wizard ── */
function AlertRuleWizard({
  item,
  onSave,
  onClose,
}: {
  item?: AlertRuleItem;
  onSave: (rule: AlertRuleItem) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(item?.name ?? "");
  const [metric, setMetric] = useState(item?.metric ?? "Payout Amount");
  const [condition, setCondition] = useState(item?.condition ?? ">= $1,000");
  const [channels, setChannels] = useState<string[]>(item?.channels ?? ["Email", "In-App"]);

  const toggleChannel = (ch: string) => {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">{item ? "Edit Alert Rule" : "Create Custom Alert Rule"}</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-stepper">
            {["1. Trigger", "2. Threshold", "3. Channels"].map((l, i) => (
              <div key={l} className={`iset-step ${step === i + 1 ? "is-active" : step > i + 1 ? "is-done" : ""}`}>
                <span className="iset-step-num">{step > i + 1 ? "✓" : i + 1}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="iset-form-grid">
              <div className="iset-field">
                <label className="iset-label">Rule Name</label>
                <input className="iset-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High APY Alert" />
              </div>
              <div className="iset-field">
                <label className="iset-label">Metric</label>
                <select className="iset-select" value={metric} onChange={(e) => setMetric(e.target.value)}>
                  <option>Payout Amount</option>
                  <option>Pool Drawdown</option>
                  <option>Pool Net APY</option>
                  <option>Geo-IP Risk</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="iset-field">
              <label className="iset-label">Condition Expression</label>
              <input className="iset-input iset-mono" value={condition} onChange={(e) => setCondition(e.target.value)} />
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["Email", "In-App", "SMS", "Push", "Webhook"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={`iset-btn iset-btn--sm ${channels.includes(ch) ? "iset-btn--primary" : ""}`}
                  onClick={() => toggleChannel(ch)}
                >
                  {ch}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="iset-modal-footer">
          {step > 1 && <button className="iset-btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 3 ? (
            <button className="iset-btn iset-btn--primary" disabled={step === 1 && !name.trim()} onClick={() => setStep(step + 1)}>
              Next
            </button>
          ) : (
            <button
              className="iset-btn iset-btn--primary"
              onClick={() =>
                onSave({
                  id: item?.id ?? `rul-${Date.now()}`,
                  name,
                  metric,
                  condition,
                  channels: channels.length ? channels : ["In-App"],
                  enabled: item?.enabled ?? true,
                  lastTriggered: item?.lastTriggered ?? "Never",
                })
              }
            >
              Save Rule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 11. Notification Payload Drawer ── */
function NotificationDrawer({
  log,
  onResend,
  onClose,
}: {
  log: NotificationLogItem;
  onResend: () => void;
  onClose: () => void;
}) {
  return (
    <div className="iset-drawer-backdrop" onClick={onClose}>
      <div className="iset-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="iset-drawer-header">
          <h3 className="iset-card-title">Notification Payload</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-drawer-body" style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div><div className="iset-label">Subject</div><div>{log.subject}</div></div>
          <div><div className="iset-label">Channel & Status</div><div>{log.channel} · {log.status}</div></div>
          <div>
            <div className="iset-label">Raw JSON Payload</div>
            <pre className="iset-mono" style={{ padding: "0.75rem", background: "var(--surface-sunken)", borderRadius: 8, fontSize: "0.75rem", overflowX: "auto" }}>
              {log.payload}
            </pre>
          </div>
        </div>
        <div className="iset-drawer-footer">
          <button className="iset-btn" onClick={onClose}>Close</button>
          <button className="iset-btn iset-btn--primary" onClick={onResend}>Resend Delivery</button>
        </div>
      </div>
    </div>
  );
}

/* ── 12. Test Notification Modal ── */
function TestNotificationModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState("Email");
  const [sent, setSent] = useState(false);
  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Dispatch Test Notification</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-field" style={{ marginBottom: "0.875rem" }}>
            <label className="iset-label">Target Channel</label>
            <select className="iset-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option>Email</option>
              <option>SMS</option>
              <option>Push</option>
              <option>Webhook</option>
            </select>
          </div>
          {sent && (
            <div className="iset-badge iset-badge--win">
              ✓ Test payload delivered via {channel} in 142ms
            </div>
          )}
        </div>
        <div className="iset-modal-footer">
          <button className="iset-btn" onClick={onClose}>Close</button>
          <button className="iset-btn iset-btn--primary" onClick={() => setSent(true)}>Send Test Alert</button>
        </div>
      </div>
    </div>
  );
}

/* ── 13. Add Payout Method Multistep Wizard ── */
function AddPayoutMethodWizard({
  onAdd,
  onClose,
}: {
  onAdd: (pm: PayoutMethodItem) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [rail, setRail] = useState<PayoutMethodItem["rail"]>("Bank Wire");
  const [label, setLabel] = useState("");
  const [accountMask, setAccountMask] = useState("");
  const [currency, setCurrency] = useState("USD");

  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Add Payout Method</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-stepper">
            {["1. Select Rail", "2. Account Details", "3. Verify"].map((l, i) => (
              <div key={l} className={`iset-step ${step === i + 1 ? "is-active" : step > i + 1 ? "is-done" : ""}`}>
                <span className="iset-step-num">{step > i + 1 ? "✓" : i + 1}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="iset-field">
              <label className="iset-label">Settlement Rail</label>
              <select className="iset-select" value={rail} onChange={(e) => setRail(e.target.value as PayoutMethodItem["rail"])}>
                <option value="Bank Wire">Bank Wire (SWIFT)</option>
                <option value="M-Pesa">M-Pesa Mobile Money</option>
                <option value="USDC (Base)">USDC (Base)</option>
                <option value="SEPA">SEPA Instant</option>
              </select>
            </div>
          )}

          {step === 2 && (
            <div className="iset-form-grid">
              <div className="iset-field">
                <label className="iset-label">Nickname</label>
                <input className="iset-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Treasury USD" />
              </div>
              <div className="iset-field">
                <label className="iset-label">Account / Wallet</label>
                <input className="iset-input" value={accountMask} onChange={(e) => setAccountMask(e.target.value)} placeholder="•••• 9921" />
              </div>
              <div className="iset-field">
                <label className="iset-label">Currency</label>
                <select className="iset-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option>USD</option>
                  <option>KES</option>
                  <option>USDC</option>
                  <option>EUR</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="iset-badge iset-badge--accent">
              Ready to register {label || rail} ({accountMask}) for {currency} settlements.
            </div>
          )}
        </div>
        <div className="iset-modal-footer">
          {step > 1 && <button className="iset-btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 3 ? (
            <button
              className="iset-btn iset-btn--primary"
              disabled={step === 2 && (!label.trim() || !accountMask.trim())}
              onClick={() => setStep(step + 1)}
            >
              Next
            </button>
          ) : (
            <button
              className="iset-btn iset-btn--primary"
              onClick={() =>
                onAdd({
                  id: `pm-${Date.now()}`,
                  label: label || rail,
                  rail,
                  accountMask,
                  currency,
                  fee: rail.includes("USDC") ? "$0.15 network" : "$10.00 flat",
                  dailyLimit: "$50,000",
                  isDefault: false,
                  status: "Pending",
                })
              }
            >
              Add Payout Method
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 14. Payout Method Drawer ── */
function PayoutMethodDrawer({
  method,
  onSetDefault,
  onRemove,
  onClose,
}: {
  method: PayoutMethodItem;
  onSetDefault: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <div className="iset-drawer-backdrop" onClick={onClose}>
      <div className="iset-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="iset-drawer-header">
          <h3 className="iset-card-title">{method.label}</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-drawer-body" style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div><div className="iset-label">Rail</div><div>{method.rail}</div></div>
          <div><div className="iset-label">Account Mask</div><div className="iset-mono">{method.accountMask}</div></div>
          <div><div className="iset-label">Currency & Fee</div><div>{method.currency} · {method.fee}</div></div>
          <div><div className="iset-label">Daily Limit</div><div className="iset-mono">{method.dailyLimit}</div></div>
          <div><div className="iset-label">Status</div><div>{method.status}</div></div>
        </div>
        <div className="iset-drawer-footer">
          {!method.isDefault && (
            <>
              <button className="iset-btn iset-btn--danger" onClick={onRemove}>Remove</button>
              <button className="iset-btn iset-btn--primary" onClick={onSetDefault}>Set as Default</button>
            </>
          )}
          {method.isDefault && <button className="iset-btn" onClick={onClose}>Close</button>}
        </div>
      </div>
    </div>
  );
}

/* ── 15. Payout Receipt Modal ── */
function PayoutReceiptModal({ item, onClose }: { item: PayoutHistoryItem; onClose: () => void }) {
  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Settlement Receipt · {item.reference}</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <div><strong>Date:</strong> <span className="iset-mono">{item.date}</span></div>
          <div><strong>Destination:</strong> {item.method}</div>
          <div><strong>Gross Amount:</strong> <span className="iset-mono">{item.grossAmount.toFixed(2)} {item.currency}</span></div>
          <div><strong>Processing Fee:</strong> <span className="iset-mono">-{item.fee.toFixed(2)} {item.currency}</span></div>
          <div style={{ paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
            <strong>Net Settled:</strong> <span className="iset-mono">{item.netAmount.toFixed(2)} {item.currency}</span>
          </div>
        </div>
        <div className="iset-modal-footer">
          <button className="iset-btn iset-btn--primary" onClick={onClose}>Close Receipt</button>
        </div>
      </div>
    </div>
  );
}

/* ── 16. KYC Tier Upgrade Multistep Wizard ── */
function KycUpgradeWizard({ onSubmit, onClose }: { onSubmit: (tier: string) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [targetTier, setTargetTier] = useState("Tier 3 (Accredited)");
  const [netWorth, setNetWorth] = useState("$250,000 - $1,000,000");

  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal iset-modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">KYC Tier Upgrade Wizard</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-stepper">
            {["1. Select Tier", "2. Declarations", "3. Documents", "4. Submit"].map((l, i) => (
              <div key={l} className={`iset-step ${step === i + 1 ? "is-active" : step > i + 1 ? "is-done" : ""}`}>
                <span className="iset-step-num">{step > i + 1 ? "✓" : i + 1}</span>
                <span>{l}</span>
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="iset-radio-grid">
              {["Tier 3 (Accredited)", "Tier 4 (Institutional)"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`iset-radio-card ${targetTier === t ? "is-selected" : ""}`}
                  onClick={() => setTargetTier(t)}
                >
                  <strong>{t}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {t.includes("Tier 3") ? "Up to $500k/day withdrawal · Private high-yield pools" : "Unlimited OTC settlement · Dedicated custody"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="iset-field">
              <label className="iset-label">Declared Liquid Net Worth</label>
              <select className="iset-select" value={netWorth} onChange={(e) => setNetWorth(e.target.value)}>
                <option>$250,000 - $1,000,000</option>
                <option>$1,000,000 - $5,000,000</option>
                <option>$5,000,000+</option>
              </select>
            </div>
          )}

          {step === 3 && (
            <div className="iset-badge iset-badge--win">
              ✓ Existing Passport, KRA Tax Cert, and Bank Statement will be attached automatically.
            </div>
          )}

          {step === 4 && (
            <p style={{ fontSize: "0.875rem", margin: 0 }}>
              Submit upgrade application for <strong>{targetTier}</strong> ({netWorth}). Compliance SLA: 24 hours.
            </p>
          )}
        </div>
        <div className="iset-modal-footer">
          {step > 1 && <button className="iset-btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 4 ? (
            <button className="iset-btn iset-btn--primary" onClick={() => setStep(step + 1)}>Continue</button>
          ) : (
            <button className="iset-btn iset-btn--primary" onClick={() => onSubmit(targetTier)}>Submit Application</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 17. KYC Document Viewer & Re-upload Modal ── */
function KycDocModal({
  doc,
  onReupload,
  onClose,
}: {
  doc: KycDocumentItem;
  onReupload: (fileName: string) => void;
  onClose: () => void;
}) {
  const [newFile, setNewFile] = useState(`${doc.id}_updated_2026.pdf`);
  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">{doc.title}</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div><strong>Current File:</strong> <span className="iset-mono">{doc.fileName}</span></div>
          <div><strong>Status:</strong> {doc.status}</div>
          <div><strong>Reviewer Note:</strong> {doc.reviewerNote}</div>
          <div className="iset-field">
            <label className="iset-label">Upload Replacement Document</label>
            <input className="iset-input iset-mono" value={newFile} onChange={(e) => setNewFile(e.target.value)} />
          </div>
        </div>
        <div className="iset-modal-footer">
          <button className="iset-btn" onClick={onClose}>Close</button>
          <button className="iset-btn iset-btn--primary" onClick={() => onReupload(newFile)}>Submit Replacement</button>
        </div>
      </div>
    </div>
  );
}

/* ── 18. Export Settings & Compliance Bundle Modal ── */
function ExportBundleModal({ onExport, onClose }: { onExport: (fmt: string) => void; onClose: () => void }) {
  const [format, setFormat] = useState("JSON");
  return (
    <div className="iset-backdrop" onClick={onClose}>
      <div className="iset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iset-modal-header">
          <h3 className="iset-card-title">Export Settings & Compliance Bundle</h3>
          <button className="iset-btn iset-btn--sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="iset-modal-body">
          <div className="iset-field">
            <label className="iset-label">Export Format</label>
            <select className="iset-select" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="JSON">JSON (Machine-readable)</option>
              <option value="CSV">CSV (Spreadsheet tables)</option>
              <option value="PDF">PDF (Signed Compliance Summary)</option>
            </select>
          </div>
        </div>
        <div className="iset-modal-footer">
          <button className="iset-btn" onClick={onClose}>Cancel</button>
          <button className="iset-btn iset-btn--primary" onClick={() => onExport(format)}>Download {format}</button>
        </div>
      </div>
    </div>
  );
}
