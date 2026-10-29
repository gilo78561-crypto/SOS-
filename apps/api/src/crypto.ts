import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb);
export const hashToken = (v: string) => createHash('sha256').update(v).digest('hex');
export const opaqueToken = () => randomBytes(32).toString('base64url');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ':' + key.toString('hex');
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(':');
  const candidate = (await scrypt(password, salt || 'invalid', 64)) as Buffer;
  const target = Buffer.from(key || '', 'hex');
  return target.length === candidate.length && timingSafeEqual(candidate, target);
}
export function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.DATA_ENCRYPTION_KEY!, 'hex'), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((v) => v.toString('base64')).join('.');
}
export function decrypt(value: string): string {
  const [iv, tag, data] = value.split('.').map((v) => Buffer.from(v, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(process.env.DATA_ENCRYPTION_KEY!, 'hex'), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
export const encrypted = {
  to: (value: string | null) => (value === null ? null : encrypt(value)),
  from: (value: string | null) => (value === null ? null : decrypt(value)),
};
