"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { StatusMark } from "@/components/auth/status-mark";
import { Icon } from "@/components/icons";
import { AuthApiError } from "@/lib/api/auth";
import { cn } from "@/lib/cn";
import type { AuthErrorCode, DerivCallbackStepKey, DerivConnectResponseDTO } from "@/lib/auth/types";
import { formatCurrency } from "@/lib/format";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { useDerivAuthorizeUrl, useDerivConnect } from "@/lib/queries/use-auth";

const STEPS: Array<{ key: DerivCallbackStepKey; label: string; detail: string }> = [
  { key: "redirected", label: "Redirected from Deriv", detail: "Authorization response received" },
  { key: "validate_state", label: "Validating state token", detail: "CSRF check · 5-minute TTL" },
  { key: "exchange_code", label: "Exchanging code for Deriv token", detail: "wss://ws.derivws.com · authorize" },
  { key: "store_connection", label: "Storing encrypted connection", detail: "AES-256-GCM at rest" },
  { key: "link_account", label: "Linking to your tradeMO account", detail: "deriv_connections upsert" },
  { key: "redirect", label: "Redirecting to dashboard", detail: "Operator console" },
];

const ERROR_COPY: Partial<Record<AuthErrorCode, { title: string; reason: string; step: DerivCallbackStepKey }>> = {
  STATE_MISMATCH: { title: "Security check failed", reason: "State token mismatch (CSRF protection). Restart the connection from tradeMO.", step: "validate_state" },
  CODE_EXPIRED: { title: "Authorization expired", reason: "The Deriv authorization code expired (over 5 minutes). Please authorize again.", step: "exchange_code" },
  ALREADY_LINKED: { title: "Account already linked", reason: "This Deriv account is linked to another tradeMO user. Disconnect it there first.", step: "link_account" },
  PERMISSION_DENIED: { title: "Authorization denied", reason: "You declined access on the Deriv authorization screen.", step: "redirected" },
  NETWORK_ERROR: { title: "Couldn't reach Deriv", reason: "The WebSocket connection to Deriv failed. Check your connection and retry.", step: "exchange_code" },
};

const FALLBACK_ERROR = { title: "Connection failed", reason: "Something unexpected happened. Our team has been notified.", step: "exchange_code" as DerivCallbackStepKey };

type Phase = "running" | "success" | "error";

interface Props {
  code: string;
  state: string;
  acct1: string | null;
  derivError: string | null;
}

