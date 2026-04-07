import { createClient } from '@libsql/client';

console.log('URL:', process.env.TURSO_DATABASE_URL);
console.log('TOKEN:', process.env.TURSO_AUTH_TOKEN ? 'OK' : 'MISSING');

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

