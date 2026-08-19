// app/api/proyectos/[id]/configuracion/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * =========================================================
 * 📌 CONTEXTO DE PARÁMETROS
 * =========================================================
 */
type ParamsContext = {
  params: Promise<{ id: string }>;
};

/**
 * =========================================================
 * 📌 TIPOS DEL PROYECTO
 * =========================================================
 */

/**
 * Permisos utilizados actualmente por el sistema.
 *
 * owner_admin:
 * - owner
 * - administradores del proyecto
 *
 * todos_miembros:
 * - owner
 * - administradores
 * - miembros
 */
type PermisoApi =
  | 'owner_admin'
  | 'todos_miembros';

type RolProyecto =
  | 'owner'
  | 'admin'
  | 'miembro'
  | null;

type EstadoProyecto =
  | 'activo'
  | 'pausado'
  | 'completado'
  | 'cancelado';

type VisibilidadProyecto =
  | 'privado'
  | 'publico';

type ModoAccesoProyecto =
  | 'privado'
  | 'publico'
  | 'solicitud';

type PrioridadProyecto =
  | 'baja'
  | 'media'
  | 'alta'
  | 'critica';

/**
 * =========================================================
 * 📁 ESTRUCTURA DEL PROYECTO EN BD
 * =========================================================
 */
type ProyectoRow = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
  estado: string | null;
  visibilidad: string | null;
  modo_acceso: string | null;
  prioridad: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  configuracion: string | null;
  permiso_editar_proyecto: string | null;
  permiso_gestionar_tareas: string | null;
  creador_id?: string | null;
};

/**
 * Información retornada por PRAGMA foreign_key_list().
 */
type ForeignKeyRow = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
};

type SqliteTableRow = {
  name: string;
};

/**
 * =========================================================
 * 📚 CATÁLOGOS PERMITIDOS
 * =========================================================
 */

const ESTADOS_VALIDOS: EstadoProyecto[] = [
  'activo',
  'pausado',
  'completado',
  'cancelado',
];

const VISIBILIDADES_VALIDAS: VisibilidadProyecto[] = [
  'privado',
  'publico',
];

const MODOS_ACCESO_VALIDOS: ModoAccesoProyecto[] = [
  'privado',
  'publico',
  'solicitud',
];

const PRIORIDADES_VALIDAS: PrioridadProyecto[] = [
  'baja',
  'media',
  'alta',
  'critica',
];

const PERMISOS_VALIDOS: PermisoApi[] = [
  'owner_admin',
  'todos_miembros',
];

/**
 * =========================================================
 * 🔐 NORMALIZAR PERMISOS
 * =========================================================
 *
 * Convierte posibles valores antiguos de la base de datos
 * al formato actualmente utilizado por el sistema.
 *
 * Valores anteriores compatibles:
 *
 * all_members → todos_miembros
 * owner       → owner_admin
 *
 * "owner" se conserva únicamente como compatibilidad
 * histórica. Los nuevos proyectos utilizan owner_admin.
 */
function normalizarPermiso(
  valor: unknown
): PermisoApi {
  const v = String(valor ?? '')
    .toLowerCase()
    .trim();

  /**
   * Todos los miembros.
   */
  if (
    [
      'todos_miembros',
      'all_members',
      'todos los miembros',
      'todos_los_miembros',
      'todos',
      'members',
      'miembros',
      'miembros_todos',
    ].includes(v)
  ) {
    return 'todos_miembros';
  }

  /**
   * Owner + administradores.
   *
   * También absorbemos antiguos valores "owner"
   * para evitar errores con registros existentes.
   */
  if (
    [
      'owner_admin',
      'owner',
      'owner_only',
      'solo_dueno',
      'solo dueño',
      'solo_el_dueno',
      'solo_el_dueño',
      'dueno',
      'dueño',
      'dueno_admin',
      'dueño_admin',
      'admin',
      'admins',
      'admin+owner',
      'admin+dueno',
      'admin+dueño',
    ].includes(v)
  ) {
    return 'owner_admin';
  }

  /**
   * Valor seguro por defecto.
   */
  return 'owner_admin';
}

