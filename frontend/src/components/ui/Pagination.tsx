import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../lib/format';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  /** Noun for the row count, e.g. "cases" / "offenders". */
  label?: string;
}

export function Pagination({ page, pages, total, pageSize, onPage, label = 'records' }: PaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 18px',
        borderTop: '1px solid var(--border)',
        fontSize: 12.5,
        color: 'var(--text-3)',
      }}
    >
      <span>
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)} {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn btn--secondary btn--sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
          Page {page} / {pages}
        </span>
        <button
          className="btn btn--secondary btn--sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
