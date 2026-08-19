// app/api/proyectos/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

/**
 * =========================================================
 * 📌 TIPOS AUXILIARES
 * =========================================================
 */

type RolProyecto =
  | 'owner'
  | 'admin'
  | 'miembro'
  | 'ninguno';

/**
 * Los permisos quedan alineados con proyectModel.ts.
 */
type PermisoProyecto =
  | 'owner_admin'
  | 'todos_miembros';

type ModoAccesoProyecto =
  | 'privado'
  | 'publico'
  | 'solicitud';

type VisibilidadProyecto =
  | 'privado'
  | 'publico';

type ProyectoRow = {
  id: number | bigint;
  nombre: string | null;
  descripcion: string | null;
  creador_id: string | null;
  estado: string | null;
  codigo_union: string | null;
  modo_acceso: string | null;
  prioridad: string | null;
  visibilidad: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  configuracion: string | null;
  ultima_actividad: string | null;
  permiso_editar_proyecto: string | null;
  permiso_gestionar_tareas: string | null;
};

type MiembroRolRow = {
  rol_en_proyecto?: string | null;
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
 * 👤 NORMALIZAR ROL EN PROYECTO
 * =========================================================
 *
 * Convierte posibles variantes almacenadas en la base
 * de datos al formato utilizado internamente.
 */
function normalizarRol(raw: unknown): RolProyecto {
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

  return 'ninguno';
}

/**
 * =========================================================
 * 🔐 NORMALIZAR PERMISOS
 * =========================================================
 *
 * Valores válidos:
 *
 * owner_admin
 * todos_miembros
 *
 * Si existe un valor antiguo "all_members",
 * se convierte a "todos_miembros" para mantener
 * compatibilidad con datos anteriores.
 */
function normalizarPermiso(
  raw: unknown
): PermisoProyecto {
  const value = String(raw ?? '')
    .toLowerCase()
    .trim();

  if (
    value === 'todos_miembros' ||
    value === 'all_members'
  ) {
    return 'todos_miembros';
  }

  return 'owner_admin';
}

/**
 * =========================================================
 * 🚪 NORMALIZAR MODO DE ACCESO
 * =========================================================
 *
 * IMPORTANTE:
 *
 * modo_acceso y visibilidad son conceptos distintos.
 *
 * modo_acceso:
 * - privado
 * - publico
 * - solicitud
 */
function normalizarModoAcceso(
  raw: unknown
): ModoAccesoProyecto {
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
    value === 'invite' ||
    value === 'invitacion' ||
    value === 'invitación'
  ) {
    return 'solicitud';
  }

  return 'privado';
}

/**
 * =========================================================
 * 👁️ NORMALIZAR VISIBILIDAD
 * =========================================================
 *
 * visibilidad:
 * - privado
 * - publico
 */
function normalizarVisibilidad(
  raw: unknown
): VisibilidadProyecto {
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

  return 'privado';
}

/**
 * =========================================================
 * 🛡️ VALIDAR PERMISOS
 * =========================================================
 */
function puedeSegunPermiso(
  permiso: PermisoProyecto,
  rol: RolProyecto
): boolean {
  if (rol === 'ninguno') {
    return false;
  }

  /**
   * owner_admin:
   *
   * Puede actuar:
   * - owner
   * - admin
   */
  if (permiso === 'owner_admin') {
    return (
      rol === 'owner' ||
      rol === 'admin'
    );
  }

  /**
   * todos_miembros:
   *
   * Puede actuar cualquier participante
   * del proyecto.
   */
  return (
    rol === 'owner' ||
    rol === 'admin' ||
    rol === 'miembro'
  );
}

/**
 * =========================================================
 * 👥 OBTENER ROL DEL USUARIO EN EL PROYECTO
 * =========================================================
 */
async function obtenerRolUsuarioEnProyecto(
  proyectoId: number,
  userId: string,
  creadorId: string | null
): Promise<{
  esOwner: boolean;
  rolProyecto: RolProyecto;
}> {
  /**
   * El creador siempre es owner independientemente
   * del contenido de proyecto_usuarios.
   */
  const esOwner =
    String(creadorId ?? '') === String(userId);

  if (esOwner) {
    return {
      esOwner: true,
      rolProyecto: 'owner',
    };
  }

  /**
   * Si no es creador, buscamos su relación
   * en proyecto_usuarios.
   */
  const miembroRes = await db.execute({
    sql: `
      SELECT rol_en_proyecto
      FROM proyecto_usuarios
      WHERE proyecto_id = ?
        AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
      LIMIT 1
    `,
    args: [
      proyectoId,
      userId,
    ],
  });

  const miembroRows =
    castRows<MiembroRolRow>(
      miembroRes.rows
    );

  const miembro = miembroRows[0];

  return {
    esOwner: false,
    rolProyecto: miembro
      ? normalizarRol(miembro.rol_en_proyecto)
      : 'ninguno',
  };
}

