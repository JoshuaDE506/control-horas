import { db } from '@/lib/database';
import { randomUUID } from 'crypto';

export type PrioridadProyecto = 'baja' | 'media' | 'alta' | 'critica';

// 🔹 Permisos de proyecto
export type PermisoEditarProyecto = 'owner_admin' | 'todos_miembros';
export type PermisoGestionarTareas = 'owner_admin' | 'todos_miembros';

export interface Proyecto {
  id: number;
  nombre: string;
  descripcion: string | null;
  creador_id: number | string;
  estado: string;
  codigo_union: string;
  created_at: string;
  updated_at: string;
  modo_acceso: string;
  prioridad: PrioridadProyecto;
  visibilidad: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  configuracion: string | null;
  last_activity_at: string | null;

  // 🔹 Nuevos campos de permisos
  permiso_editar_proyecto: PermisoEditarProyecto;
  permiso_gestionar_tareas: PermisoGestionarTareas;

  is_creator?: number; // 1 o 0
  is_member?: number;  // 1 o 0
}

type CreateProyectoInput = {
  nombre: string;
  descripcion?: string;
  creadorId: string;
  prioridad?: PrioridadProyecto;
  modoAcceso?: string;
  visibilidad?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;

  // 🔹 Permisos opcionales al crear
  permisoEditarProyecto?: PermisoEditarProyecto;
  permisoGestionarTareas?: PermisoGestionarTareas;
};

// ===========================================================
// 🔹 GET — Obtener proyectos del usuario (solo creador)
// ===========================================================
export async function getProyectosByCreadorId(creadorId: string): Promise<Proyecto[]> {
  const result = await db.execute({
    sql: `
      SELECT
        id,
        nombre,
        descripcion,
        creador_id,
        estado,
        codigo_union,
        created_at,
        updated_at,
        modo_acceso,
        prioridad,
        visibilidad,
        fecha_inicio,
        fecha_fin,
        configuracion,
        last_activity_at,
        permiso_editar_proyecto,
        permiso_gestionar_tareas,
        1 AS is_creator,
        0 AS is_member
      FROM proyectos
      WHERE creador_id = ?
      ORDER BY created_at DESC
    `,
    args: [creadorId],
  });

  return (result.rows ?? []) as any as Proyecto[];
}

// ===========================================================
// 🔹 POST — Crear proyecto (GUARDA FECHAS Y PERMISOS)
// ===========================================================
export async function createProyecto(input: CreateProyectoInput): Promise<Proyecto> {
  const codigo = randomUUID().slice(0, 8);

  const prioridad = input.prioridad ?? 'media';
  const modoAcceso = input.modoAcceso ?? 'privado';
  const visibilidad = input.visibilidad ?? 'privado';

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
      VALUES (?, ?, ?, 'activo', ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING
        id,
        nombre,
        descripcion,
        creador_id,
        estado,
        codigo_union,
        created_at,
        updated_at,
        modo_acceso,
        prioridad,
        visibilidad,
        fecha_inicio,
        fecha_fin,
        configuracion,
        last_activity_at,
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

  const rows = (result.rows ?? []) as any[];

  if (rows.length === 0) {
    throw new Error('No se pudo crear el proyecto');
  }

  const proyecto = rows[0] as Proyecto;
  proyecto.is_creator = 1;
  proyecto.is_member = 0;

  return proyecto;
}

// ===========================================================
// 🔹 GET — Proyectos visibles para el usuario
//     - públicos y solicitud: visibles para todos los logueados
//     - privados: solo creador o miembros (proyecto_usuarios)
// ===========================================================
export async function getProyectosVisiblesParaUsuario(userId: string): Promise<Proyecto[]> {
  const result = await db.execute({
    sql: `
      SELECT DISTINCT
        p.id,
        p.nombre,
        p.descripcion,
        p.creador_id,
        p.estado,
        p.codigo_union,
        p.created_at,
        p.updated_at,
        p.modo_acceso,
        p.prioridad,
        p.visibilidad,
        p.fecha_inicio,
        p.fecha_fin,
        p.configuracion,
        p.last_activity_at,
        p.permiso_editar_proyecto,
        p.permiso_gestionar_tareas,

        CASE WHEN p.creador_id = ? THEN 1 ELSE 0 END AS is_creator,
        CASE WHEN pu.usuario_id IS NOT NULL THEN 1 ELSE 0 END AS is_member

      FROM proyectos p
      LEFT JOIN proyecto_usuarios pu
        ON pu.proyecto_id = p.id
       AND pu.usuario_id = ?

      WHERE
        p.visibilidad IN ('publico', 'solicitud')
        OR p.creador_id = ?
        OR pu.usuario_id IS NOT NULL

      ORDER BY p.created_at DESC
    `,
    args: [userId, userId, userId],
  });

  return (result.rows ?? []) as any as Proyecto[];
}

// ===========================================================
// ✅ Solo proyectos creados por mí
// ===========================================================
export async function getProyectosCreadosPorUsuario(userId: string): Promise<Proyecto[]> {
  const result = await db.execute({
    sql: `
      SELECT
        p.*,
        1 AS is_creator,
        CASE WHEN pu.usuario_id IS NOT NULL THEN 1 ELSE 0 END AS is_member
      FROM proyectos p
      LEFT JOIN proyecto_usuarios pu
        ON pu.proyecto_id = p.id
       AND pu.usuario_id = ?
      WHERE p.creador_id = ?
      ORDER BY p.created_at DESC
    `,
    args: [userId, userId],
  });

  return (result.rows ?? []) as any as Proyecto[];
}

// ===========================================================
// ✅ Proyectos donde soy miembro pero NO creador
// ===========================================================
export async function getProyectosDondeSoyMiembro(userId: string): Promise<Proyecto[]> {
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
      ORDER BY p.created_at DESC
    `,
    args: [userId, userId],
  });

  return (result.rows ?? []) as any as Proyecto[];
}