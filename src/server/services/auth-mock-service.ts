
import { DEMO_PASSWORD } from "@/lib/content/auth-content";
import type {
  AuthErrorDTO,
  AuthSessionDTO,
  AuthUserDTO,
  DerivConnectResponseDTO,
  UserRole,
} from "@/lib/auth/types";
import { maskEmail } from "@/lib/auth/utils";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOCK auth backend — in-memory, process-local.
 * Exists only so the front-end flows are clickable end-to-end. Replace each
 * function with a call to the Express API (or delete and point
 * NEXT_PUBLIC_API_BASE_URL at the gateway). Response shapes are final.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class MockAuthError extends Error {
  constructor(
    readonly status: number,
    readonly body: AuthErrorDTO,
  ) {
    super(body.message ?? body.error);
  }
}

const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const token = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

interface MockUser extends AuthUserDTO {
  password: string;
}

const users = new Map<string, MockUser>([
  ["operator@trademo.io", mkUser("operator@trademo.io", "Jane Operator", "operator", false)],
  ["investor@trademo.io", mkUser("investor@trademo.io", "Kofi Investor", "investor", false)],
  ["both@trademo.io", mkUser("both@trademo.io", "Ama Dual", "both", false)],
  ["2fa@trademo.io", mkUser("2fa@trademo.io", "Sam Secure", "operator", true)],
]);

function mkUser(email: string, fullName: string, role: UserRole, twoFactorEnabled: boolean): MockUser {
  return {
    id: id("user"),
    email,
    fullName,
    role,
    primaryRole: role === "investor" ? "investor" : "operator",
    twoFactorEnabled,
    emailVerified: true,
    password: DEMO_PASSWORD,
  };
}

const failedLogins = new Map<string, number>();
const challenges = new Map<string, { email: string; attempts: number; lockedUntil: number | null }>();
const usedResetTokens = new Set<string>();
const derivStates = new Map<string, number>();

function publicUser(u: MockUser): AuthUserDTO {
  const { password: _password, ...rest } = u;
  void _password;
  return rest;
}

function session(u: MockUser): AuthSessionDTO {
  return {
    accessToken: token("eyJhbGciOiJIUzI1NiJ9."),
    refreshToken: token("ref_"),
    user: publicUser(u),
    redirectTo: u.role === "both" ? null : u.primaryRole === "operator" ? "/dashboard" : "/investor",
  };
}

/* A-1 */
export function register(input: { fullName: string; email: string; password: string; role: "operator" | "investor" }) {
  const email = input.email.toLowerCase();
  if (users.has(email) || email.startsWith("taken@")) {
    throw new MockAuthError(409, {
      error: "EMAIL_TAKEN",
      message: "An account with this email already exists.",
      fieldErrors: { email: "This email is already registered" },
    });
  }
  const user = mkUser(email, input.fullName, input.role, false);
  user.emailVerified = false;
  user.password = input.password;
  users.set(email, user);
  return {
    userId: user.id,
    email,
    role: input.role,
    emailVerified: false,
    redirectTo: `/auth/verify-email?sent=true&email=${encodeURIComponent(email)}`,
  };
}

