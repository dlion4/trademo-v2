"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

interface OtpInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  onComplete?: (code: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  success?: boolean;
  autoFocus?: boolean;
}

/**
 * 6 separate single-digit boxes (spec A-7):
 *  - auto-advance on input, Backspace jumps back
 *  - paste "482917" or "482 917" fills all boxes
 *  - final digit triggers onComplete
 */
export function OtpInput({ value, onChange, onComplete, invalid, disabled, success, autoFocus }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const commit = (next: string[], focusIndex?: number) => {
    onChange(next);
    if (focusIndex !== undefined) refs.current[Math.min(5, Math.max(0, focusIndex))]?.focus();
    if (next.every((d) => /^\d$/.test(d))) onComplete?.(next.join(""));
  };

  const setDigit = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      const next = [...value];
      next[index] = "";
      onChange(next);
      return;
    }
    if (digits.length > 1) return fillFrom(index, digits);
    const next = [...value];
    next[index] = digits;
    commit(next, index + 1);
  };

  const fillFrom = (start: number, digits: string) => {
    const next = [...value];
    digits
      .slice(0, 6 - start)
      .split("")
      .forEach((d, i) => (next[start + i] = d));
    commit(next, start + digits.length);
  };

  const onKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      e.preventDefault();
      const next = [...value];
      next[index - 1] = "";
      onChange(next);
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    e.preventDefault();
    fillFrom(0, digits);
  };

  return (
    <div className={cn("otp", invalid && "is-invalid", success && "is-success")} role="group" aria-label="6-digit code">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={cn("otp__box", digit && "is-filled", i === 3 && "otp__box--gap")}
          style={{ animationDelay: `${i * 60}ms` }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="\d*"
          maxLength={6}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
