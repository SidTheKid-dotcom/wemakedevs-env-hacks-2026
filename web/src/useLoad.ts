import { useCallback, useEffect, useState } from "react";

/** Load async data; `retry` runs it again (the "Try again" button). */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: Error & { status?: number } }>({});
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setState({});
    load().then((data) => live && setState({ data }), (error) => live && setState({ error }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  const retry = useCallback(() => setN((x) => x + 1), []);
  return { ...state, loading: !state.data && !state.error, retry };
}
