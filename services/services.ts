import { db } from '@/lib/database';
import { User } from '@/model/userModel';

export async function validateUser(
  email: string,
  password: string
): Promise<User | null> {
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
        created_at,
        updated_at
      FROM usuarios
      WHERE email = ?
      LIMIT 1
    `,
    args: [email],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0] as any;

  // ❌ Usuario desactivado
  if (row.activo !== 1) return null;

  // ⚠️ Password en texto plano (por ahora)
  if (row.password !== password) return null;

  const user: User = {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    email: row.email,
    rol: row.rol,
    activo: row.activo,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  return user;
}
