import './config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { PrivateStorage } from './extras';

async function main() {
  const storage = new PrivateStorage();
  const expected = randomBytes(257);
  let key: string | undefined;

  try {
    key = await storage.put(expected);
    const actual = await storage.get(key);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error('Le contenu relu ne correspond pas au contenu envoyé.');
    console.log('Stockage privé vérifié.');
  } finally {
    if (key) await storage.delete(key);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Échec du contrôle du stockage privé.');
  process.exit(1);
});
