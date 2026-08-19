// app/api/proyectos/[id]/tareas/[tareaId]/configuracion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

/**
 * =========================================================
 * 📌 TIPOS AUXILIARES
 * =========================================================
 */

type Params = {
  id: string;
  tareaId: string;
};

type EstadoTarea =
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'completed';

type Prioridad =
  | 'baja'
  | 'media'
  | 'alta'
  | 'critica';

type RolProyecto =
  | 'owner'
  | 'admin'
  | 'miembro'
  | 'ninguno';

type PermisoProyecto =
  | 'owner_admin'
  | 'todos_miembros';

type ProyectoRow = {
  id: number | bigint | null;
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

/**
 * =========================================================
 * 🔄 HELPERS
 * =========================================================
 */

function castRows<T>(
  rows: unknown[]
): T[] {
  return rows as T[];
}

async function getParams(
  context: {
    params:
      | Params
      | Promise<Params>;
  }
): Promise<Params> {
  return await context.params;
}

function toProjectId(
  value: string
): number | null {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return null;
  }

  return parsed;
}

function toNumber(
  value:
    | number
    | bigint
    | null
    | undefined
): number | null {
  if (value == null) {
    return null;
  }

  return Number(value);
}

/**
 * =========================================================
 * 📋 NORMALIZAR ESTADO
 * =========================================================
 */
function normalizeEstado(
  value: unknown
): EstadoTarea {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();

  if (
    raw === 'in-progress' ||
    raw === 'in_progress' ||
    raw === 'en progreso' ||
    raw === 'en_progreso'
  ) {
    return 'in-progress';
  }

  if (
    raw === 'review' ||
    raw === 'revision' ||
    raw === 'revisión'
  ) {
    return 'review';
  }

  if (
    raw === 'completed' ||
    raw === 'completado' ||
    raw === 'completada'
  ) {
    return 'completed';
  }

  return 'todo';
}

/**
 * =========================================================
 * 🚩 NORMALIZAR PRIORIDAD
 * =========================================================
 */
function normalizePrioridad(
  value: unknown
): Prioridad | null {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();

  if (raw === 'baja') {
    return 'baja';
  }

  if (raw === 'media') {
    return 'media';
  }

  if (raw === 'alta') {
    return 'alta';
  }

  if (
    raw === 'critica' ||
    raw === 'crítica'
  ) {
    return 'critica';
  }

  return null;
}

/**
 * =========================================================
 * 👤 NORMALIZAR ROL
 * =========================================================
 */
function normalizarRol(
  raw: unknown
): RolProyecto {
  const value = String(raw ?? '')
    .toLowerCase()
    .trim();

  if (
    value === 'owner' ||
    value === 'dueño' ||
    value === 'dueno'
  ) {
    return 'owner';
  }

  if (
    value === 'admin' ||
    value === 'administrador'
  ) {
    return 'admin';
  }

  if (
    value === 'miembro' ||
    value === 'member'
  ) {
    return 'miembro';
  }

  return 'ninguno';
}

/**
 * =========================================================
 * 🔐 NORMALIZAR PERMISO
 * =========================================================
 *
 * Valores actuales:
 *
 * owner_admin
 * todos_miembros
 *
 * Se mantienen alias antiguos solamente para
 * compatibilidad con datos existentes.
 */
function normalizarPermisoDesdeDB(
  raw: unknown
): PermisoProyecto {
  const value = String(raw ?? '')
    .toLowerCase()
    .trim();

  if (
    [
      'todos_miembros',
      'all_members',
      'todos los miembros',
      'todos_los_miembros',
      'todos',
      'members',
      'miembros',
      'miembros_todos',
    ].includes(value)
  ) {
    return 'todos_miembros';
  }

  /**
   * owner antiguo también se transforma
   * en owner_admin.
   */
  return 'owner_admin';
}

