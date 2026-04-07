// model/userModel.ts

import { db } from '@/lib/database';

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  activo: number;
  created_at: string | null;
  updated_at: string | null;
}

// 🔹 Ahora sí: trae el usuario REAL desde la tabla `usuarios`
export async function getUserById(id: string): Promise<User | null> {
  const result = await db.execute({
    sql: `
      SELECT
        id,
        nombre,
        apellido,
        email,
        rol,
        activo,
        created_at,
        updated_at
      FROM usuarios
      WHERE id = ?
      LIMIT 1
    `,
    args: [id],
  });

  const rows = result.rows as unknown as User[];
  const user = rows[0];

  if (!user) {
    return null;
  }

  // Por si tu DB devuelve null en fechas
  return {
    ...user,
    created_at: user.created_at ?? null,
    updated_at: user.updated_at ?? null,
  };
}


