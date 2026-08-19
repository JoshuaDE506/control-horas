// app/api/reportes/tareas/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * =========================================================
 * TIPOS
 * =========================================================
 */

type EstadoTarea =
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'completed';

type PrioridadTarea =
  | 'baja'
  | 'media'
  | 'alta'
  | 'critica';

type BaseTareaRow = {
  id: string;

  titulo: string | null;
  descripcion: string | null;

  prioridad: string | null;
  estado: string | null;

  creado_en: string | null;
  actualizado_en: string | null;

  proyecto_id:
    | number
    | bigint
    | null;

  proyecto_nombre:
    | string
    | null;

  creador_id:
    | string
    | null;

  creado_por:
    | string
    | null;

  usuario_id:
    | string
    | null;

  asignado_directo:
    | string
    | null;

  asignados:
    | string
    | null;

  tiempo_estimado_minutos:
    | number
    | bigint
    | null;

  seleccionado_en:
    | string
    | null;

  fecha_inicio_trabajo:
    | string
    | null;

  fecha_envio_revision:
    | string
    | null;

  fecha_aprobacion:
    | string
    | null;

  aprobado_por:
    | string
    | null;

  aprobado_por_nombre:
    | string
    | null;

  ultimo_rechazo_comentario:
    | string
    | null;

  segundos_reales:
    | number
    | bigint
    | null;

  cantidad_selecciones:
    | number
    | bigint
    | null;

  cantidad_completadas:
    | number
    | bigint
    | null;
};

type ResumenRow = {
  total?:
    | number
    | bigint
    | null;

  pendientes?:
    | number
    | bigint
    | null;

  en_progreso?:
    | number
    | bigint
    | null;

  revision?:
    | number
    | bigint
    | null;

  completadas?:
    | number
    | bigint
    | null;
};

type ActividadRow = {
  periodo:
    | string
    | null;

  total:
    | number
    | bigint
    | null;
};

