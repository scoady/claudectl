import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseMetricsResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMetrics<T>(
  fetcher: () => Promise<T>,
  interval: number | null,
  fallback?: () => T,
): UseMetricsResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  const fallbackRef = useRef(fallback);

  fetcherRef.current = fetcher;
  fallbackRef.current = fallback;

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      // Use fallback mock data when API is unavailable
      if (fallbackRef.current && !data) {
        setData(fallbackRef.current());
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (interval === null || interval <= 0) return;
    const id = setInterval(refetch, interval);
    return () => clearInterval(id);
  }, [interval, refetch]);

  return { data, loading, error, refetch };
}
