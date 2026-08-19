// app/api/proyectos/[id]/miembros/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

/**
 * =========================================================
 * 📌 TIPOS AUXILIARES
 * =========================================================
 */

type Params = {
  id: string;
};

type RolProyecto =
  | 'owner'
  | 'admin'
  | 'miembro'
  | null;

type RolGestionable =
  | 'admin'
  | 'miembro';

type ProyectoBaseRow = {
  id: number | bigint | null;
  creador_id: string | null;
};

type ProyectoBase = {
  id: number;
  creador_id: string | null;
};

type RolRow = {
  rol?: string | null;
};

type MiembroRow = {
  usuario_id: string;
  nombre: string | null;
  apellido: string | null;
  pais: string | null;
  email: string | null;
  rol_raw: string | null;
  fecha_union: string | null;
  tareas_asignadas: number | bigint | null;
};

/**
 * =========================================================
 * 🔄 CAST DE RESULTADOS
 * =========================================================
 */
function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

/**
 * =========================================================
 * 📍 OBTENER PARÁMETROS
 * =========================================================
 */
async function getParams(
  context: {
    params: Params | Promise<Params>;
  }
): Promise<Params> {
  return await context.params;
}

/**
 * =========================================================
 * 🔢 CONVERTIR ID DEL PROYECTO
 * =========================================================
 */
function toProjectId(
  proyectoId: string
): number | null {
  const parsed = Number(proyectoId);

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
 * 👤 NORMALIZAR ROL DEL PROYECTO
 * =========================================================
 *
 * Se utiliza para leer roles existentes de la base.
 */
function normalizarRolProyecto(
  raw: unknown
): RolProyecto {
  const value = String(raw ?? '')
    .toLowerCase()
    .trim();

  if (
    value === 'owner' ||
    value === 'dueño' ||
    value === 'dueno'
  ) {
    return 'owner';
  }

  if (
    value === 'admin' ||
    value === 'administrador'
  ) {
    return 'admin';
  }

  if (
    value === 'miembro' ||
    value === 'member'
  ) {
    return 'miembro';
  }

  return null;
}

/**
 * =========================================================
 * 🔐 VALIDAR ROL A ASIGNAR
 * =========================================================
 *
 * Desde esta API solamente pueden asignarse:
 *
 * - admin
 * - miembro
 *
 * El rol owner pertenece únicamente al creador.
 */
function normalizarRolGestionable(
  raw: unknown
): RolGestionable | null {
  const value = String(raw ?? '')
    .toLowerCase()
    .trim();

  if (
    value === 'admin' ||
    value === 'administrador'
  ) {
    return 'admin';
  }

  if (
    value === 'miembro' ||
    value === 'member'
  ) {
    return 'miembro';
  }

  return null;
}

/**
 * =========================================================
 * 📁 OBTENER PROYECTO
 * =========================================================
 */
async function obtenerProyecto(
  proyectoId: string
): Promise<ProyectoBase | null> {
  const proyectoNumericId =
    toProjectId(proyectoId);

  if (proyectoNumericId == null) {
    return null;
  }

  const result = await db.execute({
    sql: `
      SELECT
        id,
        creador_id
      FROM proyectos
      WHERE id = ?
      LIMIT 1
    `,
    args: [proyectoNumericId],
  });

  const rows =
    castRows<ProyectoBaseRow>(
      result.rows
    );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(
      row.id ?? proyectoNumericId
    ),

    creador_id:
      row.creador_id ?? null,
  };
}

/**
 * =========================================================
 * 👥 OBTENER ROL DEL USUARIO EN EL PROYECTO
 * =========================================================
 */
async function obtenerRolEnProyecto(
  proyectoId: string,
  usuarioId: string
): Promise<RolProyecto> {
  const proyectoNumericId =
    toProjectId(proyectoId);

  if (proyectoNumericId == null) {
    return null;
  }

  const result = await db.execute({
    sql: `
      SELECT
        rol_en_proyecto AS rol
      FROM proyecto_usuarios
      WHERE proyecto_id = ?
        AND CAST(usuario_id AS TEXT)
          = CAST(? AS TEXT)
      LIMIT 1
    `,
    args: [
      proyectoNumericId,
      usuarioId,
    ],
  });

  const rows =
    castRows<RolRow>(
      result.rows
    );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return normalizarRolProyecto(
    row.rol
  );
}

