// app/api/proyectos/[id]/miembros/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type Params = { id: string };

type RolProyecto = 'owner' | 'admin' | 'miembro' | null;

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

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

async function getParams(
  context: { params: Params | Promise<Params> }
): Promise<Params> {
  return await context.params;
}

function toProjectId(proyectoId: string): number | null {
  const parsed = Number(proyectoId);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizarRolProyecto(raw: unknown): 'owner' | 'admin' | 'miembro' {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'owner' || value === 'dueño' || value === 'dueno') return 'owner';
  if (value === 'admin' || value === 'administrador') return 'admin';
  return 'miembro';
}

async function obtenerProyecto(proyectoId: string): Promise<ProyectoBase | null> {
  const proyectoNumericId = toProjectId(proyectoId);
  if (proyectoNumericId == null) return null;

  const result = await db.execute({
    sql: `
      SELECT id, creador_id
      FROM proyectos
      WHERE id = ?
      LIMIT 1
    `,
    args: [proyectoNumericId],
  });

  const rows = castRows<ProyectoBaseRow>(result.rows);
  const row = rows[0];

  if (!row) return null;

  return {
    id:
      typeof row.id === 'bigint'
        ? Number(row.id)
        : Number(row.id ?? proyectoNumericId),
    creador_id: row.creador_id ?? null,
  };
}

async function obtenerRolEnProyecto(
  proyectoId: string,
  usuarioId: string
): Promise<RolProyecto> {
  const proyectoNumericId = toProjectId(proyectoId);
  if (proyectoNumericId == null) return null;

  const result = await db.execute({
    sql: `
      SELECT rol_en_proyecto AS rol
      FROM proyecto_usuarios
      WHERE proyecto_id = ?
        AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
      LIMIT 1
    `,
    args: [proyectoNumericId, String(usuarioId)],
  });

  const rows = castRows<RolRow>(result.rows);
  const row = rows[0];

  if (!row) return null;

  const raw = String(row.rol ?? '').toLowerCase().trim();

  if (raw === 'owner' || raw === 'dueño' || raw === 'dueno') return 'owner';
  if (raw === 'admin' || raw === 'administrador') return 'admin';
  if (raw === 'miembro' || raw === 'member') return 'miembro';

  return null;
}

function esOwnerDeProyecto(
  proyecto: { creador_id: string | null },
  userId: string
): boolean {
  return String(proyecto.creador_id ?? '') === String(userId);
}

function puedeGestionarMiembros(opts: {
  rolProyecto: RolProyecto;
  esOwnerProyecto: boolean;
}): boolean {
  if (opts.esOwnerProyecto) return true;
  return opts.rolProyecto === 'admin';
}

function getRowsAffected(result: unknown): number {
  const value =
    (result as { rowsAffected?: number }).rowsAffected ??
    (result as { affectedRows?: number }).affectedRows ??
    0;

  return Number(value ?? 0);
}

/* ========================= GET ========================= */