/**
 * =========================================================
 * 🛡️ VALIDAR PERMISO DE EDICIÓN
 * =========================================================
 */
function puedeEditarProyecto(
  rol: RolProyecto,
  permisoEdicion: PermisoApi
): boolean {
  if (!rol) {
    return false;
  }

  /**
   * Cualquier participante puede editar.
   */
  if (permisoEdicion === 'todos_miembros') {
    return (
      rol === 'owner' ||
      rol === 'admin' ||
      rol === 'miembro'
    );
  }

  /**
   * owner_admin.
   */
  return (
    rol === 'owner' ||
    rol === 'admin'
  );
}

/**
 * =========================================================
 * 🧹 HELPERS
 * =========================================================
 */

function esValorDefinido<T>(
  value: T | undefined
): value is T {
  return value !== undefined;
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

  if (typeof value !== 'string') {
    return undefined;
  }

  return value.trim();
}

function sanitizarTextoNullable(
  value: unknown
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const limpio = value.trim();

  return limpio === ''
    ? null
    : limpio;
}

function castRows<T>(
  rows: unknown[]
): T[] {
  return rows as T[];
}

/**
 * =========================================================
 * 🔄 NORMALIZAR ESTADO
 * =========================================================
 */
function normalizarEstado(
  valor: unknown
): EstadoProyecto | undefined {
  if (typeof valor !== 'string') {
    return undefined;
  }

  const v = valor
    .trim()
    .toLowerCase();

  if (v === 'activo') {
    return 'activo';
  }

  if (v === 'pausado') {
    return 'pausado';
  }

  if (
    v === 'completado' ||
    v === 'completo'
  ) {
    return 'completado';
  }

  if (
    v === 'cancelado' ||
    v === 'cancelada'
  ) {
    return 'cancelado';
  }

  return undefined;
}

/**
 * =========================================================
 * 👁️ NORMALIZAR VISIBILIDAD
 * =========================================================
 *
 * La visibilidad solo determina quién puede encontrar
 * o visualizar el proyecto.
 *
 * NO determina cómo se une un usuario.
 */
function normalizarVisibilidad(
  valor: unknown
): VisibilidadProyecto | undefined {
  if (typeof valor !== 'string') {
    return undefined;
  }

  const v = valor
    .trim()
    .toLowerCase();

  if (v === 'privado') {
    return 'privado';
  }

  if (
    v === 'publico' ||
    v === 'público' ||
    v === 'public'
  ) {
    return 'publico';
  }

  return undefined;
}

/**
 * =========================================================
 * 🚪 NORMALIZAR MODO DE ACCESO
 * =========================================================
 *
 * privado:
 * acceso manual/invitación.
 *
 * publico:
 * unión directa.
 *
 * solicitud:
 * requiere aprobación.
 */
function normalizarModoAcceso(
  valor: unknown
): ModoAccesoProyecto | undefined {
  if (typeof valor !== 'string') {
    return undefined;
  }

  const v = valor
    .trim()
    .toLowerCase();

  if (
    v === 'privado' ||
    v === 'private'
  ) {
    return 'privado';
  }

  if (
    v === 'publico' ||
    v === 'público' ||
    v === 'public'
  ) {
    return 'publico';
  }

  if (
    v === 'solicitud' ||
    v === 'invitacion' ||
    v === 'invitación' ||
    v === 'request' ||
    v === 'invite'
  ) {
    return 'solicitud';
  }

  return undefined;
}

/**
 * =========================================================
 * 🚩 NORMALIZAR PRIORIDAD
 * =========================================================
 */
function normalizarPrioridad(
  valor: unknown
): PrioridadProyecto | undefined {
  if (typeof valor !== 'string') {
    return undefined;
  }

  const v = valor
    .trim()
    .toLowerCase();

  if (
    PRIORIDADES_VALIDAS.includes(
      v as PrioridadProyecto
    )
  ) {
    return v as PrioridadProyecto;
  }

  return undefined;
}

