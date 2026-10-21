"use client";

import type { ReactNode } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/cn";

export interface DeskModalShellProps {
  code: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onClose: () => void;
  steps?: string[];
  currentStep?: number;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Pure institutional trading desk modal frame (Bootstrap 5.3 compatible, zero gradients).
 */
export function DeskModalShell({
  code,
  eyebrow,
  title,
  subtitle,
  size = "md",
  onClose,
  steps,
  currentStep = 0,
  footer,
  children,
}: DeskModalShellProps) {
  return (
    <div
      className="desk-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cn("desk-modal", `desk-modal--${size}`)}>
        <div className="desk-modal__head">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="desk-code-tag mono">{code}</span>
              <span className="eyebrow-label">{eyebrow}</span>
            </div>
            <h2 className="desk-modal__title">{title}</h2>
            {subtitle ? <p className="desk-modal__sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="desk-icon-btn" onClick={onClose} aria-label="Close modal">
            <Icon name="close" size={17} />
          </button>
        </div>

        {steps && steps.length > 0 ? (
          <div className="desk-wizard-bar" aria-label="Wizard steps">
            {steps.map((label, idx) => {
              const done = idx < currentStep;
              const active = idx === currentStep;
              return (
                <div
                  key={label}
                  className={cn("desk-wizard-bar__step", done && "is-done", active && "is-active")}
                >
                  <span className="desk-wizard-bar__num mono">
                    {done ? <Icon name="check" size={12} /> : idx + 1}
                  </span>
                  <span className="desk-wizard-bar__label">{label}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="desk-modal__body">{children}</div>

        {footer ? <div className="desk-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
