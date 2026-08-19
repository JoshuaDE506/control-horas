// app/api/user/usuarios/route.ts

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

type RolSistema =
  | 'jefe'
  | 'admin'
  | 'colaborador';

type UsuarioListadoRow = {
  id: string;

  nombre: string | null;
  apellido: string | null;
  email: string | null;

  pais: string | null;
  telefono_completo: string | null;

  rol: string | null;
  activo:
    | number
    | bigint
    | string
    | boolean
    | null;

  creado_en: string | null;
  puesto: string | null;

  proyectos_creados_count:
    | number
    | bigint
    | null;

  proyectos_miembro_count:
    | number
    | bigint
    | null;
};

type UsuarioEditableRow = {
  id: string;
  rol: string | null;
  puesto: string | null;

  activo:
    | number
    | bigint
    | string
    | boolean
    | null;
};

type UsuarioActualizadoRow = {
  id: string;

  nombre: string | null;
  apellido: string | null;
  email: string | null;

  pais: string | null;
  telefono_completo: string | null;

  rol: string | null;

  activo:
    | number
    | bigint
    | string
    | boolean
    | null;

  creado_en: string | null;
  puesto: string | null;
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

function normalizarRolSistema(
  raw: unknown
): RolSistema {
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

/**
 * Para datos enviados por el frontend NO queremos
 * convertir silenciosamente un rol inválido en colaborador.
 */
function parseRolSistema(
  raw: unknown
): RolSistema | null {
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

  if (value === 'colaborador') {
    return 'colaborador';
  }

  return null;
}

function puedeAdministrarUsuarios(
  rol: RolSistema
): boolean {
  return (
    rol === 'jefe' ||
    rol === 'admin'
  );
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

/**
 * undefined/null inválido cuando el campo fue enviado.
 *
 * Si el campo NO fue enviado, el código que llama
 * esta función lo distingue mediante body.activo !== undefined.
 */
function parseActivo(
  value: unknown
): 0 | 1 | null {
  if (
    typeof value === 'boolean'
  ) {
    return value ? 1 : 0;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    const number =
      Number(value);

    if (number === 1) {
      return 1;
    }

    if (number === 0) {
      return 0;
    }

    return null;
  }

  const normalized =
    String(value ?? '')
      .toLowerCase()
      .trim();

  if (
    [
      '1',
      'true',
      'activo',
    ].includes(normalized)
  ) {
    return 1;
  }

  if (
    [
      '0',
      'false',
      'inactivo',
    ].includes(normalized)
  ) {
    return 0;
  }

  return null;
}

function sanitizarTexto(
  value: unknown
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'string'
  ) {
    return undefined;
  }

  const trimmed =
    value.trim();

  return trimmed || null;
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

/**
 * =========================================================
 * GET /api/user/usuarios
 * =========================================================
 *
 * Solo:
 *
 * - jefe
 * - admin
 *
 * pueden ver el listado administrativo.
 */

export async function GET(
  request: NextRequest
) {
  try {
    /**
     * =====================================================
     * AUTENTICACIÓN
     * =====================================================
     */

    const sessionUser =
      await getAuthenticatedUser(
        request
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

    const miRol =
      normalizarRolSistema(
        sessionUser.rol
      );

    /**
     * =====================================================
     * PERMISOS
     * =====================================================
     */

    if (
      !puedeAdministrarUsuarios(
        miRol
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes permisos para ver usuarios',
        },
        {
          status: 403,
        }
      );
    }

    /**
     * =====================================================
     * LISTAR USUARIOS
     * =====================================================
     */

    const result =
      await db.execute({
        sql: `
          SELECT
            u.id,
            u.nombre,
            u.apellido,
            u.email,

            u.pais,

            u.telefono_completo,

            u.rol,
            u.activo,

            u.creado_en,

            u.puesto,

            (
              SELECT COUNT(*)

              FROM proyectos p

              WHERE CAST(
                      p.creador_id
                      AS TEXT
                    )
                    =
                    CAST(
                      u.id AS TEXT
                    )
            ) AS proyectos_creados_count,

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
                      u.id AS TEXT
                    )
            ) AS proyectos_miembro_count

          FROM usuarios u

          ORDER BY
            datetime(
              u.creado_en
            ) DESC,
            u.id DESC
        `,
        args: [],
      });

    const rows =
      castRows<UsuarioListadoRow>(
        result.rows
      );

    const usuarios =
      rows.map((row) => ({
        id:
          String(row.id),

        nombre:
          String(
            row.nombre ?? ''
          ),

        apellido:
          String(
            row.apellido ?? ''
          ),

        email:
          String(
            row.email ?? ''
          ),

        pais:
          row.pais ?? null,

        telefono:
          row
            .telefono_completo ??
          null,

        rol:
          normalizarRolSistema(
            row.rol
          ),

        activo:
          normalizarActivo(
            row.activo
          ),

        creado_en:
          row.creado_en ??
          null,

        puesto:
          row.puesto ?? null,

        proyectos_creados_count:
          toNumber(
            row
              .proyectos_creados_count
          ),

        proyectos_miembro_count:
          toNumber(
            row
              .proyectos_miembro_count
          ),
      }));

    /**
     * =====================================================
     * RESPUESTA
     * =====================================================
     */

    return NextResponse.json(
      {
        ok: true,

        usuarios,

        total:
          usuarios.length,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'GET /api/user/usuarios error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al listar usuarios',
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * =========================================================
 * PATCH /api/user/usuarios
 * =========================================================
 *
 * Reglas:
 *
 * jefe:
 * - puede cambiar rol
 * - puede cambiar puesto
 * - puede activar/desactivar
 *
 * admin:
 * - puede cambiar puesto
 * - puede activar/desactivar
 * - NO puede cambiar roles
 * - NO puede modificar un jefe
 */

export async function PATCH(
  request: NextRequest
) {
  try {
    /**
     * =====================================================
     * AUTENTICACIÓN
     * =====================================================
     */

    const sessionUser =
      await getAuthenticatedUser(
        request
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

    const sessionUserId =
      String(
        sessionUser.id
      );

    const miRol =
      normalizarRolSistema(
        sessionUser.rol
      );

    /**
     * =====================================================
     * PERMISOS
     * =====================================================
     */

    if (
      !puedeAdministrarUsuarios(
        miRol
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes permisos para editar usuarios',
        },
        {
          status: 403,
        }
      );
    }

    /**
     * =====================================================
     * BODY
     * =====================================================
     */

    const body =
      await request
        .json()
        .catch(() => ({}));

    const targetUserId =
      typeof body?.id ===
        'string' ||
      typeof body?.id ===
        'number'
        ? String(
            body.id
          ).trim()
        : '';

    if (!targetUserId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El id del usuario es obligatorio',
        },
        {
          status: 400,
        }
      );
    }

    const rolFueEnviado =
      body?.rol !== undefined;

    const puestoFueEnviado =
      body?.puesto !==
      undefined;

    const activoFueEnviado =
      body?.activo !==
      undefined;

    if (
      !rolFueEnviado &&
      !puestoFueEnviado &&
      !activoFueEnviado
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No se enviaron campos para actualizar',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * VALIDAR ROL
     * =====================================================
     */

    const rolInput =
      rolFueEnviado
        ? parseRolSistema(
            body.rol
          )
        : null;

    if (
      rolFueEnviado &&
      !rolInput
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El rol enviado no es válido',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * VALIDAR ACTIVO
     * =====================================================
     */

    const activoInput =
      activoFueEnviado
        ? parseActivo(
            body.activo
          )
        : null;

    if (
      activoFueEnviado &&
      activoInput === null
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El campo activo no es válido',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * VALIDAR PUESTO
     * =====================================================
     */

    if (
      puestoFueEnviado &&
      body.puesto !== null &&
      typeof body.puesto !==
        'string'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El puesto debe ser texto o null',
        },
        {
          status: 400,
        }
      );
    }

    const puestoInput =
      sanitizarTexto(
        body?.puesto
      );

    /**
     * =====================================================
     * USUARIO OBJETIVO
     * =====================================================
     */

    const currentResult =
      await db.execute({
        sql: `
          SELECT
            id,
            rol,
            puesto,
            activo

          FROM usuarios

          WHERE CAST(id AS TEXT)
              = CAST(? AS TEXT)

          LIMIT 1
        `,
        args: [
          targetUserId,
        ],
      });

    const currentUser =
      castRows<UsuarioEditableRow>(
        currentResult.rows
      )[0];

    if (!currentUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Usuario no encontrado',
        },
        {
          status: 404,
        }
      );
    }

    const rolActual =
      normalizarRolSistema(
        currentUser.rol
      );

    /**
     * =====================================================
     * REGLAS DE JERARQUÍA
     * =====================================================
     */

    if (
      miRol === 'admin' &&
      rolActual === 'jefe'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Un admin no puede modificar a un jefe',
        },
        {
          status: 403,
        }
      );
    }

    /**
     * Solo jefe cambia roles.
     */
    if (
      rolFueEnviado &&
      miRol !== 'jefe'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo un jefe puede cambiar roles',
        },
        {
          status: 403,
        }
      );
    }

    /**
     * Evitar auto-desactivación.
     */
    if (
      targetUserId ===
        sessionUserId &&
      activoInput === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes desactivar tu propia cuenta',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * NUEVOS VALORES
     * =====================================================
     */

    const nuevoRol =
      rolFueEnviado
        ? rolInput!
        : rolActual;

    const nuevoPuesto =
      puestoFueEnviado
        ? puestoInput ?? null
        : currentUser.puesto ??
          null;

    const nuevoActivo =
      activoFueEnviado
        ? activoInput!
        : normalizarActivo(
              currentUser.activo
            )
          ? 1
          : 0;

    /**
     * =====================================================
     * ACTUALIZAR
     * =====================================================
     */

    await db.execute({
      sql: `
        UPDATE usuarios

        SET
          rol = ?,
          puesto = ?,
          activo = ?,
          actualizado_en = CURRENT_TIMESTAMP

        WHERE CAST(id AS TEXT)
            = CAST(? AS TEXT)
      `,
      args: [
        nuevoRol,
        nuevoPuesto,
        nuevoActivo,
        targetUserId,
      ],
    });

    /**
     * =====================================================
     * RECARGAR
     * =====================================================
     */

    const updatedResult =
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
            activo,
            creado_en,
            puesto

          FROM usuarios

          WHERE CAST(id AS TEXT)
              = CAST(? AS TEXT)

          LIMIT 1
        `,
        args: [
          targetUserId,
        ],
      });

    const updated =
      castRows<UsuarioActualizadoRow>(
        updatedResult.rows
      )[0];

    if (!updated) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Usuario actualizado no encontrado',
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,

        message:
          'Usuario actualizado correctamente',

        data: {
          id:
            String(
              updated.id
            ),

          nombre:
            String(
              updated.nombre ??
                ''
            ),

          apellido:
            String(
              updated.apellido ??
                ''
            ),

          email:
            String(
              updated.email ??
                ''
            ),

          pais:
            updated.pais ??
            null,

          telefono:
            updated
              .telefono_completo ??
            null,

          rol:
            normalizarRolSistema(
              updated.rol
            ),

          activo:
            normalizarActivo(
              updated.activo
            ),

          creado_en:
            updated.creado_en ??
            null,

          puesto:
            updated.puesto ??
            null,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'PATCH /api/user/usuarios error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al actualizar usuario',
      },
      {
        status: 500,
      }
    );
  }
}