/**
 * =========================================================
 * 👑 VALIDAR OWNER
 * =========================================================
 */
function esOwnerDeProyecto(
  proyecto: {
    creador_id: string | null;
  },
  userId: string
): boolean {
  return (
    String(
      proyecto.creador_id ?? ''
    ) ===
    String(userId)
  );
}

/**
 * =========================================================
 * 🛡️ VALIDAR GESTIÓN DE MIEMBROS
 * =========================================================
 *
 * Pueden gestionar miembros:
 *
 * - owner
 * - admin del proyecto
 */
function puedeGestionarMiembros(opts: {
  rolProyecto: RolProyecto;
  esOwnerProyecto: boolean;
}): boolean {
  if (opts.esOwnerProyecto) {
    return true;
  }

  return opts.rolProyecto === 'admin';
}

/**
 * =========================================================
 * 📊 FILAS AFECTADAS
 * =========================================================
 */
function getRowsAffected(
  result: unknown
): number {
  const value =
    (result as {
      rowsAffected?: number;
    }).rowsAffected ??
    (result as {
      affectedRows?: number;
    }).affectedRows ??
    0;

  return Number(value ?? 0);
}

/**
 * =========================================================
 * GET /api/proyectos/[id]/miembros
 * =========================================================
 *
 * Lista los miembros del proyecto.
 *
 * Solo pueden visualizar la lista:
 *
 * - owner
 * - admin
 * - miembro
 */
