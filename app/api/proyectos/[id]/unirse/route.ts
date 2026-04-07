// app/api/proyectos/[id]/unirse/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type ProyectoJoinRow = {
  id: number | bigint;
  visibilidad: string | null;
  modo_acceso: string | null;
  creador_id: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarModoAcceso(
  modoAcceso: unknown,
  visibilidad?: unknown
): 'publico' | 'solicitud' | 'privado' {
  const modo = String(modoAcceso ?? '').toLowerCase().trim();
  const vis = String(visibilidad ?? '').toLowerCase().trim();

  if (
    modo === 'publico' ||
    modo === 'público' ||
    modo === 'public'
  ) {
    return 'publico';
  }

  if (
    modo === 'solicitud' ||
    modo === 'request' ||
    modo === 'invitacion' ||
    modo === 'invitación' ||
    modo === 'invite'
  ) {
    return 'solicitud';
  }

  if (
    vis === 'publico' ||
    vis === 'público' ||
    vis === 'public'
  ) {
    return 'publico';
  }

  return 'privado';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const proyectoId = Number(id);

    if (!Number.isFinite(proyectoId)) {
      return NextResponse.json(
        { ok: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    // 1) Verificar proyecto y modo
    const pRes = await db.execute({
      sql: `
        SELECT id, visibilidad, modo_acceso, creador_id
        FROM proyectos
        WHERE id = ?
        LIMIT 1;
      `,
      args: [proyectoId],
    });

    const proyectoRows = castRows<ProyectoJoinRow>(pRes.rows);
    const proyecto = proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    const modo = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    // Solo público permite unirse directo
    if (modo !== 'publico') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Este proyecto no permite unirse directamente',
        },
        { status: 400 }
      );
    }

    // Si es creador, ya está dentro
    if (String(proyecto.creador_id) === String(sessionUser.id)) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            already: true,
            joined: false,
          },
          already: true,
          joined: false,
        },
        { status: 200 }
      );
    }

    // Si ya es miembro, responder como already
    const memberRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1;
      `,
      args: [proyectoId, String(sessionUser.id)],
    });

    if (memberRes.rows?.length) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            already: true,
            joined: false,
          },
          already: true,
          joined: false,
        },
        { status: 200 }
      );
    }

    const ahora = new Date().toISOString();

    // 2) Insertar miembro con tipo_union
    await db.execute({
      sql: `
        INSERT OR IGNORE INTO proyecto_usuarios
          (proyecto_id, usuario_id, rol_en_proyecto, fecha_union, tipo_union)
        VALUES
          (?, ?, 'miembro', ?, 'publico');
      `,
      args: [proyectoId, String(sessionUser.id), ahora],
    });

    return NextResponse.json(
      {
        ok: true,
        message: 'Te uniste al proyecto correctamente',
        data: {
          already: false,
          joined: true,
        },
        already: false,
        joined: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/proyectos/[id]/unirse error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}