// app/api/proyectos/[id]/tareas/route.ts
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type RolProyecto = 'owner' | 'admin' | 'miembro' | 'ninguno';
type PermisoProyecto = 'owner' | 'owner_admin' | 'all_members';
type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';

type ProyectoRow = {
  id: number | bigint;
  creador_id: string;
  modo_acceso: string | null;
  visibilidad: string | null;
  permiso_gestionar_tareas: string | null;
};

type RolRow = {
  rol?: string | null;
};

type TareaEstado = 'todo' | 'in-progress' | 'review' | 'completed';
type TareaPrioridad = 'baja' | 'media' | 'alta' | 'critica';

type TareaRow = {
  id: string;
  usuario_id: string | null;
  titulo: string | null;
  descripcion: string | null;
  prioridad: string | null;
  estado: string | null;
  creado_en: string | null;
  actualizado_en: string | null;
  proyecto_id: number | bigint | null;
  creador_id: string | null;
  tiempo_estimado_minutos: number | bigint | null;
  max_participantes: number | bigint | null;
  permiso_edicion: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function toNumber(value: number | bigint | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'bigint' ? Number(value) : Number(value);
}

function normalizarPermisoDesdeDB(raw: unknown): PermisoProyecto {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'owner') return 'owner';
  if (value === 'owner_admin') return 'owner_admin';
  if (value === 'all_members') return 'all_members';

  return 'owner_admin';
}

function normalizarRolProyecto(raw: unknown): RolProyecto {
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
  const visibilidad = String(rawVisibilidad ?? '').toLowerCase().trim();

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

  if (
    visibilidad === 'publico' ||
    visibilidad === 'público' ||
    visibilidad === 'public'
  ) {
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

  return normalizarRolProyecto(row.rol);
}

function toProjectId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePrioridad(raw: unknown): TareaPrioridad {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'baja') return 'baja';
  if (value === 'alta') return 'alta';
  if (value === 'critica' || value === 'crítica') return 'critica';
  return 'media';
}

function parseEstado(raw: unknown): TareaEstado {
  const value = String(raw ?? '').toLowerCase().trim();

  if (
    value === 'in-progress' ||
    value === 'in_progress' ||
    value === 'en_progreso' ||
    value === 'en progreso'
  ) {
    return 'in-progress';
  }

  if (
    value === 'review' ||
    value === 'revision' ||
    value === 'revisión'
  ) {
    return 'review';
  }

  if (
    value === 'completed' ||
    value === 'completada' ||
    value === 'completado'
  ) {
    return 'completed';
  }

  return 'todo';
}

function mapTarea(row: TareaRow) {
  return {
    id: String(row.id),
    usuario_id: row.usuario_id != null ? String(row.usuario_id) : null,
    titulo: row.titulo ?? '',
    descripcion: row.descripcion ?? null,
    prioridad: parsePrioridad(row.prioridad),
    estado: parseEstado(row.estado),
    creado_en: row.creado_en ?? null,
    actualizado_en: row.actualizado_en ?? null,
    proyecto_id: toNumber(row.proyecto_id),
    creador_id: row.creador_id ?? null,
    tiempo_estimado_minutos: toNumber(row.tiempo_estimado_minutos),
    max_participantes: toNumber(row.max_participantes) ?? 1,
    permiso_edicion: row.permiso_edicion ?? null,
  };
}

/* ========================= GET ========================= */

