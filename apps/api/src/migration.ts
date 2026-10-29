import { Table, TableForeignKey, type MigrationInterface, type QueryRunner } from 'typeorm';
import { schema } from './schema-v1';
// Frozen v1 definition: future changes require a new migration and schema version.
export class Initial1793059200000 implements MigrationInterface {
  name = 'Initial1793059200000';
  async up(q: QueryRunner) {
    await q.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    for (const e of Object.values(schema)) {
      const columns = Object.entries(e.options.columns).map(([name, opt]) => ({
        name,
        type: String(opt.type),
        isPrimary: !!opt.primary,
        isNullable: !!opt.nullable,
        isUnique: !!opt.unique,
        default: opt.generated
          ? 'gen_random_uuid()'
          : typeof opt.default === 'function'
            ? opt.default()
            : opt.default,
      }));
      await q.createTable(new Table({ name: e.options.tableName!, columns }));
    }
    const links: Record<string, Record<string, string>> = {
      professionals: { userId: 'users' },
      beneficiaries: { ownerId: 'users' },
      cares: {
        clientId: 'users',
        beneficiaryId: 'beneficiaries',
        serviceId: 'services',
        professionalId: 'professionals',
      },
      care_events: { careId: 'cares', actorId: 'users' },
      invoices: { careId: 'cares', clientId: 'users' },
      payments: { invoiceId: 'invoices', userId: 'users' },
      availabilities: { professionalId: 'professionals' },
      notifications: { userId: 'users' },
      tickets: { userId: 'users' },
      audits: { actorId: 'users' },
      consultations: { careId: 'cares' },
      documents: { userId: 'users' },
      sessions: { userId: 'users' },
      password_resets: { userId: 'users' },
      consents: { userId: 'users' },
      assignments: { careId: 'cares', professionalId: 'professionals', actorId: 'users' },
      notes: { careId: 'cares', authorId: 'users' },
      payment_events: { paymentId: 'payments' },
      refunds: { paymentId: 'payments', actorId: 'users' },
      notification_deliveries: { notificationId: 'notifications' },
      preferences: { userId: 'users' },
    };
    for (const [table, cols] of Object.entries(links))
      for (const [column, target] of Object.entries(cols)) {
        await q.createForeignKey(
          table,
          new TableForeignKey({
            columnNames: [column],
            referencedTableName: target,
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        );
        await q.query(
          'CREATE INDEX "' + table + '_' + column + '_idx" ON "' + table + '" ("' + column + '")',
        );
      }
    await q.query(
      "ALTER TABLE users ADD CONSTRAINT users_role CHECK (role IN ('client','doctor','nurse','operator','admin'))",
    );
    await q.query(
      "ALTER TABLE professionals ADD CONSTRAINT professional_verification CHECK (verification IN ('pending','approved','rejected'))",
    );
    await q.query(
      'ALTER TABLE cares ADD CONSTRAINT care_time CHECK ("endAt">"startAt"), ADD CONSTRAINT care_amount CHECK (estimate IS NULL OR estimate>=0)',
    );
    await q.query('ALTER TABLE availabilities ADD CONSTRAINT availability_time CHECK ("endAt">"startAt")');
    await q.query("ALTER TABLE invoices ADD CONSTRAINT invoice_amount CHECK (amount>=0 AND currency='XOF')");
    await q.query("ALTER TABLE payments ADD CONSTRAINT payment_amount CHECK (amount>=0 AND currency='XOF')");
    await q.query('CREATE UNIQUE INDEX payment_idempotency ON payments ("userId","idempotencyKey")');
    await q.query(
      'CREATE UNIQUE INDEX one_pending_payment ON payments ("invoiceId") WHERE status=\'pending\'',
    );
    await q.query('CREATE UNIQUE INDEX one_active_assignment ON assignments ("careId") WHERE active=true');
    await q.query(
      'ALTER TABLE cares ADD CONSTRAINT no_double_booking EXCLUDE USING gist ("professionalId" WITH =, tstzrange("startAt","endAt",\'[)\') WITH &&) WHERE ("professionalId" IS NOT NULL AND status NOT IN (\'completed\',\'cancelled\',\'failed\'))',
    );
    await q.query('CREATE INDEX care_queue ON cares (status,"startAt")');
    const available = (await q.query(
      "SELECT 1 FROM pg_available_extensions WHERE name='postgis'",
    )) as unknown[];
    if (available.length) {
      await q.query('CREATE EXTENSION IF NOT EXISTS postgis');
      await q.query(
        'ALTER TABLE professionals ADD COLUMN location geography(Point,4326) GENERATED ALWAYS AS (CASE WHEN longitude IS NOT NULL AND latitude IS NOT NULL THEN ST_SetSRID(ST_MakePoint(longitude,latitude),4326)::geography END) STORED',
      );
      await q.query('CREATE INDEX professional_geo ON professionals USING gist(location)');
    }
  }
  async down(q: QueryRunner) {
    for (const e of Object.values(schema).reverse())
      await q.dropTable(e.options.tableName!, true, true, true);
  }
}
