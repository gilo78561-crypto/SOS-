import 'reflect-metadata';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { schema, type Tables } from './schema-v1';
import { Initial1793059200000 } from './migration';
import { AuditDetail, AuditDetails1793059200001 } from './audit-details';
import { production, validateConfig } from './config';
export class Database {
  source: DataSource;
  geo = false;
  constructor(url = process.env.DATABASE_URL) {
    this.source = new DataSource({
      type: 'postgres',
      url,
      entities: [...Object.values(schema), AuditDetail],
      migrations: [Initial1793059200000, AuditDetails1793059200001],
      synchronize: false,
      logging: false,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
      extra: { max: 10 },
    });
  }
  async connect(migrate = !production) {
    validateConfig();
    await this.source.initialize();
    if (migrate) await this.source.runMigrations();
    this.geo = (await this.source.query("SELECT 1 FROM pg_extension WHERE extname='postgis'")).length > 0;
    if (production && !this.geo) throw new Error('PostGIS obligatoire en production.');
    return this;
  }
  repo<K extends keyof Tables>(name: K, em?: EntityManager): Repository<Tables[K]> {
    return (em ?? this.source.manager).getRepository(schema[name]) as Repository<Tables[K]>;
  }
  async close() {
    if (this.source.isInitialized) await this.source.destroy();
  }
}
