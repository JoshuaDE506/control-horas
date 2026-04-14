// app/api/proyectos/[id]/tareas/[tareaId]/configuracion/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type Params = { id: string; tareaId: string };

type Estado = 'todo' | 'in-progress' | 'completed';
type Prioridad = 'baja' | 'media' | 'alta' | 'critica';
type RolProyecto = 'owner' | 'admin' | 'miembro' | 'ninguno';
type PermisoProyecto = 'owner' | 'owner_admin' | 'all_members';
type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';

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
  titulo: string | null;
  descripcion: string | null;
  prioridad: string | null;
  estado: string | null;
  tiempo_estimado_minutos: number | bigint | null;
  max_participantes: number | bigint | null;
  creado_en: string | null;
  actualizado_en: string | null;
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

function toNumber(value: number | bigint | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'bigint' ? Number(value) : Number(value);
}

function normalizeEstado(value: unknown): Estado | null {
  const s = String(value ?? '').trim().toLowerCase();

  if (s === 'todo') return 'todo';
  if (s === 'in-progress' || s === 'in_progress') return 'in-progress';
  if (s === 'completed') return 'completed';

  return null;
}

function normalizePrioridad(value: unknown): Prioridad | null {
  const s = String(value ?? '').trim().toLowerCase();

  if (s === 'baja') return 'baja';
  if (s === 'media') return 'media';
  if (s === 'alta') return 'alta';
  if (s === 'critica' || s === 'crítica') return 'critica';

  return null;
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

  if (permiso === 'owner') return rol === 'owner';
  if (permiso === 'owner_admin') return rol === 'owner' || rol === 'admin';
  return rol === 'owner' || rol === 'admin' || rol === 'miembro';
}

async function obtenerRolEnProyecto(
  proyectoId: number,
  usuarioId: string
): Promise<RolProyecto> {
  const result = await db.execute({
    sql: `
      SELECT rol_en_proyecto AS rol
      FROM proyecto_usuarios
      WHERE proyecto_id = ?
        AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
      LIMIT 1
    `,
    args: [proyectoId, String(usuarioId)],
  });

  const rows = castRows<RolRow>(result.rows);
  const row = rows[0];

  if (!row) return 'ninguno';
  return normalizarRol(row.rol);
}

function mapTarea(row: TareaRow) {
  return {
    id: String(row.id),
    proyecto_id: toNumber(row.proyecto_id),
    titulo: row.titulo ?? '',
    descripcion: row.descripcion ?? '',
    prioridad: normalizePrioridad(row.prioridad) ?? 'media',
    estado: normalizeEstado(row.estado) ?? 'todo',
    tiempo_estimado_minutos: toNumber(row.tiempo_estimado_minutos),
    max_participantes: toNumber(row.max_participantes) ?? 1,
    creado_en: row.creado_en ?? null,
    actualizado_en: row.actualizado_en ?? null,
    creador_id: row.creador_id ?? null,
  };
}

async function cargarProyectoYTarea(
  proyectoId: number,
  tareaId: string
): Promise<{ proyecto: ProyectoRow | null; tarea: TareaRow | null }> {
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

  const tareaRes = await db.execute({
    sql: `
      SELECT
        id,
        proyecto_id,
        titulo,
        descripcion,
        prioridad,
        estado,
        tiempo_estimado_minutos,
        max_participantes,
        creado_en,
        actualizado_en,
        creador_id
      FROM tareas
      WHERE id = ?
        AND proyecto_id = ?
      LIMIT 1
    `,
    args: [String(tareaId), proyectoId],
  });

  const proyectoRows = castRows<ProyectoRow>(proyectoRes.rows);
  const tareaRows = castRows<TareaRow>(tareaRes.rows);

  return {
    proyecto: proyectoRows[0] ?? null,
    tarea: tareaRows[0] ?? null,
  };
}