/* A-2 */
export function login(input: { email: string; password: string }) {
  const email = input.email.toLowerCase();
  const fails = failedLogins.get(email) ?? 0;
  if (fails >= 5) {
    throw new MockAuthError(429, {
      error: "ACCOUNT_LOCKED",
      message: "Too many failed attempts. Try again in 15 minutes.",
      attemptsRemaining: 0,
      lockoutAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
  }
  const user = users.get(email);
  if (!user || user.password !== input.password) {
    failedLogins.set(email, fails + 1);
    throw new MockAuthError(401, {
      error: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect",
      attemptsRemaining: Math.max(0, 4 - fails),
      lockoutAt: null,
    });
  }
  failedLogins.delete(email);

  if (user.twoFactorEnabled) {
    const challengeId = id("ch");
    challenges.set(challengeId, { email, attempts: 0, lockedUntil: null });
    return {
      challengeId,
      channels: ["authenticator" as const],
      backupAvailable: true,
      redirectTo: `/auth/2fa?challengeId=${challengeId}`,
    };
  }
  return session(user);
}

/* A-4 */
export function forgotPassword() {
  return { message: "If the email exists, a reset link has been sent.", retryAfterSeconds: 60 };
}

/* A-5 */
export function checkResetToken(t: string) {
  if (t.length < 20) return { valid: false, emailMasked: null, expiresAt: null, reason: "malformed" as const };
  if (t.includes("expired")) return { valid: false, emailMasked: null, expiresAt: null, reason: "expired" as const };
  if (usedResetTokens.has(t)) return { valid: false, emailMasked: null, expiresAt: null, reason: "used" as const };
  return { valid: true, emailMasked: maskEmail("jane@trademo.io"), expiresAt: new Date(Date.now() + 3600_000).toISOString() };
}

export function resetPassword(t: string) {
  if (!checkResetToken(t).valid) {
    throw new MockAuthError(400, { error: "INVALID_TOKEN", message: "Token invalid or expired" });
  }
  usedResetTokens.add(t);
  return { message: "Password reset successful", redirectTo: "/auth/signin?reset=success" };
}

/* A-6 */
export function verifyEmail(t: string) {
  if (t.includes("expired")) return { status: "expired" as const, userId: null, email: null, verifiedAt: null };
  if (t.length < 20) return { status: "invalid" as const, userId: null, email: null, verifiedAt: null };
  return { status: "verified" as const, userId: id("user"), email: "jane@trademo.io", verifiedAt: new Date().toISOString() };
}

export function resendVerification(email: string) {
  return { message: "Verification email sent.", emailMasked: maskEmail(email), retryAfterSeconds: 60 };
}

/* A-7 */
export const DEMO_TOTP = "482917";
export const DEMO_BACKUP = "K7M9P2X4";

export function verifyTwoFactor(input: { challengeId: string; code: string; method: string }) {
  let ch = challenges.get(input.challengeId);
  if (!ch) {
    // Allow direct visits (no prior login) to still be demo-able.
    ch = { email: "2fa@trademo.io", attempts: 0, lockedUntil: null };
    challenges.set(input.challengeId, ch);
  }
  if (ch.lockedUntil && ch.lockedUntil > Date.now()) {
    throw new MockAuthError(429, { error: "2FA_LOCKED", lockoutEndsAt: new Date(ch.lockedUntil).toISOString() });
  }
  const ok = input.method === "backup_code" ? input.code.toUpperCase() === DEMO_BACKUP : input.code === DEMO_TOTP;
  if (!ok) {
    ch.attempts += 1;
    if (ch.attempts >= 5) {
      ch.lockedUntil = Date.now() + 15 * 60_000;
      throw new MockAuthError(429, { error: "2FA_LOCKED", lockoutEndsAt: new Date(ch.lockedUntil).toISOString() });
    }
    throw new MockAuthError(400, {
      error: "INVALID_2FA_CODE",
      message: input.method === "backup_code" ? "That backup code is not valid." : "That code is incorrect.",
      attemptsRemaining: 5 - ch.attempts,
      lockoutAt: null,
    });
  }
  challenges.delete(input.challengeId);
  return session(users.get(ch.email) ?? mkUser(ch.email, "Sam Secure", "operator", true));
}

/* A-8 */
export function derivAuthorizeUrl() {
  const state = token("st_");
  derivStates.set(state, Date.now() + 5 * 60_000);
  // Real: https://oauth.deriv.com/oauth2/authorize?app_id=…&l=EN&redirect_uri=…&state=…
  const appId = process.env.DERIV_APP_ID;
  const url = appId
    ? `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=EN&state=${state}`
    : `/auth/deriv/callback?code=${token("a1-")}&acct1=CR123456&state=${state}`;
  return { url, state, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
}

export function derivConnect(input: { code: string; state: string; acct1: string | null }): DerivConnectResponseDTO {
  const exp = derivStates.get(input.state);
  // Demo affordances: ?state=mismatch, ?code=expired, ?acct1=CR000000 (already linked)
  if (input.state === "mismatch" || (!exp && !input.state.startsWith("st_"))) {
    throw new MockAuthError(400, { error: "STATE_MISMATCH", message: "State token mismatch (CSRF protection)" });
  }
  if (input.code === "expired" || (exp && exp < Date.now())) {
    throw new MockAuthError(400, { error: "CODE_EXPIRED", message: "The Deriv authorization code expired (over 5 minutes)." });
  }
  if (input.acct1 === "CR000000") {
    throw new MockAuthError(409, { error: "ALREADY_LINKED", message: "This Deriv account is linked to another tradeMO user." });
  }
  derivStates.delete(input.state);
  const loginId = input.acct1 ?? "CR123456";
  return {
    connection: {
      id: id("dc"),
      derivLoginId: loginId,
      accountType: loginId.startsWith("VR") ? "demo" : "real",
      currency: "USD",
      balance: 1234.56,
      permissions: ["read", "trade", "payments", "admin"],
      status: "active",
      connectedAt: new Date().toISOString(),
    },
    redirectTo: "/dashboard",
  };
}

/* A-3 */
export function kycSubmit() {
  return {
    kycId: id("kyc"),
    userId: id("user"),
    level: 1 as const,
    reviewStatus: "pending" as const,
    depositLimitPerTx: 1000,
    depositLimitDaily: 5000,
    depositLimitMonthly: 50000,
    submittedAt: new Date().toISOString(),
  };
}
