// app/api/proyectos/[id]/tareas/[tareaId]/aprobar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getUserIdFromRequest } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type RolProyecto = 'owner' | 'admin' | 'miembro' | 'ninguno';
type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';
type EstadoTarea = 'todo' | 'in-progress' | 'review' | 'completed';

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
  visibilidad: string | null;
  modo_acceso: string | null;
};

type RolRow = {
  rol?: string | null;
};

type TareaRow = {
  id: string;
  estado: string | null;
  proyecto_id: number | bigint | null;
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

function normalizarRol(raw: unknown): RolProyecto {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'owner' || value === 'dueño' || value === 'dueno') return 'owner';
  if (value === 'admin' || value === 'administrador') return 'admin';
  if (value === 'miembro' || value === 'member') return 'miembro';

  return 'ninguno';
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
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 1) Proyecto
    const proyectoRes = await db.execute({
      sql: `
        SELECT
          id,
          creador_id,
          visibilidad,
          modo_acceso
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

    const esOwnerProyecto =
      proyecto.creador_id != null &&
      String(proyecto.creador_id) === String(userId);

    const rolRes = await db.execute({
      sql: `
        SELECT rol_en_proyecto AS rol
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [proyectoId, String(userId)],
    });

    const rolRows = castRows<RolRow>(rolRes.rows);
    const rolProyecto: RolProyecto = esOwnerProyecto
      ? 'owner'
      : normalizarRol(rolRows[0]?.rol);

    const esAdminProyecto = rolProyecto === 'admin';
    const esMiembro = rolProyecto === 'miembro';

    const modoAcceso = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    let canAccess = false;
    let canRequestAccess = false;

    if (modoAcceso === 'publico') {
      canAccess = true;
    } else if (modoAcceso === 'solicitud') {
      canAccess = esOwnerProyecto || esAdminProyecto || esMiembro;
      canRequestAccess = !canAccess;
    } else {
      canAccess = esOwnerProyecto || esAdminProyecto || esMiembro;
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

    // 2) Solo owner/admin pueden aprobar
    if (!esOwnerProyecto && !esAdminProyecto) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Solo el owner o un admin pueden aprobar tareas',
        },
        { status: 403 }
      );
    }

    // 3) Tarea
    const tareaRes = await db.execute({
      sql: `
        SELECT
          id,
          estado,
          proyecto_id
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

    if (estadoActual !== 'review') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Solo se puede aprobar una tarea que esté en review',
        },
        { status: 409 }
      );
    }

    // 4) Aprobar tarea
    await db.execute({
      sql: `
        UPDATE tareas
        SET estado = 'completed',
            fecha_aprobacion = ?,
            aprobado_por = ?,
            actualizado_en = ?
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [now, String(userId), now, String(tareaId), proyectoId],
    });

    // 5) Historial
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
          'review',
          'completed',
          'Tarea aprobada',
          now,
        ],
      });
    } catch (e) {
      console.warn('No se pudo insertar en tarea_historial:', e);
    }

    // 6) Respuesta final
    const tareaUpdatedRes = await db.execute({
      sql: `
        SELECT
          id,
          estado,
          proyecto_id
        FROM tareas
        WHERE id = ?
          AND proyecto_id = ?
        LIMIT 1
      `,
      args: [String(tareaId), proyectoId],
    });

    const tareaUpdated = tareaUpdatedRes.rows?.[0] ?? null;

    return NextResponse.json(
      {
        ok: true,
        message: 'Tarea aprobada correctamente',
        tarea: tareaUpdated,
        meta: {
          aprobado_por: String(userId),
          fecha_aprobacion: now,
          rol_proyecto: rolProyecto,
          es_owner_proyecto: esOwnerProyecto,
          es_admin_proyecto: esAdminProyecto,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/proyectos/[id]/tareas/[tareaId]/aprobar error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}