export async function GET(
  request: NextRequest,
  context: { params: Params | Promise<Params> }
) {
  try {
    const sessionUser = await getAuthenticatedUser(request);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await getParams(context);
    const proyectoNumericId = toProjectId(id);

    if (proyectoNumericId == null) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const proyecto = await obtenerProyecto(id);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const rolUsuario = await obtenerRolEnProyecto(id, String(sessionUser.id));
    const esOwner = esOwnerDeProyecto(proyecto, String(sessionUser.id));

    if (!esOwner && !rolUsuario) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permisos para ver los miembros de este proyecto' },
        { status: 403 }
      );
    }

    const miembrosRes = await db.execute({
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
            JOIN tareas t ON t.id = ta.tarea_id
            WHERE t.proyecto_id = p.id
              AND CAST(ta.usuario_id AS TEXT) = CAST(u.id AS TEXT)
              AND ta.estado = 'activo'
          ) AS tareas_asignadas
        FROM proyectos p
        JOIN usuarios u
          ON CAST(u.id AS TEXT) = CAST(p.creador_id AS TEXT)
        LEFT JOIN proyecto_usuarios pu
          ON pu.proyecto_id = p.id
         AND CAST(pu.usuario_id AS TEXT) = CAST(p.creador_id AS TEXT)
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
            JOIN tareas t ON t.id = ta.tarea_id
            WHERE t.proyecto_id = pu.proyecto_id
              AND CAST(ta.usuario_id AS TEXT) = CAST(u.id AS TEXT)
              AND ta.estado = 'activo'
          ) AS tareas_asignadas
        FROM proyecto_usuarios pu
        JOIN proyectos p2
          ON p2.id = pu.proyecto_id
        JOIN usuarios u
          ON CAST(u.id AS TEXT) = CAST(pu.usuario_id AS TEXT)
        WHERE pu.proyecto_id = ?
          AND CAST(u.id AS TEXT) != CAST(p2.creador_id AS TEXT)
      `,
      args: [proyectoNumericId, proyectoNumericId],
    });

    const miembrosRows = castRows<MiembroRow>(miembrosRes.rows);

    const miembros = miembrosRows.map((row) => {
      const nombre = row.nombre ?? '';
      const apellido = row.apellido ?? '';
      const tareasAsignadas =
        typeof row.tareas_asignadas === 'bigint'
          ? Number(row.tareas_asignadas)
          : Number(row.tareas_asignadas ?? 0);

      return {
        id: String(row.usuario_id),
        nombre,
        apellido,
        nombre_completo: `${nombre} ${apellido}`.trim(),
        pais: row.pais ?? null,
        email: row.email ?? '',
        fecha_union: row.fecha_union ?? null,
        rol: normalizarRolProyecto(row.rol_raw),
        tareas_asignadas: tareasAsignadas,
      };
    });

    return NextResponse.json(
      { ok: true, data: miembros, miembros },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/proyectos/[id]/miembros error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno al obtener miembros del proyecto' },
      { status: 500 }
    );
  }
}

/* ========================= POST ========================= */

export async function POST(
  request: NextRequest,
  context: { params: Params | Promise<Params> }
) {
  try {
    const sessionUser = await getAuthenticatedUser(request);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await getParams(context);
    const proyectoNumericId = toProjectId(id);

    if (proyectoNumericId == null) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const proyecto = await obtenerProyecto(id);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const rolUsuario = await obtenerRolEnProyecto(id, String(sessionUser.id));
    const esOwner = esOwnerDeProyecto(proyecto, String(sessionUser.id));

    if (!puedeGestionarMiembros({ rolProyecto: rolUsuario, esOwnerProyecto: esOwner })) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permisos para gestionar miembros de este proyecto' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const usuarioId =
      typeof body?.usuario_id === 'string' ? body.usuario_id.trim() : '';

    const rolInput =
      typeof body?.rol_en_proyecto === 'string'
        ? body.rol_en_proyecto.trim()
        : 'miembro';

    if (!usuarioId) {
      return NextResponse.json(
        { ok: false, error: 'usuario_id es obligatorio' },
        { status: 400 }
      );
    }

    if (String(usuarioId) === String(proyecto.creador_id ?? '')) {
      return NextResponse.json(
        { ok: false, error: 'El dueño del proyecto ya forma parte del proyecto como owner' },
        { status: 400 }
      );
    }

    const usuarioRes = await db.execute({
      sql: `
        SELECT id
        FROM usuarios
        WHERE CAST(id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [usuarioId],
    });

    const usuarioRows = castRows<{ id: string }>(usuarioRes.rows);

    if (!usuarioRows.length) {
      return NextResponse.json(
        { ok: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const existeRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [proyectoNumericId, usuarioId],
    });

    if (existeRes.rows.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'El usuario ya es miembro de este proyecto' },
        { status: 409 }
      );
    }

    const rolNormalizado = normalizarRolProyecto(rolInput);
    const rolGuardar = rolNormalizado === 'owner' ? 'admin' : rolNormalizado;

    const tipoUnion =
      typeof body?.tipo_union === 'string' && body.tipo_union.trim()
        ? body.tipo_union.trim()
        : 'manual';

    await db.execute({
      sql: `
        INSERT INTO proyecto_usuarios (
          proyecto_id,
          usuario_id,
          rol_en_proyecto,
          fecha_union,
          tipo_union
        )
        VALUES (?, ?, ?, datetime('now'), ?)
      `,
      args: [proyectoNumericId, usuarioId, rolGuardar, tipoUnion],
    });

    return NextResponse.json(
      { ok: true, message: 'Miembro añadido correctamente' },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/proyectos/[id]/miembros error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al añadir miembro al proyecto' },
      { status: 500 }
    );
  }
}

