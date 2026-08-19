// app/api/proyectos/buscar/route.ts

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

type ModoAcceso =
  | 'publico'
  | 'solicitud'
  | 'privado';

type VisibilidadProyecto =
  | 'publico'
  | 'privado';

type ProyectoRow = {
  id: number | bigint;

  nombre?: string | null;
  descripcion?: string | null;

  creador_id?: string | null;

  estado?: string | null;

  codigo_union?: string | null;

  creado_en?: string | null;
  actualizado_en?: string | null;

  modo_acceso?: string | null;
  visibilidad?: string | null;

  prioridad?: string | null;

  fecha_inicio?: string | null;
  fecha_fin?: string | null;

  configuracion?: string | null;

  ultima_actividad?: string | null;

  permiso_editar_proyecto?: string | null;

  permiso_gestionar_tareas?: string | null;
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

/**
 * =========================================================
 * NORMALIZAR MODO DE ACCESO
 * =========================================================
 *
 * IMPORTANTE:
 *
 * modo_acceso y visibilidad son campos independientes.
 *
 * modo_acceso determina cómo puede unirse el usuario.
 *
 * visibilidad determina si el proyecto puede aparecer
 * públicamente en búsquedas.
 */
function normalizarModoAcceso(
  raw: unknown
): ModoAcceso {
  const value =
    String(raw ?? '')
      .toLowerCase()
      .trim();

  if (
    value === 'publico' ||
    value === 'público' ||
    value === 'public'
  ) {
    return 'publico';
  }

  if (
    value === 'solicitud' ||
    value === 'request' ||
    value === 'invitacion' ||
    value === 'invitación' ||
    value === 'invite'
  ) {
    return 'solicitud';
  }

  return 'privado';
}

/**
 * =========================================================
 * NORMALIZAR VISIBILIDAD
 * =========================================================
 */
function normalizarVisibilidad(
  raw: unknown
): VisibilidadProyecto {
  const value =
    String(raw ?? '')
      .toLowerCase()
      .trim();

  if (
    value === 'publico' ||
    value === 'público' ||
    value === 'public'
  ) {
    return 'publico';
  }

  return 'privado';
}

/**
 * =========================================================
 * PAGINACIÓN
 * =========================================================
 */

function parsePositiveInt(
  value: string | null,
  fallback: number
): number {
  if (
    value == null ||
    value.trim() === ''
  ) {
    return fallback;
  }

  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return NaN;
  }

  return parsed;
}

/**
 * =========================================================
 * GET /api/proyectos/buscar
 * =========================================================
 *
 * Devuelve proyectos:
 *
 * - con visibilidad pública
 * - que el usuario no creó
 * - de los que todavía no es miembro
 *
 * IMPORTANTE:
 *
 * Un proyecto puede aparecer aquí aunque:
 *
 * modo_acceso = privado
 *
 * porque visibilidad pública únicamente significa que
 * puede descubrirse.
 *
 * El frontend debe utilizar modo_acceso para decidir:
 *
 * publico   -> "Unirse"
 * solicitud -> "Solicitar acceso"
 * privado   -> no permitir unión directa
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
     * PAGINACIÓN
     * =====================================================
     */

    const rawPage =
      req.nextUrl.searchParams.get(
        'page'
      );

    const rawLimit =
      req.nextUrl.searchParams.get(
        'limit'
      );

    const parsedPage =
      parsePositiveInt(
        rawPage,
        1
      );

    const parsedLimit =
      parsePositiveInt(
        rawLimit,
        20
      );

    if (
      Number.isNaN(
        parsedPage
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'El parámetro page debe ser un entero mayor o igual a 1',
        },
        {
          status: 400,
        }
      );
    }

    if (
      Number.isNaN(
        parsedLimit
      )
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'El parámetro limit debe ser un entero mayor o igual a 1',
        },
        {
          status: 400,
        }
      );
    }

    const page =
      parsedPage;

    /**
     * Máximo 50 elementos por petición.
     */
    const limit =
      Math.min(
        50,
        parsedLimit
      );

    const offset =
      (page - 1) * limit;

    /**
     * =====================================================
     * CONSULTAR PROYECTOS PÚBLICOS
     * =====================================================
     *
     * Aquí SÍ utilizamos visibilidad.
     *
     * Pero solamente para decidir si el proyecto puede
     * aparecer en el buscador.
     */
    const result =
      await db.execute({
        sql: `
          SELECT
            p.id,
            p.nombre,
            p.descripcion,
            p.creador_id,
            p.estado,
            p.codigo_union,
            p.creado_en,
            p.actualizado_en,
            p.modo_acceso,
            p.visibilidad,
            p.prioridad,
            p.fecha_inicio,
            p.fecha_fin,
            p.configuracion,
            p.ultima_actividad,
            p.permiso_editar_proyecto,
            p.permiso_gestionar_tareas

          FROM proyectos p

          WHERE
            LOWER(
              TRIM(
                COALESCE(
                  p.visibilidad,
                  'privado'
                )
              )
            ) = 'publico'

            /**
             * No mostrar proyectos creados
             * por el propio usuario.
             */
            AND CAST(
                  p.creador_id AS TEXT
                )
                <>
                CAST(
                  ? AS TEXT
                )

            /**
             * No mostrar proyectos donde ya
             * pertenece como miembro.
             */
            AND NOT EXISTS (
              SELECT 1

              FROM proyecto_usuarios pu

              WHERE pu.proyecto_id = p.id

                AND CAST(
                      pu.usuario_id
                      AS TEXT
                    )
                    =
                    CAST(
                      ? AS TEXT
                    )
            )

          ORDER BY
            datetime(
              p.creado_en
            ) DESC

          LIMIT ?

          OFFSET ?
        `,
        args: [
          userId,
          userId,
          limit,
          offset,
        ],
      });

    const rows =
      castRows<ProyectoRow>(
        result.rows
      );

    /**
     * =====================================================
     * MAPEAR PROYECTOS
     * =====================================================
     */

    const proyectos =
      rows.map(
        (row) => ({
          ...row,

          id:
            Number(
              row.id
            ),

          /**
           * IMPORTANTE:
           *
           * modo_acceso se obtiene exclusivamente
           * desde modo_acceso.
           */
          modo_acceso:
            normalizarModoAcceso(
              row.modo_acceso
            ),

          visibilidad:
            normalizarVisibilidad(
              row.visibilidad
            ),
        })
      );

    /**
     * =====================================================
     * RESPUESTA
     * =====================================================
     */

    return NextResponse.json(
      {
        ok: true,

        data:
          proyectos,

        proyectos,

        page,

        limit,

        cantidad:
          proyectos.length,

        /**
         * Permite al frontend saber si posiblemente
         * existe otra página.
         */
        has_more:
          proyectos.length ===
          limit,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'GET /api/proyectos/buscar error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al buscar proyectos',
      },
      {
        status: 500,
      }
    );
  }
}