export async function GET(
  request: NextRequest,
  context: {
    params: Params | Promise<Params>;
  }
) {
  try {
    /**
     * =====================================================
     * 🔐 VALIDAR SESIÓN
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
          error: 'No autenticado',
        },
        { status: 401 }
      );
    }

    /**
     * =====================================================
     * 📁 VALIDAR PROYECTO
     * =====================================================
     */
    const { id } =
      await getParams(context);

    const proyectoNumericId =
      toProjectId(id);

    if (proyectoNumericId == null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de proyecto inválido',
        },
        { status: 400 }
      );
    }

    const proyecto =
      await obtenerProyecto(id);

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no encontrado',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 👤 VALIDAR MEMBRESÍA
     * =====================================================
     */
    const rolUsuario =
      await obtenerRolEnProyecto(
        id,
        sessionUser.id
      );

    const esOwner =
      esOwnerDeProyecto(
        proyecto,
        sessionUser.id
      );

    if (
      !esOwner &&
      !rolUsuario
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes permisos para ver los miembros de este proyecto',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 👥 OBTENER MIEMBROS
     * =====================================================
     *
     * El owner se obtiene directamente desde creador_id.
     *
     * Los demás participantes se obtienen desde
     * proyecto_usuarios.
     */
    const miembrosRes =
      await db.execute({
        sql: `
          SELECT
            u.id AS usuario_id,
            u.nombre,
            u.apellido,
            u.pais,
            u.email,
            'owner' AS rol_raw,
            pu.fecha_union AS fecha_union,

            (
              SELECT COUNT(*)
              FROM tarea_asignaciones ta
              JOIN tareas t
                ON t.id = ta.tarea_id

              WHERE t.proyecto_id = p.id
                AND CAST(ta.usuario_id AS TEXT)
                  = CAST(u.id AS TEXT)
                AND ta.estado = 'activo'
            ) AS tareas_asignadas

          FROM proyectos p

          JOIN usuarios u
            ON CAST(u.id AS TEXT)
             = CAST(p.creador_id AS TEXT)

          LEFT JOIN proyecto_usuarios pu
            ON pu.proyecto_id = p.id
           AND CAST(pu.usuario_id AS TEXT)
             = CAST(p.creador_id AS TEXT)

          WHERE p.id = ?

          UNION

          SELECT
            u.id AS usuario_id,
            u.nombre,
            u.apellido,
            u.pais,
            u.email,
            pu.rol_en_proyecto AS rol_raw,
            pu.fecha_union,

            (
              SELECT COUNT(*)
              FROM tarea_asignaciones ta
              JOIN tareas t
                ON t.id = ta.tarea_id

              WHERE t.proyecto_id = pu.proyecto_id
                AND CAST(ta.usuario_id AS TEXT)
                  = CAST(u.id AS TEXT)
                AND ta.estado = 'activo'
            ) AS tareas_asignadas

          FROM proyecto_usuarios pu

          JOIN proyectos p2
            ON p2.id = pu.proyecto_id

          JOIN usuarios u
            ON CAST(u.id AS TEXT)
             = CAST(pu.usuario_id AS TEXT)

          WHERE pu.proyecto_id = ?
            AND CAST(u.id AS TEXT)
              != CAST(p2.creador_id AS TEXT)
        `,
        args: [
          proyectoNumericId,
          proyectoNumericId,
        ],
      });

    const miembrosRows =
      castRows<MiembroRow>(
        miembrosRes.rows
      );

    const miembros =
      miembrosRows.map((row) => {
        const nombre =
          row.nombre ?? '';

        const apellido =
          row.apellido ?? '';

        const tareasAsignadas =
          Number(
            row.tareas_asignadas ?? 0
          );

        return {
          id:
            String(row.usuario_id),

          nombre,

          apellido,

          nombre_completo:
            `${nombre} ${apellido}`.trim(),

          pais:
            row.pais ?? null,

          email:
            row.email ?? '',

          fecha_union:
            row.fecha_union ?? null,

          rol:
            normalizarRolProyecto(
              row.rol_raw
            ) ?? 'miembro',

          tareas_asignadas:
            tareasAsignadas,
        };
      });

    return NextResponse.json(
      {
        ok: true,
        data: miembros,
        miembros,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/proyectos/[id]/miembros error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno al obtener miembros del proyecto',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * POST /api/proyectos/[id]/miembros
 * =========================================================
 *
 * Añade manualmente un usuario al proyecto.
 *
 * Solamente pueden hacerlo:
 *
 * - owner
 * - admin
 */
export async function POST(
  request: NextRequest,
  context: {
    params: Params | Promise<Params>;
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
          error: 'No autenticado',
        },
        { status: 401 }
      );
    }

    const { id } =
      await getParams(context);

    const proyectoNumericId =
      toProjectId(id);

    if (proyectoNumericId == null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de proyecto inválido',
        },
        { status: 400 }
      );
    }

    const proyecto =
      await obtenerProyecto(id);

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no encontrado',
        },
        { status: 404 }
      );
    }

    const rolUsuario =
      await obtenerRolEnProyecto(
        id,
        sessionUser.id
      );

    const esOwner =
      esOwnerDeProyecto(
        proyecto,
        sessionUser.id
      );

    if (
      !puedeGestionarMiembros({
        rolProyecto: rolUsuario,
        esOwnerProyecto: esOwner,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes permisos para gestionar miembros de este proyecto',
        },
        { status: 403 }
      );
    }

    const body = await request
      .json()
      .catch(() => ({}));

    const usuarioId =
      typeof body?.usuario_id === 'string'
        ? body.usuario_id.trim()
        : '';

    if (!usuarioId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'usuario_id es obligatorio',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 👑 OWNER NO PUEDE AÑADIRSE NUEVAMENTE
     * =====================================================
     */
    if (
      usuarioId ===
      String(
        proyecto.creador_id ?? ''
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El dueño del proyecto ya forma parte del proyecto como owner',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 👤 VALIDAR USUARIO
     * =====================================================
     *
     * Ahora también verificamos que se encuentre activo.
     */
    const usuarioRes =
      await db.execute({
        sql: `
          SELECT
            id,
            activo
          FROM usuarios
          WHERE CAST(id AS TEXT)
            = CAST(? AS TEXT)
            AND CAST(
              COALESCE(activo, 0)
              AS INTEGER
            ) = 1
          LIMIT 1
        `,
        args: [usuarioId],
      });

    if (
      !usuarioRes.rows ||
      usuarioRes.rows.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Usuario no encontrado o inactivo',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 🔎 VERIFICAR MEMBRESÍA EXISTENTE
     * =====================================================
     */
    const existeRes =
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
          proyectoNumericId,
          usuarioId,
        ],
      });

    if (
      existeRes.rows.length > 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El usuario ya es miembro de este proyecto',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * 🔐 VALIDAR ROL
     * =====================================================
     */
    const rolInput =
      body?.rol_en_proyecto ??
      'miembro';

    const rolGuardar =
      normalizarRolGestionable(
        rolInput
      );

    if (!rolGuardar) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Rol inválido. Solo se permite "admin" o "miembro".',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 🔗 TIPO DE UNIÓN
     * =====================================================
     */
    const tipoUnion =
      typeof body?.tipo_union === 'string' &&
      body.tipo_union.trim()
        ? body.tipo_union.trim()
        : 'manual';

    /**
     * =====================================================
     * ➕ INSERTAR MIEMBRO
     * =====================================================
     */
    await db.execute({
      sql: `
        INSERT INTO proyecto_usuarios (
          proyecto_id,
          usuario_id,
          rol_en_proyecto,
          fecha_union,
          tipo_union
        )
        VALUES (
          ?,
          ?,
          ?,
          datetime('now'),
          ?
        )
      `,
      args: [
        proyectoNumericId,
        usuarioId,
        rolGuardar,
        tipoUnion,
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          'Miembro añadido correctamente',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/miembros error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al añadir miembro al proyecto',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * PATCH /api/proyectos/[id]/miembros
 * =========================================================
 *
 * Modifica el rol de un miembro existente.
 */
export async function PATCH(
  request: NextRequest,
  context: {
    params: Params | Promise<Params>;
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
          error: 'No autenticado',
        },
        { status: 401 }
      );
    }

    const { id } =
      await getParams(context);

    const proyectoNumericId =
      toProjectId(id);

    if (proyectoNumericId == null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de proyecto inválido',
        },
        { status: 400 }
      );
    }

    const proyecto =
      await obtenerProyecto(id);

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no encontrado',
        },
        { status: 404 }
      );
    }

    const rolUsuario =
      await obtenerRolEnProyecto(
        id,
        sessionUser.id
      );

    const esOwner =
      esOwnerDeProyecto(
        proyecto,
        sessionUser.id
      );

    if (
      !puedeGestionarMiembros({
        rolProyecto: rolUsuario,
        esOwnerProyecto: esOwner,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes permisos para gestionar miembros de este proyecto',
        },
        { status: 403 }
      );
    }

    const body = await request
      .json()
      .catch(() => ({}));

    const usuarioId =
      typeof body?.usuario_id === 'string'
        ? body.usuario_id.trim()
        : '';

    const nuevoRol =
      normalizarRolGestionable(
        body?.rol_en_proyecto
      );

    if (!usuarioId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'usuario_id es obligatorio',
        },
        { status: 400 }
      );
    }

    if (!nuevoRol) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Rol inválido. Solo se permite "admin" o "miembro".',
        },
        { status: 400 }
      );
    }

    /**
     * Owner nunca puede ser modificado desde aquí.
     */
    if (
      usuarioId ===
      String(
        proyecto.creador_id ?? ''
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes cambiar el rol del dueño del proyecto',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 🔐 PROTEGER ADMINISTRADORES
     * =====================================================
     *
     * Un admin puede gestionar miembros normales,
     * pero únicamente el owner puede modificar
     * el rol de otro admin.
     */
    const rolObjetivo =
      await obtenerRolEnProyecto(
        id,
        usuarioId
      );

    if (!rolObjetivo) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El usuario no es miembro de este proyecto',
        },
        { status: 404 }
      );
    }

    if (
      rolUsuario === 'admin' &&
      rolObjetivo === 'admin'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo el owner puede modificar el rol de otro administrador',
        },
        { status: 403 }
      );
    }

    const resUpdate =
      await db.execute({
        sql: `
          UPDATE proyecto_usuarios
          SET rol_en_proyecto = ?
          WHERE proyecto_id = ?
            AND CAST(usuario_id AS TEXT)
              = CAST(? AS TEXT)
        `,
        args: [
          nuevoRol,
          proyectoNumericId,
          usuarioId,
        ],
      });

    if (
      getRowsAffected(resUpdate) === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El usuario no es miembro de este proyecto',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          'Rol actualizado correctamente',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'PATCH /api/proyectos/[id]/miembros error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al actualizar rol del miembro',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * DELETE /api/proyectos/[id]/miembros
 * =========================================================
 *
 * Elimina un miembro del proyecto.
 *
 * Opcionalmente puede cancelar sus asignaciones
 * activas mediante:
 *
 * liberar_tareas = true
 *
 * Esta lógica se mantiene por ahora y será revisada
 * junto con el módulo completo de tareas.
 */
export async function DELETE(
  request: NextRequest,
  context: {
    params: Params | Promise<Params>;
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
          error: 'No autenticado',
        },
        { status: 401 }
      );
    }

    const { id } =
      await getParams(context);

    const proyectoNumericId =
      toProjectId(id);

    if (proyectoNumericId == null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de proyecto inválido',
        },
        { status: 400 }
      );
    }

    const proyecto =
      await obtenerProyecto(id);

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no encontrado',
        },
        { status: 404 }
      );
    }

    const rolUsuario =
      await obtenerRolEnProyecto(
        id,
        sessionUser.id
      );

    const esOwner =
      esOwnerDeProyecto(
        proyecto,
        sessionUser.id
      );

    if (
      !puedeGestionarMiembros({
        rolProyecto: rolUsuario,
        esOwnerProyecto: esOwner,
      })
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes permisos para gestionar miembros de este proyecto',
        },
        { status: 403 }
      );
    }

    const body = await request
      .json()
      .catch(() => ({}));

    const usuarioId =
      typeof body?.usuario_id === 'string'
        ? body.usuario_id.trim()
        : '';

    const liberarTareas =
      Boolean(
        body?.liberar_tareas
      );

    if (!usuarioId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'usuario_id es obligatorio',
        },
        { status: 400 }
      );
    }

    /**
     * Owner nunca puede eliminarse.
     */
    if (
      usuarioId ===
      String(
        proyecto.creador_id ?? ''
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes eliminar al dueño del proyecto',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 🔐 PROTEGER ADMINISTRADORES
     * =====================================================
     *
     * Un admin no puede eliminar a otro admin.
     * Esa acción queda reservada al owner.
     */
    const rolObjetivo =
      await obtenerRolEnProyecto(
        id,
        usuarioId
      );

    if (!rolObjetivo) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El usuario no es miembro de este proyecto',
        },
        { status: 404 }
      );
    }

    if (
      rolUsuario === 'admin' &&
      rolObjetivo === 'admin'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo el owner puede eliminar a otro administrador',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * ⏸️ LIBERAR TAREAS
     * =====================================================
     *
     * Por ahora mantenemos la lógica existente.
     *
     * La revisaremos cuando analicemos:
     *
     * - tarea_asignaciones
     * - inicio de tareas
     * - cancelaciones
     * - informes
     * - cronómetro
     */
    if (liberarTareas) {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones

          SET estado = 'cancelado'

          WHERE CAST(usuario_id AS TEXT)
            = CAST(? AS TEXT)

            AND estado = 'activo'

            AND tarea_id IN (
              SELECT id
              FROM tareas
              WHERE proyecto_id = ?
            )
        `,
        args: [
          usuarioId,
          proyectoNumericId,
        ],
      });
    }

    /**
     * =====================================================
     * 🗑️ ELIMINAR MEMBRESÍA
     * =====================================================
     */
    const resDelete =
      await db.execute({
        sql: `
          DELETE FROM proyecto_usuarios

          WHERE proyecto_id = ?

            AND CAST(usuario_id AS TEXT)
              = CAST(? AS TEXT)
        `,
        args: [
          proyectoNumericId,
          usuarioId,
        ],
      });

    if (
      getRowsAffected(resDelete) === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El usuario no es miembro de este proyecto',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          'Miembro eliminado correctamente',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'DELETE /api/proyectos/[id]/miembros error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al eliminar miembro del proyecto',
      },
      { status: 500 }
    );
  }
}