/**
 * =========================================================
 * 🔐 NORMALIZAR ROL EN PROYECTO
 * =========================================================
 */
function normalizarRolProyecto(
  valor: unknown
): RolProyecto {
  const v = String(valor ?? '')
    .trim()
    .toLowerCase();

  if (
    v === 'owner' ||
    v === 'dueño' ||
    v === 'dueno'
  ) {
    return 'owner';
  }

  if (
    v === 'admin' ||
    v === 'administrador'
  ) {
    return 'admin';
  }

  if (
    v === 'miembro' ||
    v === 'member'
  ) {
    return 'miembro';
  }

  return null;
}

/**
 * =========================================================
 * 🧱 ESCAPAR IDENTIFICADORES SQL
 * =========================================================
 *
 * Se utiliza únicamente con nombres de tablas/columnas
 * obtenidos directamente desde SQLite.
 */
function escaparIdentificadorSql(
  nombre: string
): string {
  return `"${String(nombre).replace(
    /"/g,
    '""'
  )}"`;
}

/**
 * =========================================================
 * 👤 OBTENER ROL DEL USUARIO EN PROYECTO
 * =========================================================
 */
async function obtenerRolProyecto(
  proyectoId: number,
  userId: string,
  creadorId?: string | null
): Promise<RolProyecto> {
  /**
   * El creador siempre es owner.
   */
  if (
    String(creadorId ?? '') ===
    String(userId)
  ) {
    return 'owner';
  }

  const rolRes = await db.execute({
    sql: `
      SELECT rol_en_proyecto
      FROM proyecto_usuarios
      WHERE proyecto_id = ?
        AND CAST(usuario_id AS TEXT)
          = CAST(? AS TEXT)
      LIMIT 1
    `,
    args: [
      proyectoId,
      userId,
    ],
  });

  const rolRows =
    castRows<{
      rol_en_proyecto?: string | null;
    }>(
      rolRes.rows
    );

  const rolRow = rolRows[0];

  if (!rolRow) {
    return null;
  }

  return normalizarRolProyecto(
    rolRow.rol_en_proyecto
  );
}

/**
 * =========================================================
 * 📁 OBTENER PROYECTO POR ID
 * =========================================================
 */
async function obtenerProyectoPorId(
  proyectoId: number
): Promise<ProyectoRow | undefined> {
  const projRes = await db.execute({
    sql: `
      SELECT
        id,
        nombre,
        descripcion,
        estado,
        visibilidad,
        modo_acceso,
        prioridad,
        fecha_inicio,
        fecha_fin,
        configuracion,
        permiso_editar_proyecto,
        permiso_gestionar_tareas,
        creador_id
      FROM proyectos
      WHERE id = ?
      LIMIT 1
    `,
    args: [proyectoId],
  });

  const rows =
    castRows<ProyectoRow>(
      projRes.rows
    );

  return rows[0];
}

/**
 * =========================================================
 * 🗃️ LISTAR TABLAS DEL SISTEMA
 * =========================================================
 */
async function listarTablasUsuario():
Promise<string[]> {
  const res = await db.execute({
    sql: `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
    `,
    args: [],
  });

  return castRows<SqliteTableRow>(
    res.rows
  )
    .map((row) =>
      String(row.name)
    )
    .filter(Boolean);
}

/**
 * =========================================================
 * 🔗 BUSCAR TABLAS CON FOREIGN KEY
 * =========================================================
 */
async function obtenerTablasQueReferencian(
  tablaObjetivo: string
): Promise<
  Array<{
    tabla: string;
    columnaFk: string;
  }>
> {
  const tablas =
    await listarTablasUsuario();

  const referencias: Array<{
    tabla: string;
    columnaFk: string;
  }> = [];

  for (const tabla of tablas) {
    const pragmaRes =
      await db.execute({
        sql: `
          PRAGMA foreign_key_list(
            ${escaparIdentificadorSql(tabla)}
          )
        `,
        args: [],
      });

    const fks =
      castRows<ForeignKeyRow>(
        pragmaRes.rows
      );

    for (const fk of fks) {
      if (
        String(fk.table).toLowerCase() ===
        tablaObjetivo.toLowerCase()
      ) {
        referencias.push({
          tabla,
          columnaFk:
            String(fk.from),
        });
      }
    }
  }

  return referencias;
}

