// app/api/user/perfil/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

type UserRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  pais: string | null;
  telefono_completo:
    | string
    | null;
  rol: string | null;
  puesto: string | null;
  activo:
    | number
    | bigint
    | string
    | boolean
    | null;
  creado_en: string | null;
};

type StatsRow = {
  proyectos_creados:
    | number
    | bigint
    | null;

  proyectos_miembro:
    | number
    | bigint
    | null;

  tareas_seleccionadas:
    | number
    | bigint
    | null;

  tareas_en_proceso:
    | number
    | bigint
    | null;

  tareas_completadas:
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
  const result =
    Number(value ?? 0);

  return Number.isFinite(result)
    ? result
    : 0;
}

function normalizarActivo(
  value: unknown
): boolean {
  if (
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    return Number(value) === 1;
  }

  const normalized =
    String(value ?? '')
      .toLowerCase()
      .trim();

  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'activo'
  );
}

function normalizarRol(
  raw: unknown
):
  | 'jefe'
  | 'admin'
  | 'colaborador' {
  const value =
    String(raw ?? '')
      .toLowerCase()
      .trim();

  if (value === 'jefe') {
    return 'jefe';
  }

  if (value === 'admin') {
    return 'admin';
  }

  return 'colaborador';
}

function normalizarTexto(
  value: unknown
): string {
  return typeof value ===
    'string'
    ? value.trim()
    : '';
}

