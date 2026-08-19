// horaslaborales/model/proyectModel.ts

import { db } from '@/lib/database';
import { randomUUID } from 'crypto';

/**
 * =========================================================
 * 📌 TIPOS DEL PROYECTO
 * =========================================================
 */

export type PrioridadProyecto =
  | 'baja'
  | 'media'
  | 'alta'
  | 'critica';

/**
 * Visibilidad:
 *
 * privado → solo creador y miembros pueden verlo.
 * publico → otros usuarios pueden encontrarlo.
 */
export type VisibilidadProyecto =
  | 'privado'
  | 'publico';

/**
 * Modo de acceso:
 *
 * privado   → no permite unión libre.
 * publico   → permite unión directa.
 * solicitud → requiere aprobación.
 */
export type ModoAccesoProyecto =
  | 'privado'
  | 'publico'
  | 'solicitud';

/**
 * Permisos para editar el proyecto.
 */
export type PermisoEditarProyecto =
  | 'owner_admin'
  | 'todos_miembros';

/**
 * Permisos para gestionar tareas.
 */
export type PermisoGestionarTareas =
  | 'owner_admin'
  | 'todos_miembros';

/**
 * =========================================================
 * 📁 INTERFAZ PROYECTO
 * =========================================================
 */
export interface Proyecto {
  id: number;

  nombre: string;
  descripcion: string | null;

  /**
   * Los IDs de usuarios son TEXT en la base de datos.
   */
  creador_id: string;

  estado: string;
  codigo_union: string;

  creado_en: string;
  actualizado_en: string;

  modo_acceso: ModoAccesoProyecto;
  prioridad: PrioridadProyecto;
  visibilidad: VisibilidadProyecto;

  fecha_inicio: string | null;
  fecha_fin: string | null;

  configuracion: string | null;
  ultima_actividad: string | null;

  permiso_editar_proyecto: PermisoEditarProyecto;
  permiso_gestionar_tareas: PermisoGestionarTareas;

  /**
   * Campos calculados.
   *
   * 1 = sí
   * 0 = no
   */
  is_creator?: number;
  is_member?: number;
}

/**
 * =========================================================
 * 📝 DATOS PARA CREAR PROYECTO
 * =========================================================
 */
type CreateProyectoInput = {
  nombre: string;
  descripcion?: string;

  creadorId: string;

  prioridad?: PrioridadProyecto;
  modoAcceso?: ModoAccesoProyecto;
  visibilidad?: VisibilidadProyecto;

  fecha_inicio?: string | null;
  fecha_fin?: string | null;

  permisoEditarProyecto?: PermisoEditarProyecto;
  permisoGestionarTareas?: PermisoGestionarTareas;
};

/**
 * =========================================================
 * 📂 GET — PROYECTOS CREADOS POR USUARIO
 * =========================================================
 */
export async function getProyectosByCreadorId(
  creadorId: string
): Promise<Proyecto[]> {
  const result = await db.execute({
    sql: `
      SELECT
        id,
        nombre,
        descripcion,
        creador_id,
        estado,
        codigo_union,
        creado_en,
        actualizado_en,
        modo_acceso,
        prioridad,
        visibilidad,
        fecha_inicio,
        fecha_fin,
        configuracion,
        ultima_actividad,
        permiso_editar_proyecto,
        permiso_gestionar_tareas,

        1 AS is_creator,
        1 AS is_member

      FROM proyectos

      WHERE creador_id = ?

      ORDER BY creado_en DESC
    `,
    args: [creadorId],
  });

  return (result.rows ?? []) as unknown as Proyecto[];
}

/**
 * =========================================================
 * ➕ POST — CREAR PROYECTO
 * =========================================================
 */