type HorasRow = {
  hoy?:
    | number
    | bigint
    | null;

  semana?:
    | number
    | bigint
    | null;

  mes?:
    | number
    | bigint
    | null;

  rango?:
    | number
    | bigint
    | null;
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

function toNumber(
  value: unknown
): number {
  if (value == null) {
    return 0;
  }

  if (
    typeof value === 'bigint'
  ) {
    return Number(value);
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function normalizarTexto(
  value: string | null
): string {
  return String(value ?? '')
    .trim();
}

/**
 * =========================================================
 * ESTADO
 * =========================================================
 */

function normalizeEstado(
  raw: unknown
): EstadoTarea {
  const value =
    String(raw ?? '')
      .trim()
      .toLowerCase();

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

function estadoLabel(
  estado: EstadoTarea
): string {
  switch (estado) {
    case 'todo':
      return 'Por hacer';

    case 'in-progress':
      return 'En progreso';

    case 'review':
      return 'En revisión';

    case 'completed':
      return 'Completada';
  }
}

/**
 * =========================================================
 * PRIORIDAD
 * =========================================================
 */

function normalizePrioridad(
  raw: unknown
): PrioridadTarea | null {
  const value =
    String(raw ?? '')
      .trim()
      .toLowerCase();

  if (value === 'baja') {
    return 'baja';
  }

  if (value === 'media') {
    return 'media';
  }

  if (value === 'alta') {
    return 'alta';
  }

  if (
    value === 'critica' ||
    value === 'crítica'
  ) {
    return 'critica';
  }

  return null;
}

function prioridadLabel(
  prioridad: unknown
): string {
  switch (
    normalizePrioridad(
      prioridad
    )
  ) {
    case 'baja':
      return 'Baja';

    case 'alta':
      return 'Alta';

    case 'critica':
      return 'Crítica';

    default:
      return 'Media';
  }
}

/**
 * =========================================================
 * FECHAS
 * =========================================================
 */

function esFechaValida(
  value: string
): boolean {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function inicioDiaIso(
  fecha: string
): string {
  return `${fecha}T00:00:00`;
}

function finDiaIso(
  fecha: string
): string {
  return `${fecha}T23:59:59`;
}

/**
 * =========================================================
 * FECHAS DEL RESUMEN
 * =========================================================
 */

function construirFechasBase() {
  const now =
    new Date();

  const inicioHoy =
    new Date(now);

  inicioHoy.setHours(
    0,
    0,
    0,
    0
  );

  const inicioSemana =
    new Date(now);

  const day =
    inicioSemana.getDay();

  const diff =
    day === 0
      ? 6
      : day - 1;

  inicioSemana.setDate(
    inicioSemana.getDate() -
      diff
  );

  inicioSemana.setHours(
    0,
    0,
    0,
    0
  );

  const inicioMes =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

  return {
    inicioHoy:
      inicioHoy.toISOString(),

    inicioSemana:
      inicioSemana.toISOString(),

    inicioMes:
      inicioMes.toISOString(),
  };
}

/**
 * =========================================================
 * GET /api/reportes/tareas
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    /**
     * =====================================================
     * AUTENTICACIÓN
     * =====================================================
     */

    const sessionUser =
      await getAuthenticatedUser(
        req
      );

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No autenticado',
        },
        {
          status: 401,
        }
      );
    }

    const userId =
      String(
        sessionUser.id
      );

    /**
     * =====================================================
     * FILTROS
     * =====================================================
     */

    const {
      searchParams,
    } = new URL(req.url);

    const fechaInicio =
      normalizarTexto(
        searchParams.get(
          'fecha_inicio'
        )
      );

    const fechaFin =
      normalizarTexto(
        searchParams.get(
          'fecha_fin'
        )
      );

    const proyectoId =
      normalizarTexto(
        searchParams.get(
          'proyecto_id'
        )
      );

    const usuarioIdFiltro =
      normalizarTexto(
        searchParams.get(
          'usuario_id'
        )
      );

    const estadoRaw =
      normalizarTexto(
        searchParams.get(
          'estado'
        )
      );

    const prioridadRaw =
      normalizarTexto(
        searchParams.get(
          'prioridad'
        )
      );

    /**
     * =====================================================
     * VALIDAR FECHAS
     * =====================================================
     */

    if (
      !esFechaValida(
        fechaInicio
      ) ||
      !esFechaValida(
        fechaFin
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Formato de fecha inválido. Utiliza YYYY-MM-DD',
        },
        {
          status: 400,
        }
      );
    }

    if (
      fechaInicio &&
      fechaFin &&
      fechaInicio > fechaFin
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'La fecha de inicio no puede ser posterior a la fecha final',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * VALIDAR ESTADO
     * =====================================================
     */

    let estadoFiltro:
      EstadoTarea | null =
      null;

    if (estadoRaw) {
      const normalizado =
        normalizeEstado(
          estadoRaw
        );

      const valoresValidos = [
        'todo',
        'in-progress',
        'in_progress',
        'en progreso',
        'en_progreso',
        'review',
        'revision',
        'revisión',
        'completed',
        'completado',
        'completada',
      ];

      if (
        !valoresValidos.includes(
          estadoRaw.toLowerCase()
        )
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Estado de tarea inválido',
          },
          {
            status: 400,
          }
        );
      }

      estadoFiltro =
        normalizado;
    }

    /**
     * =====================================================
     * VALIDAR PRIORIDAD
     * =====================================================
     */

    const prioridadFiltro =
      prioridadRaw
        ? normalizePrioridad(
            prioridadRaw
          )
        : null;

    if (
      prioridadRaw &&
      !prioridadFiltro
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Prioridad inválida',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * VALIDAR PROYECTO
     * =====================================================
     *
     * Si se solicita un proyecto específico,
     * verificamos primero que el usuario sea miembro.
     */

    if (proyectoId) {
      const accesoProyectoRes =
        await db.execute({
          sql: `
            SELECT
              p.id,
              p.creador_id,

              pu.rol_en_proyecto

            FROM proyectos p

            LEFT JOIN proyecto_usuarios pu
              ON pu.proyecto_id = p.id
             AND CAST(
                   pu.usuario_id AS TEXT
                 )
                 =
                 CAST(
                   ? AS TEXT
                 )

            WHERE CAST(
                    p.id AS TEXT
                  )
                  =
                  CAST(
                    ? AS TEXT
                  )

            LIMIT 1
          `,
          args: [
            userId,
            proyectoId,
          ],
        });

      const proyecto =
        accesoProyectoRes
          .rows?.[0] as
          | {
              id?:
                | number
                | bigint
                | null;

              creador_id?:
                | string
                | null;

              rol_en_proyecto?:
                | string
                | null;
            }
          | undefined;

      if (!proyecto?.id) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Proyecto no encontrado',
          },
          {
            status: 404,
          }
        );
      }

      const esCreador =
        String(
          proyecto.creador_id ??
            ''
        ) === userId;

      const esMiembro =
        Boolean(
          proyecto
            .rol_en_proyecto
        );

      if (
        !esCreador &&
        !esMiembro
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Sin acceso a este proyecto',
          },
          {
            status: 403,
          }
        );
      }
    }

    /**
     * =====================================================
     * WHERE PRINCIPAL
     * =====================================================
     */

    const where: string[] =
      [];

    const args: Array<
      string | number
    > = [];

    /**
     * Solo tareas pertenecientes a proyectos
     * de los que el usuario es creador o miembro.
     */
    where.push(`
      (
        CAST(
          p.creador_id AS TEXT
        ) = CAST(? AS TEXT)

        OR EXISTS (
          SELECT 1

          FROM proyecto_usuarios pu_access

          WHERE pu_access.proyecto_id = p.id

            AND CAST(
                  pu_access.usuario_id
                  AS TEXT
                )
                =
                CAST(
                  ? AS TEXT
                )
        )
      )
    `);

    args.push(
      userId,
      userId
    );

    if (proyectoId) {
      where.push(`
        CAST(
          t.proyecto_id AS TEXT
        ) = CAST(? AS TEXT)
      `);

      args.push(
        proyectoId
      );
    }

    /**
     * El filtro de fechas corresponde a fecha
     * de creación de la tarea.
     */
    if (fechaInicio) {
      where.push(`
        datetime(t.creado_en)
        >=
        datetime(?)
      `);

      args.push(
        inicioDiaIso(
          fechaInicio
        )
      );
    }

    if (fechaFin) {
      where.push(`
        datetime(t.creado_en)
        <=
        datetime(?)
      `);

      args.push(
        finDiaIso(
          fechaFin
        )
      );
    }

    if (estadoFiltro) {
      where.push(`
        LOWER(
          TRIM(t.estado)
        ) = ?
      `);

      args.push(
        estadoFiltro
      );
    }

    if (prioridadFiltro) {
      where.push(`
        LOWER(
          TRIM(t.prioridad)
        ) = ?
      `);

      args.push(
        prioridadFiltro
      );
    }

    /**
     * Filtrar por colaborador relacionado con la tarea.
     *
     * Incluye:
     *
     * - asignación directa antigua
     * - tarea_asignaciones
     */
    if (usuarioIdFiltro) {
      where.push(`
        (
          CAST(
            COALESCE(
              t.usuario_id,
              ''
            )
            AS TEXT
          )
          =
          CAST(? AS TEXT)

          OR EXISTS (
            SELECT 1

            FROM tarea_asignaciones ta_filter

            WHERE ta_filter.tarea_id = t.id

              AND CAST(
                    ta_filter.usuario_id
                    AS TEXT
                  )
                  =
                  CAST(
                    ? AS TEXT
                  )
          )
        )
      `);

      args.push(
        usuarioIdFiltro,
        usuarioIdFiltro
      );
    }

    const whereSql =
      where.length
        ? `WHERE ${where.join(
            ' AND '
          )}`
        : '';

    /**
     * =====================================================
     * FROM BASE
     * =====================================================
     */

    const baseFromSql = `
      FROM tareas t

      INNER JOIN proyectos p
        ON p.id = t.proyecto_id

      LEFT JOIN usuarios uc
        ON CAST(
             uc.id AS TEXT
           )
           =
           CAST(
             t.creador_id AS TEXT
           )

      LEFT JOIN usuarios ua
        ON CAST(
             ua.id AS TEXT
           )
           =
           CAST(
             t.usuario_id AS TEXT
           )

      LEFT JOIN usuarios uap
        ON CAST(
             uap.id AS TEXT
           )
           =
           CAST(
             t.aprobado_por AS TEXT
           )

      /**
       * Participantes de la tarea.
       */
      LEFT JOIN (
        SELECT
          ta.tarea_id,

          MIN(
            COALESCE(
              ta.seleccionado_en,
              ta.creado_en
            )
          ) AS seleccionado_en,

          GROUP_CONCAT(
            TRIM(
              COALESCE(
                u.nombre,
                ''
              )
              || ' ' ||
              COALESCE(
                u.apellido,
                ''
              )
            ),
            ', '
          ) AS asignados,

          COUNT(*) AS cantidad_selecciones,

          SUM(
            CASE
              WHEN ta.completado_en
                   IS NOT NULL
              THEN 1
              ELSE 0
            END
          ) AS cantidad_completadas

        FROM tarea_asignaciones ta

        INNER JOIN usuarios u
          ON CAST(
               u.id AS TEXT
             )
             =
             CAST(
               ta.usuario_id AS TEXT
             )

        WHERE ta.estado IN (
          'activo',
          'completado',
          'pausado'
        )

        GROUP BY
          ta.tarea_id
      ) ta_agg
        ON ta_agg.tarea_id = t.id

      /**
       * Tiempo real de toda la tarea.
       *
       * Si el registro está activo se suma también
       * el tramo todavía abierto.
       */
      LEFT JOIN (
        SELECT
          rh.tarea_id,

          SUM(
            COALESCE(
              rh.total_segundos,
              0
            )
            +
            CASE
              WHEN rh.estado = 'activo'
                   AND rh.iniciado_en
                       IS NOT NULL

              THEN MAX(
                0,
                CAST(
                  strftime(
                    '%s',
                    'now'
                  )
                  AS INTEGER
                )
                -
                CAST(
                  strftime(
                    '%s',
                    rh.iniciado_en
                  )
                  AS INTEGER
                )
              )

              ELSE 0
            END
          ) AS segundos_reales

        FROM registro_horas rh

        GROUP BY
          rh.tarea_id
      ) rh_agg
        ON rh_agg.tarea_id = t.id
    `;

    /**
     * =====================================================
     * RESUMEN
     * =====================================================
     */

    const resumenRes =
      await db.execute({
        sql: `
          SELECT

            COUNT(*) AS total,

            SUM(
              CASE
                WHEN t.estado = 'todo'
                THEN 1
                ELSE 0
              END
            ) AS pendientes,

            SUM(
              CASE
                WHEN t.estado = 'in-progress'
                THEN 1
                ELSE 0
              END
            ) AS en_progreso,

            SUM(
              CASE
                WHEN t.estado = 'review'
                THEN 1
                ELSE 0
              END
            ) AS revision,

            SUM(
              CASE
                WHEN t.estado = 'completed'
                THEN 1
                ELSE 0
              END
            ) AS completadas

          ${baseFromSql}

          ${whereSql}
        `,
        args,
      });

    const resumenRow =
      castRows<ResumenRow>(
        resumenRes.rows
      )[0] ?? {};

    /**
     * =====================================================
     * TAREAS
     * =====================================================
     */

    const tareasRes =
      await db.execute({
        sql: `
          SELECT
            t.id,

            t.titulo,
            t.descripcion,

            t.prioridad,
            t.estado,

            t.creado_en,
            t.actualizado_en,

            t.proyecto_id,

            p.nombre
              AS proyecto_nombre,

            t.creador_id,

            TRIM(
              COALESCE(
                uc.nombre,
                ''
              )
              || ' ' ||
              COALESCE(
                uc.apellido,
                ''
              )
            ) AS creado_por,

            t.usuario_id,

            TRIM(
              COALESCE(
                ua.nombre,
                ''
              )
              || ' ' ||
              COALESCE(
                ua.apellido,
                ''
              )
            ) AS asignado_directo,

            ta_agg.asignados,

            t.tiempo_estimado_minutos,

            ta_agg.seleccionado_en,

            t.fecha_inicio_trabajo,

            t.fecha_envio_revision,

            t.fecha_aprobacion,

            t.aprobado_por,

            TRIM(
              COALESCE(
                uap.nombre,
                ''
              )
              || ' ' ||
              COALESCE(
                uap.apellido,
                ''
              )
            ) AS aprobado_por_nombre,

            t.ultimo_rechazo_comentario,

            COALESCE(
              rh_agg.segundos_reales,
              0
            ) AS segundos_reales,

            COALESCE(
              ta_agg.cantidad_selecciones,
              0
            ) AS cantidad_selecciones,

            COALESCE(
              ta_agg.cantidad_completadas,
              0
            ) AS cantidad_completadas

          ${baseFromSql}

          ${whereSql}

          ORDER BY
            datetime(
              t.creado_en
            ) DESC
        `,
        args,
      });

    const tareasRows =
      castRows<BaseTareaRow>(
        tareasRes.rows
      );

    const tareas =
      tareasRows.map(
        (row) => {
          const estado =
            normalizeEstado(
              row.estado
            );

          const segundosReales =
            Math.max(
              0,
              toNumber(
                row.segundos_reales
              )
            );

          const minutosReales =
            Number(
              (
                segundosReales /
                60
              ).toFixed(2)
            );

          const estimado =
            Math.max(
              0,
              toNumber(
                row
                  .tiempo_estimado_minutos
              )
            );

          const asignadoA =
            row.asignados?.trim() ||
            row
              .asignado_directo
              ?.trim() ||
            '—';

          const rendimiento =
            estimado > 0 &&
            minutosReales > 0
              ? Number(
                  (
                    (
                      estimado /
                      minutosReales
                    ) *
                    100
                  ).toFixed(2)
                )
              : null;

          return {
            id:
              String(
                row.id
              ),

            titulo:
              row.titulo ?? '',

            descripcion:
              row.descripcion ??
              '',

            prioridad:
              normalizePrioridad(
                row.prioridad
              ) ?? 'media',

            prioridad_label:
              prioridadLabel(
                row.prioridad
              ),

            estado,

            estado_label:
              estadoLabel(
                estado
              ),

            proyecto_id:
              toNumber(
                row.proyecto_id
              ),

            proyecto_nombre:
              row
                .proyecto_nombre ??
              '',

            creador_id:
              row.creador_id
                ? String(
                    row.creador_id
                  )
                : '',

            creado_por:
              row.creado_por
                ?.trim() ||
              '—',

            usuario_id:
              row.usuario_id
                ? String(
                    row.usuario_id
                  )
                : null,

            asignado_a:
              asignadoA,

            /**
             * Actualmente la tarea no tiene
             * fecha límite definida.
             */
            fecha_limite:
              null,

            fecha_creacion:
              row.creado_en ??
              null,

            creado_en:
              row.creado_en ??
              null,

            actualizado_en:
              row
                .actualizado_en ??
              null,

            seleccionado_en:
              row
                .seleccionado_en ??
              null,

            fecha_inicio_trabajo:
              row
                .fecha_inicio_trabajo ??
              null,

            fecha_envio_revision:
              row
                .fecha_envio_revision ??
              null,

            fecha_aprobacion:
              row
                .fecha_aprobacion ??
              null,

            fecha_completado:
              row
                .fecha_aprobacion ??
              null,

            aprobado_por:
              row.aprobado_por
                ? String(
                    row.aprobado_por
                  )
                : null,

            aprobado_por_nombre:
              row
                .aprobado_por_nombre
                ?.trim() ||
              null,

            ultimo_rechazo_comentario:
              row
                .ultimo_rechazo_comentario ??
              null,

            tiempo_estimado_minutos:
              estimado,

            segundos_reales:
              segundosReales,

            minutos_reales:
              minutosReales,

            horas_reales:
              Number(
                (
                  segundosReales /
                  3600
                ).toFixed(2)
              ),

            cantidad_selecciones:
              toNumber(
                row
                  .cantidad_selecciones
              ),

            cantidad_completadas:
              toNumber(
                row
                  .cantidad_completadas
              ),

            rendimiento_porcentaje:
              rendimiento,
          };
        }
      );

    /**
     * =====================================================
     * HORAS
     * =====================================================
     *
     * Estas métricas corresponden al usuario que está
     * consultando el reporte.
     */

    const {
      inicioHoy,
      inicioSemana,
      inicioMes,
    } = construirFechasBase();

    const filtrosHoras: string[] =
      [
        `
          CAST(
            rh.usuario_id
            AS TEXT
          ) = CAST(? AS TEXT)
        `,
      ];

    const argsHoras: Array<
      string | number
    > = [
      userId,
    ];

    /**
     * Solo proyectos a los que el usuario pertenece.
     */
    filtrosHoras.push(`
      (
        CAST(
          p.creador_id AS TEXT
        ) = CAST(? AS TEXT)

        OR EXISTS (
          SELECT 1

          FROM proyecto_usuarios pu_hours

          WHERE pu_hours.proyecto_id = p.id

            AND CAST(
                  pu_hours.usuario_id
                  AS TEXT
                )
                =
                CAST(
                  ? AS TEXT
                )
        )
      )
    `);

    argsHoras.push(
      userId,
      userId
    );

    if (proyectoId) {
      filtrosHoras.push(`
        CAST(
          t.proyecto_id
          AS TEXT
        ) = CAST(? AS TEXT)
      `);

      argsHoras.push(
        proyectoId
      );
    }

    if (fechaInicio) {
      filtrosHoras.push(`
        datetime(
          rh.creado_en
        )
        >=
        datetime(?)
      `);

      argsHoras.push(
        inicioDiaIso(
          fechaInicio
        )
      );
    }

    if (fechaFin) {
      filtrosHoras.push(`
        datetime(
          rh.creado_en
        )
        <=
        datetime(?)
      `);

      argsHoras.push(
        finDiaIso(
          fechaFin
        )
      );
    }

    const whereHorasSql =
      `WHERE ${filtrosHoras.join(
        ' AND '
      )}`;

    /**
     * Cada registro aporta:
     *
     * total_segundos
     *
     * +
     *
     * tramo abierto si actualmente está activo.
     */
    const segundosRegistroSql = `
      (
        COALESCE(
          rh.total_segundos,
          0
        )
        +
        CASE
          WHEN rh.estado = 'activo'
               AND rh.iniciado_en
                   IS NOT NULL

          THEN MAX(
            0,

            CAST(
              strftime(
                '%s',
                'now'
              )
              AS INTEGER
            )
            -
            CAST(
              strftime(
                '%s',
                rh.iniciado_en
              )
              AS INTEGER
            )
          )

          ELSE 0
        END
      )
    `;

    const horasRes =
      await db.execute({
        sql: `
          SELECT

            SUM(
              CASE
                WHEN datetime(
                       rh.creado_en
                     )
                     >=
                     datetime(?)

                THEN
                  ${segundosRegistroSql}

                ELSE 0
              END
            ) AS hoy,

            SUM(
              CASE
                WHEN datetime(
                       rh.creado_en
                     )
                     >=
                     datetime(?)

                THEN
                  ${segundosRegistroSql}

                ELSE 0
              END
            ) AS semana,

            SUM(
              CASE
                WHEN datetime(
                       rh.creado_en
                     )
                     >=
                     datetime(?)

                THEN
                  ${segundosRegistroSql}

                ELSE 0
              END
            ) AS mes,

            SUM(
              ${segundosRegistroSql}
            ) AS rango

          FROM registro_horas rh

          INNER JOIN tareas t
            ON t.id = rh.tarea_id

          INNER JOIN proyectos p
            ON p.id = t.proyecto_id

          ${whereHorasSql}
        `,
        args: [
          inicioHoy,
          inicioSemana,
          inicioMes,
          ...argsHoras,
        ],
      });

    const horasRow =
      (horasRes
        .rows?.[0] as
        HorasRow | undefined) ??
      {};

    /**
     * =====================================================
     * ACTIVIDAD
     * =====================================================
     */

    const actividadRes =
      await db.execute({
        sql: `
          SELECT

            strftime(
              '%Y-%m-%d',
              t.creado_en
            ) AS periodo,

            COUNT(*) AS total

          ${baseFromSql}

          ${whereSql}

          GROUP BY
            strftime(
              '%Y-%m-%d',
              t.creado_en
            )

          ORDER BY
            periodo ASC
        `,
        args,
      });

    const actividad =
      castRows<ActividadRow>(
        actividadRes.rows
      ).map(
        (row) => ({
          periodo:
            row.periodo ?? '',

          total:
            toNumber(
              row.total
            ),
        })
      );

    /**
     * =====================================================
     * TAREAS POR ESTADO
     * =====================================================
     */

    const tareasPorEstado = [
      {
        estado: 'todo',
        label:
          estadoLabel(
            'todo'
          ),
        total:
          toNumber(
            resumenRow
              .pendientes
          ),
      },

      {
        estado:
          'in-progress',
        label:
          estadoLabel(
            'in-progress'
          ),
        total:
          toNumber(
            resumenRow
              .en_progreso
          ),
      },

      {
        estado: 'review',
        label:
          estadoLabel(
            'review'
          ),
        total:
          toNumber(
            resumenRow
              .revision
          ),
      },

      {
        estado:
          'completed',
        label:
          estadoLabel(
            'completed'
          ),
        total:
          toNumber(
            resumenRow
              .completadas
          ),
      },
    ];

    /**
     * =====================================================
     * RESPUESTA
     * =====================================================
     */

    return NextResponse.json(
      {
        ok: true,

        filtros: {
          fecha_inicio:
            fechaInicio ||
            null,

          fecha_fin:
            fechaFin ||
            null,

          proyecto_id:
            proyectoId ||
            null,

          usuario_id:
            usuarioIdFiltro ||
            null,

          estado:
            estadoFiltro,

          prioridad:
            prioridadFiltro,
        },

        resumen: {
          total:
            toNumber(
              resumenRow.total
            ),

          pendientes:
            toNumber(
              resumenRow
                .pendientes
            ),

          en_progreso:
            toNumber(
              resumenRow
                .en_progreso
            ),

          revision:
            toNumber(
              resumenRow
                .revision
            ),

          completadas:
            toNumber(
              resumenRow
                .completadas
            ),

          /**
           * Cancelada NO es un estado de tarea.
           *
           * cancelado pertenece a tarea_asignaciones.
           */
          canceladas: 0,

          horas_hoy:
            Number(
              (
                toNumber(
                  horasRow.hoy
                ) / 3600
              ).toFixed(2)
            ),

          horas_semana:
            Number(
              (
                toNumber(
                  horasRow.semana
                ) / 3600
              ).toFixed(2)
            ),

          horas_mes:
            Number(
              (
                toNumber(
                  horasRow.mes
                ) / 3600
              ).toFixed(2)
            ),

          horas_rango:
            Number(
              (
                toNumber(
                  horasRow.rango
                ) / 3600
              ).toFixed(2)
            ),
        },

        graficas: {
          tareas_por_estado:
            tareasPorEstado,

          actividad_por_dia:
            actividad,
        },

        tareas,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'GET /api/reportes/tareas error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno del servidor',
      },
      {
        status: 500,
      }
    );
  }
}