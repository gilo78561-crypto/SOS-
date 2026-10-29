export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}
let csrf = '';
export const setCsrf = (value: string) => {
  csrf = value;
};
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch((process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api') + path, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError('Connexion impossible. Vérifie ta connexion puis réessaie.', 0);
  }
  const data = await response.json().catch(() => ({ message: 'Réponse du serveur non reconnue.' }));
  if (!response.ok)
    throw new ApiError(data.message ?? 'Une erreur est survenue.', response.status, data.errors ?? []);
  return data as T;
}
export const errorText = (e: unknown) =>
  e instanceof ApiError
    ? e.message + (e.fields.length ? ' ' + e.fields.map((v) => v.path + ' : ' + v.message).join(' ') : '')
    : e instanceof Error
      ? e.message
      : 'Une erreur est survenue.';