async function resolverPermisos(
  proyecto: ProyectoRow,
  userId: string
): Promise<{
  rolProyecto: RolProyecto;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}> {
  const esOwnerProyecto = String(proyecto.creador_id ?? '') === String(userId);

  const rolProyecto: RolProyecto = esOwnerProyecto
    ? 'owner'
    : await obtenerRolEnProyecto(Number(proyecto.id), userId);

  const permiso = normalizarPermisoDesdeDB(proyecto.permiso_gestionar_tareas);
  const puedeGestionar = puedeGestionarSegunPermiso(permiso, rolProyecto);

  return {
    rolProyecto,
    puedeEditar: puedeGestionar,
    puedeEliminar: puedeGestionar,
  };
}

/* ========================= GET ========================= */

export async function GET(
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

    const { id, tareaId } = await getParams(context);
    const proyectoId = toProjectId(id);

    if (proyectoId == null || !tareaId) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const { proyecto, tarea } = await cargarProyectoYTarea(proyectoId, tareaId);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    if (!tarea) {
      return NextResponse.json(
        { ok: false, error: 'Tarea no existe' },
        { status: 404 }
      );
    }

    const modoAcceso = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    const isCreator = String(proyecto.creador_id ?? '') === String(sessionUser.id);
    const memberRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [proyectoId, String(sessionUser.id)],
    });

    const isMember = !!memberRes.rows?.length;

    let canAccess = false;
    if (modoAcceso === 'publico') canAccess = true;
    else if (modoAcceso === 'solicitud') canAccess = isCreator || isMember;
    else canAccess = isCreator || isMember;

    if (!canAccess) {
      return NextResponse.json(
        { ok: false, error: 'Sin acceso a esta tarea' },
        { status: 403 }
      );
    }

    const permisos = await resolverPermisos(proyecto, String(sessionUser.id));

    return NextResponse.json(
      {
        ok: true,
        data: {
          tarea: mapTarea(tarea),
          permisos: {
            puedeEditar: permisos.puedeEditar,
            puedeEliminar: permisos.puedeEliminar,
          },
        },
        tarea: mapTarea(tarea),
        permisos: {
          puedeEditar: permisos.puedeEditar,
          puedeEliminar: permisos.puedeEliminar,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/proyectos/[id]/tareas/[tareaId]/configuracion error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno al cargar la tarea' },
      { status: 500 }
    );
  }
}

/* ========================= PUT ========================= */

