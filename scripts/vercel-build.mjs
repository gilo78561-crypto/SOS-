import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args) {
  const result = spawnSync(npm, args, {
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.RUN_DATABASE_MIGRATIONS === 'true') {
  console.log('Initialisation contrôlée de la base de données...');
  run(['run', 'db:seed']);
}

run(['run', 'build', '--workspace=@sos/web']);
