'use client';
import { useState, useCallback, useEffect } from 'react';
import { api, errorText } from './api';
export function useResource<T>(path: string, initial: T) {
  const [data, setData] = useState<T>(initial),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setError('');
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh };
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  async function run(task: () => Promise<unknown>, message = 'Modification enregistrée.') {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await task();
      setSuccess(message);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, success, run, setError };
}
