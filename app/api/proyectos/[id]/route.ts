//app/api/proyectos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getUserIdFromRequest } from '@/lib/auth';

/* ─────────────────────── Types helpers ─────────────────────── */

type RolProyecto = 'owner' | 'admin' | 'miembro' | 'ninguno';
type PermisoProyecto = 'owner' | 'owner_admin' | 'all_members';
type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';

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
  last_activity_at: string | null;
  permiso_editar_proyecto: string | null;
  permiso_gestionar_tareas: string | null;
};

type MiembroRolRow = {
  rol_en_proyecto?: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarRol(raw: unknown): RolProyecto {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'owner' || value === 'dueño' || value === 'dueno') return 'owner';
  if (value === 'admin' || value === 'administrador') return 'admin';
  if (value === 'miembro' || value === 'member') return 'miembro';

  return 'ninguno';
}

function normalizarPermiso(raw: unknown): PermisoProyecto {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'owner') return 'owner';
  if (value === 'owner_admin') return 'owner_admin';
  if (value === 'all_members') return 'all_members';

  return 'owner_admin';
}

function normalizarModoAcceso(
  rawModo: unknown,
  rawVisibilidad?: unknown
): ModoAccesoProyecto {
  const modo = String(rawModo ?? '').toLowerCase().trim();
  const visibilidad = String(rawVisibilidad ?? '').toLowerCase().trim();

  if (modo === 'publico' || modo === 'público' || modo === 'public') {
    return 'publico';
  }

  if (
    modo === 'solicitud' ||
    modo === 'request' ||
    modo === 'invite' ||
    modo === 'invitacion' ||
    modo === 'invitación'
  ) {
    return 'solicitud';
  }

  if (modo === 'privado' || modo === 'private') {
    return 'privado';
  }

  if (visibilidad === 'publico' || visibilidad === 'público' || visibilidad === 'public') {
    return 'publico';
  }

  return 'privado';
}

function puedeSegunPermiso(
  permiso: PermisoProyecto,
  rol: RolProyecto
): boolean {
  if (rol === 'ninguno') return false;

  if (permiso === 'owner') {
    return rol === 'owner';
  }

  if (permiso === 'owner_admin') {
    return rol === 'owner' || rol === 'admin';
  }

  return rol === 'owner' || rol === 'admin' || rol === 'miembro';
}

async function obtenerRolUsuarioEnProyecto(
  proyectoId: number,
  userId: string,
  creadorId: string | null
): Promise<{ esOwner: boolean; rolProyecto: RolProyecto }> {
  const esOwner = String(creadorId ?? '') === String(userId);

  if (esOwner) {
    return {
      esOwner: true,
      rolProyecto: 'owner',
    };
  }

  const miembroRes = await db.execute({
    sql: `
      SELECT rol_en_proyecto
      FROM proyecto_usuarios
      WHERE proyecto_id = ?
        AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
      LIMIT 1
    `,
    args: [proyectoId, String(userId)],
  });

  const miembroRows = castRows<MiembroRolRow>(miembroRes.rows);
  const miembro = miembroRows[0];

  return {
    esOwner: false,
    rolProyecto: miembro ? normalizarRol(miembro.rol_en_proyecto) : 'ninguno',
  };
}

/* ─────────────────────── GET /api/proyectos/[id] ─────────────────────── */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const proyectoIdNum = Number(id);

    if (!Number.isFinite(proyectoIdNum)) {
      return NextResponse.json(
        { error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const res = await db.execute({
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
          p.last_activity_at,
          p.permiso_editar_proyecto,
          p.permiso_gestionar_tareas
        FROM proyectos p
        WHERE p.id = ?
        LIMIT 1
      `,
      args: [proyectoIdNum],
    });

    const rows = castRows<ProyectoRow>(res.rows);
    const row = rows[0];

    if (!row) {
      return NextResponse.json(
        { error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    const { esOwner, rolProyecto } = await obtenerRolUsuarioEnProyecto(
      proyectoIdNum,
      String(userId),
      row.creador_id
    );

    const esMiembro = esOwner || rolProyecto !== 'ninguno';

    const modoAcceso = normalizarModoAcceso(row.modo_acceso, row.visibilidad);

    let puedeVerProyecto = false;
    let canRequestAccess = false;

    if (modoAcceso === 'publico') {
      puedeVerProyecto = true;
    } else if (modoAcceso === 'solicitud') {
      puedeVerProyecto = esMiembro;
      canRequestAccess = !esMiembro;
    } else {
      puedeVerProyecto = esMiembro;
    }

    if (!puedeVerProyecto) {
      return NextResponse.json(
        {
          error:
            modoAcceso === 'solicitud'
              ? 'Requiere aprobación'
              : 'Sin acceso a este proyecto',
          canRequestAccess,
        },
        { status: 403 }
      );
    }

    const permisoEditarProyectoNorm = normalizarPermiso(
      row.permiso_editar_proyecto
    );

    const permisoGestionarTareasNorm = normalizarPermiso(
      row.permiso_gestionar_tareas
    );

    const puede_editar_proyecto = puedeSegunPermiso(
      permisoEditarProyectoNorm,
      rolProyecto
    );

    const puede_gestionar_tareas = puedeSegunPermiso(
      permisoGestionarTareasNorm,
      rolProyecto
    );

    const proyecto = {
      id: typeof row.id === 'bigint' ? Number(row.id) : Number(row.id),
      nombre: row.nombre,
      descripcion: row.descripcion,
      creador_id: row.creador_id,
      estado: row.estado,
      codigo_union: esMiembro ? row.codigo_union : null,
      modo_acceso: modoAcceso,
      prioridad: row.prioridad,
      visibilidad: row.visibilidad,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,
      configuracion: row.configuracion,
      last_activity_at: row.last_activity_at,
      permiso_editar_proyecto: row.permiso_editar_proyecto,
      permiso_gestionar_tareas: row.permiso_gestionar_tareas,
    };

    return NextResponse.json(
      {
        proyecto,
        rol_en_proyecto: rolProyecto,
        es_owner: esOwner,
        es_miembro: esMiembro,
        puede_editar_proyecto,
        puede_gestionar_tareas,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/proyectos/[id] error:', error);

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}