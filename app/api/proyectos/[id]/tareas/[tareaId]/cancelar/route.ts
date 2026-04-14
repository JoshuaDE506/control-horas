// app/api/proyectos/[id]/tareas/[tareaId]/cancelar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type Params = { id: string; tareaId: string };
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
  iniciado_en: string | null;
  completado_en: string | null;
};

type CountRow = {
  c: number | bigint | null;
};

type RegistroHorasRow = {
  id: string;
  iniciado_en: string | null;
  pausado_en: string | null;
  detenido_en: string | null;
  total_segundos: number | bigint | null;
  estado: string | null;
};

async function getParams(
  context: { params: Params | Promise<Params> }
): Promise<Params> {
  return await context.params;
}

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
  context: { params: Params | Promise<Params> }
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
    const { id, tareaId } = await getParams(context);
    const proyectoId = toProjectId(id);

    if (proyectoId == null || !tareaId) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

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
        { ok: false, error: 'No puedes cancelar una tarea completada' },
        { status: 409 }
      );
    }

    if (estadoAnterior === 'review') {
      return NextResponse.json(
        { ok: false, error: 'No puedes cancelar una tarea que está en review' },
        { status: 409 }
      );
    }

    const asigRes = await db.execute({
      sql: `
        SELECT id, iniciado_en, completado_en
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
          AND estado = 'activo'
        LIMIT 1
      `,
      args: [String(tareaId), userId],
    });

    const asigRows = castRows<AsignacionRow>(asigRes.rows);
    const asig = asigRows[0];

    if (!asig) {
      return NextResponse.json(
        { ok: false, error: 'No tienes una selección activa en esta tarea' },
        { status: 403 }
      );
    }

    const registroRes = await db.execute({
      sql: `
        SELECT
          id,
          iniciado_en,
          pausado_en,
          detenido_en,
          total_segundos,
          estado
        FROM registro_horas
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
          AND estado IN ('activo', 'pausado')
        ORDER BY creado_en DESC
        LIMIT 1
      `,
      args: [String(tareaId), userId],
    });

    const registroRows = castRows<RegistroHorasRow>(registroRes.rows);
    const registro = registroRows[0];

    if (registro) {
      const registroEstado = String(registro.estado ?? '').toLowerCase().trim();
      const totalActual = toNumber(registro.total_segundos);

      if (registroEstado === 'activo' && registro.iniciado_en) {
        const extra = diffSeconds(registro.iniciado_en, now);

        await db.execute({
          sql: `
            UPDATE registro_horas
            SET total_segundos = ?,
                iniciado_en = NULL,
                pausado_en = NULL,
                detenido_en = ?,
                estado = 'finalizado'
            WHERE id = ?
          `,
          args: [totalActual + extra, now, String(registro.id)],
        });
      } else {
        await db.execute({
          sql: `
            UPDATE registro_horas
            SET iniciado_en = NULL,
                pausado_en = NULL,
                detenido_en = ?,
                estado = 'finalizado'
            WHERE id = ?
          `,
          args: [now, String(registro.id)],
        });
      }
    }

    try {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET estado = 'cancelado',
              cancelado_en = ?
          WHERE id = ?
        `,
        args: [now, String(asig.id)],
      });
    } catch {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET estado = 'cancelado'
          WHERE id = ?
        `,
        args: [String(asig.id)],
      });
    }

    const trabajandoRes = await db.execute({
      sql: `
        SELECT COUNT(*) AS c
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND estado = 'activo'
          AND iniciado_en IS NOT NULL
          AND completado_en IS NULL
      `,
      args: [String(tareaId)],
    });

    const trabajandoRows = castRows<CountRow>(trabajandoRes.rows);
    const trabajando = toNumber(trabajandoRows[0]?.c);

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
    const activos = toNumber(activosRows[0]?.c);

    let nuevoEstado: EstadoTarea = 'todo';

    if (trabajando > 0) {
      nuevoEstado = 'in-progress';
    } else {
      nuevoEstado = 'todo';
    }

    await db.execute({
      sql: `
        UPDATE tareas
        SET estado = ?,
            actualizado_en = ?
        WHERE id = ?
      `,
      args: [nuevoEstado, now, String(tareaId)],
    });

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
          userId,
          estadoAnterior,
          nuevoEstado,
          'Canceló selección',
          now,
        ],
      });
    } catch (e) {
      console.error('Historial fallo (no crítico):', e);
    }

    const asignadosRes = await db.execute({
      sql: `
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u.email,
          COALESCE(ta.seleccionado_en, ta.creado_en) AS seleccionada_at,
          ta.iniciado_en,
          ta.completado_en
        FROM tarea_asignaciones ta
        JOIN usuarios u
          ON CAST(u.id AS TEXT) = CAST(ta.usuario_id AS TEXT)
        WHERE ta.tarea_id = ?
          AND ta.estado = 'activo'
        ORDER BY ta.creado_en ASC
      `,
      args: [String(tareaId)],
    });

    const payload = {
      asignados: asignadosRes.rows ?? [],
      activos,
      trabajando,
      estado: nuevoEstado,
      cancelado_en: now,
    };

    return NextResponse.json(
      {
        ok: true,
        data: payload,
        ...payload,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('POST cancelar error:', err);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}