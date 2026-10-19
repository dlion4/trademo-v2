import { Icon, type IconName } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import type { TrustBadgeDTO } from "@/lib/api/types";

export function TrustBar({ badges }: { badges: TrustBadgeDTO[] }) {
  if (badges.length === 0) return null;

  return (
    <section className="trust" aria-label="Trust and security">
      <div className="container-xl">
        <div className="trust__grid">
          {badges.map((badge, index) => (
            <Reveal key={badge.id} delay={index * 70}>
              <div className="trust__item">
                <span className="trust__glyph">
                  <Icon name={badge.icon as IconName} size={18} />
                </span>
                <div>
                  <div className="trust__label">{badge.label}</div>
                  {badge.detail ? <div className="trust__detail">{badge.detail}</div> : null}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
