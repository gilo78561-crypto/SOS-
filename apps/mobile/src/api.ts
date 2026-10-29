import * as SecureStore from 'expo-secure-store';
let token = '';
let endpoint = process.env.EXPO_PUBLIC_API_URL ?? '';
let expired: (() => void) | null = null;
export const onSessionExpired = (handler: (() => void) | null) => {
  expired = handler;
};
export const currentEndpoint = () => endpoint;
export async function setEndpoint(value: string) {
  if (process.env.EXPO_PUBLIC_DEMO_MODE !== 'true')
    throw new Error('Configuration du serveur réservée au build de démonstration.');
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Adresse de serveur invalide.');
  await clearSession();
  endpoint = value.trim().replace(/\/$/, '');
  await SecureStore.setItemAsync('sos-demo-endpoint', endpoint);
}
const key = 'sos-session';
export async function restoreSession() {
  if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true')
    endpoint = (await SecureStore.getItemAsync('sos-demo-endpoint')) ?? endpoint;
  token = (await SecureStore.getItemAsync(key)) ?? '';
  return token;
}
export async function saveSession(value: string) {
  token = value;
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
export async function clearSession() {
  token = '';
  await SecureStore.deleteItemAsync(key);
}
export class MobileApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  extra: Record<string, string> = {},
): Promise<T> {
  const base = endpoint;
  if (!base) throw new MobileApiError('Adresse du serveur non configurée.', 0);
  let response: Response;
  try {
    response = await fetch(base + path, {
      method,
      headers: {
        'X-Client': 'mobile',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...extra,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new MobileApiError(
      'Connexion indisponible. Vérifiez votre réseau et réessayez. Votre demande n’a pas été confirmée.',
      0,
    );
  }
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      const hadToken = !!token;
      await clearSession();
      if (hadToken) expired?.();
    }
    throw new MobileApiError(result.message ?? 'Action impossible.', response.status);
  }
  return result as T;
}
export const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Une erreur est survenue.');
