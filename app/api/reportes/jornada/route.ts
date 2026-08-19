// app/api/reportes/jornada/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * =========================================================
 * TIPOS
 * =========================================================
 */

type EstadoJornada =
  | 'presente'
  | 'ausente'
  | 'justificado';

type RegistroRow = {
  id: string;
  fecha: string | null;

  usuario_id: string | null;
  colaborador_nombre: string | null;
  colaborador_apellido: string | null;
  puesto: string | null;

  supervisor_id: string | null;
  supervisor_nombre: string | null;
  supervisor_apellido: string | null;

  estado: string | null;

  hora_entrada: string | null;
  hora_salida: string | null;

  minutos_trabajados:
    | number
    | bigint
    | null;

  motivo: string | null;
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

function normalizarTexto(
  value: string | null
): string {
  return String(value ?? '')
    .trim();
}

function toNumber(
  value: unknown
): number {
  const numero =
    Number(value ?? 0);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

/**
 * =========================================================
 * VALIDAR ROL
 * =========================================================
 *
 * Los reportes generales de jornada son administrativos.
 *
 * Tienen acceso:
 *
 * - admin
 * - jefe
 */
function esAdminOJefe(
  rol: unknown
): boolean {
  const value =
    String(rol ?? '')
      .toLowerCase()
      .trim();

  return (
    value === 'admin' ||
    value === 'jefe'
  );
}

/**
 * =========================================================
 * NORMALIZAR ESTADO
 * =========================================================
 */
function normalizarEstado(
  value: unknown
): EstadoJornada | null {
  const estado =
    String(value ?? '')
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

/**
 * =========================================================
 * VALIDAR FECHA YYYY-MM-DD
 * =========================================================
 */
function esFechaValida(
  value: string
): boolean {
  if (!value) {
    return true;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const date =
    new Date(
      `${value}T00:00:00Z`
    );

  return (
    !Number.isNaN(
      date.getTime()
    ) &&
    date
      .toISOString()
      .slice(0, 10) === value
  );
}

/**
 * =========================================================
 * GET /api/reportes/jornada
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
    const user =
      await getAuthenticatedUser(
        req
      );

    if (!user) {
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

    /**
     * =====================================================
     * PERMISOS
     * =====================================================
     */
    if (
      !esAdminOJefe(
        user.rol
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sin permisos',
        },
        {
          status: 403,
        }
      );
    }

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
      return NextResponse.json(
        {
          ok: false,
          error:
            'Estado de jornada inválido',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * CONSTRUIR WHERE
     * =====================================================
     */
    const where: string[] =
      [];

    const args: (
      | string
      | number
    )[] = [];

    if (fechaInicio) {
      where.push(
        'rj.fecha >= ?'
      );

      args.push(
        fechaInicio
      );
    }

    if (fechaFin) {
      where.push(
        'rj.fecha <= ?'
      );

      args.push(
        fechaFin
      );
    }

    if (usuarioId) {
      where.push(`
        CAST(
          rj.usuario_id AS TEXT
        ) = CAST(? AS TEXT)
      `);

      args.push(
        usuarioId
      );
    }

    if (supervisorId) {
      where.push(`
        CAST(
          rj.supervisor_id AS TEXT
        ) = CAST(? AS TEXT)
      `);

      args.push(
        supervisorId
      );
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

      args.push(
        estado
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
     * OBTENER REGISTROS
     * =====================================================
     */
    const registrosRes =
      await db.execute({
        sql: `
          SELECT
            rj.id,

            rj.fecha,

            CAST(
              rj.usuario_id AS TEXT
            ) AS usuario_id,

            uc.nombre
              AS colaborador_nombre,

            uc.apellido
              AS colaborador_apellido,

            uc.puesto
              AS puesto,

            CAST(
              rj.supervisor_id
              AS TEXT
            ) AS supervisor_id,

            us.nombre
              AS supervisor_nombre,

            us.apellido
              AS supervisor_apellido,

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
                 rj.usuario_id
                 AS TEXT
               )

          LEFT JOIN usuarios us
            ON CAST(
                 us.id AS TEXT
               )
               =
               CAST(
                 rj.supervisor_id
                 AS TEXT
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
     * =====================================================
     * MAPEAR REGISTROS
     * =====================================================
     */
    const registros =
      castRows<RegistroRow>(
        registrosRes.rows
      ).map((r) => {
        const minutos =
          Math.max(
            0,
            toNumber(
              r.minutos_trabajados
            )
          );

        const estadoRegistro =
          normalizarEstado(
            r.estado
          );

        return {
          id:
            String(
              r.id
            ),

          fecha:
            r.fecha ?? '',

          usuario_id:
            r.usuario_id
              ? String(
                  r.usuario_id
                )
              : '',

          colaborador:
            `${r.colaborador_nombre ?? ''} ${r.colaborador_apellido ?? ''}`
              .trim(),

          puesto:
            r.puesto ?? null,

          supervisor_id:
            r.supervisor_id
              ? String(
                  r.supervisor_id
                )
              : null,

          supervisor:
            `${r.supervisor_nombre ?? ''} ${r.supervisor_apellido ?? ''}`
              .trim(),

          estado:
            estadoRegistro,

          hora_entrada:
            r.hora_entrada ??
            null,

          hora_salida:
            r.hora_salida ??
            null,

          minutos_trabajados:
            minutos,

          horas_trabajadas:
            Number(
              (
                minutos / 60
              ).toFixed(2)
            ),

          motivo:
            r.motivo ?? null,
        };
      });

    /**
     * =====================================================
     * RESUMEN GENERAL
     * =====================================================
     */
    const presentes =
      registros.filter(
        (r) =>
          r.estado ===
          'presente'
      ).length;

    const ausentes =
      registros.filter(
        (r) =>
          r.estado ===
          'ausente'
      ).length;

    const justificados =
      registros.filter(
        (r) =>
          r.estado ===
          'justificado'
      ).length;

    const minutosTotales =
      registros.reduce(
        (
          total,
          registro
        ) =>
          total +
          registro
            .minutos_trabajados,
        0
      );

    /**
     * =====================================================
     * RESUMEN POR COLABORADOR
     * =====================================================
     *
     * Se utiliza usuario_id como clave.
     *
     * NO usamos el nombre porque podrían existir
     * dos colaboradores con el mismo nombre.
     */
    const resumenMap =
      new Map<
        string,
        {
          usuario_id: string;
          colaborador: string;
          puesto:
            | string
            | null;

          presentes: number;
          ausentes: number;
          justificados: number;

          minutos_totales: number;
        }
      >();

    for (
      const registro
      of registros
    ) {
      const key =
        registro.usuario_id;

      /**
       * En condiciones normales usuario_id siempre
       * existe porque registro_jornada pertenece a
       * un usuario.
       */
      if (!key) {
        continue;
      }

      if (
        !resumenMap.has(
          key
        )
      ) {
        resumenMap.set(
          key,
          {
            usuario_id:
              key,

            colaborador:
              registro
                .colaborador ||
              'Sin nombre',

            puesto:
              registro.puesto,

            presentes: 0,
            ausentes: 0,
            justificados: 0,

            minutos_totales:
              0,
          }
        );
      }

      const item =
        resumenMap.get(
          key
        )!;

      if (
        registro.estado ===
        'presente'
      ) {
        item.presentes += 1;
      }

      if (
        registro.estado ===
        'ausente'
      ) {
        item.ausentes += 1;
      }

      if (
        registro.estado ===
        'justificado'
      ) {
        item.justificados += 1;
      }

      item.minutos_totales +=
        registro
          .minutos_trabajados;
    }

    const resumenPorColaborador =
      Array.from(
        resumenMap.values()
      )
        .map((item) => ({
          ...item,

          horas_totales:
            Number(
              (
                item
                  .minutos_totales /
                60
              ).toFixed(2)
            ),
        }))
        .sort(
          (a, b) =>
            a.colaborador.localeCompare(
              b.colaborador,
              'es'
            )
        );

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

          usuario_id:
            usuarioId ||
            null,

          supervisor_id:
            supervisorId ||
            null,

          estado:
            estado ?? null,
        },

        resumen_general: {
          total_registros:
            registros.length,

          presentes,

          ausentes,

          justificados,

          minutos_totales:
            minutosTotales,

          horas_totales:
            Number(
              (
                minutosTotales /
                60
              ).toFixed(2)
            ),
        },

        resumen_por_colaborador:
          resumenPorColaborador,

        registros,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'GET /api/reportes/jornada error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al obtener reporte de jornada',
      },
      {
        status: 500,
      }
    );
  }
}