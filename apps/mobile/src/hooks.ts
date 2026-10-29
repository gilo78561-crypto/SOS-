import { useState, useEffect, useCallback } from 'react';
import { request, messageOf } from './api';
export function useData<T>(path: string, initial: T) {
  const [data, setData] = useState(initial),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setError('');
    try {
      setData(await request<T>(path));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh };
}
export function useTask() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await task();
      return true;
    } catch (e) {
      setError(messageOf(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
