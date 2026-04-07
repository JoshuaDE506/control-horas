// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

type DbUser = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  rol: string | null;
  activo: number | string | boolean | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function isActivo(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const normalized = String(value ?? '').toLowerCase().trim();
  return normalized === '1' || normalized === 'true' || normalized === 'activo';
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set('session_user_id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.cookies.get('session_user_id')?.value?.trim();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT id, nombre, apellido, email, rol, activo
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [userId],
    });

    const rows = castRows<DbUser>(result.rows);
    const user = rows[0];

    if (!user || !isActivo(user.activo)) {
      const response = NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );

      clearSessionCookie(response);
      return response;
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: String(user.id),
          nombre: String(user.nombre ?? ''),
          apellido: String(user.apellido ?? ''),
          email: String(user.email ?? ''),
          rol: String(user.rol ?? ''),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/auth/me error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}