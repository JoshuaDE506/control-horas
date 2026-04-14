// model/userModel.ts

import { db } from '@/lib/database';

export interface User {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  activo: number;
  creado_en: string | null;
  actualizado_en: string | null;
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
        creado_en,
        actualizado_en
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
    creado_en: user.creado_en ?? null,
    actualizado_en: user.actualizado_en ?? null,
  };
}


