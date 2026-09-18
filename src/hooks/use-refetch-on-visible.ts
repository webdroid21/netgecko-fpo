import { useRef, useEffect } from 'react';

// ----------------------------------------------------------------------

/**
 * Refetch when the user returns to an idle/open window.
 *
 * Listens to `visibilitychange` and `focus` (throttled) plus `online`
 * (always) — the `online` event is what lets the app recover when the
 * refetch fired while the machine was still waking up and the network
 * was not back yet.
 */
export function useRefetchOnVisible(refetch: () => void, minIntervalMs = 30_000) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const lastFetchAt = useRef(Date.now());

  useEffect(() => {
    const fire = () => {
      lastFetchAt.current = Date.now();
      refetchRef.current();
    };

    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastFetchAt.current < minIntervalMs) return;
      fire();
    };

    const onOnline = () => {
      if (document.visibilityState !== 'visible') return;
      fire();
    };

    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
      window.removeEventListener('online', onOnline);
    };
  }, [minIntervalMs]);
}
