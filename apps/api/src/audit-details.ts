import { EntitySchema, type MigrationInterface, type QueryRunner } from 'typeorm';
import { encrypted } from './crypto';
export const AuditDetail = new EntitySchema<{ id: string; auditId: string; content: string }>({
  name: 'audit_details',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    auditId: { type: 'uuid', unique: true },
    content: { type: 'text', transformer: encrypted },
  },
});
export class AuditDetails1793059200001 implements MigrationInterface {
  name = 'AuditDetails1793059200001';
  async up(q: QueryRunner) {
    await q.query(
      'CREATE TABLE audit_details(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"auditId" uuid NOT NULL UNIQUE REFERENCES audits(id),content text NOT NULL)',
    );
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE audit_details');
  }
}