export async function PUT(
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

    const { id, tareaId } = await getParams(context);
    const proyectoId = toProjectId(id);

    if (proyectoId == null || !tareaId) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const { proyecto, tarea } = await cargarProyectoYTarea(proyectoId, tareaId);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    if (!tarea) {
      return NextResponse.json(
        { ok: false, error: 'Tarea no existe' },
        { status: 404 }
      );
    }

    const permisos = await resolverPermisos(proyecto, String(sessionUser.id));

    if (!permisos.puedeEditar) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permisos para editar esta tarea' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const titulo =
      typeof body?.titulo === 'string' ? body.titulo.trim() : '';
    const descripcion =
      typeof body?.descripcion === 'string'
        ? body.descripcion.trim()
        : body?.descripcion === null
        ? null
        : '';

    const prioridad = normalizePrioridad(body?.prioridad);
    const estado = normalizeEstado(body?.estado);

    const tiempoEstimadoMinutos =
      body?.tiempo_estimado_minutos == null
        ? null
        : Number(body.tiempo_estimado_minutos);

    const maxParticipantes =
      body?.max_participantes == null ? 1 : Number(body.max_participantes);

    if (!titulo) {
      return NextResponse.json(
        { ok: false, error: 'El título es obligatorio' },
        { status: 400 }
      );
    }

    if (!prioridad) {
      return NextResponse.json(
        { ok: false, error: 'Prioridad inválida' },
        { status: 400 }
      );
    }

    if (!estado) {
      return NextResponse.json(
        { ok: false, error: 'Estado inválido' },
        { status: 400 }
      );
    }

    if (
      tiempoEstimadoMinutos != null &&
      (!Number.isFinite(tiempoEstimadoMinutos) || tiempoEstimadoMinutos < 0)
    ) {
      return NextResponse.json(
        { ok: false, error: 'tiempo_estimado_minutos inválido' },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(maxParticipantes) ||
      !Number.isInteger(maxParticipantes) ||
      maxParticipantes < 1
    ) {
      return NextResponse.json(
        { ok: false, error: 'max_participantes inválido' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const estadoAnterior = normalizeEstado(tarea.estado) ?? 'todo';

    await db.execute({
      sql: `
        UPDATE tareas
        SET
          titulo = ?,
          descripcion = ?,
          prioridad = ?,
          estado = ?,
          tiempo_estimado_minutos = ?,
          max_participantes = ?,
          actualizado_en = ?
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [
        titulo,
        descripcion === '' ? null : descripcion,
        prioridad,
        estado,
        tiempoEstimadoMinutos,
        maxParticipantes,
        now,
        String(tareaId),
        proyectoId,
      ],
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
          String(sessionUser.id),
          estadoAnterior,
          estado,
          'Actualizó configuración de la tarea',
          now,
        ],
      });
    } catch (e) {
      console.warn('No se pudo insertar en tarea_historial:', e);
    }

    const updatedRes = await db.execute({
      sql: `
        SELECT
          id,
          proyecto_id,
          titulo,
          descripcion,
          prioridad,
          estado,
          tiempo_estimado_minutos,
          max_participantes,
          creado_en,
          actualizado_en,
          creador_id
        FROM tareas
        WHERE id = ?
          AND proyecto_id = ?
        LIMIT 1
      `,
      args: [String(tareaId), proyectoId],
    });

    const updatedRows = castRows<TareaRow>(updatedRes.rows);
    const updated = updatedRows[0];

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'No se pudo recargar la tarea actualizada' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Configuración guardada correctamente',
        data: {
          tarea: mapTarea(updated),
        },
        tarea: mapTarea(updated),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PUT /api/proyectos/[id]/tareas/[tareaId]/configuracion error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno al guardar configuración' },
      { status: 500 }
    );
  }
}

/* ========================= DELETE ========================= */

export async function DELETE(
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

    const { id, tareaId } = await getParams(context);
    const proyectoId = toProjectId(id);

    if (proyectoId == null || !tareaId) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const { proyecto, tarea } = await cargarProyectoYTarea(proyectoId, tareaId);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    if (!tarea) {
      return NextResponse.json(
        { ok: false, error: 'Tarea no existe' },
        { status: 404 }
      );
    }

    const permisos = await resolverPermisos(proyecto, String(sessionUser.id));

    if (!permisos.puedeEliminar) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permisos para eliminar esta tarea' },
        { status: 403 }
      );
    }

    await db.execute({
      sql: `DELETE FROM tarea_historial WHERE tarea_id = ?`,
      args: [String(tareaId)],
    });

    await db.execute({
      sql: `DELETE FROM tarea_informes WHERE tarea_id = ?`,
      args: [String(tareaId)],
    });

    await db.execute({
      sql: `DELETE FROM registro_horas WHERE tarea_id = ?`,
      args: [String(tareaId)],
    });

    await db.execute({
      sql: `DELETE FROM tarea_asignaciones WHERE tarea_id = ?`,
      args: [String(tareaId)],
    });

    await db.execute({
      sql: `
        DELETE FROM tareas
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [String(tareaId), proyectoId],
    });

    return NextResponse.json(
      {
        ok: true,
        message: 'Tarea eliminada correctamente',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'DELETE /api/proyectos/[id]/tareas/[tareaId]/configuracion error:',
      error
    );

    return NextResponse.json(
      { ok: false, error: 'Error interno al eliminar la tarea' },
      { status: 500 }
    );
  }
}