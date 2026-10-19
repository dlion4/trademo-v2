import { Icon, type IconName } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import type { ReactNode } from "react";
import type { FeatureModuleDTO } from "@/lib/api/types";

/**
 * Shared module header for the five deep-dive sections.
 * The glyph uses the `icon-draw` stroke animation from base.css.
 */
export function ModuleShell({
  module,
  children,
}: {
  module: FeatureModuleDTO;
  children: ReactNode;
}) {
  return (
    <section className="module" id={module.slug}>
      <div className="container-xl">
        <div className="module__head">
          <Reveal>
            <div>
              <div className="module__index">
                <span className="module__num">{module.number}</span>
                <span className="eyebrow-label">{module.eyebrow}</span>
              </div>
              <h2 className="module__title">{module.title}</h2>
              <p className="module__summary">{module.summary}</p>

              <ul className="module__bullets">
                {module.bullets.map((bullet) => (
                  <li key={bullet}>
                    <Icon name="check" size={14} />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={90}>
            <div>
              <div className="module__glyph mb-4 icon-draw">
                <Icon name={module.icon as IconName} size={22} />
              </div>
              <dl className="module__facts">
                {module.specs.map((spec) => (
                  <div className="module__fact" key={spec.label}>
                    <dt className="module__fact-label">{spec.label}</dt>
                    <dd className="module__fact-value mb-0">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>

        <Reveal delay={140}>{children}</Reveal>
      </div>
    </section>
  );
}

/** Demo panel chrome: window bar + badge + body. */
export function DemoPanel({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className="demo hover-lift">
      <div className="demo__bar">
        <span className="demo__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="demo__title">{title}</span>
        {badge ? (
          <span className="pill pill-live demo__badge">
            <span className="live-dot" />
            {badge}
          </span>
        ) : null}
      </div>
      <div className="demo__body">{children}</div>
    </div>
  );
}

export function DemoLabel({ children }: { children: ReactNode }) {
  return <p className="demo__label">{children}</p>;
}
