// app/api/proyectos/[id]/tareas/[tareaId]/rechazar/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

/**
 * =========================================================
 * TIPOS
 * =========================================================
 */

type RolProyecto =
  | 'owner'
  | 'admin'
  | 'miembro'
  | 'ninguno';

type EstadoTarea =
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'completed';

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
};

type RolRow = {
  rol?: string | null;
};

type TareaRow = {
  id: string;
  estado: string | null;
  proyecto_id: number | bigint | null;
};

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

function castRows<T>(
  rows: unknown[]
): T[] {
  return rows as T[];
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

/**
 * =========================================================
 * NORMALIZAR ESTADO
 * =========================================================
 */
function normalizeEstado(
  raw: unknown
): EstadoTarea {
  const value = String(raw ?? '')
    .toLowerCase()
    .trim();

  if (
    value === 'in-progress' ||
    value === 'in_progress' ||
    value === 'en progreso' ||
    value === 'en_progreso'
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
    value === 'completado' ||
    value === 'completada'
  ) {
    return 'completed';
  }

  return 'todo';
}

/**
 * =========================================================
 * NORMALIZAR ROL
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
 * POST
 * =========================================================
 *
 * POST /api/proyectos/[id]/tareas/[tareaId]/rechazar
 *
 * Flujo:
 *
 * review
 *   ↓
 * rechazar
 *   ↓
 * in-progress
 *
 * IMPORTANTE:
 *
 * - Solo owner/admin pueden rechazar.
 * - El comentario es obligatorio.
 * - NO se reinicia automáticamente el cronómetro.
 * - El colaborador deberá volver a usar /comenzar.
 * - Se limpia completado_en por compatibilidad con
 *   registros anteriores.
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      tareaId: string;
    }>;
  }
) {
  try {
    /**
     * =====================================================
     * AUTENTICACIÓN
     * =====================================================
     */
    const sessionUser =
      await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No autenticado',
        },
        { status: 401 }
      );
    }

    const userId =
      String(sessionUser.id);

    /**
     * =====================================================
     * PARÁMETROS
     * =====================================================
     */
    const {
      id,
      tareaId,
    } = await params;

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
     * BODY
     * =====================================================
     */
    const body =
      await req
        .json()
        .catch(() => ({}));

    const comentario =
      typeof body?.comentario ===
        'string'
        ? body.comentario.trim()
        : '';

    if (!comentario) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El comentario de rechazo es obligatorio',
        },
        { status: 400 }
      );
    }

    const now =
      new Date().toISOString();

    /**
     * =====================================================
     * OBTENER PROYECTO
     * =====================================================
     */
    const proyectoRes =
      await db.execute({
        sql: `
          SELECT
            id,
            creador_id
          FROM proyectos
          WHERE id = ?
          LIMIT 1
        `,
        args: [
          proyectoId,
        ],
      });

    const proyectoRows =
      castRows<ProyectoRow>(
        proyectoRes.rows
      );

    const proyecto =
      proyectoRows[0];

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

    /**
     * =====================================================
     * RESOLVER ROL
     * =====================================================
     */
    const esOwnerProyecto =
      String(
        proyecto.creador_id ?? ''
      ) === userId;

    let rolProyecto:
      RolProyecto;

    if (esOwnerProyecto) {
      rolProyecto =
        'owner';
    } else {
      const rolRes =
        await db.execute({
          sql: `
            SELECT
              rol_en_proyecto AS rol
            FROM proyecto_usuarios
            WHERE proyecto_id = ?
              AND CAST(
                    usuario_id
                    AS TEXT
                  )
                  =
                  CAST(
                    ?
                    AS TEXT
                  )
            LIMIT 1
          `,
          args: [
            proyectoId,
            userId,
          ],
        });

      const rolRows =
        castRows<RolRow>(
          rolRes.rows
        );

      rolProyecto =
        normalizarRol(
          rolRows[0]?.rol
        );
    }

    /**
     * =====================================================
     * VALIDAR ACCESO
     * =====================================================
     */
    if (
      rolProyecto ===
      'ninguno'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sin acceso a este proyecto',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * SOLO OWNER / ADMIN PUEDEN RECHAZAR
     * =====================================================
     */
    const esAdminProyecto =
      rolProyecto === 'admin';

    if (
      !esOwnerProyecto &&
      !esAdminProyecto
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo el owner o un admin pueden rechazar tareas',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * OBTENER TAREA
     * =====================================================
     */
    const tareaRes =
      await db.execute({
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
        args: [
          String(tareaId),
          proyectoId,
        ],
      });

    const tareaRows =
      castRows<TareaRow>(
        tareaRes.rows
      );

    const tarea =
      tareaRows[0];

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

    const estadoActual =
      normalizeEstado(
        tarea.estado
      );

    /**
     * =====================================================
     * VALIDAR ESTADO
     * =====================================================
     */
    if (
      estadoActual ===
      'completed'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'La tarea ya está completada',
        },
        { status: 409 }
      );
    }

    if (
      estadoActual !== 'review'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo se puede rechazar una tarea que esté en revisión',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * RECHAZAR TAREA
     * =====================================================
     *
     * La tarea vuelve a in-progress.
     *
     * El cronómetro NO empieza aquí.
     */
    await db.execute({
      sql: `
        UPDATE tareas
        SET
          estado = 'in-progress',
          ultimo_rechazo_comentario = ?,
          actualizado_en = ?
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [
        comentario,
        now,
        String(tareaId),
        proyectoId,
      ],
    });

    /**
     * =====================================================
     * LIMPIAR COMPLETADO_EN
     * =====================================================
     *
     * Con el flujo actual, /completar ya NO coloca
     * completado_en.
     *
     * Esto queda como protección para datos anteriores
     * o inconsistentes.
     */
    await db.execute({
      sql: `
        UPDATE tarea_asignaciones
        SET
          completado_en = NULL
        WHERE tarea_id = ?
          AND estado = 'activo'
      `,
      args: [
        String(tareaId),
      ],
    });

    /**
     * =====================================================
     * PROTECCIÓN DE REGISTRO_HORAS
     * =====================================================
     *
     * Una tarea en review no debería tener cronómetros
     * activos porque /completar los finaliza.
     *
     * Si existe algún registro residual activo/pausado,
     * lo dejamos finalizado SIN sumar tiempo adicional.
     *
     * No queremos contar como trabajo el tiempo que la
     * tarea estuvo esperando revisión.
     */
    await db.execute({
      sql: `
        UPDATE registro_horas
        SET
          iniciado_en = NULL,
          pausado_en = NULL,
          detenido_en = COALESCE(
            detenido_en,
            ?
          ),
          estado = 'finalizado'
        WHERE tarea_id = ?
          AND estado IN (
            'activo',
            'pausado'
          )
      `,
      args: [
        now,
        String(tareaId),
      ],
    });

    /**
     * =====================================================
     * HISTORIAL
     * =====================================================
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
          'review',
          'in-progress',
          comentario,
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
     * RECARGAR TAREA
     * =====================================================
     */
    const tareaUpdatedRes =
      await db.execute({
        sql: `
          SELECT
            id,
            estado,
            proyecto_id,
            ultimo_rechazo_comentario,
            actualizado_en
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

    const tareaUpdated =
      tareaUpdatedRes.rows?.[0] ??
      null;

    /**
     * =====================================================
     * RESPUESTA
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        message:
          'Tarea rechazada correctamente',

        tarea:
          tareaUpdated,

        meta: {
          comentario,

          rol_proyecto:
            rolProyecto,

          es_owner_proyecto:
            esOwnerProyecto,

          es_admin_proyecto:
            esAdminProyecto,

          /**
           * El trabajador debe volver a pulsar comenzar.
           */
          requiere_reanudar:
            true,

          cronometro_activo:
            false,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/tareas/[tareaId]/rechazar error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}