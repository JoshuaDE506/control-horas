// app/api/proyectos/[id]/tareas/[tareaId]/completar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getUserIdFromRequest } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';
type EstadoTarea = 'todo' | 'in-progress' | 'review' | 'completed';

type ProyectoRow = {
  id: number | bigint | null;
  visibilidad: string | null;
  modo_acceso: string | null;
  creador_id: string | null;
};

type TareaRow = {
  id: string;
  estado: string | null;
};

type AsignacionRow = {
  id: string;
  started_at: string | null;
  completed_at: string | null;
};

type RegistroHorasRow = {
  id: string;
  started_at: string | null;
  paused_at: string | null;
  stopped_at: string | null;
  total_seconds: number | bigint | null;
  estado: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function toProjectId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value: number | bigint | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'bigint' ? Number(value) : Number(value);
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

  if (modo === 'publico' || modo === 'público' || modo === 'public') return 'publico';

  if (
    modo === 'solicitud' ||
    modo === 'request' ||
    modo === 'invitacion' ||
    modo === 'invitación' ||
    modo === 'invite'
  ) {
    return 'solicitud';
  }

  if (modo === 'privado' || modo === 'private') return 'privado';
  if (vis === 'publico' || vis === 'público' || vis === 'public') return 'publico';

  return 'privado';
}

function diffSeconds(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();

  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;

  return Math.max(0, Math.floor((to - from) / 1000));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tareaId: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id, tareaId } = await params;
    const proyectoId = toProjectId(id);

    if (proyectoId == null || !tareaId) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    // 1) Proyecto
    const proyectoRes = await db.execute({
      sql: `
        SELECT id, visibilidad, modo_acceso, creador_id
        FROM proyectos
        WHERE id = ?
        LIMIT 1
      `,
      args: [proyectoId],
    });

    const proyectoRows = castRows<ProyectoRow>(proyectoRes.rows);
    const proyecto = proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    const isCreator = String(proyecto.creador_id ?? '') === String(userId);

    const memberRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [proyectoId, String(userId)],
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

    // 2) Tarea
    const tareaRes = await db.execute({
      sql: `
        SELECT id, estado
        FROM tareas
        WHERE id = ?
          AND proyecto_id = ?
        LIMIT 1
      `,
      args: [String(tareaId), proyectoId],
    });

    const tareaRows = castRows<TareaRow>(tareaRes.rows);
    const tarea = tareaRows[0];

    if (!tarea) {
      return NextResponse.json(
        { ok: false, error: 'Tarea no existe' },
        { status: 404 }
      );
    }

    const estadoAnterior = normalizeEstado(tarea.estado);

    if (estadoAnterior === 'completed') {
      return NextResponse.json(
        { ok: false, error: 'La tarea ya está completada' },
        { status: 409 }
      );
    }

    if (estadoAnterior === 'review') {
      return NextResponse.json(
        { ok: false, error: 'La tarea ya fue enviada a review' },
        { status: 409 }
      );
    }

    if (estadoAnterior !== 'in-progress') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Solo puedes enviar a review una tarea en progreso',
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // 3) Debe estar asignado activamente
    const asigRes = await db.execute({
      sql: `
        SELECT id, started_at, completed_at
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
          AND estado = 'activo'
        LIMIT 1
      `,
      args: [String(tareaId), String(userId)],
    });

    const asigRows = castRows<AsignacionRow>(asigRes.rows);
    const asig = asigRows[0];

    if (!asig) {
      return NextResponse.json(
        { ok: false, error: 'No estás asignado a esta tarea' },
        { status: 403 }
      );
    }

    // 4) Si no había empezado, se marca started_at también
    if (!asig.started_at) {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET started_at = COALESCE(started_at, ?)
          WHERE id = ?
        `,
        args: [now, String(asig.id)],
      });
    }

    // 5) Marcar participación del usuario como completada
    if (!asig.completed_at) {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET completed_at = ?
          WHERE id = ?
        `,
        args: [now, String(asig.id)],
      });
    }

    // 6) Cerrar/finalizar cronómetro del usuario en esta tarea
    const registroRes = await db.execute({
      sql: `
        SELECT
          id,
          started_at,
          paused_at,
          stopped_at,
          total_seconds,
          estado
        FROM registro_horas
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
          AND estado IN ('activo', 'pausado')
        ORDER BY created_at DESC
        LIMIT 1
      `,
      args: [String(tareaId), String(userId)],
    });

    const registroRows = castRows<RegistroHorasRow>(registroRes.rows);
    const registro = registroRows[0];

    if (registro) {
      const registroEstado = String(registro.estado ?? '').toLowerCase().trim();
      const totalActual = toNumber(registro.total_seconds);

      if (registroEstado === 'activo' && registro.started_at) {
        const extra = diffSeconds(registro.started_at, now);

        await db.execute({
          sql: `
            UPDATE registro_horas
            SET total_seconds = ?,
                started_at = NULL,
                paused_at = NULL,
                stopped_at = ?,
                estado = 'finalizado'
            WHERE id = ?
          `,
          args: [totalActual + extra, now, String(registro.id)],
        });
      } else {
        await db.execute({
          sql: `
            UPDATE registro_horas
            SET started_at = NULL,
                paused_at = NULL,
                stopped_at = ?,
                estado = 'finalizado'
            WHERE id = ?
          `,
          args: [now, String(registro.id)],
        });
      }
    }

    // 7) Mover tarea a review
    await db.execute({
      sql: `
        UPDATE tareas
        SET estado = 'review',
            fecha_envio_revision = ?,
            updated_at = ?
        WHERE id = ?
      `,
      args: [now, now, String(tareaId)],
    });

    // 8) Historial
    try {
      await db.execute({
        sql: `
          INSERT INTO tarea_historial (
            id,
            tarea_id,
            usuario_id,
            estado_anterior,
            estado_nuevo,
            comentario,
            creado_en
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          randomUUID(),
          String(tareaId),
          String(userId),
          estadoAnterior,
          'review',
          'Tarea enviada a review',
          now,
        ],
      });
    } catch (e) {
      console.warn('No se pudo insertar en tarea_historial (no crítico):', e);
    }

    return NextResponse.json(
      {
        ok: true,
        estado: 'review',
        review_sent_at: now,
        completed_at: now,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('POST completar error:', err);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}