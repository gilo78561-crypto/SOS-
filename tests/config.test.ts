import { describe, expect, it } from 'vitest';
import { resolveDatabaseUrls } from '../apps/api/src/config';

describe('resolveDatabaseUrls', () => {
  it('privilégie les noms canoniques', () => {
    expect(
      resolveDatabaseUrls({
        DATABASE_URL: ' postgres://canonical-pooled ',
        DATABASE_URL_UNPOOLED: ' postgres://canonical-direct ',
        SoS_BG_DATABASE_URL: 'postgres://prefixed-pooled',
        SoS_BG_DATABASE_URL_UNPOOLED: 'postgres://prefixed-direct',
      }),
    ).toEqual({
      databaseUrl: 'postgres://canonical-pooled',
      databaseUrlUnpooled: 'postgres://canonical-direct',
    });
  });

  it("accepte les variables préfixées par l'intégration Vercel Neon", () => {
    expect(
      resolveDatabaseUrls({
        SoS_BG_DATABASE_URL: 'postgres://prefixed-pooled',
        SoS_BG_DATABASE_URL_UNPOOLED: 'postgres://prefixed-direct',
      }),
    ).toEqual({
      databaseUrl: 'postgres://prefixed-pooled',
      databaseUrlUnpooled: 'postgres://prefixed-direct',
    });
  });

  it('accepte les alias POSTGRES et ignore les valeurs vides', () => {
    expect(
      resolveDatabaseUrls({
        DATABASE_URL: '   ',
        DATABASE_URL_UNPOOLED: '',
        SoS_BG_POSTGRES_URL: 'postgres://postgres-pooled',
        SoS_BG_POSTGRES_URL_NON_POOLING: 'postgres://postgres-direct',
      }),
    ).toEqual({
      databaseUrl: 'postgres://postgres-pooled',
      databaseUrlUnpooled: 'postgres://postgres-direct',
    });
  });

  it('utilise la connexion poolée en dernier recours pour les outils locaux', () => {
    expect(resolveDatabaseUrls({ DATABASE_URL: 'postgres://only-url' })).toEqual({
      databaseUrl: 'postgres://only-url',
      databaseUrlUnpooled: 'postgres://only-url',
    });
  });
});
