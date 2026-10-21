"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/cn";
import { scorePassword } from "@/lib/auth/utils";

/* ── Field shell: label + control + error/hint, Bootstrap validation states ── */

export function FieldShell({
  id,
  label,
  error,
  hint,
  labelAside,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: ReactNode;
  labelAside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("auth-field", className)}>
      <div className="auth-field__label-row">
        <label htmlFor={id} className="auth-field__label">
          {label}
        </label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <div className="auth-field__error" id={`${id}-error`} role="alert">
          <Icon name="alert" size={13} />
          {error}
        </div>
      ) : hint ? (
        <div className="auth-field__hint" id={`${id}-hint`}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  invalid?: boolean;
  icon?: IconName;
  onValueChange: (value: string) => void;
}

export function TextInput({ invalid, icon, onValueChange, className, ...rest }: TextInputProps) {
  return (
    <div className={cn("auth-input", icon && "auth-input--icon")}>
      {icon ? <Icon name={icon} size={16} className="auth-input__icon" /> : null}
      <input
        {...rest}
        className={cn("form-control", invalid && "is-invalid", className)}
        aria-invalid={invalid || undefined}
        onChange={(e) => onValueChange(e.target.value)}
      />
    </div>
  );
}

/** Password input with show/hide toggle (icon rotates on toggle). */
export function PasswordInput(props: Omit<TextInputProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-password">
      <TextInput {...props} type={visible ? "text" : "password"} icon={props.icon ?? "lock"} />
      <button
        type="button"
        className={cn("auth-password__toggle", visible && "is-visible")}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={16} />
        <span>{visible ? "Hide" : "Show"}</span>
      </button>
    </div>
  );
}

/** Live-filling strength meter + rule checklist. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const s = scorePassword(password);
  return (
    <div className="strength" aria-live="polite">
      <div className="strength__bar">
        <span className={cn("strength__fill", `is-${s.tone}`)} style={{ width: `${password ? s.percent : 0}%` }} />
      </div>
      <div className="strength__row">
        <ul className="strength__checks">
          {s.checks.map((c) => (
            <li key={c.key} className={cn(c.passed && "is-passed")}>
              <Icon name={c.passed ? "check" : "minus"} size={12} />
              {c.label}
            </li>
          ))}
        </ul>
        {password ? <span className={cn("strength__label", `is-${s.tone}`)}>{s.label}</span> : null}
      </div>
    </div>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  invalid,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="form-check auth-check">
      <input
        id={id}
        type="checkbox"
        className={cn("form-check-input", invalid && "is-invalid")}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="form-check-label" htmlFor={id}>
        {children}
      </label>
    </div>
  );
}

export function SubmitButton({
  loading,
  disabled,
  children,
  loadingLabel = "Please wait…",
  variant = "brand",
  type = "submit",
  onClick,
  className,
}: {
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  loadingLabel?: string;
  variant?: "brand" | "ghost";
  type?: "submit" | "button";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(variant === "brand" ? "btn-brand" : "btn-ghost", "auth-submit", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <>
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function AuthAlert({
  tone = "error",
  title,
  children,
  className,
}: {
  tone?: "error" | "info" | "success" | "warning";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const icon: IconName = tone === "success" ? "check" : tone === "info" ? "info" : "alert";
  return (
    <div className={cn("auth-alert", `auth-alert--${tone}`, className)} role={tone === "error" ? "alert" : "status"}>
      <Icon name={icon} size={16} />
      <div>
        {title ? <strong>{title}</strong> : null}
        {children ? <div className="auth-alert__body">{children}</div> : null}
      </div>
    </div>
  );
}
