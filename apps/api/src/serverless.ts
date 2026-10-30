import './config';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { createApp } from './app';
import { Database } from './database';

let application: Promise<Awaited<ReturnType<typeof createApp>>> | undefined;

function getApplication() {
  if (!application) {
    application = (async () => {
      const db = new Database();
      try {
        await db.connect();
        return await createApp(db);
      } catch (error) {
        await db.close().catch(() => undefined);
        throw error;
      }
    })().catch((error: unknown) => {
      application = undefined;
      throw error;
    });
  }
  return application;
}

export default async function handleApi(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  let listener: RequestListener;
  try {
    const { app } = await getApplication();
    listener = app.getHttpAdapter().getInstance() as RequestListener;
  } catch (error) {
    // Do not expose connection strings or infrastructure errors in public responses.
    console.error('API initialization failed', error instanceof Error ? error.name : 'UnknownError');
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Retry-After', '30');
    res.end(
      JSON.stringify({
        ok: false,
        service: 'sos-docteurs-api',
        code: 'API_UNAVAILABLE',
        message: 'Le service est temporairement indisponible. Réessaie plus tard.',
      }),
    );
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const done = () => {
      res.off('finish', done);
      res.off('close', done);
      resolve();
    };
    res.once('finish', done);
    res.once('close', done);
    try {
      listener(req, res);
    } catch (error) {
      res.off('finish', done);
      res.off('close', done);
      reject(error);
    }
  });
}
