// app/api/user/perfil/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type UserRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  country: string | null;
  phone_full: string | null;
  rol: string | null;
  puesto: string | null;
  activo: number | string | boolean | null;
  created_at: string | null;
};

type StatsRow = {
  proyectos_creados: number | bigint | null;
  proyectos_miembro: number | bigint | null;
  tareas_seleccionadas: number | bigint | null;
  tareas_en_proceso: number | bigint | null;
  tareas_completadas: number | bigint | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarActivo(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const v = String(value ?? '').toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'activo';
}

function normalizarRol(raw: unknown): 'jefe' | 'admin' | 'colaborador' {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'jefe') return 'jefe';
  if (value === 'admin') return 'admin';
  return 'colaborador';
}

function normalizarTexto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    const userId = String(sessionUser.id);

    const userRes = await db.execute({
      sql: `
        SELECT
          id,
          nombre,
          apellido,
          email,
          country,
          phone_full,
          rol,
          puesto,
          activo,
          created_at
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [userId],
    });

    const userRows = castRows<UserRow>(userRes.rows);
    const userRow = userRows[0];

    if (!userRow) {
      return NextResponse.json(
        { ok: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const statsRes = await db.execute({
      sql: `
        SELECT
          (
            SELECT COUNT(*)
            FROM proyectos p
            WHERE CAST(p.creador_id AS TEXT) = CAST(? AS TEXT)
          ) AS proyectos_creados,

          (
            SELECT COUNT(DISTINCT pu.proyecto_id)
            FROM proyecto_usuarios pu
            WHERE CAST(pu.usuario_id AS TEXT) = CAST(? AS TEXT)
              AND LOWER(COALESCE(pu.rol_en_proyecto, '')) IN ('admin', 'miembro')
          ) AS proyectos_miembro,

          (
            SELECT COUNT(DISTINCT ta.tarea_id)
            FROM tarea_asignaciones ta
            WHERE CAST(ta.usuario_id AS TEXT) = CAST(? AS TEXT)
          ) AS tareas_seleccionadas,

          (
            SELECT COUNT(DISTINCT ta.tarea_id)
            FROM tarea_asignaciones ta
            JOIN tareas t ON CAST(t.id AS TEXT) = CAST(ta.tarea_id AS TEXT)
            WHERE CAST(ta.usuario_id AS TEXT) = CAST(? AS TEXT)
              AND LOWER(COALESCE(t.estado, '')) = 'in-progress'
          ) AS tareas_en_proceso,

          (
            SELECT COUNT(DISTINCT ta.tarea_id)
            FROM tarea_asignaciones ta
            JOIN tareas t ON CAST(t.id AS TEXT) = CAST(ta.tarea_id AS TEXT)
            WHERE CAST(ta.usuario_id AS TEXT) = CAST(? AS TEXT)
              AND LOWER(COALESCE(t.estado, '')) = 'completed'
          ) AS tareas_completadas
      `,
      args: [userId, userId, userId, userId, userId],
    });

    const statsRows = castRows<StatsRow>(statsRes.rows);
    const statsRow = statsRows[0] ?? {
      proyectos_creados: 0,
      proyectos_miembro: 0,
      tareas_seleccionadas: 0,
      tareas_en_proceso: 0,
      tareas_completadas: 0,
    };

    return NextResponse.json(
      {
        ok: true,
        data: {
          user: {
            id: String(userRow.id),
            nombre: String(userRow.nombre ?? ''),
            apellido: String(userRow.apellido ?? ''),
            email: String(userRow.email ?? ''),
            pais: userRow.country ?? null,
            telefono: userRow.phone_full ?? null,
            rol: normalizarRol(userRow.rol),
            puesto: userRow.puesto ?? null,
            activo: normalizarActivo(userRow.activo),
            created_at: userRow.created_at ?? null,
          },
          stats: {
            proyectos_creados: Number(statsRow.proyectos_creados ?? 0),
            proyectos_miembro: Number(statsRow.proyectos_miembro ?? 0),
            tareas_seleccionadas: Number(statsRow.tareas_seleccionadas ?? 0),
            tareas_en_proceso: Number(statsRow.tareas_en_proceso ?? 0),
            tareas_completadas: Number(statsRow.tareas_completadas ?? 0),
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/user/perfil error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al cargar el perfil' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = String(sessionUser.id);
    const body = await req.json();

    const nombre = normalizarTexto(body?.nombre);
    const apellido = normalizarTexto(body?.apellido);
    const email = normalizarTexto(body?.email).toLowerCase();
    const pais = normalizarTexto(body?.pais);
    const telefono = normalizarTexto(body?.telefono);

    if (!nombre) {
      return NextResponse.json(
        { ok: false, error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    if (!apellido) {
      return NextResponse.json(
        { ok: false, error: 'El apellido es requerido' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'El correo es requerido' },
        { status: 400 }
      );
    }

    if (!esEmailValido(email)) {
      return NextResponse.json(
        { ok: false, error: 'El correo no es válido' },
        { status: 400 }
      );
    }

    const emailRes = await db.execute({
      sql: `
        SELECT id
        FROM usuarios
        WHERE LOWER(COALESCE(email, '')) = LOWER(?)
          AND CAST(id AS TEXT) <> CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [email, userId],
    });

    if (emailRes.rows && emailRes.rows.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'Ese correo ya está en uso por otro usuario' },
        { status: 400 }
      );
    }

    await db.execute({
      sql: `
        UPDATE usuarios
        SET
          nombre = ?,
          apellido = ?,
          email = ?,
          country = ?,
          phone_full = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [
        nombre,
        apellido,
        email,
        pais || null,
        telefono || null,
        userId,
      ],
    });

    return NextResponse.json({
      ok: true,
      message: 'Perfil actualizado correctamente',
    });
  } catch (error) {
    console.error('PATCH /api/user/perfil error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al actualizar el perfil' },
      { status: 500 }
    );
  }
}