/**
 * =========================================================
 * 🛡️ VALIDAR PERMISO
 * =========================================================
 */
function puedeGestionarSegunPermiso(
  permiso: PermisoProyecto,
  rol: RolProyecto
): boolean {
  if (rol === 'ninguno') {
    return false;
  }

  if (permiso === 'owner_admin') {
    return (
      rol === 'owner' ||
      rol === 'admin'
    );
  }

  return (
    rol === 'owner' ||
    rol === 'admin' ||
    rol === 'miembro'
  );
}

/**
 * =========================================================
 * 👥 OBTENER ROL EN PROYECTO
 * =========================================================
 */
async function obtenerRolEnProyecto(
  proyectoId: number,
  usuarioId: string
): Promise<RolProyecto> {
  const result =
    await db.execute({
      sql: `
        SELECT
          rol_en_proyecto AS rol
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT)
            = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [
        proyectoId,
        usuarioId,
      ],
    });

  const rows =
    castRows<RolRow>(
      result.rows
    );

  return normalizarRol(
    rows[0]?.rol
  );
}

/**
 * =========================================================
 * 📦 MAPEAR TAREA
 * =========================================================
 */
function mapTarea(
  row: TareaRow
) {
  return {
    id:
      String(row.id),

    proyecto_id:
      toNumber(
        row.proyecto_id
      ),

    titulo:
      row.titulo ?? '',

    descripcion:
      row.descripcion ?? null,

    prioridad:
      normalizePrioridad(
        row.prioridad
      ) ?? 'media',

    estado:
      normalizeEstado(
        row.estado
      ),

    tiempo_estimado_minutos:
      toNumber(
        row.tiempo_estimado_minutos
      ),

    max_participantes:
      toNumber(
        row.max_participantes
      ) ?? 1,

    creado_en:
      row.creado_en ?? null,

    actualizado_en:
      row.actualizado_en ?? null,

    creador_id:
      row.creador_id ?? null,
  };
}

/**
 * =========================================================
 * 📁 CARGAR PROYECTO Y TAREA
 * =========================================================
 */
async function cargarProyectoYTarea(
  proyectoId: number,
  tareaId: string
): Promise<{
  proyecto: ProyectoRow | null;
  tarea: TareaRow | null;
}> {
  const proyectoRes =
    await db.execute({
      sql: `
        SELECT
          id,
          creador_id,
          permiso_gestionar_tareas
        FROM proyectos
        WHERE id = ?
        LIMIT 1
      `,
      args: [
        proyectoId,
      ],
    });

  const tareaRes =
    await db.execute({
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
      args: [
        String(tareaId),
        proyectoId,
      ],
    });

  const proyectoRows =
    castRows<ProyectoRow>(
      proyectoRes.rows
    );

  const tareaRows =
    castRows<TareaRow>(
      tareaRes.rows
    );

  return {
    proyecto:
      proyectoRows[0] ??
      null,

    tarea:
      tareaRows[0] ??
      null,
  };
}

/**
 * =========================================================
 * 🔐 RESOLVER PERMISOS
 * =========================================================
 */
async function resolverPermisos(
  proyecto: ProyectoRow,
  proyectoId: number,
  userId: string
): Promise<{
  rolProyecto: RolProyecto;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}> {
  const esOwner =
    String(
      proyecto.creador_id ?? ''
    ) === String(userId);

  const rolProyecto:
    RolProyecto =
    esOwner
      ? 'owner'
      : await obtenerRolEnProyecto(
          proyectoId,
          userId
        );

  const permiso =
    normalizarPermisoDesdeDB(
      proyecto
        .permiso_gestionar_tareas
    );

  const puedeGestionar =
    puedeGestionarSegunPermiso(
      permiso,
      rolProyecto
    );

  return {
    rolProyecto,

    puedeEditar:
      puedeGestionar,

    puedeEliminar:
      puedeGestionar,
  };
}

/**
 * =========================================================
 * GET
 * =========================================================
 *
 * Devuelve la configuración de la tarea.
 */
export async function GET(
  req: NextRequest,
  context: {
    params:
      | Params
      | Promise<Params>;
  }
) {
  try {
    /**
     * =====================================================
     * 🔐 AUTENTICACIÓN
     * =====================================================
     */
    const sessionUser =
      await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No autenticado',
        },
        { status: 401 }
      );
    }

    const userId =
      String(sessionUser.id);

    /**
     * =====================================================
     * 📁 PARÁMETROS
     * =====================================================
     */
    const {
      id,
      tareaId,
    } = await getParams(
      context
    );

    const proyectoId =
      toProjectId(id);

    if (
      proyectoId == null ||
      !tareaId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Parámetros inválidos',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 📁 CARGAR DATOS
     * =====================================================
     */
    const {
      proyecto,
      tarea,
    } =
      await cargarProyectoYTarea(
        proyectoId,
        tareaId
      );

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no existe',
        },
        { status: 404 }
      );
    }

    if (!tarea) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Tarea no existe',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 👥 VALIDAR MEMBRESÍA
     * =====================================================
     */
    const permisos =
      await resolverPermisos(
        proyecto,
        proyectoId,
        userId
      );

    if (
      permisos.rolProyecto ===
      'ninguno'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sin acceso a esta tarea',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * ✅ RESPUESTA
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        data: {
          tarea:
            mapTarea(tarea),

          permisos: {
            puedeEditar:
              permisos
                .puedeEditar,

            puedeEliminar:
              permisos
                .puedeEliminar,
          },
        },

        tarea:
          mapTarea(tarea),

        permisos: {
          puedeEditar:
            permisos
              .puedeEditar,

          puedeEliminar:
            permisos
              .puedeEliminar,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/proyectos/[id]/tareas/[tareaId]/configuracion error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno al cargar la tarea',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * PUT
 * =========================================================
 *
 * Permite modificar únicamente:
 *
 * - título
 * - descripción
 * - prioridad
 * - tiempo estimado
 * - máximo de participantes
 *
 * IMPORTANTE:
 *
 * NO permite modificar estado.
 *
 * Las transiciones se realizan mediante:
 *
 * /comenzar
 * /completar
 * /rechazar
 * /aprobar
 * /estado (reapertura)
 */
export async function PUT(
  req: NextRequest,
  context: {
    params:
      | Params
      | Promise<Params>;
  }
) {
  try {
    /**
     * =====================================================
     * 🔐 AUTENTICACIÓN
     * =====================================================
     */
    const sessionUser =
      await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No autenticado',
        },
        { status: 401 }
      );
    }

    const userId =
      String(sessionUser.id);

    /**
     * =====================================================
     * 📁 PARÁMETROS
     * =====================================================
     */
    const {
      id,
      tareaId,
    } = await getParams(
      context
    );

    const proyectoId =
      toProjectId(id);

    if (
      proyectoId == null ||
      !tareaId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Parámetros inválidos',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 📁 CARGAR DATOS
     * =====================================================
     */
    const {
      proyecto,
      tarea,
    } =
      await cargarProyectoYTarea(
        proyectoId,
        tareaId
      );

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no existe',
        },
        { status: 404 }
      );
    }

    if (!tarea) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Tarea no existe',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 🔐 PERMISOS
     * =====================================================
     */
    const permisos =
      await resolverPermisos(
        proyecto,
        proyectoId,
        userId
      );

    if (
      permisos.rolProyecto ===
      'ninguno'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sin acceso a esta tarea',
        },
        { status: 403 }
      );
    }

    if (
      !permisos.puedeEditar
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes permisos para editar esta tarea',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 📝 BODY
     * =====================================================
     */
    const body =
      await req
        .json()
        .catch(() => ({}));

    /**
     * Si por error el frontend todavía intenta
     * enviar estado, simplemente no lo utilizamos.
     */
    const titulo =
      typeof body?.titulo ===
      'string'
        ? body.titulo.trim()
        : '';

    const descripcion =
      typeof body
        ?.descripcion === 'string'
        ? body.descripcion.trim()
        : body?.descripcion === null
          ? null
          : '';

    const prioridad =
      normalizePrioridad(
        body?.prioridad
      );

    const tiempoEstimadoMinutos =
      body
        ?.tiempo_estimado_minutos ==
      null
        ? null
        : Number(
            body
              .tiempo_estimado_minutos
          );

    const maxParticipantes =
      body?.max_participantes ==
      null
        ? 1
        : Number(
            body
              .max_participantes
          );

    /**
     * =====================================================
     * ✅ VALIDACIONES
     * =====================================================
     */
    if (!titulo) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El título es obligatorio',
        },
        { status: 400 }
      );
    }

    if (!prioridad) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Prioridad inválida',
        },
        { status: 400 }
      );
    }

    if (
      tiempoEstimadoMinutos !=
        null &&
      (
        !Number.isFinite(
          tiempoEstimadoMinutos
        ) ||
        tiempoEstimadoMinutos <
          0
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'tiempo_estimado_minutos inválido',
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(
        maxParticipantes
      ) ||
      !Number.isInteger(
        maxParticipantes
      ) ||
      maxParticipantes < 1
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'max_participantes inválido',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 👥 VALIDAR MÁXIMO DE PARTICIPANTES
     * =====================================================
     *
     * No permitimos bajar max_participantes por debajo
     * de la cantidad de asignaciones activas actuales.
     */
    const asignadosRes =
      await db.execute({
        sql: `
          SELECT
            COUNT(*) AS total
          FROM tarea_asignaciones
          WHERE tarea_id = ?
            AND estado = 'activo'
        `,
        args: [
          String(tareaId),
        ],
      });

    const totalAsignadosRow =
      asignadosRes.rows?.[0] as
        | {
            total?:
              | number
              | bigint
              | null;
          }
        | undefined;

    const totalAsignados =
      Number(
        totalAsignadosRow
          ?.total ?? 0
      );

    if (
      maxParticipantes <
      totalAsignados
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            `No puedes establecer max_participantes en ${maxParticipantes} porque actualmente existen ${totalAsignados} participantes activos`,
        },
        { status: 409 }
      );
    }

    const now =
      new Date().toISOString();

    const estadoActual =
      normalizeEstado(
        tarea.estado
      );

    /**
     * =====================================================
     * 💾 ACTUALIZAR CONFIGURACIÓN
     * =====================================================
     *
     * Observa que estado NO aparece en este UPDATE.
     */
    await db.execute({
      sql: `
        UPDATE tareas
        SET
          titulo = ?,
          descripcion = ?,
          prioridad = ?,
          tiempo_estimado_minutos = ?,
          max_participantes = ?,
          actualizado_en = ?
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [
        titulo,

        descripcion === ''
          ? null
          : descripcion,

        prioridad,

        tiempoEstimadoMinutos,

        maxParticipantes,

        now,

        String(tareaId),

        proyectoId,
      ],
    });

    /**
     * =====================================================
     * 📜 HISTORIAL
     * =====================================================
     *
     * No existe transición de estado.
     *
     * estado_anterior y estado_nuevo son iguales.
     */
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
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
        `,
        args: [
          randomUUID(),

          String(tareaId),

          userId,

          estadoActual,

          estadoActual,

          'Actualizó configuración de la tarea',

          now,
        ],
      });
    } catch (error) {
      console.warn(
        'No se pudo insertar en tarea_historial:',
        error
      );
    }

    /**
     * =====================================================
     * 🔎 RECARGAR TAREA
     * =====================================================
     */
    const updatedRes =
      await db.execute({
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
        args: [
          String(tareaId),
          proyectoId,
        ],
      });

    const updatedRows =
      castRows<TareaRow>(
        updatedRes.rows
      );

    const updated =
      updatedRows[0];

    if (!updated) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No se pudo recargar la tarea actualizada',
        },
        { status: 500 }
      );
    }

    /**
     * =====================================================
     * ✅ RESPUESTA
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        message:
          'Configuración guardada correctamente',

        data: {
          tarea:
            mapTarea(updated),
        },

        tarea:
          mapTarea(updated),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'PUT /api/proyectos/[id]/tareas/[tareaId]/configuracion error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno al guardar configuración',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * DELETE
 * =========================================================
 *
 * Elimina la tarea y sus datos relacionados.
 */
export async function DELETE(
  req: NextRequest,
  context: {
    params:
      | Params
      | Promise<Params>;
  }
) {
  try {
    /**
     * =====================================================
     * 🔐 AUTENTICACIÓN
     * =====================================================
     */
    const sessionUser =
      await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No autenticado',
        },
        { status: 401 }
      );
    }

    const userId =
      String(sessionUser.id);

    /**
     * =====================================================
     * 📁 PARÁMETROS
     * =====================================================
     */
    const {
      id,
      tareaId,
    } = await getParams(
      context
    );

    const proyectoId =
      toProjectId(id);

    if (
      proyectoId == null ||
      !tareaId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Parámetros inválidos',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 📁 CARGAR DATOS
     * =====================================================
     */
    const {
      proyecto,
      tarea,
    } =
      await cargarProyectoYTarea(
        proyectoId,
        tareaId
      );

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no existe',
        },
        { status: 404 }
      );
    }

    if (!tarea) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Tarea no existe',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 🔐 PERMISOS
     * =====================================================
     */
    const permisos =
      await resolverPermisos(
        proyecto,
        proyectoId,
        userId
      );

    if (
      permisos.rolProyecto ===
      'ninguno'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sin acceso a esta tarea',
        },
        { status: 403 }
      );
    }

    if (
      !permisos.puedeEliminar
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes permisos para eliminar esta tarea',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * ⏱️ EVITAR ELIMINAR TAREA CON CRONÓMETRO ACTIVO
     * =====================================================
     */
    const registroActivoRes =
      await db.execute({
        sql: `
          SELECT 1
          FROM registro_horas
          WHERE tarea_id = ?
            AND estado IN (
              'activo',
              'pausado'
            )
          LIMIT 1
        `,
        args: [
          String(tareaId),
        ],
      });

    if (
      registroActivoRes.rows
        ?.length
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes eliminar una tarea mientras existan registros de trabajo activos o pausados',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * 🗑️ ELIMINAR DATOS RELACIONADOS
     * =====================================================
     *
     * Mantenemos el orden para evitar problemas con FK.
     */
    await db.execute({
      sql: `
        DELETE FROM tarea_historial
        WHERE tarea_id = ?
      `,
      args: [
        String(tareaId),
      ],
    });

    await db.execute({
      sql: `
        DELETE FROM tarea_informes
        WHERE tarea_id = ?
      `,
      args: [
        String(tareaId),
      ],
    });

    await db.execute({
      sql: `
        DELETE FROM registro_horas
        WHERE tarea_id = ?
      `,
      args: [
        String(tareaId),
      ],
    });

    await db.execute({
      sql: `
        DELETE FROM tarea_asignaciones
        WHERE tarea_id = ?
      `,
      args: [
        String(tareaId),
      ],
    });

    await db.execute({
      sql: `
        DELETE FROM tareas
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [
        String(tareaId),
        proyectoId,
      ],
    });

    /**
     * =====================================================
     * ✅ RESPUESTA
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        message:
          'Tarea eliminada correctamente',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'DELETE /api/proyectos/[id]/tareas/[tareaId]/configuracion error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno al eliminar la tarea',
      },
      { status: 500 }
    );
  }
}