import { randomBytes } from 'node:crypto';
import { copyFile, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const app of ['backend', 'frontend', 'admin', 'mobile-admin']) {
  const dest = path.join(root, app, '.env');
  try { await access(dest); console.log(`${app}/.env existe déjà; conservé.`); continue; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (app === 'backend') {
    let content = await readFile(path.join(root, app, '.env.example'), 'utf8');
    content = content.replace(/^JWT_SECRET=$/m, `JWT_SECRET=${randomBytes(32).toString('hex')}`);
    content = content.replace(/^ADMIN_SEED_PASSWORD=$/m, `ADMIN_SEED_PASSWORD=${randomBytes(18).toString('base64url')}`);
    await writeFile(dest, content, { flag: 'wx', mode: 0o600 });
  } else {
    await copyFile(path.join(root, app, '.env.example'), dest);
  }
  console.log(`${app}/.env créé.`);
}
console.log('Configuration locale prête. Le mot de passe de démonstration se trouve dans backend/.env; ne le commitez pas.');
