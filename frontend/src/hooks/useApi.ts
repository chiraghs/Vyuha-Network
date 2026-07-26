import { useCallback, useEffect, useRef, useState } from 'react';
import { extractErrorMessage } from '../api/client';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-run the fetch (e.g. from an error state "Retry" button). */
  refetch: () => void;
}

/**
 * Declarative data fetching with race-condition protection: only the latest
 * in-flight request may commit state, and unmounted components never update.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const requestSeq = useRef(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((result) => {
        if (seq === requestSeq.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (seq === requestSeq.current) {
          setError(extractErrorMessage(err, 'Failed to load data.'));
          setLoading(false);
        }
      });
    return () => {
      // Invalidate this request if deps change or the component unmounts.
      if (seq === requestSeq.current) requestSeq.current++;
    };
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refetch };
}