/**
 * =========================================================
 * 🗑️ ELIMINAR REFERENCIAS A TAREAS
 * =========================================================
 */
async function eliminarReferenciasATareas(
  proyectoId: number
) {
  const referenciasATareas =
    await obtenerTablasQueReferencian(
      'tareas'
    );

  for (const ref of referenciasATareas) {
    const tabla = ref.tabla;
    const columnaFk = ref.columnaFk;

    if (
      tabla.toLowerCase() ===
      'tareas'
    ) {
      continue;
    }

    await db.execute({
      sql: `
        DELETE FROM
          ${escaparIdentificadorSql(tabla)}
        WHERE
          ${escaparIdentificadorSql(columnaFk)}
          IN (
            SELECT id
            FROM tareas
            WHERE proyecto_id = ?
          )
      `,
      args: [proyectoId],
    });
  }
}

/**
 * =========================================================
 * 🗑️ ELIMINAR REFERENCIAS AL PROYECTO
 * =========================================================
 */
async function eliminarReferenciasAProyecto(
  proyectoId: number
) {
  const referenciasAProyectos =
    await obtenerTablasQueReferencian(
      'proyectos'
    );

  for (const ref of referenciasAProyectos) {
    const tabla = ref.tabla;
    const columnaFk = ref.columnaFk;

    if (
      tabla.toLowerCase() ===
      'proyectos'
    ) {
      continue;
    }

    await db.execute({
      sql: `
        DELETE FROM
          ${escaparIdentificadorSql(tabla)}
        WHERE
          ${escaparIdentificadorSql(columnaFk)}
          = ?
      `,
      args: [proyectoId],
    });
  }
}

/**
 * =========================================================
 * GET /api/proyectos/[id]/configuracion
 * =========================================================
 */
