// app/api/proyectos/[id]/tareas/[tareaId]/estado/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getUserIdFromRequest } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type Estado = 'todo' | 'in-progress' | 'review' | 'completed';
type RolProyecto = 'owner' | 'admin' | 'miembro' | 'ninguno';
type PermisoProyecto = 'owner' | 'owner_admin' | 'all_members';
type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';

type Params = { id: string; tareaId: string };

type ProyectoRow = {
  id: number | bigint | null;
  visibilidad: string | null;
  modo_acceso: string | null;
  creador_id: string | null;
  permiso_gestionar_tareas: string | null;
};

type TareaRow = {
  id: string;
  proyecto_id: number | bigint | null;
  estado: string | null;
  creador_id: string | null;
};

type RolRow = {
  rol?: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

async function getParams(
  context: { params: Params | Promise<Params> }
): Promise<Params> {
  return await context.params;
}

function toProjectId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEstado(value: unknown): Estado | null {
  const s = String(value ?? '').trim().toLowerCase();

  if (s === 'todo') return 'todo';
  if (s === 'in-progress' || s === 'in_progress') return 'in-progress';
  if (s === 'review' || s === 'revision' || s === 'revisión') return 'review';
  if (s === 'completed') return 'completed';

  return null;
}

function isValidTransition(
  from: Estado,
  to: Estado,
  options?: { rejected?: boolean; reopen?: boolean }
): boolean {
  if (from === to) return true;

  switch (from) {
    case 'todo':
      return to === 'in-progress';

    case 'in-progress':
      return to === 'review';

    case 'review':
      if (to === 'completed') return true;
      if (to === 'in-progress' && options?.rejected) return true;
      return false;

    case 'completed':
      if (to === 'todo' && options?.reopen) return true;
      return false;

    default:
      return false;
  }
}

function normalizarRol(raw: unknown): RolProyecto {
  const v = String(raw ?? '').toLowerCase().trim();

  if (v === 'owner' || v === 'dueño' || v === 'dueno') return 'owner';
  if (v === 'admin' || v === 'administrador') return 'admin';
  if (v === 'miembro' || v === 'member') return 'miembro';

  return 'ninguno';
}

function normalizarPermisoDesdeDB(raw: unknown): PermisoProyecto {
  const v = String(raw ?? '').toLowerCase().trim();

  if (
    [
      'owner',
      'solo_dueno',
      'solo dueño',
      'solo el dueno',
      'solo el dueño',
      'owner_only',
      'dueno',
      'dueño',
    ].includes(v)
  ) {
    return 'owner';
  }

  if (
    [
      'all_members',
      'todos_miembros',
      'todos los miembros',
      'todos_los_miembros',
      'todos',
      'miembros',
      'members',
      'miembros_todos',
    ].includes(v)
  ) {
    return 'all_members';
  }

  return 'owner_admin';
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

function puedeGestionarSegunPermiso(
  permiso: PermisoProyecto,
  rol: RolProyecto
): boolean {
  if (rol === 'ninguno') return false;

  if (permiso === 'owner') {
    return rol === 'owner';
  }

  if (permiso === 'owner_admin') {
    return rol === 'owner' || rol === 'admin';
  }

  return rol === 'owner' || rol === 'admin' || rol === 'miembro';
}

function toSafeNumber(value: number | bigint | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'bigint' ? Number(value) : Number(value);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Params | Promise<Params> }
) {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id, tareaId } = await getParams(context);
    const proyectoId = toProjectId(id);

    if (proyectoId == null || !tareaId) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const nuevoEstado = normalizeEstado(body?.estado);
    const rejected = body?.rejected === true;
    const reopen = body?.reopen === true;
    const comentario =
      typeof body?.comentario === 'string' ? body.comentario.trim() : '';

    if (!nuevoEstado) {
      return NextResponse.json(
        { ok: false, error: 'Estado inválido' },
        { status: 400 }
      );
    }

    const proyectoRes = await db.execute({
      sql: `
        SELECT
          id,
          visibilidad,
          modo_acceso,
          creador_id,
          permiso_gestionar_tareas
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

    const modoAcceso = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    const permisoProyecto = normalizarPermisoDesdeDB(
      proyecto.permiso_gestionar_tareas
    );

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
    const rawRol = rolRows[0]?.rol ?? null;

    const rolProyecto: RolProyecto = esOwnerProyecto
      ? 'owner'
      : normalizarRol(rawRol);

    const esMember = rolProyecto === 'admin' || rolProyecto === 'miembro';

    let canAccess = false;
    let canRequestAccess = false;

    if (modoAcceso === 'publico') {
      canAccess = true;
    } else if (modoAcceso === 'solicitud') {
      canAccess = esOwnerProyecto || esMember;
      canRequestAccess = !canAccess;
    } else {
      canAccess = esOwnerProyecto || esMember;
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
        SELECT
          id,
          proyecto_id,
          estado,
          creador_id
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

    const estadoActual: Estado = normalizeEstado(tarea.estado) ?? 'todo';

    if (!isValidTransition(estadoActual, nuevoEstado, { rejected, reopen })) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se permite cambiar de "${estadoActual}" a "${nuevoEstado}"`,
        },
        { status: 400 }
      );
    }

    if (estadoActual === 'review' && nuevoEstado === 'in-progress' && !rejected) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Solo se puede volver de review a in-progress cuando la tarea fue rechazada',
        },
        { status: 400 }
      );
    }

    if (estadoActual === 'completed' && nuevoEstado === 'todo' && !reopen) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Solo se puede volver de completed a todo cuando la tarea se reabre explícitamente',
        },
        { status: 400 }
      );
    }

    const esCreadorTarea =
      tarea.creador_id != null && String(tarea.creador_id) === String(userId);

    const asignadoRes = await db.execute({
      sql: `
        SELECT 1
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
          AND estado = 'activo'
        LIMIT 1
      `,
      args: [String(tareaId), String(userId)],
    });

    const estaAsignadoActivo = !!asignadoRes.rows?.length;

    const esAdminProyecto = rolProyecto === 'admin';
    const esMiembroComun = rolProyecto === 'miembro';

    const puedeGestionProyecto = puedeGestionarSegunPermiso(
      permisoProyecto,
      rolProyecto
    );

    const puedeCambiarEstado =
      esOwnerProyecto ||
      esAdminProyecto ||
      esCreadorTarea ||
      (esMiembroComun && puedeGestionProyecto && estaAsignadoActivo);

    if (!puedeCambiarEstado) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No tienes permisos para cambiar el estado de esta tarea',
        },
        { status: 403 }
      );
    }

    if (estadoActual === 'completed' && nuevoEstado === 'todo') {
      const puedeReabrir = esOwnerProyecto || esAdminProyecto;

      if (!puedeReabrir) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Solo el owner o admin del proyecto puede reabrir una tarea completada',
          },
          { status: 403 }
        );
      }
    }

    const now = new Date().toISOString();

    let extraSql = '';
    const extraArgs: Array<string | number | null> = [];

    if (estadoActual === 'todo' && nuevoEstado === 'in-progress') {
      extraSql += ', fecha_inicio_trabajo = COALESCE(fecha_inicio_trabajo, ?)';
      extraArgs.push(now);
    }

    if (estadoActual === 'in-progress' && nuevoEstado === 'review') {
      extraSql += ', fecha_envio_revision = ?';
      extraArgs.push(now);
    }

    if (estadoActual === 'review' && nuevoEstado === 'completed') {
      extraSql += ', fecha_aprobacion = ?, aprobado_por = ?';
      extraArgs.push(now, String(userId));
    }

    if (estadoActual === 'review' && nuevoEstado === 'in-progress' && rejected) {
      extraSql += ', ultimo_rechazo_comentario = ?';
      extraArgs.push(comentario || null);
    }

    if (estadoActual === 'completed' && nuevoEstado === 'todo' && reopen) {
      extraSql += `
        , fecha_aprobacion = NULL
        , aprobado_por = NULL
        , fecha_envio_revision = NULL
        , ultimo_rechazo_comentario = NULL
      `;
    }

    const sql = `
      UPDATE tareas
      SET estado = ?,
          actualizado_en = ?
          ${extraSql}
      WHERE id = ?
        AND proyecto_id = ?
    `;

    const args: Array<string | number | null> = [
      nuevoEstado,
      now,
      ...extraArgs,
      String(tareaId),
      proyectoId,
    ];

    await db.execute({
      sql,
      args,
    });

    const comentarioHistorial =
      comentario ||
      (reopen
        ? `Reapertura: ${estadoActual} → ${nuevoEstado}`
        : rejected
          ? `Rechazo: ${estadoActual} → ${nuevoEstado}`
          : `Cambio de estado: ${estadoActual} → ${nuevoEstado}`);

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
          estadoActual,
          nuevoEstado,
          comentarioHistorial,
          now,
        ],
      });
    } catch (e) {
      console.warn('No se pudo insertar en tarea_historial:', e);
    }

    const tareaUpdatedRes = await db.execute({
      sql: `
        SELECT
          id,
          proyecto_id,
          estado,
          creador_id
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
        tarea: tareaUpdated,
        meta: {
          rolProyecto,
          esOwnerProyecto,
          esAdminProyecto,
          esCreadorTarea,
          estaAsignadoActivo,
          proyecto_id: toSafeNumber(tarea.proyecto_id),
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('PATCH /api/proyectos/[id]/tareas/[tareaId]/estado error:', err);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}