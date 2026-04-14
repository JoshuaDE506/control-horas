// app/api/proyectos/[id]/tareas/[tareaId]/informes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getUserIdFromRequest } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type ModoAccesoProyecto = 'privado' | 'publico' | 'solicitud';
type EstadoTarea = 'todo' | 'in-progress' | 'review' | 'completed';
type TipoInforme = 'avance' | 'final';

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
  visibilidad: string | null;
  modo_acceso: string | null;
};

type TareaRow = {
  id: string;
  estado: string | null;
  proyecto_id: number | bigint | null;
  ultimo_rechazo_comentario?: string | null;
};

type InformeRow = {
  id: string;
  tarea_id: string;
  usuario_id: string;
  tipo: string | null;
  titulo: string | null;
  descripcion: string | null;
  url_archivo: string | null;
  creado_en: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function toProjectId(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEstado(raw: unknown): EstadoTarea {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'in-progress' || value === 'in_progress') return 'in-progress';
  if (value === 'review' || value === 'revision' || value === 'revisión') {
    return 'review';
  }
  if (value === 'completed') return 'completed';
  return 'todo';
}

function normalizeTipoInforme(raw: unknown): TipoInforme | null {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'avance') return 'avance';
  if (value === 'final') return 'final';

  return null;
}

function normalizarModoAcceso(
  rawModo: unknown,
  rawVisibilidad?: unknown
): ModoAccesoProyecto {
  const modo = String(rawModo ?? '').toLowerCase().trim();
  const vis = String(rawVisibilidad ?? '').toLowerCase().trim();

  if (modo === 'publico' || modo === 'público' || modo === 'public') {
    return 'publico';
  }

  if (
    modo === 'solicitud' ||
    modo === 'request' ||
    modo === 'invitacion' ||
    modo === 'invitación' ||
    modo === 'invite'
  ) {
    return 'solicitud';
  }

  if (modo === 'privado' || modo === 'private') {
    return 'privado';
  }

  if (vis === 'publico' || vis === 'público' || vis === 'public') {
    return 'publico';
  }

  return 'privado';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tareaId: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id, tareaId } = await params;
    const proyectoId = toProjectId(id);

    if (proyectoId == null || !tareaId) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    // 1) Validar tarea
    const tareaRes = await db.execute({
      sql: `
        SELECT
          id,
          estado,
          proyecto_id,
          ultimo_rechazo_comentario
        FROM tareas
        WHERE id = ?
          AND proyecto_id = ?
        LIMIT 1
      `,
      args: [String(tareaId), proyectoId],
    });

    const tareaRows = castRows<TareaRow>(tareaRes.rows);
    const tarea = tareaRows[0];

    if (!tarea) {
      return NextResponse.json(
        { ok: false, error: 'Tarea no existe' },
        { status: 404 }
      );
    }

    // 2) Validar acceso al proyecto
    const proyectoRes = await db.execute({
      sql: `
        SELECT id, creador_id, visibilidad, modo_acceso
        FROM proyectos
        WHERE id = ?
        LIMIT 1
      `,
      args: [proyectoId],
    });

    const proyectoRows = castRows<ProyectoRow>(proyectoRes.rows);
    const proyecto = proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    const isCreator = String(proyecto.creador_id ?? '') === String(userId);

    const memberRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [proyectoId, String(userId)],
    });

    const isMember = !!memberRes.rows?.length;
    const modoAcceso = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    let canAccess = false;
    let canRequestAccess = false;

    if (modoAcceso === 'publico') {
      canAccess = true;
    } else if (modoAcceso === 'solicitud') {
      canAccess = isCreator || isMember;
      canRequestAccess = !canAccess;
    } else {
      canAccess = isCreator || isMember;
    }

    if (!canAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            modoAcceso === 'solicitud'
              ? 'Requiere aprobación'
              : 'Sin acceso a este proyecto',
          canRequestAccess,
        },
        { status: 403 }
      );
    }

    const informesRes = await db.execute({
      sql: `
        SELECT
          id,
          tarea_id,
          usuario_id,
          tipo,
          titulo,
          descripcion,
          url_archivo,
          creado_en
        FROM tarea_informes
        WHERE tarea_id = ?
        ORDER BY creado_en DESC
      `,
      args: [String(tareaId)],
    });

    const informes = castRows<InformeRow>(informesRes.rows).map((row) => ({
      id: String(row.id),
      tarea_id: String(row.tarea_id),
      usuario_id: String(row.usuario_id),
      tipo: normalizeTipoInforme(row.tipo),
      titulo: row.titulo ?? '',
      descripcion: row.descripcion ?? '',
      url_archivo: row.url_archivo ?? null,
      creado_en: row.creado_en ?? null,
    }));

    return NextResponse.json(
      {
        ok: true,
        informes,
        meta: {
          estado_tarea: normalizeEstado(tarea.estado),
          comentario_revision: tarea.ultimo_rechazo_comentario ?? null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/proyectos/[id]/tareas/[tareaId]/informes error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tareaId: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id, tareaId } = await params;
    const proyectoId = toProjectId(id);

    if (proyectoId == null || !tareaId) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const tipo = normalizeTipoInforme(body?.tipo);
    const titulo = typeof body?.titulo === 'string' ? body.titulo.trim() : '';
    const descripcion =
      typeof body?.descripcion === 'string' ? body.descripcion.trim() : '';
    const archivoUrl =
      typeof body?.url_archivo === 'string' && body.url_archivo.trim()
        ? body.url_archivo.trim()
        : null;

    if (!tipo) {
      return NextResponse.json(
        { ok: false, error: 'El tipo de informe es inválido' },
        { status: 400 }
      );
    }

    if (!titulo) {
      return NextResponse.json(
        { ok: false, error: 'El título del informe es obligatorio' },
        { status: 400 }
      );
    }

    if (!descripcion) {
      return NextResponse.json(
        { ok: false, error: 'La descripción del informe es obligatoria' },
        { status: 400 }
      );
    }

    // 1) Validar proyecto
    const proyectoRes = await db.execute({
      sql: `
        SELECT id, creador_id, visibilidad, modo_acceso
        FROM proyectos
        WHERE id = ?
        LIMIT 1
      `,
      args: [proyectoId],
    });

    const proyectoRows = castRows<ProyectoRow>(proyectoRes.rows);
    const proyecto = proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    const isCreator = String(proyecto.creador_id ?? '') === String(userId);

    const memberRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [proyectoId, String(userId)],
    });

    const isMember = !!memberRes.rows?.length;
    const modoAcceso = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    let canAccess = false;
    let canRequestAccess = false;

    if (modoAcceso === 'publico') {
      canAccess = true;
    } else if (modoAcceso === 'solicitud') {
      canAccess = isCreator || isMember;
      canRequestAccess = !canAccess;
    } else {
      canAccess = isCreator || isMember;
    }

    if (!canAccess) {
      return NextResponse.json(
        {
          ok: false,
          error:
            modoAcceso === 'solicitud'
              ? 'Requiere aprobación'
              : 'Sin acceso a este proyecto',
          canRequestAccess,
        },
        { status: 403 }
      );
    }

    // 2) Validar tarea
    const tareaRes = await db.execute({
      sql: `
        SELECT
          id,
          estado,
          proyecto_id,
          ultimo_rechazo_comentario
        FROM tareas
        WHERE id = ?
          AND proyecto_id = ?
        LIMIT 1
      `,
      args: [String(tareaId), proyectoId],
    });

    const tareaRows = castRows<TareaRow>(tareaRes.rows);
    const tarea = tareaRows[0];

    if (!tarea) {
      return NextResponse.json(
        { ok: false, error: 'Tarea no existe' },
        { status: 404 }
      );
    }

    const estadoTarea = normalizeEstado(tarea.estado);

    if (estadoTarea === 'completed') {
      return NextResponse.json(
        { ok: false, error: 'No puedes crear informes para una tarea completada' },
        { status: 409 }
      );
    }

    if (estadoTarea === 'review') {
      return NextResponse.json(
        { ok: false, error: 'No puedes crear informes para una tarea en review' },
        { status: 409 }
      );
    }

    // 3) Validar asignación activa
    const asigRes = await db.execute({
      sql: `
        SELECT 1
        FROM tarea_asignaciones
        WHERE tarea_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
          AND estado = 'activo'
        LIMIT 1
      `,
      args: [String(tareaId), String(userId)],
    });

    const estaAsignadoActivo = !!asigRes.rows?.length;

    if (!estaAsignadoActivo) {
      return NextResponse.json(
        { ok: false, error: 'No estás asignado activamente a esta tarea' },
        { status: 403 }
      );
    }

    const informeId = randomUUID();
    const now = new Date().toISOString();

    // 4) Insertar informe
    await db.execute({
      sql: `
        INSERT INTO tarea_informes (
          id,
          tarea_id,
          usuario_id,
          tipo,
          titulo,
          descripcion,
          url_archivo,
          creado_en
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        informeId,
        String(tareaId),
        String(userId),
        tipo,
        titulo,
        descripcion,
        archivoUrl,
        now,
      ],
    });

    // 5) Limpiar comentario de rechazo anterior al reenviar
    await db.execute({
      sql: `
        UPDATE tareas
        SET
          ultimo_rechazo_comentario = NULL,
          actualizado_en = ?
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [now, String(tareaId), proyectoId],
    });

    // 6) Historial
    try {
      await db.execute({
        sql: `
          INSERT INTO tarea_historial (
            id,
            tarea_id,
            usuario_id,
            estado_anterior,
            estado_nuevo,
            comentario,
            creado_en
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          randomUUID(),
          String(tareaId),
          String(userId),
          estadoTarea,
          estadoTarea,
          tipo === 'final'
            ? 'Subió informe final'
            : 'Subió informe de avance',
          now,
        ],
      });
    } catch (e) {
      console.warn('No se pudo insertar en tarea_historial:', e);
    }

    // 7) Devolver informe creado
    const informeRes = await db.execute({
      sql: `
        SELECT
          id,
          tarea_id,
          usuario_id,
          tipo,
          titulo,
          descripcion,
          url_archivo,
          creado_en
        FROM tarea_informes
        WHERE id = ?
        LIMIT 1
      `,
      args: [informeId],
    });

    const informeRows = castRows<InformeRow>(informeRes.rows);
    const informe = informeRows[0]
      ? {
          id: String(informeRows[0].id),
          tarea_id: String(informeRows[0].tarea_id),
          usuario_id: String(informeRows[0].usuario_id),
          tipo: normalizeTipoInforme(informeRows[0].tipo),
          titulo: informeRows[0].titulo ?? '',
          descripcion: informeRows[0].descripcion ?? '',
          url_archivo: informeRows[0].url_archivo ?? null,
          creado_en: informeRows[0].creado_en ?? null,
        }
      : null;

    return NextResponse.json(
      {
        ok: true,
        message: 'Informe guardado correctamente',
        data: { informe },
        informe,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/proyectos/[id]/tareas/[tareaId]/informes error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}