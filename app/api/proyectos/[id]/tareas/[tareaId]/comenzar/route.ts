// app/api/proyectos/[id]/tareas/[tareaId]/comenzar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';
type EstadoTarea = 'todo' | 'in-progress' | 'review' | 'completed';
type EstadoRegistroHoras = 'activo' | 'pausado' | 'finalizado';

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
  visibilidad: string | null;
  modo_acceso: string | null;
};

type TareaRow = {
  id: string;
  proyecto_id: number | bigint | null;
  estado: string | null;
  fecha_inicio_trabajo: string | null;
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
  created_at: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function toProjectId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toSafeNumber(value: number | bigint | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'bigint' ? Number(value) : Number(value);
}

function normalizeEstado(raw: unknown): EstadoTarea {
  const value = String(raw ?? '').toLowerCase().trim();

  if (
    value === 'in-progress' ||
    value === 'in_progress' ||
    value === 'en progreso' ||
    value === 'en_progreso'
  ) {
    return 'in-progress';
  }

  if (value === 'review' || value === 'revision' || value === 'revisión') {
    return 'review';
  }

  if (value === 'completed' || value === 'completado' || value === 'completada') {
    return 'completed';
  }

  return 'todo';
}

function normalizeEstadoRegistro(raw: unknown): EstadoRegistroHoras {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'pausado') return 'pausado';
  if (value === 'finalizado') return 'finalizado';
  return 'activo';
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

    // 1) Verificar tarea
    const tareaRes = await db.execute({
      sql: `
        SELECT
          id,
          proyecto_id,
          estado,
          fecha_inicio_trabajo
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

    const estadoActual = normalizeEstado(tarea.estado);

    if (estadoActual === 'completed') {
      return NextResponse.json(
        { ok: false, error: 'La tarea ya está completada' },
        { status: 409 }
      );
    }

    if (estadoActual === 'review') {
      return NextResponse.json(
        { ok: false, error: 'La tarea está en review y no puede comenzarse' },
        { status: 409 }
      );
    }

    // 2) Verificar acceso al proyecto
    const proyectoRes = await db.execute({
      sql: `
        SELECT id, creador_id, visibilidad, modo_acceso
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

    // 3) Exigir asignación activa previa
    const asigRes = await db.execute({
      sql: `
        SELECT id, started_at, completed_at
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
          AND estado = 'activo'
        LIMIT 1
      `,
      args: [String(tareaId), userId],
    });

    const asigRows = castRows<AsignacionRow>(asigRes.rows);
    const asignacion = asigRows[0];

    if (!asignacion) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Debes seleccionar la tarea antes de comenzar',
          requiereSeleccion: true,
        },
        { status: 409 }
      );
    }

    if (asignacion.completed_at) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Tu participación en esta tarea ya fue completada',
        },
        { status: 409 }
      );
    }

    // 4) Asegurar started_at en tarea_asignaciones
    await db.execute({
      sql: `
        UPDATE tarea_asignaciones
        SET started_at = COALESCE(started_at, ?)
        WHERE id = ?
      `,
      args: [now, String(asignacion.id)],
    });

    // 5) Mover tarea a in-progress y guardar fecha_inicio_trabajo
    if (estadoActual === 'todo') {
      await db.execute({
        sql: `
          UPDATE tareas
          SET estado = 'in-progress',
              fecha_inicio_trabajo = COALESCE(fecha_inicio_trabajo, ?),
              updated_at = ?
          WHERE id = ?
        `,
        args: [now, now, String(tareaId)],
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
            'todo',
            'in-progress',
            'Comenzó la tarea',
            now,
          ],
        });
      } catch (e) {
        console.warn('No se pudo insertar en tarea_historial:', e);
      }
    } else if (estadoActual === 'in-progress' && !tarea.fecha_inicio_trabajo) {
      await db.execute({
        sql: `
          UPDATE tareas
          SET fecha_inicio_trabajo = COALESCE(fecha_inicio_trabajo, ?),
              updated_at = ?
          WHERE id = ?
        `,
        args: [now, now, String(tareaId)],
      });
    }

    // 6) Buscar último registro_horas del usuario en esta tarea
    const registroRes = await db.execute({
      sql: `
        SELECT
          id,
          started_at,
          paused_at,
          stopped_at,
          total_seconds,
          estado,
          created_at
        FROM registro_horas
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        ORDER BY created_at DESC
        LIMIT 1
      `,
      args: [String(tareaId), userId],
    });

    const registroRows = castRows<RegistroHorasRow>(registroRes.rows);
    const registro = registroRows[0];

    let registroFinalId: string;

    if (!registro) {
      registroFinalId = randomUUID();

      await db.execute({
        sql: `
          INSERT INTO registro_horas (
            id,
            tarea_id,
            usuario_id,
            started_at,
            paused_at,
            stopped_at,
            total_seconds,
            estado,
            created_at
          )
          VALUES (?, ?, ?, ?, NULL, NULL, 0, 'activo', ?)
        `,
        args: [registroFinalId, String(tareaId), userId, now, now],
      });
    } else {
      const estadoRegistro = normalizeEstadoRegistro(registro.estado);

      if (estadoRegistro === 'pausado') {
        registroFinalId = String(registro.id);

        await db.execute({
          sql: `
            UPDATE registro_horas
            SET started_at = ?,
                paused_at = NULL,
                stopped_at = NULL,
                estado = 'activo'
            WHERE id = ?
          `,
          args: [now, registroFinalId],
        });
      } else if (estadoRegistro === 'activo') {
        registroFinalId = String(registro.id);

        await db.execute({
          sql: `
            UPDATE registro_horas
            SET started_at = COALESCE(started_at, ?),
                paused_at = NULL,
                stopped_at = NULL,
                estado = 'activo'
            WHERE id = ?
          `,
          args: [now, registroFinalId],
        });
      } else {
        // Si el último registro estaba finalizado, crear uno nuevo
        registroFinalId = randomUUID();

        await db.execute({
          sql: `
            INSERT INTO registro_horas (
              id,
              tarea_id,
              usuario_id,
              started_at,
              paused_at,
              stopped_at,
              total_seconds,
              estado,
              created_at
            )
            VALUES (?, ?, ?, ?, NULL, NULL, 0, 'activo', ?)
          `,
          args: [registroFinalId, String(tareaId), userId, now, now],
        });
      }
    }

    // 7) Leer registro_horas final ya persistido
    const registroFinalRes = await db.execute({
      sql: `
        SELECT
          id,
          started_at,
          paused_at,
          stopped_at,
          total_seconds,
          estado,
          created_at
        FROM registro_horas
        WHERE id = ?
        LIMIT 1
      `,
      args: [registroFinalId],
    });

    const registroFinalRows = castRows<RegistroHorasRow>(registroFinalRes.rows);
    const registroFinal = registroFinalRows[0] ?? null;

    // 8) Traer asignados activos
    const asignadosRes = await db.execute({
      sql: `
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u.email,
          COALESCE(ta.selected_at, ta.created_at) AS seleccionada_at,
          ta.started_at,
          ta.completed_at
        FROM tarea_asignaciones ta
        JOIN usuarios u
          ON CAST(u.id AS TEXT) = CAST(ta.usuario_id AS TEXT)
        WHERE ta.tarea_id = ?
          AND ta.estado = 'activo'
        ORDER BY ta.created_at ASC
      `,
      args: [String(tareaId)],
    });

    const payload = {
      asignados: asignadosRes.rows ?? [],
      started_at: registroFinal?.started_at ?? now,
      stopped_at: registroFinal?.stopped_at ?? null,
      estado: 'in-progress' as const,
      registro_horas: registroFinal
        ? {
            id: String(registroFinal.id),
            started_at: registroFinal.started_at ?? null,
            paused_at: registroFinal.paused_at ?? null,
            stopped_at: registroFinal.stopped_at ?? null,
            total_seconds: toSafeNumber(registroFinal.total_seconds),
            estado: normalizeEstadoRegistro(registroFinal.estado),
            created_at: registroFinal.created_at ?? null,
          }
        : null,
    };

    return NextResponse.json(
      {
        ok: true,
        data: payload,
        ...payload,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/tareas/[tareaId]/comenzar error:',
      error
    );

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}