/* ========================= PATCH ========================= */

export async function PATCH(
  request: NextRequest,
  context: { params: Params | Promise<Params> }
) {
  try {
    const sessionUser = await getAuthenticatedUser(request);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await getParams(context);
    const proyectoNumericId = toProjectId(id);

    if (proyectoNumericId == null) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const proyecto = await obtenerProyecto(id);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const rolUsuario = await obtenerRolEnProyecto(id, String(sessionUser.id));
    const esOwner = esOwnerDeProyecto(proyecto, String(sessionUser.id));

    if (!puedeGestionarMiembros({ rolProyecto: rolUsuario, esOwnerProyecto: esOwner })) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permisos para gestionar miembros de este proyecto' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const usuarioId =
      typeof body?.usuario_id === 'string' ? body.usuario_id.trim() : '';

    const nuevoRolInput =
      typeof body?.rol_en_proyecto === 'string'
        ? body.rol_en_proyecto.trim()
        : '';

    if (!usuarioId || !nuevoRolInput) {
      return NextResponse.json(
        { ok: false, error: 'usuario_id y rol_en_proyecto son obligatorios' },
        { status: 400 }
      );
    }

    if (String(usuarioId) === String(proyecto.creador_id ?? '')) {
      return NextResponse.json(
        { ok: false, error: 'No puedes cambiar el rol del dueño del proyecto' },
        { status: 400 }
      );
    }

    const nuevoRol = normalizarRolProyecto(nuevoRolInput);

    if (nuevoRol === 'owner') {
      return NextResponse.json(
        { ok: false, error: 'No se puede asignar el rol "owner" desde aquí' },
        { status: 400 }
      );
    }

    const resUpdate = await db.execute({
      sql: `
        UPDATE proyecto_usuarios
        SET rol_en_proyecto = ?
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
      `,
      args: [nuevoRol, proyectoNumericId, usuarioId],
    });

    if (getRowsAffected(resUpdate) === 0) {
      return NextResponse.json(
        { ok: false, error: 'El usuario no es miembro de este proyecto' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: true, message: 'Rol actualizado correctamente' },
      { status: 200 }
    );
  } catch (error) {
    console.error('PATCH /api/proyectos/[id]/miembros error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al actualizar rol del miembro' },
      { status: 500 }
    );
  }
}

/* ========================= DELETE ========================= */

export async function DELETE(
  request: NextRequest,
  context: { params: Params | Promise<Params> }
) {
  try {
    const sessionUser = await getAuthenticatedUser(request);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await getParams(context);
    const proyectoNumericId = toProjectId(id);

    if (proyectoNumericId == null) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const proyecto = await obtenerProyecto(id);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const rolUsuario = await obtenerRolEnProyecto(id, String(sessionUser.id));
    const esOwner = esOwnerDeProyecto(proyecto, String(sessionUser.id));

    if (!puedeGestionarMiembros({ rolProyecto: rolUsuario, esOwnerProyecto: esOwner })) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permisos para gestionar miembros de este proyecto' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const usuarioId =
      typeof body?.usuario_id === 'string' ? body.usuario_id.trim() : '';

    const liberarTareas = Boolean(body?.liberar_tareas);

    if (!usuarioId) {
      return NextResponse.json(
        { ok: false, error: 'usuario_id es obligatorio' },
        { status: 400 }
      );
    }

    if (String(usuarioId) === String(proyecto.creador_id ?? '')) {
      return NextResponse.json(
        { ok: false, error: 'No puedes eliminar al dueño del proyecto' },
        { status: 400 }
      );
    }

    if (liberarTareas) {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET estado = 'cancelado'
          WHERE CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
            AND estado = 'activo'
            AND tarea_id IN (
              SELECT id
              FROM tareas
              WHERE proyecto_id = ?
            )
        `,
        args: [usuarioId, proyectoNumericId],
      });
    }

    const resDelete = await db.execute({
      sql: `
        DELETE FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
      `,
      args: [proyectoNumericId, usuarioId],
    });

    if (getRowsAffected(resDelete) === 0) {
      return NextResponse.json(
        { ok: false, error: 'El usuario no es miembro de este proyecto' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { ok: true, message: 'Miembro eliminado correctamente' },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE /api/proyectos/[id]/miembros error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al eliminar miembro del proyecto' },
      { status: 500 }
    );
  }
}