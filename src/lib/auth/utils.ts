import type { AuthSessionDTO } from "./types";

/* ── Password strength (spec: 0-1 weak · 2 fair · 3 good · 4 strong) ── */

const WEAK_WORDS = ["trademo", "deriv", "derivx", "trading", "trader", "password", "invest", "qwerty", "123456"];

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too weak" | "Weak" | "Fair" | "Good" | "Strong";
  tone: "loss" | "warning" | "fair" | "win";
  percent: number;
  checks: Array<{ key: string; label: string; passed: boolean }>;
}

/**
 * Lightweight zxcvbn-style heuristic. Swap for `zxcvbn` once the backend is
 * wired if you want dictionary-grade scoring — the return shape stays the same.
 */
export function scorePassword(password: string): PasswordStrength {
  const checks = [
    { key: "length", label: "8+ characters", passed: password.length >= 8 },
    { key: "upper", label: "Uppercase", passed: /[A-Z]/.test(password) },
    { key: "number", label: "Number", passed: /[0-9]/.test(password) },
    { key: "symbol", label: "Symbol", passed: /[^a-zA-Z0-9]/.test(password) },
  ];

  if (!password) {
    return { score: 0, label: "Too weak", tone: "loss", percent: 0, checks };
  }

  let points = checks.filter((c) => c.passed).length;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 0.5;

  const lower = password.toLowerCase();
  if (WEAK_WORDS.some((w) => lower.includes(w))) points -= 1.5;
  if (/(.)\1{2,}/.test(password)) points -= 1;

  const score = Math.max(0, Math.min(4, Math.floor(points - 1))) as PasswordStrength["score"];
  const map: Record<number, Pick<PasswordStrength, "label" | "tone" | "percent">> = {
    0: { label: "Weak", tone: "loss", percent: 12 },
    1: { label: "Weak", tone: "loss", percent: 20 },
    2: { label: "Fair", tone: "warning", percent: 40 },
    3: { label: "Good", tone: "fair", percent: 70 },
    4: { label: "Strong", tone: "win", percent: 100 },
  };

  return { score, ...map[score], checks };
}

/* ── Masking ── */

/** jane@trademo.io → j••••@trademo.io */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return email ?? "";
  const [local, domain] = email.split("@");
  return `${local.charAt(0)}${"•".repeat(Math.max(3, Math.min(local.length - 1, 6)))}@${domain}`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ── Client session persistence ──
 * Front-end only for now. When the backend ships httpOnly refresh cookies,
 * keep only the access token in memory and drop the refresh token here.
 */

const SESSION_KEY = "trademo.session";
const PENDING_EMAIL_KEY = "trademo.pendingEmail";

export function persistSession(session: AuthSessionDTO, remember: boolean) {
  if (typeof window === "undefined") return;
  const store = remember ? window.localStorage : window.sessionStorage;
  store.setItem(SESSION_KEY, JSON.stringify(session));
}

export function readSession(): AuthSessionDTO | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSessionDTO;
  } catch {
    return null;
  }
}

export function rememberPendingEmail(email: string) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(PENDING_EMAIL_KEY, email);
}

export function readPendingEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(PENDING_EMAIL_KEY);
}

/** Role router (spec A-2). */
export function dashboardFor(primaryRole: "operator" | "investor"): string {
  return primaryRole === "operator" ? "/dashboard" : "/investor";
}