export function DerivCallbackPage({ code, state, acct1, derivError }: Props) {
  const router = useRouter();
  const connect = useDerivConnect();
  const retry = useDerivAuthorizeUrl();
  const started = useRef(false);
  const [active, setActive] = useState(1);
  const [phase, setPhase] = useState<Phase>("running");
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const [result, setResult] = useState<DerivConnectResponseDTO | null>(null);
  const redirect = useCountdown(0, false);

  const fail = (code: AuthErrorCode) => {
    const copy = ERROR_COPY[code] ?? FALLBACK_ERROR;
    setErrorCode(code);
    setActive(STEPS.findIndex((s) => s.key === copy.step));
    setPhase("error");
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (derivError) return fail("PERMISSION_DENIED");
    if (!code || !state) return fail(!state ? "STATE_MISMATCH" : "CODE_EXPIRED");

    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      await sleep(450);
      if (!cancelled) setActive(2);
      try {
        const [res] = await Promise.all([connect.mutateAsync({ code, state, acct1 }), sleep(700)]);
        for (const i of [3, 4, 5]) {
          await sleep(380);
          if (cancelled) return;
          setActive(i);
        }
        await sleep(300);
        if (cancelled) return;
        setActive(STEPS.length);
        setResult(res);
        setPhase("success");
        redirect.restart(6);
      } catch (e) {
        if (!cancelled) fail(e instanceof AuthApiError ? e.code : "UNKNOWN");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === "success" && result && redirect.total > 0 && redirect.done) router.push(result.redirectTo);
  }, [phase, result, redirect.done, redirect.total, router]);

  const tryAgain = async () => {
    try {
      const { url } = await retry.mutateAsync();
      window.location.href = url;
    } catch {
      /* stays on error card */
    }
  };

  const err = errorCode ? (ERROR_COPY[errorCode] ?? FALLBACK_ERROR) : null;

  return (
    <AuthShell rootClass="page-auth-deriv-callback" width="md">
      <div className={cn("auth-card dc-card", phase === "error" && "shake")}>
        <div className="dc-head">
          <span className="dc-logos" aria-hidden="true">
            <span className="dc-logo dc-logo--deriv">d</span>
            <span className="dc-logos__link">
              <Icon name="link" size={14} />
            </span>
            <span className="dc-logo brand-mark__glyph">tM</span>
          </span>
          <div>
            <span className="eyebrow-label">Deriv OAuth</span>
            <h1 className="dc-title">
              {phase === "success" ? "Deriv account connected!" : phase === "error" ? (err?.title ?? "Connection failed") : "Connecting your Deriv account…"}
            </h1>
          </div>
        </div>

        <ol className="dc-steps" aria-live="polite">
          {STEPS.map((s, i) => {
            const state = i < active || phase === "success" ? "done" : i === active ? (phase === "error" ? "failed" : "active") : "idle";
            return (
              <li key={s.key} className={cn("dc-step", `is-${state}`)}>
                <span className="dc-step__icon">
                  {state === "done" ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" className="icon-draw" aria-hidden="true">
                      <path d="M5 12.5 10 17.5 19 7" pathLength={1} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : state === "active" ? (
                    <Icon name="refresh" size={14} className="icon-spin" />
                  ) : state === "failed" ? (
                    <Icon name="x" size={14} />
                  ) : null}
                </span>
                <span className="dc-step__text">
                  <strong>{s.label}</strong>
                  <span className="mono">{state === "failed" && errorCode ? errorCode : s.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>

        {phase === "success" && result ? (
          <div className="dc-result auth-enter">
            <dl className="auth-kv">
              <dt>Deriv login ID</dt>
              <dd className="mono">{result.connection.derivLoginId}</dd>
              <dt>Account type</dt>
              <dd>
                <span className={cn("dc-acct", result.connection.accountType === "real" ? "is-real" : "is-demo")}>
                  {result.connection.accountType === "real" ? "Real" : "Demo"}
                </span>
              </dd>
              <dt>Currency</dt>
              <dd className="mono">{result.connection.currency}</dd>
              <dt>Balance</dt>
              <dd className="mono">{formatCurrency(result.connection.balance, result.connection.currency)}</dd>
              <dt>Permissions</dt>
              <dd>
                <span className="dc-perms">
                  {result.connection.permissions.map((p) => (
                    <span key={p} className="pill">
                      {p}
                    </span>
                  ))}
                </span>
              </dd>
            </dl>
            <Link href={result.redirectTo} className="btn-brand w-100 mt-4">
              Continue to dashboard <Icon name="arrowRight" size={16} />
            </Link>
            <p className="dc-muted">
              Redirecting in <span className="mono">{redirect.remaining}s</span> · Token encrypted, never shown again.
            </p>
          </div>
        ) : null}

        {phase === "error" && err ? (
          <div className="dc-error auth-enter">
            <div className="dc-error__box">
              <StatusMark kind="error" size={40} className="icon-pulse-once" />
              <div>
                <strong>Reason</strong>
                <p>{err.reason}</p>
                {errorCode ? <span className="mono dc-error__code">code: {errorCode}</span> : null}
              </div>
            </div>
            <div className="dc-error__actions">
              <button type="button" className="btn-brand" onClick={tryAgain} disabled={retry.isPending}>
                {retry.isPending ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : <Icon name="refresh" size={15} />}
                Try again
              </button>
              <a className="btn-ghost" href={`mailto:support@trademo.io?subject=Deriv%20connection%20${errorCode ?? "error"}`}>
                Contact support
              </a>
            </div>
          </div>
        ) : null}
      </div>
      <p className="dc-foot">
        tradeMO requests <span className="mono">read</span>, <span className="mono">trade</span>, <span className="mono">payments</span> and{" "}
        <span className="mono">admin</span> scopes. You can revoke access anytime in Deriv → Security → Connected apps.
      </p>
    </AuthShell>
  );
}
