import { Lightbulb, Radar, Siren, Sparkles } from 'lucide-react';
import type { AiAnswerData } from '../../types';
import { Badge } from './Badge';

/**
 * Styled, interactive rendering of a structured AI answer — a summary lead,
 * "detected patterns" and "recommended actions" as iconed rows, a confidence
 * meter, and optional sentiment/keyword chips. Used by the chat assistant and
 * the offender risk panel.
 */
export function AiAnswer({
  data,
  compact = false,
}: {
  data: AiAnswerData;
  compact?: boolean;
}) {
  const patterns = data.detected_patterns ?? [];
  const actions = data.recommended_actions ?? [];
  const conf = typeof data.confidence === 'number' ? Math.round(data.confidence * 100) : null;

  return (
    <div className="ai-answer">
      <div className="ai-answer__head">
        <span className="ai-answer__mark">
          <Sparkles size={13} />
        </span>
        <span className="ai-answer__label">AI analysis</span>
        {conf !== null && (
          <span className="ai-answer__conf" title="Model confidence">
            <span className="ai-answer__conf-bar">
              <span className="ai-answer__conf-fill" style={{ width: `${conf}%` }} />
            </span>
            {conf}%
          </span>
        )}
      </div>

      {data.summary && <p className="ai-answer__summary">{data.summary}</p>}

      {patterns.length > 0 && (
        <div className="ai-answer__section">
          <div className="ai-answer__section-title">
            <Radar size={13} />
            Detected patterns
          </div>
          <ul className="ai-answer__list">
            {patterns.map((p, i) => (
              <li key={i} className="ai-answer__item ai-answer__item--pattern">
                <span className="ai-answer__dot" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {actions.length > 0 && (
        <div className="ai-answer__section">
          <div className="ai-answer__section-title">
            <Siren size={13} />
            Recommended actions
          </div>
          <ul className="ai-answer__list">
            {actions.map((a, i) => (
              <li key={i} className="ai-answer__item ai-answer__item--action">
                <Lightbulb size={13} className="ai-answer__item-icon" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (data.sentiment || (data.keywords && data.keywords.length > 0)) && (
        <div className="ai-answer__chips">
          {data.sentiment && (
            <Badge
              tone={
                /pos/i.test(data.sentiment) ? 'good' : /neg/i.test(data.sentiment) ? 'critical' : 'neutral'
              }
            >
              {data.sentiment}
            </Badge>
          )}
          {data.keywords?.slice(0, 6).map((kw) => (
            <Badge key={kw} tone="accent">
              {kw}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Whether a payload has enough structure to render as a styled AiAnswer. */
export function hasStructuredAnswer(data: AiAnswerData): boolean {
  return Boolean(
    data.summary ||
      (data.detected_patterns && data.detected_patterns.length) ||
      (data.recommended_actions && data.recommended_actions.length),
  );
}