export async function GET(
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

    const userId = String(sessionUser.id);
    const { id } = await params;
    const proyectoId = toProjectId(id);

    if (proyectoId == null) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const proyectoRes = await db.execute({
      sql: `
        SELECT
          id,
          creador_id,
          modo_acceso,
          visibilidad,
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

    const isCreator = String(proyecto.creador_id) === userId;

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

    const isMember = memberRes.rows.length > 0;

    const modoAcceso = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    let canViewTasks = false;
    let canRequestAccess = false;

    if (modoAcceso === 'publico') {
      canViewTasks = true;
    } else if (modoAcceso === 'solicitud') {
      canViewTasks = isCreator || isMember;
      canRequestAccess = !canViewTasks;
    } else {
      canViewTasks = isCreator || isMember;
    }

    if (!canViewTasks) {
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

    const tareasRes = await db.execute({
      sql: `
        SELECT
          id,
          usuario_id,
          titulo,
          descripcion,
          prioridad,
          estado,
          creado_en,
          actualizado_en,
          proyecto_id,
          creador_id,
          tiempo_estimado_minutos,
          max_participantes,
          permiso_edicion
        FROM tareas
        WHERE proyecto_id = ?
        ORDER BY creado_en DESC
      `,
      args: [proyectoId],
    });

    const tareasRows = castRows<TareaRow>(tareasRes.rows);
    const tareas = tareasRows.map(mapTarea);

    const payload = {
      tareas,
      meta: {
        modo_acceso: modoAcceso,
        es_creador: isCreator,
        es_miembro: isMember,
        puede_ver_tareas: true,
      },
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
    console.error('GET /api/proyectos/[id]/tareas error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/* ========================= POST ========================= */

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

    const userId = String(sessionUser.id);
    const { id } = await params;
    const proyectoId = toProjectId(id);

    if (proyectoId == null) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const proyectoRes = await db.execute({
      sql: `
        SELECT
          id,
          creador_id,
          permiso_gestionar_tareas,
          modo_acceso,
          visibilidad
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

    const esOwnerProyecto = String(proyecto.creador_id) === userId;

    const rolProyecto: RolProyecto = esOwnerProyecto
      ? 'owner'
      : await obtenerRolEnProyecto(proyectoId, userId);

    const modoAcceso = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    const puedeAcceder =
      modoAcceso === 'publico' ||
      esOwnerProyecto ||
      rolProyecto === 'admin' ||
      rolProyecto === 'miembro';

    if (!puedeAcceder) {
      return NextResponse.json(
        { ok: false, error: 'Sin acceso a este proyecto' },
        { status: 403 }
      );
    }

    const permisoProyecto = normalizarPermisoDesdeDB(
      proyecto.permiso_gestionar_tareas
    );

    const puedeCrear = puedeGestionarSegunPermiso(permisoProyecto, rolProyecto);

    if (!puedeCrear) {
      return NextResponse.json(
        { ok: false, error: 'Sin permiso para crear tareas' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const titulo = typeof body?.titulo === 'string' ? body.titulo.trim() : '';
    const descripcion =
      typeof body?.descripcion === 'string' && body.descripcion.trim()
        ? body.descripcion.trim()
        : null;

    const prioridad = parsePrioridad(body?.prioridad);
    const estado: TareaEstado = 'todo';

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

    const tareaId = randomUUID();
    const now = new Date().toISOString();

    await db.execute({
      sql: `
        INSERT INTO tareas (
          id,
          usuario_id,
          titulo,
          descripcion,
          prioridad,
          estado,
          creado_en,
          actualizado_en,
          proyecto_id,
          creador_id,
          tiempo_estimado_minutos,
          max_participantes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        tareaId,
        userId,
        titulo,
        descripcion,
        prioridad,
        estado,
        now,
        now,
        proyectoId,
        userId,
        tiempoEstimadoMinutos,
        maxParticipantes,
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
          VALUES (?, ?, ?, NULL, ?, 'Tarea creada', ?)
        `,
        args: [randomUUID(), tareaId, userId, estado, now],
      });
    } catch (error) {
      console.warn('No se pudo insertar en tarea_historial:', error);
    }

    const tareaRes = await db.execute({
      sql: `
        SELECT
          id,
          usuario_id,
          titulo,
          descripcion,
          prioridad,
          estado,
          creado_en,
          actualizado_en,
          proyecto_id,
          creador_id,
          tiempo_estimado_minutos,
          max_participantes,
          permiso_edicion
        FROM tareas
        WHERE id = ?
        LIMIT 1
      `,
      args: [tareaId],
    });

    const tareaRows = castRows<TareaRow>(tareaRes.rows);
    const tarea = tareaRows[0] ? mapTarea(tareaRows[0]) : null;

    return NextResponse.json(
      {
        ok: true,
        message: 'Tarea creada correctamente',
        data: { tarea },
        tarea,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/proyectos/[id]/tareas error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}