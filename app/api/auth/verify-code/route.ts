//api/auth/verify-code/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

type UserRow = {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  reset_code: string | null;
  reset_expires: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizarCode(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function esCodigoValido(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email = normalizarEmail(body?.email);
    const code = normalizarCode(body?.code);

    if (!email || !code) {
      return NextResponse.json(
        { ok: false, error: 'Email y código son obligatorios.' },
        { status: 400 }
      );
    }

    if (!esCodigoValido(code)) {
      return NextResponse.json(
        { ok: false, error: 'El código debe tener 6 dígitos.' },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT id, email, nombre, apellido, reset_code, reset_expires
        FROM usuarios
        WHERE email = ?
        LIMIT 1
      `,
      args: [email],
    });

    const rows = castRows<UserRow>(result.rows);
    const user = rows[0];

    if (!user || !user.reset_code || !user.reset_expires) {
      return NextResponse.json(
        { ok: false, error: 'Código inválido o expirado.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const expiresAt = new Date(user.reset_expires);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      await db.execute({
        sql: `
          UPDATE usuarios
          SET reset_code = NULL,
              reset_expires = NULL,
              updated_at = ?
          WHERE id = ?
        `,
        args: [nowIso, user.id],
      });

      return NextResponse.json(
        { ok: false, error: 'El código ha expirado.' },
        { status: 400 }
      );
    }

    if (String(user.reset_code) !== code) {
      return NextResponse.json(
        { ok: false, error: 'Código incorrecto.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Código válido.',
        data: {
          id: String(user.id),
          email: String(user.email ?? ''),
          nombre: String(user.nombre ?? ''),
          apellido: String(user.apellido ?? ''),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/auth/verify-code error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}