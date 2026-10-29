import './config';
import { Database } from './database';
import { createApp } from './app';
async function main() {
  const db = await new Database().connect();
  const { app } = await createApp(db, { log: true, exportOpenApi: process.env.NODE_ENV !== 'production' });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
  console.log('SOS DOCTEURS API prête sur le port ' + (process.env.PORT ?? 4000));
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Démarrage impossible.');
  process.exit(1);
});
