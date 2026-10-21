"use client";

import { Icon, type IconName } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import { useCountUp } from "@/lib/hooks/use-motion";
import { formatNumber } from "@/lib/format";
import type { StatDTO } from "@/lib/api/types";

function StatCard({ stat, index }: { stat: StatDTO; index: number }) {
  const animated = useCountUp(stat.value);
  const decimals = Math.min(stat.decimals, 2);

  return (
    <Reveal delay={index * 80} className="h-100">
      <article className="stat-card h-100">
        {stat.icon ? (
          <span className="stat-card__icon">
            <Icon name={stat.icon as IconName} size={18} />
          </span>
        ) : null}
        <div className="stat-card__value">
          {stat.prefix}
          {formatNumber(animated, decimals)}
          {stat.suffix}
        </div>
        <div className="stat-card__label">{stat.label}</div>
        {stat.caption ? <div className="stat-card__caption">{stat.caption}</div> : null}
      </article>
    </Reveal>
  );
}

/** KPI band — 1 col (sm) / 2 cols (md) / 4 cols (xl). */
export function StatsBand({ stats }: { stats: StatDTO[] }) {
  if (stats.length === 0) return null;

  return (
    <section className="stats" aria-label="Platform statistics">
      <div className="container-xl">
        <div className="stats__grid">
          {stats.map((stat, index) => (
            <StatCard key={stat.id} stat={stat} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
