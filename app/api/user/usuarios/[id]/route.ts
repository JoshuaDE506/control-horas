// app/api/user/usuarios/[id]/route.ts

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

type Params = {
  id: string;
};

type RolSistema =
  | 'jefe'
  | 'admin'
  | 'colaborador';

type UsuarioExistenteRow = {
  id: string;
  rol: string | null;

  activo:
    | number
    | bigint
    | string
    | boolean
    | null;

  puesto: string | null;
};

type UsuarioBaseRow = {
  id: string;

  nombre: string | null;
  apellido: string | null;

  email: string | null;

  pais: string | null;

  rol: string | null;

  activo:
    | number
    | bigint
    | string
    | boolean
    | null;

  creado_en: string | null;

  puesto: string | null;

  telefono_completo:
    | string
    | null;
};

type CountRow = {
  cnt:
    | number
    | bigint
    | null;
};

type TareasStatsRow = {
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

type ProyectoDetalleRow = {
  id:
    | number
    | bigint
    | string;

  nombre: string | null;

  descripcion:
    | string
    | null;

  estado:
    | string
    | null;

  prioridad:
    | string
    | null;

  modo_acceso:
    | string
    | null;

  visibilidad:
    | string
    | null;

  fecha_inicio:
    | string
    | null;

  fecha_fin:
    | string
    | null;

  creador_id:
    | string
    | null;

  rol_en_proyecto:
    | string
    | null;

  tipo_union:
    | string
    | null;
};

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

async function getParams(
  context: {
    params:
      | Params
      | Promise<Params>;
  }
): Promise<Params> {
  return await context.params;
}

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

  if (
    value === 'colaborador'
  ) {
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
 * DATOS BASE DEL USUARIO
 * =========================================================
 */

async function getUsuarioBase(
  id: string
) {
  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          nombre,
          apellido,
          email,
          pais,
          rol,
          activo,
          creado_en,
          puesto,
          telefono_completo

        FROM usuarios

        WHERE CAST(id AS TEXT)
            = CAST(? AS TEXT)

        LIMIT 1
      `,
      args: [id],
    });

  return (
    castRows<UsuarioBaseRow>(
      result.rows
    )[0] ?? null
  );
}

/**
 * =========================================================
 * CONTEO DE PROYECTOS
 * =========================================================
 */

async function getUsuarioProyectoCounts(
  id: string
) {
  const creadosRes =
    await db.execute({
      sql: `
        SELECT
          COUNT(*) AS cnt

        FROM proyectos

        WHERE CAST(
                creador_id
                AS TEXT
              )
              =
              CAST(
                ? AS TEXT
              )
      `,
      args: [id],
    });

  const miembroRes =
    await db.execute({
      sql: `
        SELECT
          COUNT(
            DISTINCT proyecto_id
          ) AS cnt

        FROM proyecto_usuarios

        WHERE CAST(
                usuario_id
                AS TEXT
              )
              =
              CAST(
                ? AS TEXT
              )
      `,
      args: [id],
    });

  const creados =
    castRows<CountRow>(
      creadosRes.rows
    )[0];

  const miembro =
    castRows<CountRow>(
      miembroRes.rows
    )[0];

  return {
    proyectos_creados_count:
      toNumber(
        creados?.cnt
      ),

    proyectos_miembro_count:
      toNumber(
        miembro?.cnt
      ),
  };
}

/**
 * =========================================================
 * ESTADÍSTICAS DE TAREAS
 * =========================================================
 *
 * Adaptadas al flujo nuevo:
 *
 * selección:
 *   tarea_asignaciones
 *
 * en proceso:
 *   asignación activa + tarea in-progress
 *
 * completada:
 *   asignación activa + completado_en + tarea completed
 */

async function getUsuarioTareasStats(
  id: string
) {
  const statsRes =
    await db.execute({
      sql: `
        SELECT

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
                    TRIM(
                      COALESCE(
                        t.estado,
                        ''
                      )
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
                    TRIM(
                      COALESCE(
                        t.estado,
                        ''
                      )
                    )
                  )
                  =
                  'completed'

          ) AS tareas_completadas
      `,
      args: [
        id,
        id,
        id,
      ],
    });

  const row =
    castRows<TareasStatsRow>(
      statsRes.rows
    )[0] ?? {
      tareas_seleccionadas:
        0,

      tareas_en_proceso:
        0,

      tareas_completadas:
        0,
    };

  return {
    tareas_seleccionadas:
      toNumber(
        row
          .tareas_seleccionadas
      ),

    tareas_en_proceso:
      toNumber(
        row
          .tareas_en_proceso
      ),

    tareas_completadas:
      toNumber(
        row
          .tareas_completadas
      ),
  };
}

/**
 * =========================================================
 * PROYECTOS DEL USUARIO
 * =========================================================
 */

async function getUsuarioProyectos(
  id: string
) {
  const proyectosRes =
    await db.execute({
      sql: `
        SELECT
          p.id,
          p.nombre,
          p.descripcion,
          p.estado,
          p.prioridad,

          p.modo_acceso,

          p.visibilidad,

          p.fecha_inicio,
          p.fecha_fin,

          CAST(
            p.creador_id
            AS TEXT
          ) AS creador_id,

          CASE
            WHEN CAST(
                   p.creador_id
                   AS TEXT
                 )
                 =
                 CAST(
                   ? AS TEXT
                 )

            THEN 'owner'

            ELSE COALESCE(
              pu.rol_en_proyecto,
              'miembro'
            )
          END AS rol_en_proyecto,

          pu.tipo_union

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

        WHERE
          CAST(
            p.creador_id
            AS TEXT
          )
          =
          CAST(
            ? AS TEXT
          )

          OR CAST(
               pu.usuario_id
               AS TEXT
             )
             =
             CAST(
               ? AS TEXT
             )

        ORDER BY
          datetime(
            COALESCE(
              p.actualizado_en,
              p.creado_en
            )
          ) DESC,

          p.id DESC
      `,
      args: [
        id,
        id,
        id,
        id,
      ],
    });

  const rows =
    castRows<ProyectoDetalleRow>(
      proyectosRes.rows
    );

  return rows.map(
    (row) => ({
      id:
        String(row.id),

      nombre:
        String(
          row.nombre ?? ''
        ),

      descripcion:
        row.descripcion ??
        null,

      estado:
        row.estado ?? null,

      prioridad:
        row.prioridad ??
        null,

      /**
       * Se mantienen separados.
       *
       * No inferimos uno desde el otro.
       */
      modo_acceso:
        row.modo_acceso ??
        null,

      visibilidad:
        row.visibilidad ??
        null,

      fecha_inicio:
        row.fecha_inicio ??
        null,

      fecha_fin:
        row.fecha_fin ??
        null,

      creador_id:
        row.creador_id ??
        null,

      rol_en_proyecto:
        row
          .rol_en_proyecto ??
        'miembro',

      tipo_union:
        row.tipo_union ??
        null,
    })
  );
}

/**
 * =========================================================
 * CONSTRUIR DETALLE COMPLETO
 * =========================================================
 */

async function buildUsuarioDetalle(
  id: string
) {
  const usuarioBase =
    await getUsuarioBase(id);

  if (!usuarioBase) {
    return null;
  }

  const [
    counts,
    tareas,
    proyectos,
  ] = await Promise.all([
    getUsuarioProyectoCounts(
      id
    ),

    getUsuarioTareasStats(
      id
    ),

    getUsuarioProyectos(
      id
    ),
  ]);

  return {
    id:
      String(
        usuarioBase.id
      ),

    nombre:
      String(
        usuarioBase.nombre ??
          ''
      ),

    apellido:
      String(
        usuarioBase.apellido ??
          ''
      ),

    email:
      String(
        usuarioBase.email ??
          ''
      ),

    pais:
      usuarioBase.pais ??
      null,

    rol:
      normalizarRolSistema(
        usuarioBase.rol
      ),

    activo:
      normalizarActivo(
        usuarioBase.activo
      ),

    puesto:
      usuarioBase.puesto ??
      null,

    creado_en:
      usuarioBase.creado_en ??
      null,

    telefono_completo:
      usuarioBase
        .telefono_completo ??
      null,

    proyectos_creados_count:
      counts
        .proyectos_creados_count,

    proyectos_miembro_count:
      counts
        .proyectos_miembro_count,

    tareas_seleccionadas:
      tareas
        .tareas_seleccionadas,

    tareas_en_proceso:
      tareas
        .tareas_en_proceso,

    tareas_completadas:
      tareas
        .tareas_completadas,

    proyectos,
  };
}

/**
 * =========================================================
 * GET /api/user/usuarios/[id]
 * =========================================================
 */

export async function GET(
  request: NextRequest,
  context: {
    params:
      | Params
      | Promise<Params>;
  }
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
            'Solo jefe o admin pueden ver colaboradores',
        },
        {
          status: 403,
        }
      );
    }

    const { id } =
      await getParams(
        context
      );

    if (!id?.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de usuario inválido',
        },
        {
          status: 400,
        }
      );
    }

    const usuario =
      await buildUsuarioDetalle(
        String(id)
      );

    if (!usuario) {
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

    return NextResponse.json(
      {
        ok: true,
        usuario,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'GET /api/user/usuarios/[id] error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al obtener usuario',
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * =========================================================
 * PATCH /api/user/usuarios/[id]
 * =========================================================
 *
 * JEFE:
 * - rol
 * - activo
 * - puesto
 *
 * ADMIN:
 * - activo
 * - puesto
 *
 * Admin no puede modificar jefe.
 */

export async function PATCH(
  request: NextRequest,
  context: {
    params:
      | Params
      | Promise<Params>;
  }
) {
  try {
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

    if (
      !puedeAdministrarUsuarios(
        miRol
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo jefe o admin pueden editar colaboradores',
        },
        {
          status: 403,
        }
      );
    }

    const { id } =
      await getParams(
        context
      );

    const targetUserId =
      String(id ?? '')
        .trim();

    if (!targetUserId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de usuario inválido',
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    const rolFueEnviado =
      body?.rol !== undefined;

    const activoFueEnviado =
      body?.activo !==
      undefined;

    const puestoFueEnviado =
      body?.puesto !==
      undefined;

    if (
      !rolFueEnviado &&
      !activoFueEnviado &&
      !puestoFueEnviado
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
     * USUARIO OBJETIVO
     * =====================================================
     */

    const existingRes =
      await db.execute({
        sql: `
          SELECT
            id,
            rol,
            activo,
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

    const existing =
      castRows<UsuarioExistenteRow>(
        existingRes.rows
      )[0];

    if (!existing) {
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

    const rolObjetivoActual =
      normalizarRolSistema(
        existing.rol
      );

    /**
     * =====================================================
     * JERARQUÍA
     * =====================================================
     */

    if (
      miRol === 'admin' &&
      rolObjetivoActual ===
        'jefe'
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
     * =====================================================
     * ROL
     * =====================================================
     */

    let nuevoRol =
      rolObjetivoActual;

    if (rolFueEnviado) {
      if (
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

      const rolNormalizado =
        parseRolSistema(
          body.rol
        );

      if (!rolNormalizado) {
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

      nuevoRol =
        rolNormalizado;
    }

    /**
     * =====================================================
     * ACTIVO
     * =====================================================
     */

    let nuevoActivo =
      normalizarActivo(
        existing.activo
      )
        ? 1
        : 0;

    if (activoFueEnviado) {
      if (
        typeof body.activo !==
        'boolean'
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'activo debe ser booleano',
          },
          {
            status: 400,
          }
        );
      }

      /**
       * Nadie puede desactivarse a sí mismo.
       */
      if (
        targetUserId ===
          sessionUserId &&
        body.activo === false
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'No puedes desactivar tu propia cuenta desde aquí',
          },
          {
            status: 400,
          }
        );
      }

      nuevoActivo =
        body.activo
          ? 1
          : 0;
    }

    /**
     * =====================================================
     * PUESTO
     * =====================================================
     */

    let nuevoPuesto =
      existing.puesto ??
      null;

    if (puestoFueEnviado) {
      if (
        body.puesto !== null &&
        typeof body.puesto !==
          'string'
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'puesto debe ser texto o null',
          },
          {
            status: 400,
          }
        );
      }

      const puestoLimpio =
        typeof body.puesto ===
          'string'
          ? body.puesto.trim()
          : '';

      nuevoPuesto =
        puestoLimpio ||
        null;
    }

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
          activo = ?,
          puesto = ?,
          actualizado_en = CURRENT_TIMESTAMP

        WHERE CAST(id AS TEXT)
            = CAST(? AS TEXT)
      `,
      args: [
        nuevoRol,
        nuevoActivo,
        nuevoPuesto,
        targetUserId,
      ],
    });

    const usuario =
      await buildUsuarioDetalle(
        targetUserId
      );

    if (!usuario) {
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

        usuario,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'PATCH /api/user/usuarios/[id] error:',
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

/**
 * =========================================================
 * DELETE /api/user/usuarios/[id]
 * =========================================================
 *
 * IMPORTANTE:
 *
 * NO elimina físicamente al usuario.
 *
 * Realiza soft delete:
 *
 * activo = 0
 *
 * Esto conserva:
 *
 * - proyectos
 * - tareas
 * - informes
 * - jornadas
 * - registros históricos
 */

export async function DELETE(
  request: NextRequest,
  context: {
    params:
      | Params
      | Promise<Params>;
  }
) {
  try {
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

    if (
      !puedeAdministrarUsuarios(
        miRol
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo jefe o admin pueden desactivar colaboradores',
        },
        {
          status: 403,
        }
      );
    }

    const { id } =
      await getParams(
        context
      );

    const targetUserId =
      String(id ?? '')
        .trim();

    if (!targetUserId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de usuario inválido',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * No auto-desactivación.
     */
    if (
      sessionUserId ===
      targetUserId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes desactivar tu propia cuenta desde aquí',
        },
        {
          status: 400,
        }
      );
    }

    /**
     * =====================================================
     * USUARIO OBJETIVO
     * =====================================================
     */

    const existingRes =
      await db.execute({
        sql: `
          SELECT
            id,
            rol,
            activo,
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

    const existing =
      castRows<UsuarioExistenteRow>(
        existingRes.rows
      )[0];

    if (!existing) {
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

    const rolObjetivo =
      normalizarRolSistema(
        existing.rol
      );

    /**
     * Admin no puede desactivar jefe.
     */
    if (
      miRol === 'admin' &&
      rolObjetivo === 'jefe'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Un admin no puede desactivar a un jefe',
        },
        {
          status: 403,
        }
      );
    }

    /**
     * Ya está inactivo.
     */
    if (
      !normalizarActivo(
        existing.activo
      )
    ) {
      return NextResponse.json(
        {
          ok: true,

          message:
            'El usuario ya estaba inactivo',
        },
        {
          status: 200,
        }
      );
    }

    /**
     * =====================================================
     * SOFT DELETE
     * =====================================================
     */

    await db.execute({
      sql: `
        UPDATE usuarios

        SET
          activo = 0,
          actualizado_en = CURRENT_TIMESTAMP

        WHERE CAST(id AS TEXT)
            = CAST(? AS TEXT)
      `,
      args: [
        targetUserId,
      ],
    });

    return NextResponse.json(
      {
        ok: true,

        message:
          'Usuario marcado como inactivo',
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      'DELETE /api/user/usuarios/[id] error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al desactivar usuario',
      },
      {
        status: 500,
      }
    );
  }
}