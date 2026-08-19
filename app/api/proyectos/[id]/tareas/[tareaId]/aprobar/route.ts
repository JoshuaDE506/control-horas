// app/api/proyectos/[id]/tareas/[tareaId]/aprobar/route.ts

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
 * 🔄 HELPERS
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
 * 📋 NORMALIZAR ESTADO
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
 * POST /api/proyectos/[id]/tareas/[tareaId]/aprobar
 * =========================================================
 *
 * Flujo:
 *
 * review
 *   ↓
 * aprobar
 *   ↓
 * completed
 *
 * Al aprobar:
 *
 * - Se marca la tarea como completada.
 * - Se guarda fecha_aprobacion.
 * - Se guarda aprobado_por.
 * - Las asignaciones activas reciben completado_en.
 *
 * El cronómetro NO se toca aquí porque debe haber sido
 * finalizado cuando la tarea pasó a review.
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
     * 🔐 VALIDAR USUARIO
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
     * 📁 VALIDAR PARÁMETROS
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

    const now =
      new Date().toISOString();

    /**
     * =====================================================
     * 📁 OBTENER PROYECTO
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
        args: [proyectoId],
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
     * 👤 OBTENER ROL
     * =====================================================
     */
    const esOwnerProyecto =
      String(
        proyecto.creador_id ?? ''
      ) === userId;

    let rolProyecto: RolProyecto;

    if (esOwnerProyecto) {
      rolProyecto = 'owner';
    } else {
      const rolRes =
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
     * 🔒 VALIDAR MEMBRESÍA
     * =====================================================
     */
    if (
      rolProyecto === 'ninguno'
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
     * 🛡️ SOLO OWNER / ADMIN PUEDEN APROBAR
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
            'Solo el owner o un admin pueden aprobar tareas',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 📋 OBTENER TAREA
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
     * 🔒 VALIDAR ESTADO
     * =====================================================
     */
    if (
      estadoActual === 'completed'
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
            'Solo se puede aprobar una tarea que esté en revisión',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * ✅ APROBAR TAREA
     * =====================================================
     */
    await db.execute({
      sql: `
        UPDATE tareas
        SET
          estado = 'completed',
          fecha_aprobacion = ?,
          aprobado_por = ?,
          ultimo_rechazo_comentario = NULL,
          actualizado_en = ?
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [
        now,
        userId,
        now,
        String(tareaId),
        proyectoId,
      ],
    });

    /**
     * =====================================================
     * 👥 COMPLETAR ASIGNACIONES ACTIVAS
     * =====================================================
     *
     * Aquí sí tiene sentido establecer completado_en,
     * porque el trabajo fue aprobado definitivamente.
     *
     * Mantenemos estado = activo porque por ahora ese
     * campo identifica una participación válida en
     * la tarea.
     */
    await db.execute({
      sql: `
        UPDATE tarea_asignaciones
        SET completado_en = ?
        WHERE tarea_id = ?
          AND estado = 'activo'
      `,
      args: [
        now,
        String(tareaId),
      ],
    });

    /**
     * =====================================================
     * 🛡️ CERRAR REGISTROS DE HORAS RESIDUALES
     * =====================================================
     *
     * Normalmente /completar ya los deja finalizados.
     *
     * Esto es únicamente una protección adicional ante
     * registros antiguos o datos inconsistentes.
     *
     * No calculamos tiempo extra aquí, porque desde review
     * ya no debería existir tiempo trabajando.
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
     * 📜 HISTORIAL
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
          'completed',
          'Tarea aprobada',
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
    const tareaUpdatedRes =
      await db.execute({
        sql: `
          SELECT
            id,
            estado,
            proyecto_id,
            fecha_aprobacion,
            aprobado_por,
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
     * 📊 TOTAL DE HORAS DE LA TAREA
     * =====================================================
     */
    const totalHorasRes =
      await db.execute({
        sql: `
          SELECT
            COALESCE(
              SUM(total_segundos),
              0
            ) AS total_segundos
          FROM registro_horas
          WHERE tarea_id = ?
        `,
        args: [
          String(tareaId),
        ],
      });

    const totalHorasRow =
      totalHorasRes.rows?.[0] as
        | {
            total_segundos?:
              | number
              | bigint
              | null;
          }
        | undefined;

    const totalSegundos =
      Number(
        totalHorasRow
          ?.total_segundos ?? 0
      );

    /**
     * =====================================================
     * ✅ RESPUESTA FINAL
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        message:
          'Tarea aprobada correctamente',

        tarea:
          tareaUpdated,

        meta: {
          aprobado_por:
            userId,

          fecha_aprobacion:
            now,

          completado_en:
            now,

          total_segundos:
            totalSegundos,

          rol_proyecto:
            rolProyecto,

          es_owner_proyecto:
            esOwnerProyecto,

          es_admin_proyecto:
            esAdminProyecto,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/tareas/[tareaId]/aprobar error:',
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