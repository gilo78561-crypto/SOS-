import { beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt, hashPassword, verifyPassword, opaqueToken, hashToken } from '../apps/api/src/crypto';

beforeAll(() => { process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex'); });
describe('Protection des secrets et données privées', () => {
  it('sale les mots de passe et vérifie le mot de passe exact', async () => {
    const password = 'Test-Only-Password-2026!';
    const first = await hashPassword(password), second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('incorrect', first)).toBe(false);
  });
  it('chiffre différemment le même contenu et le restitue', () => {
    const content = 'Note exclusivement fictive de test';
    const first = encrypt(content), second = encrypt(content);
    expect(first).not.toBe(second);
    expect(first).not.toContain(content);
    expect(decrypt(first)).toBe(content);
  });
  it('rejette un contenu chiffré altéré', () => {
    const parts = encrypt('Texte fictif').split('.');
    const data = Buffer.from(parts[2], 'base64');
    data[0] ^= 1;
    parts[2] = data.toString('base64');
    expect(() => decrypt(parts.join('.'))).toThrow();
  });
  it('produit des jetons distincts et ne stocke pas leur valeur brute', () => {
    const first = opaqueToken();
    expect(first).not.toBe(opaqueToken());
    expect(hashToken(first)).not.toBe(first);
    expect(hashToken(first)).toMatch(/^[0-9a-f]{64}$/);
  });
});