/**
 * =========================================================
 * GET /api/proyectos/[id]
 * =========================================================
 *
 * Obtiene la información de un proyecto y calcula:
 *
 * - Rol del usuario.
 * - Membresía.
 * - Permiso de edición.
 * - Permiso de gestión de tareas.
 * - Posibilidad de solicitar acceso.
 */
export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    /**
     * =====================================================
     * 🔐 VALIDAR USUARIO AUTENTICADO
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
        { status: 401 }
      );
    }

    /**
     * =====================================================
     * 📁 VALIDAR ID DEL PROYECTO
     * =====================================================
     */
    const { id } = await params;
    const proyectoId = Number(id);

    if (
      !Number.isInteger(proyectoId) ||
      proyectoId < 1
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'ID de proyecto inválido',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 🔎 OBTENER PROYECTO
     * =====================================================
     */
    const result = await db.execute({
      sql: `
        SELECT
          p.id,
          p.nombre,
          p.descripcion,
          p.creador_id,
          p.estado,
          p.codigo_union,
          p.modo_acceso,
          p.prioridad,
          p.visibilidad,
          p.fecha_inicio,
          p.fecha_fin,
          p.configuracion,
          p.ultima_actividad,
          p.permiso_editar_proyecto,
          p.permiso_gestionar_tareas
        FROM proyectos p
        WHERE p.id = ?
        LIMIT 1
      `,
      args: [proyectoId],
    });

    const rows =
      castRows<ProyectoRow>(
        result.rows
      );

    const row = rows[0];

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Proyecto no existe',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 👤 OBTENER ROL DEL USUARIO
     * =====================================================
     */
    const {
      esOwner,
      rolProyecto,
    } =
      await obtenerRolUsuarioEnProyecto(
        proyectoId,
        sessionUser.id,
        row.creador_id
      );

    const esMiembro =
      esOwner ||
      rolProyecto !== 'ninguno';

    /**
     * =====================================================
     * 👁️ VISIBILIDAD
     * =====================================================
     */
    const visibilidad =
      normalizarVisibilidad(
        row.visibilidad
      );

    /**
     * =====================================================
     * 🚪 MODO DE ACCESO
     * =====================================================
     */
    const modoAcceso =
      normalizarModoAcceso(
        row.modo_acceso
      );

    /**
     * =====================================================
     * 🔒 CONTROL DE VISUALIZACIÓN
     * =====================================================
     *
     * Miembros y owner siempre pueden ver el proyecto.
     *
     * Usuarios externos únicamente pueden ver
     * proyectos con visibilidad pública.
     */
    const puedeVerProyecto =
      esMiembro ||
      visibilidad === 'publico';

    if (!puedeVerProyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sin acceso a este proyecto',
          canRequestAccess: false,
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 📩 POSIBILIDAD DE SOLICITAR ACCESO
     * =====================================================
     *
     * Solo usuarios externos pueden solicitar acceso,
     * y únicamente cuando:
     *
     * modo_acceso = solicitud
     */
    const canRequestAccess =
      !esMiembro &&
      modoAcceso === 'solicitud';

    /**
     * =====================================================
     * 🔐 PERMISOS DEL PROYECTO
     * =====================================================
     */
    const permisoEditarProyecto =
      normalizarPermiso(
        row.permiso_editar_proyecto
      );

    const permisoGestionarTareas =
      normalizarPermiso(
        row.permiso_gestionar_tareas
      );

    const puede_editar_proyecto =
      puedeSegunPermiso(
        permisoEditarProyecto,
        rolProyecto
      );

    const puede_gestionar_tareas =
      puedeSegunPermiso(
        permisoGestionarTareas,
        rolProyecto
      );

    /**
     * =====================================================
     * 📦 RESPUESTA DEL PROYECTO
     * =====================================================
     *
     * El código de unión solo se devuelve a miembros.
     */
    const proyecto = {
      id: Number(row.id),

      nombre:
        row.nombre ?? '',

      descripcion:
        row.descripcion ?? null,

      creador_id:
        row.creador_id,

      estado:
        row.estado ?? 'activo',

      codigo_union:
        esMiembro
          ? row.codigo_union
          : null,

      modo_acceso:
        modoAcceso,

      prioridad:
        row.prioridad ?? 'media',

      visibilidad,

      fecha_inicio:
        row.fecha_inicio ?? null,

      fecha_fin:
        row.fecha_fin ?? null,

      configuracion:
        row.configuracion ?? null,

      ultima_actividad:
        row.ultima_actividad ?? null,

      permiso_editar_proyecto:
        permisoEditarProyecto,

      permiso_gestionar_tareas:
        permisoGestionarTareas,
    };

    /**
     * =====================================================
     * ✅ RESPUESTA FINAL
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        proyecto,

        rol_en_proyecto:
          rolProyecto,

        es_owner:
          esOwner,

        es_miembro:
          esMiembro,

        puede_editar_proyecto,

        puede_gestionar_tareas,

        canRequestAccess,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/proyectos/[id] error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}