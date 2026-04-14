// app/api/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type UserRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function sanitizarTexto(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  return value.trim();
}

// ==================== GET /api/user ====================
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser(request);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT id, nombre, apellido, email
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [sessionUser.id],
    });

    const rows = castRows<UserRow>(result.rows);
    const row = rows[0];

    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const user = {
      id: String(row.id),
      nombre: String(row.nombre ?? ''),
      apellido: String(row.apellido ?? ''),
      email: String(row.email ?? ''),
    };

    return NextResponse.json(
      { ok: true, data: user },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en GET /api/user:', error);
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ==================== PUT /api/user ====================
export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser(request);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const currentResult = await db.execute({
      sql: `
        SELECT id, nombre, apellido, email
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [sessionUser.id],
    });

    const currentRows = castRows<UserRow>(currentResult.rows);
    const currentRow = currentRows[0];

    if (!currentRow) {
      return NextResponse.json(
        { ok: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const nombreInput = sanitizarTexto(body?.nombre);
    const apellidoInput = sanitizarTexto(body?.apellido);

    if (
      body?.nombre !== undefined &&
      (!nombreInput || nombreInput.length === 0)
    ) {
      return NextResponse.json(
        { ok: false, error: 'El nombre no puede estar vacío' },
        { status: 400 }
      );
    }

    if (
      body?.apellido !== undefined &&
      (!apellidoInput || apellidoInput.length === 0)
    ) {
      return NextResponse.json(
        { ok: false, error: 'El apellido no puede estar vacío' },
        { status: 400 }
      );
    }

    const nuevoNombre = nombreInput ?? String(currentRow.nombre ?? '');
    const nuevoApellido = apellidoInput ?? String(currentRow.apellido ?? '');

    await db.execute({
      sql: `
        UPDATE usuarios
        SET nombre = ?, apellido = ?, actualizado_en = datetime('now')
        WHERE id = ?
      `,
      args: [nuevoNombre, nuevoApellido, sessionUser.id],
    });

    const updatedResult = await db.execute({
      sql: `
        SELECT id, nombre, apellido, email
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [sessionUser.id],
    });

    const updatedRows = castRows<UserRow>(updatedResult.rows);
    const updatedRow = updatedRows[0];

    if (!updatedRow) {
      return NextResponse.json(
        { ok: false, error: 'Usuario actualizado no encontrado' },
        { status: 500 }
      );
    }

    const updatedUser = {
      id: String(updatedRow.id),
      nombre: String(updatedRow.nombre ?? ''),
      apellido: String(updatedRow.apellido ?? ''),
      email: String(updatedRow.email ?? ''),
    };

    return NextResponse.json(
      { ok: true, data: updatedUser, message: 'Perfil actualizado correctamente' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error en PUT /api/user:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al actualizar el perfil' },
      { status: 500 }
    );
  }
}