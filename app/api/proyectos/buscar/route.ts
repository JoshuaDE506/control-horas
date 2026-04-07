// app/api/proyectos/buscar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type ModoAcceso = 'publico' | 'solicitud' | 'privado';

type ProyectoRow = {
  id: number | bigint;
  nombre?: string | null;
  descripcion?: string | null;
  creador_id?: string | null;
  estado?: string | null;
  codigo_union?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  modo_acceso?: string | null;
  visibilidad?: string | null;
  prioridad?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  configuracion?: string | null;
  last_activity_at?: string | null;
  permiso_editar_proyecto?: string | null;
  permiso_gestionar_tareas?: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarModoAcceso(row: {
  modo_acceso?: unknown;
  visibilidad?: unknown;
}): ModoAcceso {
  const rawModo = String(row?.modo_acceso ?? '').toLowerCase().trim();
  const rawVisibilidad = String(row?.visibilidad ?? '').toLowerCase().trim();

  if (
    rawModo === 'publico' ||
    rawModo === 'público' ||
    rawModo === 'public'
  ) {
    return 'publico';
  }

  if (
    rawModo === 'solicitud' ||
    rawModo === 'request' ||
    rawModo === 'invitacion' ||
    rawModo === 'invitación' ||
    rawModo === 'invite'
  ) {
    return 'solicitud';
  }

  if (rawModo === 'privado' || rawModo === 'private') {
    return 'privado';
  }

  if (
    rawVisibilidad === 'publico' ||
    rawVisibilidad === 'público' ||
    rawVisibilidad === 'public'
  ) {
    return 'publico';
  }

  return 'privado';
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return NaN;
  }

  return parsed;
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

    const rawPage = req.nextUrl.searchParams.get('page');
    const rawLimit = req.nextUrl.searchParams.get('limit');

    const parsedPage = parsePositiveInt(rawPage, 1);
    const parsedLimit = parsePositiveInt(rawLimit, 20);

    if (Number.isNaN(parsedPage)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'El parámetro page debe ser un entero mayor o igual a 1',
        },
        { status: 400 }
      );
    }

    if (Number.isNaN(parsedLimit)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'El parámetro limit debe ser un entero mayor o igual a 1',
        },
        { status: 400 }
      );
    }

    const page = parsedPage;
    const limit = Math.min(50, parsedLimit);
    const offset = (page - 1) * limit;

    const result = await db.execute({
      sql: `
        SELECT p.*
        FROM proyectos p
        WHERE
          LOWER(COALESCE(p.visibilidad, 'privado')) = 'publico'
          AND CAST(p.creador_id AS TEXT) <> CAST(? AS TEXT)
          AND NOT EXISTS (
            SELECT 1
            FROM proyecto_usuarios pu
            WHERE pu.proyecto_id = p.id
              AND CAST(pu.usuario_id AS TEXT) = CAST(? AS TEXT)
          )
        ORDER BY p.created_at DESC
        LIMIT ?
        OFFSET ?;
      `,
      args: [String(sessionUser.id), String(sessionUser.id), limit, offset],
    });

    const rows = castRows<ProyectoRow>(result.rows);

    const proyectos = rows.map((row) => ({
      ...row,
      id: Number(row.id),
      modo_acceso: normalizarModoAcceso(row),
    }));

    return NextResponse.json(
      {
        ok: true,
        data: proyectos,
        proyectos,
        page,
        limit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/proyectos/buscar error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al buscar proyectos' },
      { status: 500 }
    );
  }
}