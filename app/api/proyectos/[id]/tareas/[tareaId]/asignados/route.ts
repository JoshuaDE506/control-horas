// app/api/proyectos/[id]/tareas/[tareaId]/asignados/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * =========================================================
 * 📌 TIPOS AUXILIARES
 * =========================================================
 */

type EstadoTarea =
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'completed';

type TareaProyectoRow = {
  id: string;
  proyecto_id: number | bigint;
  estado: string | null;
};

type ProyectoAccesoRow = {
  id: number | bigint;
  creador_id: string | null;
};

type AsignadoRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  seleccionada_at: string | null;
  iniciado_en: string | null;
  completado_en: string | null;
  cronometro_estado: string | null;
  cronometro_total_segundos:
    | number
    | bigint
    | null;
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

function toNumber(
  value:
    | number
    | bigint
    | null
    | undefined
): number {
  if (value == null) {
    return 0;
  }

  return Number(value);
}

/**
 * =========================================================
 * 📋 NORMALIZAR ESTADO DE TAREA
 * =========================================================
 */
function normalizeEstadoTarea(
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
 * GET /api/proyectos/[id]/tareas/[tareaId]/asignados
 * =========================================================
 *
 * Devuelve los participantes activos de la tarea.
 *
 * Incluye:
 *
 * - usuario
 * - fecha de selección
 * - fecha de inicio
 * - fecha de completado
 * - estado del cronómetro
 * - tiempo acumulado
 *
 * Las tareas son internas, por lo que solo pueden
 * acceder miembros del proyecto o el owner.
 */
export async function GET(
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

    /**
     * =====================================================
     * 📋 VALIDAR TAREA
     * =====================================================
     */
    const tareaRes =
      await db.execute({
        sql: `
          SELECT
            id,
            proyecto_id,
            estado
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
      castRows<TareaProyectoRow>(
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

    const estadoTarea =
      normalizeEstadoTarea(
        tarea.estado
      );

    /**
     * =====================================================
     * 📁 VALIDAR PROYECTO
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
      castRows<ProyectoAccesoRow>(
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
     * 👥 VALIDAR MEMBRESÍA
     * =====================================================
     */
    const esCreador =
      String(
        proyecto.creador_id ?? ''
      ) === userId;

    const memberRes =
      await db.execute({
        sql: `
          SELECT 1
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

    const esMiembro =
      Boolean(
        memberRes.rows?.length
      );

    /**
     * modo_acceso y visibilidad NO permiten ver
     * los participantes de las tareas.
     */
    if (
      !esCreador &&
      !esMiembro
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sin acceso a los participantes de esta tarea',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 👥 OBTENER ASIGNADOS ACTIVOS
     * =====================================================
     *
     * Se obtiene también el último registro_horas
     * de cada participante.
     */
    const asignadosRes =
      await db.execute({
        sql: `
          SELECT
            u.id,
            u.nombre,
            u.apellido,
            u.email,

            COALESCE(
              ta.seleccionado_en,
              ta.creado_en
            ) AS seleccionada_at,

            ta.iniciado_en,
            ta.completado_en,

            rh.estado
              AS cronometro_estado,

            rh.total_segundos
              AS cronometro_total_segundos

          FROM tarea_asignaciones ta

          JOIN usuarios u
            ON CAST(u.id AS TEXT)
             = CAST(
                 ta.usuario_id
                 AS TEXT
               )

          LEFT JOIN registro_horas rh
            ON rh.id = (
              SELECT rh2.id
              FROM registro_horas rh2
              WHERE rh2.tarea_id =
                    ta.tarea_id
                AND CAST(
                      rh2.usuario_id
                      AS TEXT
                    )
                    =
                    CAST(
                      ta.usuario_id
                      AS TEXT
                    )
              ORDER BY
                rh2.creado_en DESC
              LIMIT 1
            )

          WHERE ta.tarea_id = ?
            AND ta.estado = 'activo'

          ORDER BY
            ta.creado_en ASC
        `,
        args: [
          String(tareaId),
        ],
      });

    /**
     * =====================================================
     * 📦 MAPEAR PARTICIPANTES
     * =====================================================
     */
    const asignados =
      castRows<AsignadoRow>(
        asignadosRes.rows
      ).map(
        (row) => ({
          id:
            String(row.id),

          nombre:
            row.nombre ?? '',

          apellido:
            row.apellido ?? '',

          email:
            row.email ?? '',

          seleccionada_at:
            row.seleccionada_at ??
            null,

          iniciado_en:
            row.iniciado_en ??
            null,

          completado_en:
            row.completado_en ??
            null,

          /**
           * El usuario ha comenzado si existe
           * iniciado_en.
           */
          ha_comenzado:
            Boolean(
              row.iniciado_en
            ),

          /**
           * Solo será true después de la aprobación
           * definitiva de la tarea.
           */
          ha_completado:
            Boolean(
              row.completado_en
            ),

          cronometro: {
            estado:
              row.cronometro_estado ??
              null,

            total_segundos:
              toNumber(
                row
                  .cronometro_total_segundos
              ),
          },
        })
      );

    /**
     * =====================================================
     * 📊 TOTAL ACUMULADO REAL POR PARTICIPANTE
     * =====================================================
     *
     * IMPORTANTE:
     *
     * El LEFT JOIN anterior devuelve el último
     * registro_horas.
     *
     * Pero una tarea puede tener varios períodos:
     *
     * trabajo #1
     * → review
     * → rechazo
     * → trabajo #2
     *
     * Por eso calculamos también la suma total
     * de todos los registros del participante.
     */
    const asignadosConTotales =
      await Promise.all(
        asignados.map(
          async (asignado) => {
            const totalRes =
              await db.execute({
                sql: `
                  SELECT
                    COALESCE(
                      SUM(
                        total_segundos
                      ),
                      0
                    ) AS total
                  FROM registro_horas
                  WHERE tarea_id = ?
                    AND CAST(
                          usuario_id
                          AS TEXT
                        )
                        =
                        CAST(
                          ?
                          AS TEXT
                        )
                `,
                args: [
                  String(tareaId),
                  String(
                    asignado.id
                  ),
                ],
              });

            const totalRow =
              totalRes.rows?.[0] as
                | {
                    total?:
                      | number
                      | bigint
                      | null;
                  }
                | undefined;

            return {
              ...asignado,

              cronometro: {
                ...asignado
                  .cronometro,

                total_segundos:
                  Number(
                    totalRow
                      ?.total ?? 0
                  ),
              },
            };
          }
        )
      );

    /**
     * =====================================================
     * ✅ RESPUESTA FINAL
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        asignados:
          asignadosConTotales,

        meta: {
          es_creador:
            esCreador,

          es_miembro:
            true,

          estado_tarea:
            estadoTarea,

          total_asignados:
            asignadosConTotales
              .length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/proyectos/[id]/tareas/[tareaId]/asignados error:',
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