function esEmailValido(
  email: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

/**
 * =========================================================
 * GET /api/user/perfil
 * =========================================================
 */

export async function GET(
  req: NextRequest
) {
  try {
    const sessionUser =
      await getAuthenticatedUser(
        req
      );

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

    const userRes =
      await db.execute({
        sql: `
          SELECT
            id,
            nombre,
            apellido,
            email,
            pais,
            telefono_completo,
            rol,
            puesto,
            activo,
            creado_en

          FROM usuarios

          WHERE CAST(id AS TEXT)
              = CAST(? AS TEXT)

          LIMIT 1
        `,
        args: [userId],
      });

    const userRow =
      castRows<UserRow>(
        userRes.rows
      )[0];

    if (!userRow) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Usuario no encontrado',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * ESTADÍSTICAS
     * =====================================================
     */

    const statsRes =
      await db.execute({
        sql: `
          SELECT

            (
              SELECT COUNT(*)

              FROM proyectos p

              WHERE CAST(
                      p.creador_id
                      AS TEXT
                    )
                    =
                    CAST(
                      ? AS TEXT
                    )
            ) AS proyectos_creados,

            (
              SELECT COUNT(
                DISTINCT pu.proyecto_id
              )

              FROM proyecto_usuarios pu

              WHERE CAST(
                      pu.usuario_id
                      AS TEXT
                    )
                    =
                    CAST(
                      ? AS TEXT
                    )
            ) AS proyectos_miembro,

            (
              SELECT COUNT(
                DISTINCT ta.tarea_id
              )

              FROM tarea_asignaciones ta

              WHERE CAST(
                      ta.usuario_id
                      AS TEXT
                    )
                    =
                    CAST(
                      ? AS TEXT
                    )

                AND ta.estado <> 'cancelado'
            ) AS tareas_seleccionadas,

            (
              SELECT COUNT(
                DISTINCT ta.tarea_id
              )

              FROM tarea_asignaciones ta

              INNER JOIN tareas t
                ON CAST(
                     t.id AS TEXT
                   )
                   =
                   CAST(
                     ta.tarea_id
                     AS TEXT
                   )

              WHERE CAST(
                      ta.usuario_id
                      AS TEXT
                    )
                    =
                    CAST(
                      ? AS TEXT
                    )

                AND ta.estado = 'activo'

                AND LOWER(
                      COALESCE(
                        t.estado,
                        ''
                      )
                    )
                    =
                    'in-progress'
            ) AS tareas_en_proceso,

            (
              SELECT COUNT(
                DISTINCT ta.tarea_id
              )

              FROM tarea_asignaciones ta

              INNER JOIN tareas t
                ON CAST(
                     t.id AS TEXT
                   )
                   =
                   CAST(
                     ta.tarea_id
                     AS TEXT
                   )

              WHERE CAST(
                      ta.usuario_id
                      AS TEXT
                    )
                    =
                    CAST(
                      ? AS TEXT
                    )

                AND ta.estado = 'activo'

                AND ta.completado_en
                    IS NOT NULL

                AND LOWER(
                      COALESCE(
                        t.estado,
                        ''
                      )
                    )
                    =
                    'completed'
            ) AS tareas_completadas
        `,
        args: [
          userId,
          userId,
          userId,
          userId,
          userId,
        ],
      });

    const statsRow =
      castRows<StatsRow>(
        statsRes.rows
      )[0] ?? {
        proyectos_creados: 0,
        proyectos_miembro: 0,
        tareas_seleccionadas: 0,
        tareas_en_proceso: 0,
        tareas_completadas: 0,
      };

    return NextResponse.json(
      {
        ok: true,

        data: {
          user: {
            id:
              String(
                userRow.id
              ),

            nombre:
              String(
                userRow.nombre ??
                  ''
              ),

            apellido:
              String(
                userRow.apellido ??
                  ''
              ),

            email:
              String(
                userRow.email ??
                  ''
              ),

            pais:
              userRow.pais ??
              null,

            telefono:
              userRow
                .telefono_completo ??
              null,

            rol:
              normalizarRol(
                userRow.rol
              ),

            puesto:
              userRow.puesto ??
              null,

            activo:
              normalizarActivo(
                userRow.activo
              ),

            creado_en:
              userRow.creado_en ??
              null,
          },

          stats: {
            proyectos_creados:
              toNumber(
                statsRow
                  .proyectos_creados
              ),

            proyectos_miembro:
              toNumber(
                statsRow
                  .proyectos_miembro
              ),

            tareas_seleccionadas:
              toNumber(
                statsRow
                  .tareas_seleccionadas
              ),

            tareas_en_proceso:
              toNumber(
                statsRow
                  .tareas_en_proceso
              ),

            tareas_completadas:
              toNumber(
                statsRow
                  .tareas_completadas
              ),
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/user/perfil error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al cargar el perfil',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * PATCH /api/user/perfil
 * =========================================================
 */

export async function PATCH(
  req: NextRequest
) {
  try {
    const sessionUser =
      await getAuthenticatedUser(
        req
      );

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

    const body =
      await req
        .json()
        .catch(() => ({}));

    const nombre =
      normalizarTexto(
        body?.nombre
      );

    const apellido =
      normalizarTexto(
        body?.apellido
      );

    const email =
      normalizarTexto(
        body?.email
      ).toLowerCase();

    const pais =
      normalizarTexto(
        body?.pais
      );

    const telefono =
      normalizarTexto(
        body?.telefono
      );

    if (!nombre) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El nombre es requerido',
        },
        { status: 400 }
      );
    }

    if (!apellido) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El apellido es requerido',
        },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El correo es requerido',
        },
        { status: 400 }
      );
    }

    if (
      !esEmailValido(email)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El correo no es válido',
        },
        { status: 400 }
      );
    }

    const emailRes =
      await db.execute({
        sql: `
          SELECT id

          FROM usuarios

          WHERE LOWER(
                  COALESCE(
                    email,
                    ''
                  )
                )
                =
                LOWER(?)

            AND CAST(id AS TEXT)
                <>
                CAST(? AS TEXT)

          LIMIT 1
        `,
        args: [
          email,
          userId,
        ],
      });

    if (
      emailRes.rows?.length
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Ese correo ya está en uso por otro usuario',
        },
        { status: 409 }
      );
    }

    await db.execute({
      sql: `
        UPDATE usuarios

        SET
          nombre = ?,
          apellido = ?,
          email = ?,
          pais = ?,
          telefono_completo = ?,
          actualizado_en = CURRENT_TIMESTAMP

        WHERE CAST(id AS TEXT)
            = CAST(? AS TEXT)
      `,
      args: [
        nombre,
        apellido,
        email,
        pais || null,
        telefono || null,
        userId,
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          'Perfil actualizado correctamente',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'PATCH /api/user/perfil error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al actualizar el perfil',
      },
      { status: 500 }
    );
  }
}