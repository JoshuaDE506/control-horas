// horaslaborales/services/services.ts

import bcrypt from 'bcryptjs';
import { db } from '@/lib/database';
import { User } from '@/model/userModel';

/**
 * =========================================================
 * 🔐 VALIDAR USUARIO
 * =========================================================
 * Valida las credenciales de un usuario utilizando:
 *
 * - Correo electrónico
 * - Contraseña
 * - Estado activo del usuario
 *
 * La contraseña almacenada en la base de datos está
 * encriptada mediante bcrypt, por lo que debe utilizarse
 * bcrypt.compare() para comprobarla.
 *
 * Retorna:
 * - User → si las credenciales son correctas.
 * - null → si el usuario no existe, está desactivado
 *          o la contraseña es incorrecta.
 */
export async function validateUser(
  email: string,
  password: string
): Promise<User | null> {
  try {
    /**
     * =====================================================
     * 🔎 BUSCAR USUARIO POR CORREO
     * =====================================================
     * El correo se normaliza para evitar problemas por:
     *
     * - Espacios accidentales.
     * - Uso de mayúsculas/minúsculas.
     */
    const normalizedEmail = email.trim().toLowerCase();

    const result = await db.execute({
      sql: `
        SELECT 
          id,
          nombre,
          apellido,
          email,
          password,
          rol,
          activo,
          creado_en,
          actualizado_en
        FROM usuarios
        WHERE email = ?
        LIMIT 1
      `,
      args: [normalizedEmail],
    });

    /**
     * =====================================================
     * ❌ USUARIO NO ENCONTRADO
     * =====================================================
     */
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;

    /**
     * =====================================================
     * 🚫 VALIDAR ESTADO DEL USUARIO
     * =====================================================
     * Solo los usuarios con activo = 1 pueden autenticarse.
     *
     * Number() permite manejar correctamente valores
     * devueltos por la base de datos como 1, "1", etc.
     */
    if (Number(row.activo ?? 0) !== 1) {
      return null;
    }

    /**
     * =====================================================
     * 🔑 VALIDAR CONTRASEÑA
     * =====================================================
     * Las contraseñas se almacenan utilizando bcrypt.
     *
     * Nunca debe compararse:
     *
     * row.password === password
     *
     * porque row.password contiene el hash generado
     * durante el registro o cambio de contraseña.
     */
    const passwordOk = await bcrypt.compare(
      password,
      String(row.password)
    );

    if (!passwordOk) {
      return null;
    }

    /**
     * =====================================================
     * 👤 CONSTRUIR OBJETO USUARIO
     * =====================================================
     * No se devuelve la contraseña al resto del sistema.
     */
    const user: User = {
      id: String(row.id),
      nombre: String(row.nombre ?? ''),
      apellido: String(row.apellido ?? ''),
      email: String(row.email ?? ''),
      rol: String(row.rol ?? 'colaborador'),
      activo: Number(row.activo ?? 0),

      // Las fechas pueden ser null en la base de datos.
      creado_en:
        row.creado_en !== null && row.creado_en !== undefined
          ? String(row.creado_en)
          : null,

      actualizado_en:
        row.actualizado_en !== null && row.actualizado_en !== undefined
          ? String(row.actualizado_en)
          : null,
    };

    return user;
  } catch (error) {
    /**
     * =====================================================
     * ⚠️ ERROR INTERNO
     * =====================================================
     * Si ocurre un error de conexión con Turso o alguna
     * excepción inesperada, evitamos que la aplicación
     * falle completamente.
     */
    console.error('validateUser error:', error);

    return null;
  }
}