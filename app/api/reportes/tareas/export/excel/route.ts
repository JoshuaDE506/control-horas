/// app/api/reportes/tareas/export/excel/route.ts

import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  proyecto_id:
    | number
    | bigint
    | null;

  proyecto_nombre:
    | string
    | null;

  creado_por:
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

function formatDateSafe(
  value:
    | string
    | null
    | undefined
): string {
  if (!value) {
    return '';
  }

  const d =
    new Date(value);

  if (
    Number.isNaN(
      d.getTime()
    )
  ) {
    return String(value);
  }

  return d.toLocaleString(
    'es-CR'
  );
}

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
) {
  return `${fecha}T00:00:00`;
}

function finDiaIso(
  fecha: string
) {
  return `${fecha}T23:59:59`;
}

function minutosAHoras(
  minutos: number
) {
  return Number(
    (
      minutos / 60
    ).toFixed(2)
  );
}

/**
 * =========================================================
 * GET /api/reportes/tareas/export/excel
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
      return new Response(
        'No autenticado',
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

    if (
      !esFechaValida(
        fechaInicio
      ) ||
      !esFechaValida(
        fechaFin
      )
    ) {
      return new Response(
        'Formato de fecha inválido',
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
      return new Response(
        'Rango de fechas inválido',
        {
          status: 400,
        }
      );
    }

    const estadoFiltro =
      estadoRaw
        ? normalizeEstado(
            estadoRaw
          )
        : null;

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
      return new Response(
        'Prioridad inválida',
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * ACCESO A PROYECTO ESPECÍFICO
     * =====================================================
     */

    if (proyectoId) {
      const accesoRes =
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
                   pu.usuario_id
                   AS TEXT
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
        accesoRes.rows?.[0] as
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
        return new Response(
          'Proyecto no encontrado',
          {
            status: 404,
          }
        );
      }

      const autorizado =
        String(
          proyecto.creador_id ??
            ''
        ) === userId ||
        Boolean(
          proyecto
            .rol_en_proyecto
        );

      if (!autorizado) {
        return new Response(
          'Sin acceso al proyecto',
          {
            status: 403,
          }
        );
      }
    }

    /**
     * =====================================================
     * WHERE
     * =====================================================
     */

    const where: string[] =
      [];

    const args: Array<
      string | number
    > = [];

    where.push(`
      (
        CAST(
          p.creador_id
          AS TEXT
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

    if (fechaInicio) {
      where.push(`
        datetime(
          t.creado_en
        )
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
        datetime(
          t.creado_en
        )
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
          TRIM(
            t.estado
          )
        ) = ?
      `);

      args.push(
        estadoFiltro
      );
    }

    if (prioridadFiltro) {
      where.push(`
        LOWER(
          TRIM(
            t.prioridad
          )
        ) = ?
      `);

      args.push(
        prioridadFiltro
      );
    }

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
      `WHERE ${where.join(
        ' AND '
      )}`;

    /**
     * =====================================================
     * FROM
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
             t.creador_id
             AS TEXT
           )

      LEFT JOIN usuarios ua
        ON CAST(
             ua.id AS TEXT
           )
           =
           CAST(
             t.usuario_id
             AS TEXT
           )

      LEFT JOIN usuarios uap
        ON CAST(
             uap.id AS TEXT
           )
           =
           CAST(
             t.aprobado_por
             AS TEXT
           )

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

          COUNT(*)
            AS cantidad_selecciones,

          SUM(
            CASE
              WHEN ta.completado_en
                   IS NOT NULL
              THEN 1
              ELSE 0
            END
          )
            AS cantidad_completadas

        FROM tarea_asignaciones ta

        INNER JOIN usuarios u
          ON CAST(
               u.id AS TEXT
             )
             =
             CAST(
               ta.usuario_id
               AS TEXT
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

            t.proyecto_id,

            p.nombre
              AS proyecto_nombre,

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

    /**
     * =====================================================
     * WORKBOOK
     * =====================================================
     */

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      'Control de Horas Laborales';

    workbook.company =
      'Código Fácil';

    workbook.created =
      new Date();

    workbook.modified =
      new Date();

    const wsResumen =
      workbook.addWorksheet(
        'Resumen'
      );

    const wsTareas =
      workbook.addWorksheet(
        'Tareas'
      );

    const wsActividad =
      workbook.addWorksheet(
        'Actividad'
      );

    /**
     * =====================================================
     * HOJA RESUMEN
     * =====================================================
     */

    wsResumen.columns = [
      {
        header: 'Métrica',
        key: 'metrica',
        width: 32,
      },
      {
        header: 'Valor',
        key: 'valor',
        width: 18,
      },
    ];

    wsResumen.addRow({
      metrica:
        'Total tareas',
      valor:
        toNumber(
          resumenRow.total
        ),
    });

    wsResumen.addRow({
      metrica:
        'Por hacer',
      valor:
        toNumber(
          resumenRow
            .pendientes
        ),
    });

    wsResumen.addRow({
      metrica:
        'En progreso',
      valor:
        toNumber(
          resumenRow
            .en_progreso
        ),
    });

    wsResumen.addRow({
      metrica:
        'En revisión',
      valor:
        toNumber(
          resumenRow
            .revision
        ),
    });

    wsResumen.addRow({
      metrica:
        'Completadas',
      valor:
        toNumber(
          resumenRow
            .completadas
        ),
    });

    /**
     * No existe estado cancelado para tareas.
     */
    wsResumen.addRow({
      metrica:
        'Canceladas',
      valor: 0,
    });

    /**
     * =====================================================
     * HOJA TAREAS
     * =====================================================
     */

    wsTareas.columns = [
      {
        header: 'ID',
        key: 'id',
        width: 38,
      },
      {
        header: 'Título',
        key: 'titulo',
        width: 28,
      },
      {
        header:
          'Descripción',
        key: 'descripcion',
        width: 36,
      },
      {
        header: 'Proyecto',
        key:
          'proyecto_nombre',
        width: 24,
      },
      {
        header: 'Estado',
        key:
          'estado_label',
        width: 16,
      },
      {
        header: 'Prioridad',
        key:
          'prioridad_label',
        width: 14,
      },
      {
        header:
          'Asignado a',
        key: 'asignado_a',
        width: 28,
      },
      {
        header:
          'Creado por',
        key: 'creado_por',
        width: 24,
      },
      {
        header:
          'Fecha creación',
        key:
          'fecha_creacion',
        width: 22,
      },
      {
        header:
          'Fecha selección',
        key:
          'seleccionado_en',
        width: 22,
      },
      {
        header:
          'Inicio trabajo',
        key:
          'fecha_inicio_trabajo',
        width: 22,
      },
      {
        header:
          'Envío revisión',
        key:
          'fecha_envio_revision',
        width: 22,
      },
      {
        header:
          'Fecha aprobación',
        key:
          'fecha_aprobacion',
        width: 22,
      },
      {
        header:
          'Aprobado por',
        key:
          'aprobado_por_nombre',
        width: 24,
      },
      {
        header:
          'Comentario rechazo',
        key:
          'ultimo_rechazo_comentario',
        width: 34,
      },
      {
        header:
          'Tiempo estimado (min)',
        key:
          'tiempo_estimado_minutos',
        width: 22,
      },
      {
        header:
          'Tiempo real (min)',
        key:
          'minutos_reales',
        width: 18,
      },
      {
        header:
          'Tiempo real (h)',
        key:
          'horas_reales',
        width: 16,
      },
      {
        header:
          'Selecciones',
        key:
          'cantidad_selecciones',
        width: 14,
      },
      {
        header:
          'Completadas',
        key:
          'cantidad_completadas',
        width: 14,
      },
      {
        header:
          'Rendimiento %',
        key:
          'rendimiento_porcentaje',
        width: 16,
      },
    ];

    for (
      const row
      of tareasRows
    ) {
      const estado =
        normalizeEstado(
          row.estado
        );

      const segundos =
        Math.max(
          0,
          toNumber(
            row.segundos_reales
          )
        );

      const minutos =
        Number(
          (
            segundos / 60
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

      const rendimiento =
        estimado > 0 &&
        minutos > 0
          ? Number(
              (
                (
                  estimado /
                  minutos
                ) *
                100
              ).toFixed(2)
            )
          : null;

      wsTareas.addRow({
        id:
          String(row.id),

        titulo:
          row.titulo ?? '',

        descripcion:
          row.descripcion ??
          '',

        proyecto_nombre:
          row
            .proyecto_nombre ??
          '',

        estado_label:
          estadoLabel(
            estado
          ),

        prioridad_label:
          prioridadLabel(
            row.prioridad
          ),

        asignado_a:
          row.asignados
            ?.trim() ||
          row
            .asignado_directo
            ?.trim() ||
          '—',

        creado_por:
          row.creado_por
            ?.trim() ||
          '—',

        fecha_creacion:
          formatDateSafe(
            row.creado_en
          ),

        seleccionado_en:
          formatDateSafe(
            row
              .seleccionado_en
          ),

        fecha_inicio_trabajo:
          formatDateSafe(
            row
              .fecha_inicio_trabajo
          ),

        fecha_envio_revision:
          formatDateSafe(
            row
              .fecha_envio_revision
          ),

        fecha_aprobacion:
          formatDateSafe(
            row
              .fecha_aprobacion
          ),

        aprobado_por_nombre:
          row
            .aprobado_por_nombre
            ?.trim() ||
          '',

        ultimo_rechazo_comentario:
          row
            .ultimo_rechazo_comentario ??
          '',

        tiempo_estimado_minutos:
          estimado,

        minutos_reales:
          minutos,

        horas_reales:
          minutosAHoras(
            minutos
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
      });
    }

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
      );

    wsActividad.columns = [
      {
        header: 'Fecha',
        key: 'periodo',
        width: 18,
      },
      {
        header:
          'Total tareas',
        key: 'total',
        width: 16,
      },
    ];

    for (
      const item
      of actividad
    ) {
      wsActividad.addRow({
        periodo:
          item.periodo ?? '',

        total:
          toNumber(
            item.total
          ),
      });
    }

    /**
     * =====================================================
     * FORMATO GENERAL
     * =====================================================
     */

    [
      wsResumen,
      wsTareas,
      wsActividad,
    ].forEach((sheet) => {
      sheet.getRow(
        1
      ).font = {
        bold: true,
      };

      sheet.getRow(
        1
      ).alignment = {
        vertical:
          'middle',

        horizontal:
          'center',
      };

      sheet.views = [
        {
          state:
            'frozen',
          ySplit: 1,
        },
      ];

      sheet.eachRow(
        (
          row,
          rowNumber
        ) => {
          row.eachCell(
            (cell) => {
              cell.border = {
                top: {
                  style:
                    'thin',
                },
                left: {
                  style:
                    'thin',
                },
                bottom: {
                  style:
                    'thin',
                },
                right: {
                  style:
                    'thin',
                },
              };

              if (
                rowNumber >
                1
              ) {
                cell.alignment = {
                  vertical:
                    'middle',
                  wrapText:
                    true,
                };
              }
            }
          );
        }
      );
    });

    wsTareas.autoFilter = {
      from: 'A1',
      to: 'U1',
    };

    wsActividad.autoFilter = {
      from: 'A1',
      to: 'B1',
    };

    wsTareas.getColumn(
      'minutos_reales'
    ).numFmt = '0.00';

    wsTareas.getColumn(
      'horas_reales'
    ).numFmt = '0.00';

    wsTareas.getColumn(
      'rendimiento_porcentaje'
    ).numFmt = '0.00';

    /**
     * =====================================================
     * GENERAR ARCHIVO
     * =====================================================
     */

    const buffer =
      await workbook.xlsx.writeBuffer();

    const file =
      new Uint8Array(
        buffer
      );

    const fileName =
      `reporte_tareas_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

    return new Response(
      file,
      {
        status: 200,

        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

          'Content-Disposition':
            `attachment; filename="${fileName}"`,

          'Cache-Control':
            'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'GET /api/reportes/tareas/export/excel error:',
      error
    );

    return new Response(
      'Error exportando reporte de tareas',
      {
        status: 500,
      }
    );
  }
}