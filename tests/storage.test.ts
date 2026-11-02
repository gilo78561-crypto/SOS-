import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const blob = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@vercel/blob', () => blob);

import { ExtrasService, PrivateStorage } from '../apps/api/src/extras';

describe('Stockage privé Vercel Blob', () => {
  let stored: string | undefined;

  beforeEach(() => {
    stored = undefined;
    vi.stubEnv('DATA_ENCRYPTION_KEY', 'a'.repeat(64));
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_teststore_testsecret');
    vi.stubEnv('BLOB_STORE_ID', '');
    vi.stubEnv('STORAGE_BUCKET', 'ancien-bucket');
    vi.stubEnv('STORAGE_ACCESS_KEY_ID', 'unused');
    vi.stubEnv('STORAGE_SECRET_ACCESS_KEY', 'unused');

    blob.put.mockReset().mockImplementation(async (pathname: string, body: unknown) => {
      stored = String(body);
      return {
        pathname,
        url: `https://teststore.private.blob.vercel-storage.com/${pathname}`,
        downloadUrl: '',
        contentType: 'application/octet-stream',
        contentDisposition: 'attachment',
        etag: 'test-etag',
      };
    });
    blob.get.mockReset().mockImplementation(async (pathname: string) =>
      stored === undefined
        ? null
        : {
            statusCode: 200,
            stream: new Response(stored).body!,
            headers: new Headers(),
            blob: {
              pathname,
              url: '',
              downloadUrl: '',
              contentType: 'application/octet-stream',
              contentDisposition: 'attachment',
              cacheControl: 'private',
              uploadedAt: new Date(),
              etag: 'test-etag',
              size: stored.length,
            },
          },
    );
    blob.del.mockReset().mockImplementation(async () => {
      stored = undefined;
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('privilégie Blob avec le jeton seul, chiffre, relit puis supprime le document', async () => {
    const storage = new PrivateStorage();
    const input = Buffer.from('Justificatif privé de test');

    const key = await storage.put(input);

    expect(key).toMatch(/^[0-9a-f-]{36}$/i);
    expect(stored?.split('.')).toHaveLength(3);
    expect(stored).not.toContain(input.toString('utf8'));
    expect(stored).not.toContain(input.toString('base64'));
    expect(blob.put).toHaveBeenCalledWith(
      key,
      expect.any(String),
      expect.objectContaining({
        access: 'private',
        addRandomSuffix: false,
        token: 'vercel_blob_rw_teststore_testsecret',
      }),
    );

    await expect(storage.get(key)).resolves.toEqual(input);
    expect(blob.get).toHaveBeenCalledWith(
      key,
      expect.objectContaining({
        access: 'private',
        useCache: false,
        token: 'vercel_blob_rw_teststore_testsecret',
      }),
    );

    await storage.delete(key);
    expect(blob.del).toHaveBeenCalledWith(key, {
      token: 'vercel_blob_rw_teststore_testsecret',
    });
    expect(stored).toBeUndefined();
    await expect(storage.get(key)).rejects.toThrow('stockage privé');
  });

  it('utilise BLOB_STORE_ID sans imposer un jeton permanent', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    vi.stubEnv('BLOB_STORE_ID', 'store_oidc_test');
    const storage = new PrivateStorage();

    const key = await storage.put(Buffer.from('OIDC'));

    expect(blob.put.mock.calls.at(-1)?.[2]).not.toHaveProperty('token');
    await storage.delete(key);
    expect(blob.del).toHaveBeenLastCalledWith(key);
  });

  it('rejette une clé non UUID avant tout appel au fournisseur', async () => {
    const storage = new PrivateStorage();

    await expect(storage.get('../secret')).rejects.toThrow();
    await expect(storage.delete('../secret')).rejects.toThrow();
    expect(blob.get).not.toHaveBeenCalled();
    expect(blob.del).not.toHaveBeenCalled();
  });

  it('supprime le Blob si la transaction du document est annulée', async () => {
    const em = {};
    const save = vi.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002',
      userId: '00000000-0000-4000-8000-000000000001',
      name: 'preuve.pdf',
      mime: 'application/pdf',
    });
    const db = {
      repo: vi.fn((_name: string, manager?: object) =>
        manager ? { save } : { countBy: vi.fn().mockResolvedValue(0) },
      ),
      source: {
        transaction: vi.fn(async (callback: (manager: object) => Promise<unknown>) => callback(em)),
      },
    };
    const transactionError = new Error('audit rollback');
    const auth = {
      require: vi.fn(),
      audit: vi.fn().mockRejectedValue(transactionError),
    };
    const service = new ExtrasService(db as never, auth as never, {} as never);
    const user = {
      id: '00000000-0000-4000-8000-000000000001',
      role: 'doctor',
    };

    await expect(
      service.upload(user as never, {
        name: 'preuve.pdf',
        mime: 'application/pdf',
        base64: Buffer.from('%PDF-1.7 test').toString('base64'),
      }),
    ).rejects.toBe(transactionError);

    expect(save).toHaveBeenCalledOnce();
    expect(auth.audit).toHaveBeenCalledWith(
      user.id,
      'document.upload',
      '00000000-0000-4000-8000-000000000002',
      em,
    );
    expect(blob.del).toHaveBeenCalledOnce();
    expect(stored).toBeUndefined();
  });
});
