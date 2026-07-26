import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function Spinner({ large }: { large?: boolean }) {
  return <div className={`spinner ${large ? 'spinner--lg' : ''}`} role="status" aria-label="Loading" />;
}

export function CenteredLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-block">
      <Spinner large />
      <div className="state-block__message">{label}</div>
    </div>
  );
}

export function Skeleton({ height, width, style }: { height: number; width?: number | string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height, width: width ?? '100%', ...style }} />;
}

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className="state-block">
      {icon ?? <Inbox size={28} />}
      <div className="state-block__title">{title}</div>
      {message && <div className="state-block__message">{message}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-block" role="alert">
      <AlertTriangle size={28} style={{ color: 'var(--status-critical)' }} />
      <div className="state-block__title">Something went wrong</div>
      <div className="state-block__message">{message}</div>
      {onRetry && (
        <button className="btn btn--secondary btn--sm" onClick={onRetry}>
          <RotateCw size={13} />
          Retry
        </button>
      )}
    </div>
  );
}
