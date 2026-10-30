import { databaseUrlUnpooled } from './config';
import { Database } from './database';
import { seed } from './seed';
import { hashPassword } from './crypto';
import { emailSchema, passwordSchema } from '@sos/contracts';
import { z } from 'zod';
async function main() {
  const db = await new Database(databaseUrlUnpooled).connect(true);
  try {
    const command = process.argv[2];
    if (command === 'seed') await seed(db);
    if (command === 'bootstrap-admin' || command === 'bootstrap-operator') {
      const values = z
        .object({
          name: z.string().min(2).max(100),
          email: emailSchema,
          password: passwordSchema,
          phone: z.string().regex(/^\+22901\d{8}$/),
        })
        .parse({
          name: process.env.ADMIN_NAME,
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
          phone: process.env.ADMIN_PHONE,
        });
      const role = command === 'bootstrap-admin' ? 'admin' : 'operator';
      if (role === 'admin' && (await db.repo('users').countBy({ role: 'admin' })))
        throw new Error('Un administrateur existe déjà. Bootstrap refusé.');
      if (await db.repo('users').findOneBy({ email: values.email }))
        throw new Error('Ce compte existe déjà.');
      const passwordHash = await hashPassword(values.password);
      await db.source.transaction(async (em) => {
        const u = await db.repo('users', em).save({
          name: values.name,
          email: values.email,
          phone: values.phone,
          passwordHash,
          role,
          suspended: false,
        });
        await db
          .repo('preferences', em)
          .save({ userId: u.id, email: false, sms: false, push: false, pushToken: null });
        await db
          .repo('audits', em)
          .save({ actorId: null, action: 'account.bootstrap_' + role, resourceId: u.id });
      });
      console.log('Compte ' + role + ' créé. Aucun secret affiché.');
    }
    console.log('Migrations terminées. PostGIS : ' + db.geo);
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Échec');
  process.exit(1);
});
