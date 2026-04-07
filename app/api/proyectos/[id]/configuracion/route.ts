// app/api/proyectos/[id]/configuracion/route.ts
// app/api/proyectos/[id]/configuracion/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

type ParamsContext = {
  params: Promise<{ id: string }>;
};

type PermisoApi = 'owner' | 'owner_admin' | 'all_members';
type RolProyecto = 'owner' | 'admin' | 'miembro' | null;
type EstadoProyecto = 'activo' | 'pausado' | 'completado' | 'cancelado';
type VisibilidadProyecto = 'privado' | 'publico';
type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';
type PrioridadProyecto = 'baja' | 'media' | 'alta' | 'critica';

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
  'owner',
  'owner_admin',
  'all_members',
];

function normalizarPermiso(valor: any): PermisoApi {
  const v = String(valor ?? '').toLowerCase().trim();

  if (
    [
      'owner',
      'solo_dueno',
      'solo dueño',
      'solo_el_dueno',
      'solo_el_dueño',
      'owner_only',
      'dueno',
      'dueño',
    ].includes(v)
  ) {
    return 'owner';
  }

  if (
    [
      'owner_admin',
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

  if (
    [
      'all_members',
      'todos_miembros',
      'todos los miembros',
      'todos_los_miembros',
      'todos',
      'members',
      'miembros',
      'miembros_todos',
    ].includes(v)
  ) {
    return 'all_members';
  }

  return 'owner';
}

function puedeEditarProyecto(
  rol: RolProyecto,
  permisoEdicion: PermisoApi
): boolean {
  if (!rol) return false;

  switch (permisoEdicion) {
    case 'all_members':
      return rol === 'owner' || rol === 'admin' || rol === 'miembro';
    case 'owner_admin':
      return rol === 'owner' || rol === 'admin';
    case 'owner':
    default:
      return rol === 'owner';
  }
}

function esValorDefinido<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function sanitizarTexto(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  return value.trim();
}

function sanitizarTextoNullable(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const limpio = value.trim();
  return limpio === '' ? null : limpio;
}

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarEstado(valor: unknown): EstadoProyecto | undefined {
  if (typeof valor !== 'string') return undefined;

  const v = valor.trim().toLowerCase();

  if (v === 'activo') return 'activo';
  if (v === 'pausado') return 'pausado';
  if (v === 'completado' || v === 'completo') return 'completado';
  if (v === 'cancelado' || v === 'cancelada') return 'cancelado';

  return undefined;
}

function normalizarVisibilidad(
  valor: unknown
): VisibilidadProyecto | undefined {
  if (typeof valor !== 'string') return undefined;

  const v = valor.trim().toLowerCase();

  if (v === 'privado') return 'privado';
  if (v === 'publico' || v === 'público') return 'publico';

  return undefined;
}

function normalizarModoAcceso(
  valor: unknown
): ModoAccesoProyecto | undefined {
  if (typeof valor !== 'string') return undefined;

  const v = valor.trim().toLowerCase();

  if (v === 'privado') return 'privado';
  if (v === 'publico' || v === 'público') return 'publico';
  if (
    v === 'solicitud' ||
    v === 'invitacion' ||
    v === 'invitación' ||
    v === 'request'
  ) {
    return 'solicitud';
  }

  return undefined;
}

function normalizarPrioridad(
  valor: unknown
): PrioridadProyecto | undefined {
  if (typeof valor !== 'string') return undefined;

  const v = valor.trim().toLowerCase();

  if ((PRIORIDADES_VALIDAS as string[]).includes(v)) {
    return v as PrioridadProyecto;
  }

  return undefined;
}

function escaparIdentificadorSql(nombre: string): string {
  return `"${String(nombre).replace(/"/g, '""')}"`;
}

async function obtenerRolProyecto(
  proyectoId: number,
  userId: string,
  creadorId?: string | null
): Promise<RolProyecto> {
  if (String(creadorId ?? '') === String(userId)) {
    return 'owner';
  }

  const rolRes = await db.execute({
    sql: `
      SELECT rol_en_proyecto
      FROM proyecto_usuarios
      WHERE proyecto_id = ?
        AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
      LIMIT 1;
    `,
    args: [proyectoId, String(userId)],
  });

  const rolRows = castRows<{ rol_en_proyecto?: string }>(rolRes.rows);
  const rolRow = rolRows[0];

  return rolRow
    ? (String(rolRow.rol_en_proyecto).toLowerCase() as RolProyecto)
    : null;
}

async function obtenerProyectoPorId(proyectoId: number) {
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
      LIMIT 1;
    `,
    args: [proyectoId],
  });

  const rows = castRows<ProyectoRow>(projRes.rows);
  return rows[0];
}

async function listarTablasUsuario(): Promise<string[]> {
  const res = await db.execute({
    sql: `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
    `,
    args: [],
  });

  return castRows<SqliteTableRow>(res.rows)
    .map((r) => String(r.name))
    .filter(Boolean);
}

async function obtenerTablasQueReferencian(
  tablaObjetivo: string
): Promise<Array<{ tabla: string; columnaFk: string }>> {
  const tablas = await listarTablasUsuario();
  const referencias: Array<{ tabla: string; columnaFk: string }> = [];

  for (const tabla of tablas) {
    const pragmaRes = await db.execute({
      sql: `PRAGMA foreign_key_list(${escaparIdentificadorSql(tabla)})`,
      args: [],
    });

    const fks = castRows<ForeignKeyRow>(pragmaRes.rows);

    for (const fk of fks) {
      if (String(fk.table).toLowerCase() === tablaObjetivo.toLowerCase()) {
        referencias.push({
          tabla,
          columnaFk: String(fk.from),
        });
      }
    }
  }

  return referencias;
}

async function eliminarReferenciasATareas(proyectoId: number) {
  const referenciasATareas = await obtenerTablasQueReferencian('tareas');

  for (const ref of referenciasATareas) {
    const tabla = ref.tabla;
    const columnaFk = ref.columnaFk;

    // Evitamos tocar la misma tabla tareas aquí
    if (tabla.toLowerCase() === 'tareas') continue;

    await db.execute({
      sql: `
        DELETE FROM ${escaparIdentificadorSql(tabla)}
        WHERE ${escaparIdentificadorSql(columnaFk)} IN (
          SELECT id
          FROM tareas
          WHERE proyecto_id = ?
        )
      `,
      args: [proyectoId],
    });
  }
}

async function eliminarReferenciasAProyecto(proyectoId: number) {
  const referenciasAProyectos = await obtenerTablasQueReferencian('proyectos');

  for (const ref of referenciasAProyectos) {
    const tabla = ref.tabla;
    const columnaFk = ref.columnaFk;

    // Evitamos borrar desde la propia tabla proyectos
    if (tabla.toLowerCase() === 'proyectos') continue;

    await db.execute({
      sql: `
        DELETE FROM ${escaparIdentificadorSql(tabla)}
        WHERE ${escaparIdentificadorSql(columnaFk)} = ?
      `,
      args: [proyectoId],
    });
  }
}

// ─────────────────── GET ───────────────────

export async function GET(req: NextRequest, { params }: ParamsContext) {
  try {
    const { id } = await params;
    const proyectoId = Number(id);

    if (!id || Number.isNaN(proyectoId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const proyecto = await obtenerProyectoPorId(proyectoId);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const rol = await obtenerRolProyecto(
      proyectoId,
      String(sessionUser.id),
      proyecto.creador_id
    );

    const permisoEdicion: PermisoApi = normalizarPermiso(
      proyecto.permiso_editar_proyecto
    );
    const permisoGestionTareas: PermisoApi = normalizarPermiso(
      proyecto.permiso_gestionar_tareas
    );

    const puedeEditar = puedeEditarProyecto(rol, permisoEdicion);
    const puedeEliminar = rol === 'owner';

    const payload = {
      proyecto,
      meta: {
        rol,
        puedeEditarProyecto: puedeEditar,
        puedeEliminarProyecto: puedeEliminar,
        permisosConfiguracion: {
          permisoEdicion,
          permisoGestionTareas,
        },
        catalogos: {
          estados: ESTADOS_VALIDOS,
          visibilidades: VISIBILIDADES_VALIDAS,
          modosAcceso: MODOS_ACCESO_VALIDOS,
          prioridades: PRIORIDADES_VALIDAS,
          permisos: PERMISOS_VALIDOS,
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
    console.error('Error en GET /api/proyectos/[id]/configuracion:', err);
    return NextResponse.json(
      { ok: false, error: 'Error interno al cargar configuración' },
      { status: 500 }
    );
  }
}

// ─────────────────── PATCH ───────────────────

export async function PATCH(req: NextRequest, { params }: ParamsContext) {
  try {
    const { id } = await params;
    const proyectoId = Number(id);

    if (!id || Number.isNaN(proyectoId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const proyecto = await obtenerProyectoPorId(proyectoId);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const rol = await obtenerRolProyecto(
      proyectoId,
      String(sessionUser.id),
      proyecto.creador_id
    );

    const permisoEdicionActual: PermisoApi = normalizarPermiso(
      proyecto.permiso_editar_proyecto
    );

    if (!puedeEditarProyecto(rol, permisoEdicionActual)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No tienes permisos para editar la configuración de este proyecto',
        },
        { status: 403 }
      );
    }

    const nombreInput = sanitizarTexto(body?.nombre);
    const descripcionInput = sanitizarTextoNullable(body?.descripcion);
    const fechaInicioInput = sanitizarTextoNullable(body?.fecha_inicio);
    const fechaFinInput = sanitizarTextoNullable(body?.fecha_fin);

    const estadoRecibido = body?.estado;
    const visibilidadRecibida = body?.visibilidad;
    const modoAccesoRecibido = body?.modo_acceso;
    const prioridadRecibida = body?.prioridad;

    const permisoEdicionInput =
      typeof body?.permisoEdicion === 'string'
        ? body.permisoEdicion.trim().toLowerCase()
        : undefined;

    const permisoGestionInput =
      typeof body?.permisoGestionTareas === 'string'
        ? body.permisoGestionTareas.trim().toLowerCase()
        : undefined;

    if (esValorDefinido(nombreInput) && !nombreInput) {
      return NextResponse.json(
        { ok: false, error: 'El nombre del proyecto no puede estar vacío' },
        { status: 400 }
      );
    }

    if (estadoRecibido !== undefined) {
      const estadoNormalizado = normalizarEstado(estadoRecibido);
      if (!estadoNormalizado) {
        return NextResponse.json(
          {
            ok: false,
            error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    if (visibilidadRecibida !== undefined) {
      const visibilidadNormalizada = normalizarVisibilidad(visibilidadRecibida);
      if (!visibilidadNormalizada) {
        return NextResponse.json(
          {
            ok: false,
            error: `Visibilidad inválida. Valores permitidos: ${VISIBILIDADES_VALIDAS.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    if (modoAccesoRecibido !== undefined) {
      const modoAccesoNormalizado = normalizarModoAcceso(modoAccesoRecibido);
      if (!modoAccesoNormalizado) {
        return NextResponse.json(
          {
            ok: false,
            error: `Modo de acceso inválido. Valores permitidos: ${MODOS_ACCESO_VALIDOS.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    if (prioridadRecibida !== undefined) {
      const prioridadNormalizada = normalizarPrioridad(prioridadRecibida);
      if (!prioridadNormalizada) {
        return NextResponse.json(
          {
            ok: false,
            error: `Prioridad inválida. Valores permitidos: ${PRIORIDADES_VALIDAS.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    if (
      permisoEdicionInput !== undefined &&
      !PERMISOS_VALIDOS.includes(permisoEdicionInput as PermisoApi)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `permisoEdicion inválido. Valores permitidos: ${PERMISOS_VALIDOS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (
      permisoGestionInput !== undefined &&
      !PERMISOS_VALIDOS.includes(permisoGestionInput as PermisoApi)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `permisoGestionTareas inválido. Valores permitidos: ${PERMISOS_VALIDOS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const estadoFinal =
      estadoRecibido !== undefined
        ? normalizarEstado(estadoRecibido)!
        : (proyecto.estado as string | null);

    const visibilidadFinal =
      visibilidadRecibida !== undefined
        ? normalizarVisibilidad(visibilidadRecibida)!
        : (proyecto.visibilidad as string | null);

    const modoAccesoFinal =
      modoAccesoRecibido !== undefined
        ? normalizarModoAcceso(modoAccesoRecibido)!
        : (proyecto.modo_acceso as string | null);

    const prioridadFinal =
      prioridadRecibida !== undefined
        ? normalizarPrioridad(prioridadRecibida)!
        : (proyecto.prioridad as string | null);

    const nuevoPermisoEdicion: PermisoApi =
      permisoEdicionInput !== undefined
        ? (permisoEdicionInput as PermisoApi)
        : permisoEdicionActual;

    const permisoGestionActual: PermisoApi = normalizarPermiso(
      proyecto.permiso_gestionar_tareas
    );

    const nuevoPermisoGestion: PermisoApi =
      permisoGestionInput !== undefined
        ? (permisoGestionInput as PermisoApi)
        : permisoGestionActual;

    const nombreFinal = esValorDefinido(nombreInput)
      ? nombreInput
      : proyecto.nombre;

    const descripcionFinal = esValorDefinido(descripcionInput)
      ? descripcionInput
      : proyecto.descripcion;

    const fechaInicioFinal = esValorDefinido(fechaInicioInput)
      ? fechaInicioInput
      : proyecto.fecha_inicio;

    const fechaFinFinal = esValorDefinido(fechaFinInput)
      ? fechaFinInput
      : proyecto.fecha_fin;

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
          updated_at = CURRENT_TIMESTAMP
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

    const proyectoUpdated = await obtenerProyectoPorId(proyectoId);

    if (!proyectoUpdated) {
      return NextResponse.json(
        { ok: false, error: 'No se pudo recargar el proyecto actualizado' },
        { status: 500 }
      );
    }

    const permisoEdicionFinal: PermisoApi = normalizarPermiso(
      proyectoUpdated.permiso_editar_proyecto
    );
    const permisoGestionFinal: PermisoApi = normalizarPermiso(
      proyectoUpdated.permiso_gestionar_tareas
    );

    const puedeEditar = puedeEditarProyecto(rol, permisoEdicionFinal);
    const puedeEliminar = rol === 'owner';

    const payload = {
      proyecto: proyectoUpdated,
      meta: {
        rol,
        puedeEditarProyecto: puedeEditar,
        puedeEliminarProyecto: puedeEliminar,
        permisosConfiguracion: {
          permisoEdicion: permisoEdicionFinal,
          permisoGestionTareas: permisoGestionFinal,
        },
      },
    };

    return NextResponse.json(
      {
        ok: true,
        message: 'Configuración actualizada correctamente',
        data: payload,
        ...payload,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error en PATCH /api/proyectos/[id]/configuracion:', err);
    return NextResponse.json(
      { ok: false, error: 'Error interno al guardar configuración' },
      { status: 500 }
    );
  }
}

// ─────────────────── DELETE ───────────────────

export async function DELETE(req: NextRequest, { params }: ParamsContext) {
  try {
    const { id } = await params;
    const proyectoId = Number(id);

    if (!id || Number.isNaN(proyectoId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const sessionUser = await getAuthenticatedUser(req);
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const proyecto = await obtenerProyectoPorId(proyectoId);

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const rol = await obtenerRolProyecto(
      proyectoId,
      String(sessionUser.id),
      proyecto.creador_id
    );

    if (rol !== 'owner') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Solo el owner del proyecto puede eliminarlo',
        },
        { status: 403 }
      );
    }

    // 1. Eliminar todas las tablas que referencian tareas.id
    await eliminarReferenciasATareas(proyectoId);

    // 2. Eliminar tareas del proyecto
    await db.execute({
      sql: `
        DELETE FROM tareas
        WHERE proyecto_id = ?
      `,
      args: [proyectoId],
    });

    // 3. Eliminar todas las tablas que referencian proyectos.id
    await eliminarReferenciasAProyecto(proyectoId);

    // 4. Eliminar proyecto
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
        message: 'Proyecto eliminado correctamente',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error en DELETE /api/proyectos/[id]/configuracion:', err);
    return NextResponse.json(
      { ok: false, error: 'Error interno al eliminar el proyecto' },
      { status: 500 }
    );
  }
}