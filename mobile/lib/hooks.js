import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Load data when a screen gains focus and expose pull-to-refresh.
 *   const { data, error, loading, refreshing, reload, refresh } = useLoad(() => api('/api/x'), [dep]);
 */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async (mode) => {
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'initial') setLoading(true);
    try { setData(await fn()); setError(''); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(useCallback(() => { run(data ? 'silent' : 'initial'); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]));

  return { data, setData, error, loading, refreshing, reload: () => run(data ? 'silent' : 'initial'), refresh: () => run('refresh') };
}