export async function createProyecto(
  input: CreateProyectoInput
): Promise<Proyecto> {
  /**
   * Código corto utilizado para identificación/unión.
   */
  const codigo = randomUUID().slice(0, 8);

  /**
   * Valores predeterminados.
   */
  const prioridad =
    input.prioridad ?? 'media';

  const modoAcceso: ModoAccesoProyecto =
    input.modoAcceso ?? 'privado';

  const visibilidad: VisibilidadProyecto =
    input.visibilidad ?? 'privado';

  const permisoEditar: PermisoEditarProyecto =
    input.permisoEditarProyecto ?? 'owner_admin';

  const permisoTareas: PermisoGestionarTareas =
    input.permisoGestionarTareas ?? 'owner_admin';

  const result = await db.execute({
    sql: `
      INSERT INTO proyectos (
        nombre,
        descripcion,
        creador_id,
        estado,
        codigo_union,
        modo_acceso,
        prioridad,
        visibilidad,
        fecha_inicio,
        fecha_fin,
        permiso_editar_proyecto,
        permiso_gestionar_tareas
      )
      VALUES (
        ?,
        ?,
        ?,
        'activo',
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )

      RETURNING
        id,
        nombre,
        descripcion,
        creador_id,
        estado,
        codigo_union,
        creado_en,
        actualizado_en,
        modo_acceso,
        prioridad,
        visibilidad,
        fecha_inicio,
        fecha_fin,
        configuracion,
        ultima_actividad,
        permiso_editar_proyecto,
        permiso_gestionar_tareas
    `,
    args: [
      input.nombre,
      input.descripcion ?? null,
      input.creadorId,
      codigo,
      modoAcceso,
      prioridad,
      visibilidad,
      input.fecha_inicio ?? null,
      input.fecha_fin ?? null,
      permisoEditar,
      permisoTareas,
    ],
  });

  const rows = (result.rows ?? []) as unknown as Proyecto[];

  if (rows.length === 0) {
    throw new Error('No se pudo crear el proyecto');
  }

  const proyecto = rows[0];

  /**
   * El creador es owner y también se registra
   * en proyecto_usuarios.
   */
  proyecto.is_creator = 1;
  proyecto.is_member = 1;

  return proyecto;
}

/**
 * =========================================================
 * 👁️ GET — PROYECTOS VISIBLES PARA EL USUARIO
 * =========================================================
 *
 * Un usuario puede ver:
 *
 * - Proyectos públicos.
 * - Proyectos creados por él.
 * - Proyectos donde ya es miembro.
 *
 * IMPORTANTE:
 *
 * "solicitud" pertenece a modo_acceso,
 * NO a visibilidad.
 */
export async function getProyectosVisiblesParaUsuario(
  userId: string
): Promise<Proyecto[]> {
  const result = await db.execute({
    sql: `
      SELECT DISTINCT
        p.id,
        p.nombre,
        p.descripcion,
        p.creador_id,
        p.estado,
        p.codigo_union,
        p.creado_en,
        p.actualizado_en,
        p.modo_acceso,
        p.prioridad,
        p.visibilidad,
        p.fecha_inicio,
        p.fecha_fin,
        p.configuracion,
        p.ultima_actividad,
        p.permiso_editar_proyecto,
        p.permiso_gestionar_tareas,

        CASE
          WHEN p.creador_id = ?
          THEN 1
          ELSE 0
        END AS is_creator,

        CASE
          WHEN pu.usuario_id IS NOT NULL
          THEN 1
          ELSE 0
        END AS is_member

      FROM proyectos p

      LEFT JOIN proyecto_usuarios pu
        ON pu.proyecto_id = p.id
       AND pu.usuario_id = ?

      WHERE
        LOWER(COALESCE(p.visibilidad, 'privado')) = 'publico'
        OR p.creador_id = ?
        OR pu.usuario_id IS NOT NULL

      ORDER BY p.creado_en DESC
    `,
    args: [
      userId,
      userId,
      userId,
    ],
  });

  return (result.rows ?? []) as unknown as Proyecto[];
}

/**
 * =========================================================
 * 👑 GET — PROYECTOS CREADOS POR EL USUARIO
 * =========================================================
 */
export async function getProyectosCreadosPorUsuario(
  userId: string
): Promise<Proyecto[]> {
  const result = await db.execute({
    sql: `
      SELECT
        p.*,

        1 AS is_creator,

        CASE
          WHEN pu.usuario_id IS NOT NULL
          THEN 1
          ELSE 0
        END AS is_member

      FROM proyectos p

      LEFT JOIN proyecto_usuarios pu
        ON pu.proyecto_id = p.id
       AND pu.usuario_id = ?

      WHERE p.creador_id = ?

      ORDER BY p.creado_en DESC
    `,
    args: [
      userId,
      userId,
    ],
  });

  return (result.rows ?? []) as unknown as Proyecto[];
}

/**
 * =========================================================
 * 👥 GET — PROYECTOS DONDE SOY MIEMBRO
 * =========================================================
 *
 * Excluye proyectos donde el usuario sea creador,
 * evitando duplicados entre "creados" y "miembro".
 */
export async function getProyectosDondeSoyMiembro(
  userId: string
): Promise<Proyecto[]> {
  const result = await db.execute({
    sql: `
      SELECT
        p.*,

        0 AS is_creator,
        1 AS is_member

      FROM proyectos p

      INNER JOIN proyecto_usuarios pu
        ON pu.proyecto_id = p.id

      WHERE pu.usuario_id = ?
        AND p.creador_id <> ?

      ORDER BY p.creado_en DESC
    `,
    args: [
      userId,
      userId,
    ],
  });

  return (result.rows ?? []) as unknown as Proyecto[];
}