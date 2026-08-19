// app/api/reportes/jornada/export/excel/route.ts

import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

type EstadoJornada =
  | 'presente'
  | 'ausente'
  | 'justificado';

type RegistroRow = {
  usuario_id: string | null;
  fecha: string | null;
  colaborador: string | null;
  puesto: string | null;
  supervisor: string | null;
  estado: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  minutos_trabajados: number | bigint | null;
  motivo: string | null;
};

function castRows<T>(
  rows: unknown[]
): T[] {
  return rows as T[];
}

function normalizarTexto(
  value: string | null
): string {
  return String(value ?? '').trim();
}

function toNumber(
  value: unknown
): number {
  const numero = Number(value ?? 0);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function esAdminOJefe(
  rol: unknown
): boolean {
  const value = String(rol ?? '')
    .toLowerCase()
    .trim();

  return (
    value === 'admin' ||
    value === 'jefe'
  );
}

function normalizarEstado(
  value: unknown
): EstadoJornada | null {
  const estado = String(value ?? '')
    .toLowerCase()
    .trim();

  if (estado === 'presente') {
    return 'presente';
  }

  if (estado === 'ausente') {
    return 'ausente';
  }

  if (estado === 'justificado') {
    return 'justificado';
  }

  return null;
}

function esFechaValida(
  value: string
): boolean {
  if (!value) {
    return true;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00Z`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function GET(
  req: NextRequest
) {
  try {
    /**
     * ===============================================
     * AUTENTICACIÓN
     * ===============================================
     */

    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return new Response(
        'No autenticado',
        {
          status: 401,
        }
      );
    }

    /**
     * ===============================================
     * PERMISOS
     * ===============================================
     */

    if (
      !esAdminOJefe(user.rol)
    ) {
      return new Response(
        'Sin permisos',
        {
          status: 403,
        }
      );
    }

    /**
     * ===============================================
     * FILTROS
     * ===============================================
     */

    const { searchParams } =
      new URL(req.url);

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

    const usuarioId =
      normalizarTexto(
        searchParams.get(
          'usuario_id'
        )
      );

    const supervisorId =
      normalizarTexto(
        searchParams.get(
          'supervisor_id'
        )
      );

    const estadoRaw =
      normalizarTexto(
        searchParams.get(
          'estado'
        )
      );

    /**
     * ===============================================
     * VALIDAR FECHAS
     * ===============================================
     */

    if (
      !esFechaValida(fechaInicio) ||
      !esFechaValida(fechaFin)
    ) {
      return new Response(
        'Formato de fecha inválido. Utiliza YYYY-MM-DD',
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
        'La fecha de inicio no puede ser posterior a la fecha final',
        {
          status: 400,
        }
      );
    }

    /**
     * ===============================================
     * VALIDAR ESTADO
     * ===============================================
     */

    const estado =
      estadoRaw
        ? normalizarEstado(
            estadoRaw
          )
        : null;

    if (
      estadoRaw &&
      !estado
    ) {
      return new Response(
        'Estado de jornada inválido',
        {
          status: 400,
        }
      );
    }

    /**
     * ===============================================
     * WHERE DINÁMICO
     * ===============================================
     */

    const where: string[] = [];

    const args: (
      | string
      | number
    )[] = [];

    if (fechaInicio) {
      where.push(
        'rj.fecha >= ?'
      );

      args.push(fechaInicio);
    }

    if (fechaFin) {
      where.push(
        'rj.fecha <= ?'
      );

      args.push(fechaFin);
    }

    if (usuarioId) {
      where.push(`
        CAST(
          rj.usuario_id AS TEXT
        ) = CAST(? AS TEXT)
      `);

      args.push(usuarioId);
    }

    if (supervisorId) {
      where.push(`
        CAST(
          rj.supervisor_id AS TEXT
        ) = CAST(? AS TEXT)
      `);

      args.push(supervisorId);
    }

    if (estado) {
      where.push(`
        LOWER(
          TRIM(
            COALESCE(
              rj.estado,
              ''
            )
          )
        ) = ?
      `);

      args.push(estado);
    }

    const whereSql =
      where.length
        ? `WHERE ${where.join(
            ' AND '
          )}`
        : '';

    /**
     * ===============================================
     * CONSULTA
     * ===============================================
     */

    const result =
      await db.execute({
        sql: `
          SELECT

            CAST(
              rj.usuario_id AS TEXT
            ) AS usuario_id,

            rj.fecha,

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
            ) AS colaborador,

            uc.puesto AS puesto,

            TRIM(
              COALESCE(
                us.nombre,
                ''
              )
              || ' ' ||
              COALESCE(
                us.apellido,
                ''
              )
            ) AS supervisor,

            rj.estado,

            rj.hora_entrada,

            rj.hora_salida,

            rj.minutos_trabajados,

            rj.motivo

          FROM registro_jornada rj

          LEFT JOIN usuarios uc
            ON CAST(
                 uc.id AS TEXT
               )
               =
               CAST(
                 rj.usuario_id AS TEXT
               )

          LEFT JOIN usuarios us
            ON CAST(
                 us.id AS TEXT
               )
               =
               CAST(
                 rj.supervisor_id AS TEXT
               )

          ${whereSql}

          ORDER BY
            rj.fecha DESC,
            uc.nombre ASC,
            uc.apellido ASC
        `,
        args,
      });

    /**
     * ===============================================
     * NORMALIZAR REGISTROS
     * ===============================================
     */

    const rows =
      castRows<RegistroRow>(
        result.rows
      ).map((row) => ({
        ...row,

        usuario_id:
          row.usuario_id
            ? String(
                row.usuario_id
              )
            : '',

        estado:
          normalizarEstado(
            row.estado
          ),

        minutos_trabajados:
          Math.max(
            0,
            toNumber(
              row.minutos_trabajados
            )
          ),
      }));

    /**
     * ===============================================
     * WORKBOOK
     * ===============================================
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

    /**
     * ===============================================
     * HOJA JORNADA
     * ===============================================
     */

    const sheet =
      workbook.addWorksheet(
        'Jornada'
      );

    sheet.columns = [
      {
        header: 'Fecha',
        key: 'fecha',
        width: 14,
      },

      {
        header: 'Colaborador',
        key: 'colaborador',
        width: 28,
      },

      {
        header: 'Puesto',
        key: 'puesto',
        width: 22,
      },

      {
        header: 'Supervisor',
        key: 'supervisor',
        width: 28,
      },

      {
        header: 'Estado',
        key: 'estado',
        width: 16,
      },

      {
        header: 'Hora entrada',
        key: 'hora_entrada',
        width: 16,
      },

      {
        header: 'Hora salida',
        key: 'hora_salida',
        width: 16,
      },

      {
        header: 'Horas trabajadas',
        key: 'horas',
        width: 18,
      },

      {
        header: 'Motivo',
        key: 'motivo',
        width: 36,
      },
    ];

    const header =
      sheet.getRow(1);

    header.font = {
      bold: true,
    };

    header.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    header.height = 22;

    /**
     * Congelar encabezado.
     */
    sheet.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];

    /**
     * Filtros en Excel.
     */
    sheet.autoFilter = {
      from: 'A1',
      to: 'I1',
    };

    /**
     * ===============================================
     * AGREGAR REGISTROS
     * ===============================================
     */

    for (const row of rows) {
      const minutos =
        Number(
          row.minutos_trabajados ??
            0
        );

      sheet.addRow({
        fecha:
          row.fecha ?? '',

        colaborador:
          row.colaborador ?? '',

        puesto:
          row.puesto ?? '',

        supervisor:
          row.supervisor ?? '',

        estado:
          row.estado ?? '',

        hora_entrada:
          row.hora_entrada ?? '',

        hora_salida:
          row.hora_salida ?? '',

        /**
         * Número real.
         *
         * No usar toFixed directamente,
         * porque devuelve string.
         */
        horas:
          Number(
            (
              minutos / 60
            ).toFixed(2)
          ),

        motivo:
          row.motivo ?? '',
      });
    }

    sheet.getColumn(
      'horas'
    ).numFmt = '0.00';

    /**
     * ===============================================
     * RESUMEN GENERAL
     * ===============================================
     */

    const total =
      rows.length;

    const presentes =
      rows.filter(
        (row) =>
          row.estado ===
          'presente'
      ).length;

    const ausentes =
      rows.filter(
        (row) =>
          row.estado ===
          'ausente'
      ).length;

    const justificados =
      rows.filter(
        (row) =>
          row.estado ===
          'justificado'
      ).length;

    const minutosTotales =
      rows.reduce(
        (
          totalActual,
          row
        ) =>
          totalActual +
          Number(
            row.minutos_trabajados ??
              0
          ),
        0
      );

    /**
     * ===============================================
     * HOJA RESUMEN
     * ===============================================
     */

    const resumen =
      workbook.addWorksheet(
        'Resumen'
      );

    resumen.columns = [
      {
        header: 'Concepto',
        key: 'concepto',
        width: 28,
      },

      {
        header: 'Valor',
        key: 'valor',
        width: 18,
      },
    ];

    resumen.getRow(
      1
    ).font = {
      bold: true,
    };

    resumen.addRow({
      concepto:
        'Total registros',
      valor:
        total,
    });

    resumen.addRow({
      concepto:
        'Presentes',
      valor:
        presentes,
    });

    resumen.addRow({
      concepto:
        'Ausentes',
      valor:
        ausentes,
    });

    resumen.addRow({
      concepto:
        'Justificados',
      valor:
        justificados,
    });

    resumen.addRow({
      concepto:
        'Horas totales',

      valor:
        Number(
          (
            minutosTotales /
            60
          ).toFixed(2)
        ),
    });

    /**
     * ===============================================
     * RESUMEN POR COLABORADOR
     * ===============================================
     *
     * Agrupamos por usuario_id.
     *
     * No por nombre, porque dos colaboradores
     * podrían llamarse igual.
     */

    const porColaborador =
      new Map<
        string,
        {
          colaborador: string;
          puesto: string | null;
          presentes: number;
          ausentes: number;
          justificados: number;
          minutos: number;
        }
      >();

    for (const row of rows) {
      const key =
        String(
          row.usuario_id ?? ''
        );

      if (!key) {
        continue;
      }

      if (
        !porColaborador.has(key)
      ) {
        porColaborador.set(
          key,
          {
            colaborador:
              row.colaborador ||
              'Sin nombre',

            puesto:
              row.puesto ?? null,

            presentes: 0,
            ausentes: 0,
            justificados: 0,
            minutos: 0,
          }
        );
      }

      const item =
        porColaborador.get(
          key
        )!;

      if (
        row.estado ===
        'presente'
      ) {
        item.presentes += 1;
      }

      if (
        row.estado ===
        'ausente'
      ) {
        item.ausentes += 1;
      }

      if (
        row.estado ===
        'justificado'
      ) {
        item.justificados +=
          1;
      }

      item.minutos +=
        Number(
          row.minutos_trabajados ??
            0
        );
    }

    /**
     * ===============================================
     * HOJA POR COLABORADOR
     * ===============================================
     */

    const resumenColab =
      workbook.addWorksheet(
        'Por colaborador'
      );

    resumenColab.columns = [
      {
        header: 'Colaborador',
        key: 'colaborador',
        width: 28,
      },

      {
        header: 'Puesto',
        key: 'puesto',
        width: 22,
      },

      {
        header: 'Presentes',
        key: 'presentes',
        width: 12,
      },

      {
        header: 'Ausentes',
        key: 'ausentes',
        width: 12,
      },

      {
        header: 'Justificados',
        key: 'justificados',
        width: 14,
      },

      {
        header: 'Horas totales',
        key: 'horas',
        width: 16,
      },
    ];

    resumenColab.getRow(
      1
    ).font = {
      bold: true,
    };

    resumenColab.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ];

    resumenColab.autoFilter = {
      from: 'A1',
      to: 'F1',
    };

    const colaboradores =
      Array.from(
        porColaborador.values()
      ).sort(
        (a, b) =>
          a.colaborador.localeCompare(
            b.colaborador,
            'es'
          )
      );

    for (
      const item
      of colaboradores
    ) {
      resumenColab.addRow({
        colaborador:
          item.colaborador,

        puesto:
          item.puesto ?? '',

        presentes:
          item.presentes,

        ausentes:
          item.ausentes,

        justificados:
          item.justificados,

        horas:
          Number(
            (
              item.minutos /
              60
            ).toFixed(2)
          ),
      });
    }

    resumenColab.getColumn(
      'horas'
    ).numFmt = '0.00';

    /**
     * ===============================================
     * GENERAR ARCHIVO
     * ===============================================
     */

    const buffer =
      await workbook.xlsx.writeBuffer();

    const file =
      new Uint8Array(
        buffer
      );

    return new Response(
      file,
      {
        status: 200,

        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

          'Content-Disposition':
            'attachment; filename="reporte_jornada.xlsx"',

          'Cache-Control':
            'no-store',
        },
      }
    );
  } catch (error) {
    console.error(
      'GET /api/reportes/jornada/export/excel error:',
      error
    );

    return new Response(
      'Error generando Excel',
      {
        status: 500,
      }
    );
  }
}