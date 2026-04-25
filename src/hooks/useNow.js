import { useState, useEffect, useCallback, useRef } from 'react';

export default function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  const lastTickRef = useRef(now);

  const tick = useCallback(() => {
    const t = Date.now();
    lastTickRef.current = t;
    setNow(t);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, [intervalMs, tick]);

  return { now, tick };
}
