// app/api/proyectos/[id]/tareas/[tareaId]/seleccionar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';
type EstadoTarea = 'todo' | 'in-progress' | 'review' | 'completed';

type TareaRow = {
  id: string;
  estado: string | null;
  max_participantes: number | bigint | null;
  proyecto_id: number | bigint | null;
};

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
  modo_acceso: string | null;
  visibilidad: string | null;
};

type IdRow = {
  id: string;
};

type CountRow = {
  c: number | bigint | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function toProjectId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEstado(raw: unknown): EstadoTarea {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'in-progress' || value === 'in_progress') return 'in-progress';
  if (value === 'review' || value === 'revision' || value === 'revisión') {
    return 'review';
  }
  if (value === 'completed') return 'completed';
  return 'todo';
}

function normalizarModoAcceso(
  rawModo: unknown,
  rawVisibilidad?: unknown
): ModoAccesoProyecto {
  const modo = String(rawModo ?? '').toLowerCase().trim();
  const vis = String(rawVisibilidad ?? '').toLowerCase().trim();

  if (modo === 'publico' || modo === 'público' || modo === 'public') {
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

  if (modo === 'privado' || modo === 'private') {
    return 'privado';
  }

  if (vis === 'publico' || vis === 'público' || vis === 'public') {
    return 'publico';
  }

  return 'privado';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tareaId: string }> }
) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = String(sessionUser.id);
    const { id, tareaId } = await params;
    const proyectoId = toProjectId(id);

    if (proyectoId == null || !tareaId) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 1) Validar tarea + proyecto
    const tRes = await db.execute({
      sql: `
        SELECT
          id,
          estado,
          max_participantes,
          proyecto_id
        FROM tareas
        WHERE id = ?
          AND proyecto_id = ?
        LIMIT 1
      `,
      args: [String(tareaId), proyectoId],
    });

    const tareaRows = castRows<TareaRow>(tRes.rows);
    const tarea = tareaRows[0];

    if (!tarea) {
      return NextResponse.json(
        { ok: false, error: 'Tarea no existe' },
        { status: 404 }
      );
    }

    const estadoTarea = normalizeEstado(tarea.estado);

    if (estadoTarea === 'completed') {
      return NextResponse.json(
        {
          ok: false,
          error: 'No puedes seleccionar una tarea completada',
        },
        { status: 409 }
      );
    }

    if (estadoTarea === 'review') {
      return NextResponse.json(
        {
          ok: false,
          error: 'No puedes seleccionar una tarea que está en review',
        },
        { status: 409 }
      );
    }

    // 2) Validar acceso al proyecto
    const pRes = await db.execute({
      sql: `
        SELECT
          id,
          creador_id,
          modo_acceso,
          visibilidad
        FROM proyectos
        WHERE id = ?
        LIMIT 1
      `,
      args: [proyectoId],
    });

    const proyectoRows = castRows<ProyectoRow>(pRes.rows);
    const proyecto = proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    const isCreator = String(proyecto.creador_id ?? '') === userId;

    const memberRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [proyectoId, userId],
    });

    const isMember = !!memberRes.rows?.length;

    const modoAcceso = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    let canAccess = false;
    let canRequestAccess = false;

    if (modoAcceso === 'publico') {
      canAccess = true;
    } else if (modoAcceso === 'solicitud') {
      canAccess = isCreator || isMember;
      canRequestAccess = !canAccess;
    } else {
      canAccess = isCreator || isMember;
    }

    if (!canAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            modoAcceso === 'solicitud'
              ? 'Requiere aprobación'
              : 'Sin acceso a este proyecto',
          canRequestAccess,
        },
        { status: 403 }
      );
    }

    const maxParticipantes =
      Number(tarea.max_participantes ?? 1) > 0
        ? Number(tarea.max_participantes ?? 1)
        : 1;

    // 3) Si ya está activo, respuesta idempotente
    const yaActivoRes = await db.execute({
      sql: `
        SELECT id
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
          AND estado = 'activo'
        LIMIT 1
      `,
      args: [String(tareaId), userId],
    });

    const yaActivoRows = castRows<IdRow>(yaActivoRes.rows);
    const asignacionActiva = yaActivoRows[0];

    if (asignacionActiva) {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET selected_at = ?
          WHERE id = ?
        `,
        args: [now, String(asignacionActiva.id)],
      });

      const activosRes = await db.execute({
        sql: `
          SELECT COUNT(*) AS c
          FROM tarea_asignaciones
          WHERE tarea_id = ?
            AND estado = 'activo'
        `,
        args: [String(tareaId)],
      });

      const activosRows = castRows<CountRow>(activosRes.rows);
      const activos = Number(activosRows[0]?.c ?? 0);

      const payload = {
        ya_estaba_activo: true,
        activos,
        max_participantes: maxParticipantes,
      };

      return NextResponse.json(
        {
          ok: true,
          data: payload,
          ...payload,
        },
        { status: 200 }
      );
    }

    // 4) Recontar cupo
    const countRes = await db.execute({
      sql: `
        SELECT COUNT(*) AS c
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND estado = 'activo'
      `,
      args: [String(tareaId)],
    });

    const countRows = castRows<CountRow>(countRes.rows);
    const activos = Number(countRows[0]?.c ?? 0);

    if (activos >= maxParticipantes) {
      return NextResponse.json(
        { ok: false, error: 'Cupo lleno' },
        { status: 409 }
      );
    }

    // 5) Buscar asignación previa para reactivarla
    const previaRes = await db.execute({
      sql: `
        SELECT id
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        ORDER BY created_at DESC
        LIMIT 1
      `,
      args: [String(tareaId), userId],
    });

    const previaRows = castRows<IdRow>(previaRes.rows);
    const asignacionPrevia = previaRows[0];

    if (asignacionPrevia) {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET estado = 'activo',
              selected_at = ?,
              started_at = NULL,
              completed_at = NULL,
              canceled_at = NULL
          WHERE id = ?
        `,
        args: [now, String(asignacionPrevia.id)],
      });

      const activosLuegoRes = await db.execute({
        sql: `
          SELECT COUNT(*) AS c
          FROM tarea_asignaciones
          WHERE tarea_id = ?
            AND estado = 'activo'
        `,
        args: [String(tareaId)],
      });

      const activosLuegoRows = castRows<CountRow>(activosLuegoRes.rows);
      const activosLuego = Number(activosLuegoRows[0]?.c ?? 0);

      const payload = {
        reactivada: true,
        activos: activosLuego,
        max_participantes: maxParticipantes,
      };

      return NextResponse.json(
        {
          ok: true,
          data: payload,
          ...payload,
        },
        { status: 200 }
      );
    }

    // 6) Crear nueva asignación
    await db.execute({
      sql: `
        INSERT INTO tarea_asignaciones (
          id,
          tarea_id,
          usuario_id,
          rol,
          estado,
          created_at,
          selected_at
        )
        VALUES (?, ?, ?, 'miembro', 'activo', ?, ?)
      `,
      args: [randomUUID(), String(tareaId), userId, now, now],
    });

    const activosFinalRes = await db.execute({
      sql: `
        SELECT COUNT(*) AS c
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND estado = 'activo'
      `,
      args: [String(tareaId)],
    });

    const activosFinalRows = castRows<CountRow>(activosFinalRes.rows);
    const activosFinal = Number(activosFinalRows[0]?.c ?? 0);

    const payload = {
      activos: activosFinal,
      max_participantes: maxParticipantes,
    };

    return NextResponse.json(
      {
        ok: true,
        data: payload,
        ...payload,
      },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = e?.message ?? String(e);

    if (
      msg.toLowerCase().includes('unique') ||
      msg.toLowerCase().includes('constraint')
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Ya tienes una selección activa o el cupo fue ocupado al mismo tiempo',
        },
        { status: 409 }
      );
    }

    console.error('POST seleccionar error:', e);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}