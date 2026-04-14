// app/api/user/buscar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type UsuarioBusquedaRow = {
  id: string | number;
  nombre: string | null;
  apellido: string | null;
  nombreCompleto: string | null;
  email: string | null;
  pais: string | null;
  rol: string | null;
  activo: number | bigint | null;
  puesto: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function toBoolActivo(value: number | bigint | null): boolean {
  if (value == null) return false;
  return Number(value) === 1;
}

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') ?? '').trim();

    if (q.length < 2) {
      return NextResponse.json(
        { ok: true, data: [], usuarios: [] },
        { status: 200 }
      );
    }

    const qLower = q.toLowerCase();

    const result = await db.execute({
      sql: `
        SELECT
          id,
          nombre,
          apellido,
          TRIM(COALESCE(nombre, '') || ' ' || COALESCE(apellido, '')) AS nombreCompleto,
          email,
          pais AS pais,
          rol,
          activo,
          puesto
        FROM usuarios
        WHERE
          CAST(id AS TEXT) = CAST(? AS TEXT)
          OR LOWER(COALESCE(nombre, '')) LIKE ?
          OR LOWER(COALESCE(apellido, '')) LIKE ?
          OR LOWER(TRIM(COALESCE(nombre, '') || ' ' || COALESCE(apellido, ''))) LIKE ?
          OR LOWER(COALESCE(email, '')) LIKE ?
        ORDER BY nombre ASC, apellido ASC
        LIMIT 20
      `,
      args: [
        String(q),
        `%${qLower}%`,
        `%${qLower}%`,
        `%${qLower}%`,
        `%${qLower}%`,
      ],
    });

    const rows = castRows<UsuarioBusquedaRow>(result.rows);

    const usuarios = rows
      .map((row) => {
        const nombre = String(row.nombre ?? '').trim();
        const apellido = String(row.apellido ?? '').trim();
        const nombreCompleto =
          String(row.nombreCompleto ?? '').trim() ||
          `${nombre} ${apellido}`.trim();

        return {
          id: String(row.id),
          nombre,
          apellido,
          nombreCompleto,
          email: String(row.email ?? '').trim(),
          pais: row.pais ?? null,
          rol: row.rol ? String(row.rol) : null,
          activo: toBoolActivo(row.activo),
          puesto: row.puesto ?? null,
        };
      })
      .filter((u) => String(u.id) !== String(sessionUser.id));

    return NextResponse.json(
      {
        ok: true,
        data: usuarios,
        usuarios,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/user/buscar error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al buscar usuarios' },
      { status: 500 }
    );
  }
}