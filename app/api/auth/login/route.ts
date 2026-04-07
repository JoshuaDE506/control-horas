// app/api/auth/login/route.ts
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

type DbUserRow = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol: string;
  activo: number | null;
};

type SesionRow = {
  id: string;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const email =
      typeof body?.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';

    const password =
      typeof body?.password === 'string'
        ? body.password
        : '';

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Email y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT id, nombre, apellido, email, password, rol, activo
        FROM usuarios
        WHERE email = ?
        LIMIT 1
      `,
      args: [email],
    });

    const rows = castRows<DbUserRow>(result.rows);
    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    if (Number(user.activo ?? 0) !== 1) {
      return NextResponse.json(
        { ok: false, error: 'Usuario desactivado' },
        { status: 403 }
      );
    }

    const passwordOk = await bcrypt.compare(password, user.password);

    if (!passwordOk) {
      return NextResponse.json(
        { ok: false, error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const sessionResult = await db.execute({
      sql: `
        SELECT id
        FROM sesiones_trabajo
        WHERE usuario_id = ? AND fin IS NULL
        LIMIT 1
      `,
      args: [user.id],
    });

    const openSessions = castRows<SesionRow>(sessionResult.rows);

    if (!openSessions[0]) {
      const now = new Date().toISOString();
      const sessionId = randomUUID();

      await db.execute({
        sql: `
          INSERT INTO sesiones_trabajo (
            id,
            usuario_id,
            inicio,
            fin,
            updated_at
          )
          VALUES (?, ?, ?, NULL, ?)
        `,
        args: [sessionId, user.id, now, now],
      });
    }

    const response = NextResponse.json(
      {
        ok: true,
        message: 'Login exitoso',
        data: {
          id: user.id,
          nombre: user.nombre,
          apellido: user.apellido,
          email: user.email,
          rol: user.rol,
        },
      },
      { status: 200 }
    );

    response.cookies.set('session_user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error('POST /api/auth/login error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}