import type { ReactNode } from 'react';

const REWARD_TOKEN_RE = /(\+\d+\s+\S+(?:\s+[A-Z][A-Za-z-]+)*)/g;

function renderRewardTokens(text: string): ReactNode {
  const parts = text.split(REWARD_TOKEN_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="ows-reward-token">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export interface FloatingCallout {
  id: number;
  text: string;
  tone?: 'reward' | 'build';
  /** Optional viewport-relative coordinates (% 0–100); defaults to upper-center stage */
  x?: number;
  y?: number;
}

export interface FloatingRewardsProps {
  callouts: readonly FloatingCallout[];
}

/**
 * Brief upward-drifting callouts shown above unlocked doors, scavenged piles, and completed builds.
 * Stationary fade when `data-reduce-motion='true'`.
 */
export default function FloatingRewards({ callouts }: FloatingRewardsProps) {
  if (callouts.length === 0) return null;

  return (
    <div className="ows-float-layer" aria-live="polite" aria-atomic="false">
      {callouts.map((c) => (
        <div
          key={c.id}
          className={`ows-float-callout ${c.tone === 'build' ? 'ows-float-callout--build' : ''}`}
          style={{
            left: `${c.x ?? 50}%`,
            top: `${c.y ?? 24}%`,
          }}
        >
          {renderRewardTokens(c.text)}
        </div>
      ))}
    </div>
  );
}
