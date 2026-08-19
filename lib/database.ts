// horaslaborales/lib/database.ts

import { createClient } from '@libsql/client';

/**
 * =========================================================
 * 🗄️ CONEXIÓN A LA BASE DE DATOS TURSO
 * =========================================================
 *
 * Se crea una instancia reutilizable del cliente de Turso.
 *
 * Las credenciales se obtienen desde las variables
 * de entorno configuradas localmente y en Vercel:
 *
 * - TURSO_DATABASE_URL
 * - TURSO_AUTH_TOKEN
 *
 * No se imprimen estas variables en consola para evitar
 * exponer información sensible en los logs del servidor.
 */
export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

