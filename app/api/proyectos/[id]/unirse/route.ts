// app/api/proyectos/[id]/unirse/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * =========================================================
 * TIPOS
 * =========================================================
 */

type ModoAcceso =
  | 'publico'
  | 'solicitud'
  | 'privado';

type ProyectoJoinRow = {
  id: number | bigint | null;
  modo_acceso: string | null;
  creador_id: string | null;
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
 * NORMALIZAR MODO DE ACCESO
 * =========================================================
 *
 * IMPORTANTE:
 *
 * modo_acceso y visibilidad son independientes.
 *
 * visibilidad:
 *   - publico
 *   - privado
 *
 * modo_acceso:
 *   - publico
 *   - solicitud
 *   - privado
 *
 * Por lo tanto, esta función NO utiliza visibilidad.
 */
function normalizarModoAcceso(
  raw: unknown
): ModoAcceso {
  const value = String(raw ?? '')
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
 * POST /api/proyectos/[id]/unirse
 * =========================================================
 *
 * Esta ruta sirve exclusivamente para unión DIRECTA.
 *
 * Solo funciona cuando:
 *
 * modo_acceso = publico
 *
 * Si:
 *
 * modo_acceso = solicitud
 *
 * debe utilizarse el flujo de solicitudes.
 *
 * Si:
 *
 * modo_acceso = privado
 *
 * el usuario no puede unirse por sí mismo.
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
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
        {
          status: 401,
        }
      );
    }

    const userId =
      String(sessionUser.id);

    /**
     * =====================================================
     * PARÁMETROS
     * =====================================================
     */

    const { id } =
      await params;

    const proyectoId =
      toProjectId(id);

    if (proyectoId == null) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ID inválido',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * OBTENER PROYECTO
     * =====================================================
     *
     * No necesitamos visibilidad.
     *
     * Para unirse solamente importa modo_acceso.
     */

    const proyectoRes =
      await db.execute({
        sql: `
          SELECT
            id,
            modo_acceso,
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
      castRows<ProyectoJoinRow>(
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
        {
          status: 404,
        }
      );
    }

    /**
     * =====================================================
     * CREADOR
     * =====================================================
     *
     * El creador ya pertenece implícitamente al proyecto.
     */

    const esCreador =
      String(
        proyecto.creador_id ??
          ''
      ) === userId;

    if (esCreador) {
      return NextResponse.json(
        {
          ok: true,

          message:
            'Ya perteneces al proyecto',

          data: {
            already: true,
            joined: false,
          },

          already: true,
          joined: false,
        },
        {
          status: 200,
        }
      );
    }

    /**
     * =====================================================
     * VALIDAR SI YA ES MIEMBRO
     * =====================================================
     *
     * Esta validación se realiza antes de revisar
     * modo_acceso.
     *
     * Así, si el owner posteriormente cambia un proyecto
     * de público a privado, los miembros existentes
     * siguen siendo reconocidos correctamente.
     */

    const memberRes =
      await db.execute({
        sql: `
          SELECT
            1

          FROM proyecto_usuarios

          WHERE proyecto_id = ?

            AND CAST(
                  usuario_id AS TEXT
                )
                =
                CAST(
                  ? AS TEXT
                )

          LIMIT 1
        `,
        args: [
          proyectoId,
          userId,
        ],
      });

    if (
      memberRes.rows?.length
    ) {
      return NextResponse.json(
        {
          ok: true,

          message:
            'Ya perteneces al proyecto',

          data: {
            already: true,
            joined: false,
          },

          already: true,
          joined: false,
        },
        {
          status: 200,
        }
      );
    }

    /**
     * =====================================================
     * VALIDAR MODO DE ACCESO
     * =====================================================
     */

    const modoAcceso =
      normalizarModoAcceso(
        proyecto.modo_acceso
      );

    /**
     * SOLICITUD
     *
     * Esta ruta no crea solicitudes.
     */
    if (
      modoAcceso ===
      'solicitud'
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'Este proyecto requiere enviar una solicitud para unirse',

          requiere_solicitud:
            true,

          modo_acceso:
            modoAcceso,
        },
        {
          status: 409,
        }
      );
    }

    /**
     * PRIVADO
     */
    if (
      modoAcceso ===
      'privado'
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            'Este proyecto no permite unirse directamente',

          requiere_solicitud:
            false,

          modo_acceso:
            modoAcceso,
        },
        {
          status: 403,
        }
      );
    }

    /**
     * =====================================================
     * UNIÓN DIRECTA
     * =====================================================
     *
     * Llegar aquí significa:
     *
     * modo_acceso = publico
     */

    const ahora =
      new Date().toISOString();

    /**
     * INSERT OR IGNORE protege frente a solicitudes
     * duplicadas simultáneas.
     */

    await db.execute({
      sql: `
        INSERT OR IGNORE INTO proyecto_usuarios (
          proyecto_id,
          usuario_id,
          rol_en_proyecto,
          fecha_union,
          tipo_union
        )
        VALUES (
          ?,
          ?,
          'miembro',
          ?,
          'publico'
        )
      `,
      args: [
        proyectoId,
        userId,
        ahora,
      ],
    });

    /**
     * =====================================================
     * VERIFICAR INSERCIÓN
     * =====================================================
     *
     * INSERT OR IGNORE podría no insertar si otra petición
     * hizo la misma operación casi simultáneamente.
     *
     * Verificamos el estado real en DB antes de responder.
     */

    const verificarRes =
      await db.execute({
        sql: `
          SELECT
            rol_en_proyecto,
            fecha_union,
            tipo_union

          FROM proyecto_usuarios

          WHERE proyecto_id = ?

            AND CAST(
                  usuario_id AS TEXT
                )
                =
                CAST(
                  ? AS TEXT
                )

          LIMIT 1
        `,
        args: [
          proyectoId,
          userId,
        ],
      });

    const miembro =
      verificarRes.rows?.[0];

    if (!miembro) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No se pudo completar la unión al proyecto',
        },
        {
          status: 500,
        }
      );
    }

    /**
     * =====================================================
     * RESPUESTA
     * =====================================================
     */

    return NextResponse.json(
      {
        ok: true,

        message:
          'Te uniste al proyecto correctamente',

        data: {
          already: false,
          joined: true,

          rol_en_proyecto:
            'miembro',

          tipo_union:
            'publico',

          fecha_union:
            ahora,
        },

        already: false,
        joined: true,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/unirse error:',
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