// app/api/user/usuarios/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getUserIdFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Params = { id: string };

async function getParams(context: { params: Params | Promise<Params> }) {
  return await context.params;
}

type RolSistema = 'jefe' | 'admin' | 'colaborador';

function normalizarRolSistema(raw: unknown): RolSistema {
  const v = String(raw ?? '').toLowerCase().trim();
  if (v === 'jefe') return 'jefe';
  if (v === 'admin') return 'admin';
  return 'colaborador';
}

function puedeAdministrarUsuarios(rol: RolSistema) {
  return rol === 'jefe' || rol === 'admin';
}

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarActivo(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const v = String(value ?? '').toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'activo';
}

type UsuarioSesionRow = {
  rol: string | null;
};

type UsuarioExistenteRow = {
  id: string;
  rol: string | null;
  activo: number | null;
  puesto: string | null;
};

type UsuarioBaseRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  country: string | null;
  rol: string | null;
  activo: number | string | boolean | null;
  created_at: string | null;
  puesto: string | null;
  phone_full: string | null;
};

type CountRow = {
  cnt: number | bigint | null;
};

type TareasStatsRow = {
  tareas_seleccionadas: number | bigint | null;
  tareas_en_proceso: number | bigint | null;
  tareas_completadas: number | bigint | null;
};

type ProyectoDetalleRow = {
  id: number | string;
  nombre: string | null;
  descripcion: string | null;
  estado: string | null;
  prioridad: string | null;
  modo_acceso: string | null;
  visibilidad: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  creador_id: string | null;
  rol_en_proyecto: string | null;
  tipo_union: string | null;
};

async function getUsuarioBase(id: string) {
  const res = await db.execute({
    sql: `
      SELECT
        id,
        nombre,
        apellido,
        email,
        country,
        rol,
        activo,
        created_at,
        puesto,
        phone_full
      FROM usuarios
      WHERE id = ?
      LIMIT 1
    `,
    args: [id],
  });

  const rows = castRows<UsuarioBaseRow>(res.rows);
  return rows[0] ?? null;
}

async function getUsuarioProyectoCounts(id: string) {
  const creadosRes = await db.execute({
    sql: `
      SELECT COUNT(*) as cnt
      FROM proyectos
      WHERE CAST(creador_id AS TEXT) = CAST(? AS TEXT)
    `,
    args: [id],
  });

  const miembroRes = await db.execute({
    sql: `
      SELECT COUNT(DISTINCT proyecto_id) as cnt
      FROM proyecto_usuarios
      WHERE CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
    `,
    args: [id],
  });

  const creadosRows = castRows<CountRow>(creadosRes.rows);
  const miembroRows = castRows<CountRow>(miembroRes.rows);

  return {
    proyectos_creados_count: Number(creadosRows[0]?.cnt ?? 0),
    proyectos_miembro_count: Number(miembroRows[0]?.cnt ?? 0),
  };
}

async function getUsuarioTareasStats(id: string) {
  const statsRes = await db.execute({
    sql: `
      SELECT
        (
          SELECT COUNT(DISTINCT ta.tarea_id)
          FROM tarea_asignaciones ta
          WHERE CAST(ta.usuario_id AS TEXT) = CAST(? AS TEXT)
        ) AS tareas_seleccionadas,

        (
          SELECT COUNT(DISTINCT ta.tarea_id)
          FROM tarea_asignaciones ta
          JOIN tareas t ON CAST(t.id AS TEXT) = CAST(ta.tarea_id AS TEXT)
          WHERE CAST(ta.usuario_id AS TEXT) = CAST(? AS TEXT)
            AND LOWER(COALESCE(t.estado, '')) = 'in-progress'
        ) AS tareas_en_proceso,

        (
          SELECT COUNT(DISTINCT ta.tarea_id)
          FROM tarea_asignaciones ta
          JOIN tareas t ON CAST(t.id AS TEXT) = CAST(ta.tarea_id AS TEXT)
          WHERE CAST(ta.usuario_id AS TEXT) = CAST(? AS TEXT)
            AND LOWER(COALESCE(t.estado, '')) = 'completed'
        ) AS tareas_completadas
    `,
    args: [id, id, id],
  });

  const rows = castRows<TareasStatsRow>(statsRes.rows);
  const row = rows[0] ?? {
    tareas_seleccionadas: 0,
    tareas_en_proceso: 0,
    tareas_completadas: 0,
  };

  return {
    tareas_seleccionadas: Number(row.tareas_seleccionadas ?? 0),
    tareas_en_proceso: Number(row.tareas_en_proceso ?? 0),
    tareas_completadas: Number(row.tareas_completadas ?? 0),
  };
}