export async function GET(
  req: NextRequest,
  { params }: ParamsContext
) {
  try {
    const { id } = await params;
    const proyectoId = Number(id);

    if (
      !Number.isInteger(proyectoId) ||
      proyectoId < 1
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de proyecto inválido',
        },
        { status: 400 }
      );
    }

    /**
     * Validar sesión.
     */
    const sessionUser =
      await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No autorizado',
        },
        { status: 401 }
      );
    }

    const proyecto =
      await obtenerProyectoPorId(
        proyectoId
      );

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
     * Obtener rol.
     */
    const rol =
      await obtenerRolProyecto(
        proyectoId,
        sessionUser.id,
        proyecto.creador_id
      );

    /**
     * La configuración es información interna
     * del proyecto, por lo que debe ser miembro.
     */
    if (!rol) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes acceso a la configuración de este proyecto',
        },
        { status: 403 }
      );
    }

    const permisoEdicion =
      normalizarPermiso(
        proyecto.permiso_editar_proyecto
      );

    const permisoGestionTareas =
      normalizarPermiso(
        proyecto.permiso_gestionar_tareas
      );

    const puedeEditar =
      puedeEditarProyecto(
        rol,
        permisoEdicion
      );

    /**
     * Solo owner puede eliminar.
     */
    const puedeEliminar =
      rol === 'owner';

    const proyectoNormalizado = {
      ...proyecto,

      permiso_editar_proyecto:
        permisoEdicion,

      permiso_gestionar_tareas:
        permisoGestionTareas,

      visibilidad:
        normalizarVisibilidad(
          proyecto.visibilidad
        ) ?? 'privado',

      modo_acceso:
        normalizarModoAcceso(
          proyecto.modo_acceso
        ) ?? 'privado',

      prioridad:
        normalizarPrioridad(
          proyecto.prioridad
        ) ?? 'media',
    };

    const payload = {
      proyecto:
        proyectoNormalizado,

      meta: {
        rol,

        puedeEditarProyecto:
          puedeEditar,

        puedeEliminarProyecto:
          puedeEliminar,

        permisosConfiguracion: {
          permisoEdicion,
          permisoGestionTareas,
        },

        catalogos: {
          estados:
            ESTADOS_VALIDOS,

          visibilidades:
            VISIBILIDADES_VALIDAS,

          modosAcceso:
            MODOS_ACCESO_VALIDOS,

          prioridades:
            PRIORIDADES_VALIDAS,

          permisos:
            PERMISOS_VALIDOS,
        },
      },
    };

    return NextResponse.json(
      {
        ok: true,
        data: payload,
        ...payload,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(
      'Error en GET /api/proyectos/[id]/configuracion:',
      err
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno al cargar configuración',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * PATCH /api/proyectos/[id]/configuracion
 * =========================================================
 */
export async function PATCH(
  req: NextRequest,
  { params }: ParamsContext
) {
  try {
    const { id } = await params;
    const proyectoId = Number(id);

    if (
      !Number.isInteger(proyectoId) ||
      proyectoId < 1
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de proyecto inválido',
        },
        { status: 400 }
      );
    }

    const sessionUser =
      await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No autorizado',
        },
        { status: 401 }
      );
    }

    const body = await req
      .json()
      .catch(() => ({}));

    const proyecto =
      await obtenerProyectoPorId(
        proyectoId
      );

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

    const rol =
      await obtenerRolProyecto(
        proyectoId,
        sessionUser.id,
        proyecto.creador_id
      );

    const permisoEdicionActual =
      normalizarPermiso(
        proyecto.permiso_editar_proyecto
      );

    /**
     * Validar permiso actual antes de permitir
     * cualquier modificación.
     */
    if (
      !puedeEditarProyecto(
        rol,
        permisoEdicionActual
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No tienes permisos para editar la configuración de este proyecto',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 📝 DATOS GENERALES
     * =====================================================
     */
    const nombreInput =
      sanitizarTexto(
        body?.nombre
      );

    const descripcionInput =
      sanitizarTextoNullable(
        body?.descripcion
      );

    const fechaInicioInput =
      sanitizarTextoNullable(
        body?.fecha_inicio
      );

    const fechaFinInput =
      sanitizarTextoNullable(
        body?.fecha_fin
      );

    const estadoRecibido =
      body?.estado;

    const visibilidadRecibida =
      body?.visibilidad;

    const modoAccesoRecibido =
      body?.modo_acceso ??
      body?.modoAcceso;

    const prioridadRecibida =
      body?.prioridad;

    /**
     * Compatibilidad con diferentes nombres
     * enviados por frontend.
     */
    const permisoEdicionRaw =
      body?.permisoEdicion ??
      body?.permiso_editar_proyecto;

    const permisoGestionRaw =
      body?.permisoGestionTareas ??
      body?.permiso_gestionar_tareas;

    /**
     * =====================================================
     * ✅ VALIDACIONES
     * =====================================================
     */
    if (
      esValorDefinido(nombreInput) &&
      !nombreInput
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El nombre del proyecto no puede estar vacío',
        },
        { status: 400 }
      );
    }

    const estadoNormalizado =
      estadoRecibido !== undefined
        ? normalizarEstado(
            estadoRecibido
          )
        : undefined;

    if (
      estadoRecibido !== undefined &&
      !estadoNormalizado
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const visibilidadNormalizada =
      visibilidadRecibida !== undefined
        ? normalizarVisibilidad(
            visibilidadRecibida
          )
        : undefined;

    if (
      visibilidadRecibida !== undefined &&
      !visibilidadNormalizada
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Visibilidad inválida. Valores permitidos: ${VISIBILIDADES_VALIDAS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const modoAccesoNormalizado =
      modoAccesoRecibido !== undefined
        ? normalizarModoAcceso(
            modoAccesoRecibido
          )
        : undefined;

    if (
      modoAccesoRecibido !== undefined &&
      !modoAccesoNormalizado
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Modo de acceso inválido. Valores permitidos: ${MODOS_ACCESO_VALIDOS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const prioridadNormalizada =
      prioridadRecibida !== undefined
        ? normalizarPrioridad(
            prioridadRecibida
          )
        : undefined;

    if (
      prioridadRecibida !== undefined &&
      !prioridadNormalizada
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Prioridad inválida. Valores permitidos: ${PRIORIDADES_VALIDAS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 🔐 VALIDAR NUEVOS PERMISOS
     * =====================================================
     */
    let nuevoPermisoEdicion =
      permisoEdicionActual;

    if (
      permisoEdicionRaw !== undefined
    ) {
      const valor =
        String(
          permisoEdicionRaw
        )
          .trim()
          .toLowerCase();

      /**
       * Aceptamos nombres antiguos del frontend,
       * pero almacenamos el formato actual.
       */
      if (
        ![
          'owner_admin',
          'todos_miembros',
          'all_members',
          'owner',
        ].includes(valor)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              `permisoEdicion inválido. Valores permitidos: ${PERMISOS_VALIDOS.join(', ')}`,
          },
          { status: 400 }
        );
      }

      nuevoPermisoEdicion =
        normalizarPermiso(valor);
    }

    const permisoGestionActual =
      normalizarPermiso(
        proyecto.permiso_gestionar_tareas
      );

    let nuevoPermisoGestion =
      permisoGestionActual;

    if (
      permisoGestionRaw !== undefined
    ) {
      const valor =
        String(
          permisoGestionRaw
        )
          .trim()
          .toLowerCase();

      if (
        ![
          'owner_admin',
          'todos_miembros',
          'all_members',
          'owner',
        ].includes(valor)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              `permisoGestionTareas inválido. Valores permitidos: ${PERMISOS_VALIDOS.join(', ')}`,
          },
          { status: 400 }
        );
      }

      nuevoPermisoGestion =
        normalizarPermiso(valor);
    }

    /**
     * =====================================================
     * 🔐 SOLO OWNER PUEDE CAMBIAR LOS PERMISOS
     * =====================================================
     *
     * Evita que un admin habilitado para editar
     * se otorgue permisos más amplios a sí mismo.
     */
    const cambiaPermisos =
      permisoEdicionRaw !== undefined ||
      permisoGestionRaw !== undefined;

    if (
      cambiaPermisos &&
      rol !== 'owner'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo el owner puede modificar los permisos del proyecto',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 📦 VALORES FINALES
     * =====================================================
     */
    const nombreFinal =
      esValorDefinido(nombreInput)
        ? nombreInput
        : proyecto.nombre;

    const descripcionFinal =
      esValorDefinido(
        descripcionInput
      )
        ? descripcionInput
        : proyecto.descripcion;

    const fechaInicioFinal =
      esValorDefinido(
        fechaInicioInput
      )
        ? fechaInicioInput
        : proyecto.fecha_inicio;

    const fechaFinFinal =
      esValorDefinido(
        fechaFinInput
      )
        ? fechaFinInput
        : proyecto.fecha_fin;

    const estadoFinal =
      estadoNormalizado ??
      normalizarEstado(
        proyecto.estado
      ) ??
      'activo';

    const visibilidadFinal =
      visibilidadNormalizada ??
      normalizarVisibilidad(
        proyecto.visibilidad
      ) ??
      'privado';

    const modoAccesoFinal =
      modoAccesoNormalizado ??
      normalizarModoAcceso(
        proyecto.modo_acceso
      ) ??
      'privado';

    const prioridadFinal =
      prioridadNormalizada ??
      normalizarPrioridad(
        proyecto.prioridad
      ) ??
      'media';

    /**
     * =====================================================
     * 💾 ACTUALIZAR PROYECTO
     * =====================================================
     */
    await db.execute({
      sql: `
        UPDATE proyectos
        SET
          nombre = ?,
          descripcion = ?,
          estado = ?,
          visibilidad = ?,
          modo_acceso = ?,
          prioridad = ?,
          fecha_inicio = ?,
          fecha_fin = ?,
          permiso_editar_proyecto = ?,
          permiso_gestionar_tareas = ?,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [
        nombreFinal,
        descripcionFinal,
        estadoFinal,
        visibilidadFinal,
        modoAccesoFinal,
        prioridadFinal,
        fechaInicioFinal,
        fechaFinFinal,
        nuevoPermisoEdicion,
        nuevoPermisoGestion,
        proyectoId,
      ],
    });

    /**
     * Recargar información actualizada.
     */
    const proyectoUpdated =
      await obtenerProyectoPorId(
        proyectoId
      );

    if (!proyectoUpdated) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No se pudo recargar el proyecto actualizado',
        },
        { status: 500 }
      );
    }

    const permisoEdicionFinal =
      normalizarPermiso(
        proyectoUpdated
          .permiso_editar_proyecto
      );

    const permisoGestionFinal =
      normalizarPermiso(
        proyectoUpdated
          .permiso_gestionar_tareas
      );

    const puedeEditar =
      puedeEditarProyecto(
        rol,
        permisoEdicionFinal
      );

    const puedeEliminar =
      rol === 'owner';

    const payload = {
      proyecto: {
        ...proyectoUpdated,

        permiso_editar_proyecto:
          permisoEdicionFinal,

        permiso_gestionar_tareas:
          permisoGestionFinal,
      },

      meta: {
        rol,

        puedeEditarProyecto:
          puedeEditar,

        puedeEliminarProyecto:
          puedeEliminar,

        permisosConfiguracion: {
          permisoEdicion:
            permisoEdicionFinal,

          permisoGestionTareas:
            permisoGestionFinal,
        },
      },
    };

    return NextResponse.json(
      {
        ok: true,

        message:
          'Configuración actualizada correctamente',

        data: payload,
        ...payload,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(
      'Error en PATCH /api/proyectos/[id]/configuracion:',
      err
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno al guardar configuración',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * DELETE /api/proyectos/[id]/configuracion
 * =========================================================
 *
 * Solo el owner puede eliminar un proyecto.
 *
 * Antes de eliminarlo se eliminan registros relacionados
 * mediante las foreign keys detectadas en SQLite.
 */
export async function DELETE(
  req: NextRequest,
  { params }: ParamsContext
) {
  try {
    const { id } = await params;
    const proyectoId = Number(id);

    if (
      !Number.isInteger(proyectoId) ||
      proyectoId < 1
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'ID de proyecto inválido',
        },
        { status: 400 }
      );
    }

    const sessionUser =
      await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No autorizado',
        },
        { status: 401 }
      );
    }

    const proyecto =
      await obtenerProyectoPorId(
        proyectoId
      );

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

    const rol =
      await obtenerRolProyecto(
        proyectoId,
        sessionUser.id,
        proyecto.creador_id
      );

    /**
     * Solamente el owner puede eliminar.
     */
    if (rol !== 'owner') {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo el owner del proyecto puede eliminarlo',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 🗑️ ELIMINAR INFORMACIÓN RELACIONADA
     * =====================================================
     */

    // 1. Eliminar registros relacionados con tareas.
    await eliminarReferenciasATareas(
      proyectoId
    );

    // 2. Eliminar las tareas.
    await db.execute({
      sql: `
        DELETE FROM tareas
        WHERE proyecto_id = ?
      `,
      args: [proyectoId],
    });

    // 3. Eliminar registros relacionados directamente
    //    con el proyecto.
    await eliminarReferenciasAProyecto(
      proyectoId
    );

    // 4. Finalmente eliminar el proyecto.
    await db.execute({
      sql: `
        DELETE FROM proyectos
        WHERE id = ?
      `,
      args: [proyectoId],
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          'Proyecto eliminado correctamente',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(
      'Error en DELETE /api/proyectos/[id]/configuracion:',
      err
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno al eliminar el proyecto',
      },
      { status: 500 }
    );
  }
}