async function getUsuarioProyectos(id: string) {
  const proyectosRes = await db.execute({
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
        CAST(p.creador_id AS TEXT) AS creador_id,
        CASE
          WHEN CAST(p.creador_id AS TEXT) = CAST(? AS TEXT) THEN 'owner'
          ELSE COALESCE(pu.rol_en_proyecto, 'miembro')
        END AS rol_en_proyecto,
        pu.tipo_union
      FROM proyectos p
      LEFT JOIN proyecto_usuarios pu
        ON pu.proyecto_id = p.id
       AND CAST(pu.usuario_id AS TEXT) = CAST(? AS TEXT)
      WHERE CAST(p.creador_id AS TEXT) = CAST(? AS TEXT)
         OR CAST(pu.usuario_id AS TEXT) = CAST(? AS TEXT)
      GROUP BY
        p.id,
        p.nombre,
        p.descripcion,
        p.estado,
        p.prioridad,
        p.modo_acceso,
        p.visibilidad,
        p.fecha_inicio,
        p.fecha_fin,
        p.creador_id,
        pu.rol_en_proyecto,
        pu.tipo_union
      ORDER BY
        COALESCE(p.updated_at, p.created_at) DESC,
        p.id DESC
    `,
    args: [id, id, id, id],
  });

  const rows = castRows<ProyectoDetalleRow>(proyectosRes.rows);

  return rows.map((row) => ({
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    descripcion: row.descripcion ?? null,
    estado: row.estado ?? null,
    prioridad: row.prioridad ?? null,
    modo_acceso: row.modo_acceso ?? null,
    visibilidad: row.visibilidad ?? null,
    fecha_inicio: row.fecha_inicio ?? null,
    fecha_fin: row.fecha_fin ?? null,
    creador_id: row.creador_id ?? null,
    rol_en_proyecto: row.rol_en_proyecto ?? 'miembro',
    tipo_union: row.tipo_union ?? null,
  }));
}

async function buildUsuarioDetalle(id: string) {
  const usuarioBase = await getUsuarioBase(id);

  if (!usuarioBase) return null;

  const counts = await getUsuarioProyectoCounts(id);
  const tareas = await getUsuarioTareasStats(id);
  const proyectos = await getUsuarioProyectos(id);

  return {
    id: String(usuarioBase.id),
    nombre: String(usuarioBase.nombre ?? ''),
    apellido: String(usuarioBase.apellido ?? ''),
    email: String(usuarioBase.email ?? ''),
    pais: usuarioBase.country ?? null,
    rol: normalizarRolSistema(usuarioBase.rol),
    activo: normalizarActivo(usuarioBase.activo),
    puesto: usuarioBase.puesto ?? null,
    created_at: usuarioBase.created_at ?? null,
    phone_full: usuarioBase.phone_full ?? null,
    proyectos_creados_count: counts.proyectos_creados_count,
    proyectos_miembro_count: counts.proyectos_miembro_count,
    tareas_seleccionadas: tareas.tareas_seleccionadas,
    tareas_en_proceso: tareas.tareas_en_proceso,
    tareas_completadas: tareas.tareas_completadas,
    proyectos,
  };
}

/* ============================================================================
 * GET /api/user/usuarios/[id]
 * ==========================================================================*/
export async function GET(
  request: NextRequest,
  context: { params: Params | Promise<Params> },
) {
  try {
    const sessionUserId = await getUserIdFromRequest(request);

    if (!sessionUserId) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 },
      );
    }

    const { id } = await getParams(context);

    const meRes = await db.execute({
      sql: `SELECT rol FROM usuarios WHERE id = ? LIMIT 1`,
      args: [sessionUserId],
    });

    const meRows = castRows<UsuarioSesionRow>(meRes.rows);
    const me = meRows[0];

    if (!me) {
      return NextResponse.json(
        { ok: false, error: 'Usuario de sesión no encontrado' },
        { status: 401 },
      );
    }

    const miRol = normalizarRolSistema(me.rol);

    if (!puedeAdministrarUsuarios(miRol)) {
      return NextResponse.json(
        { ok: false, error: 'Solo Jefe o Admin pueden ver colaboradores' },
        { status: 403 },
      );
    }

    const usuario = await buildUsuarioDetalle(String(id));

    if (!usuario) {
      return NextResponse.json(
        { ok: false, error: 'Usuario no encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, usuario }, { status: 200 });
  } catch (error) {
    console.error('GET /api/user/usuarios/[id] error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al obtener usuario' },
      { status: 500 },
    );
  }
}

/* ============================================================================
 * PATCH /api/user/usuarios/[id]
 * Regla:
 * - Jefe: puede cambiar rol, activo y puesto
 * - Admin: solo activo y puesto
 * - Solo jefe puede ascender a jefe
 * ==========================================================================*/
export async function PATCH(
  request: NextRequest,
  context: { params: Params | Promise<Params> },
) {
  try {
    const sessionUserId = await getUserIdFromRequest(request);

    if (!sessionUserId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { id } = await getParams(context);

    const meRes = await db.execute({
      sql: `SELECT rol FROM usuarios WHERE id = ? LIMIT 1`,
      args: [sessionUserId],
    });

    const meRows = castRows<UsuarioSesionRow>(meRes.rows);
    const me = meRows[0];

    if (!me) {
      return NextResponse.json(
        { error: 'Usuario de sesión no encontrado' },
        { status: 401 },
      );
    }

    const miRol = normalizarRolSistema(me.rol);

    if (!puedeAdministrarUsuarios(miRol)) {
      return NextResponse.json(
        { error: 'Solo Jefe o Admin pueden editar colaboradores' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));

    const rolRaw = body?.rol;
    const activoRaw = body?.activo;
    const puestoRaw = body?.puesto;

    if (rolRaw === undefined && activoRaw === undefined && puestoRaw === undefined) {
      return NextResponse.json(
        { error: 'Nada que actualizar (rol, activo, puesto)' },
        { status: 400 },
      );
    }

    const existingRes = await db.execute({
      sql: `
        SELECT id, rol, activo, puesto
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [id],
    });

    const existingRows = castRows<UsuarioExistenteRow>(existingRes.rows);
    const existing = existingRows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const rolObjetivoActual = normalizarRolSistema(existing.rol);

    if (String(id) === String(sessionUserId) && activoRaw === false) {
      return NextResponse.json(
        { error: 'No puedes desactivarte a ti mismo desde aquí' },
        { status: 400 },
      );
    }

    // Admin no puede editar a un jefe
    if (miRol === 'admin' && rolObjetivoActual === 'jefe') {
      return NextResponse.json(
        { error: 'Un Admin no puede modificar a un Jefe' },
        { status: 403 },
      );
    }

    let nuevoRol: RolSistema = rolObjetivoActual;

    if (rolRaw !== undefined) {
      // Solo jefe puede cambiar roles
      if (miRol !== 'jefe') {
        return NextResponse.json(
          { error: 'Solo un Jefe puede cambiar roles' },
          { status: 403 },
        );
      }

      const rolNormalizado = normalizarRolSistema(rolRaw);

      // El jefe sí puede ascender a jefe, admin o colaborador
      nuevoRol = rolNormalizado;
    }

    let nuevoActivo = existing.activo ?? 1;
    if (activoRaw !== undefined) {
      if (typeof activoRaw !== 'boolean') {
        return NextResponse.json(
          { error: 'activo debe ser booleano' },
          { status: 400 },
        );
      }

      if (miRol === 'admin' && rolObjetivoActual === 'jefe' && activoRaw === false) {
        return NextResponse.json(
          { error: 'Un Admin no puede desactivar a un Jefe' },
          { status: 403 },
        );
      }

      nuevoActivo = activoRaw ? 1 : 0;
    }

    let nuevoPuesto = existing.puesto ?? null;
    if (puestoRaw !== undefined) {
      if (puestoRaw !== null && typeof puestoRaw !== 'string') {
        return NextResponse.json(
          { error: 'puesto debe ser texto o null' },
          { status: 400 },
        );
      }

      const puestoLimpio =
        typeof puestoRaw === 'string' ? puestoRaw.trim() : null;

      nuevoPuesto = puestoLimpio ? puestoLimpio : null;
    }

    await db.execute({
      sql: `
        UPDATE usuarios
        SET rol = ?, activo = ?, puesto = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [nuevoRol, nuevoActivo, nuevoPuesto, id],
    });

    const usuario = await buildUsuarioDetalle(String(id));

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario actualizado no encontrado' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, usuario }, { status: 200 });
  } catch (error) {
    console.error('PATCH /api/user/usuarios/[id] error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar usuario' },
      { status: 500 },
    );
  }
}

/* ============================================================================
 * DELETE /api/user/usuarios/[id]
 * ==========================================================================*/
export async function DELETE(
  request: NextRequest,
  context: { params: Params | Promise<Params> },
) {
  try {
    const sessionUserId = await getUserIdFromRequest(request);

    if (!sessionUserId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { id } = await getParams(context);

    const meRes = await db.execute({
      sql: `SELECT rol FROM usuarios WHERE id = ? LIMIT 1`,
      args: [sessionUserId],
    });

    const meRows = castRows<UsuarioSesionRow>(meRes.rows);
    const me = meRows[0];

    if (!me) {
      return NextResponse.json(
        { error: 'Usuario de sesión no encontrado' },
        { status: 401 },
      );
    }

    const miRol = normalizarRolSistema(me.rol);

    if (!puedeAdministrarUsuarios(miRol)) {
      return NextResponse.json(
        { error: 'Solo Jefe o Admin pueden desactivar colaboradores' },
        { status: 403 },
      );
    }

    if (String(sessionUserId) === String(id)) {
      return NextResponse.json(
        { error: 'No puedes desactivarte a ti mismo desde aquí' },
        { status: 400 },
      );
    }

    const existingRes = await db.execute({
      sql: `
        SELECT id, rol, activo, puesto
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [id],
    });

    const existingRows = castRows<UsuarioExistenteRow>(existingRes.rows);
    const existing = existingRows[0];

    if (!existing) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 },
      );
    }

    const rolObjetivo = normalizarRolSistema(existing.rol);

    if (miRol === 'admin' && rolObjetivo === 'jefe') {
      return NextResponse.json(
        { error: 'Un Admin no puede desactivar a un Jefe' },
        { status: 403 },
      );
    }

    if (!existing.activo) {
      return NextResponse.json(
        { ok: true, message: 'El usuario ya estaba inactivo' },
        { status: 200 },
      );
    }

    await db.execute({
      sql: `
        UPDATE usuarios
        SET activo = 0, updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [id],
    });

    return NextResponse.json(
      { ok: true, message: 'Usuario marcado como inactivo' },
      { status: 200 },
    );
  } catch (error) {
    console.error('DELETE /api/user/usuarios/[id] error:', error);
    return NextResponse.json(
      { error: 'Error al desactivar usuario' },
      { status: 500 },
    );
  }
}