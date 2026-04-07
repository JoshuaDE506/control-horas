// app/api/proyectos/[id]/solicitudes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type SolicitudEstado = 'pendiente' | 'aprobada' | 'rechazada';

type ProyectoSolicitudRow = {
  id: number | bigint;
  visibilidad: string | null;
  modo_acceso: string | null;
  creador_id: string | null;
};

type SolicitudExistenteRow = {
  id: number | bigint;
  proyecto_id: number | bigint;
  usuario_id: string;
  estado: string | null;
  mensaje: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SolicitudListadoRow = {
  id: number | bigint;
  proyecto_id: number | bigint;
  usuario_id: string;
  estado: string | null;
  mensaje: string | null;
  created_at: string | null;
  updated_at: string | null;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarModoSolicitud(
  modoAcceso: unknown,
  visibilidad?: unknown
): boolean {
  const modo = String(modoAcceso ?? '').toLowerCase().trim();
  const vis = String(visibilidad ?? '').toLowerCase().trim();

  return (
    modo === 'solicitud' ||
    modo === 'request' ||
    modo === 'invitacion' ||
    modo === 'invitación' ||
    vis === 'solicitud'
  );
}

function mapSolicitud(row: SolicitudExistenteRow | SolicitudListadoRow) {
  return {
    id: typeof row.id === 'bigint' ? Number(row.id) : Number(row.id),
    proyecto_id:
      typeof row.proyecto_id === 'bigint'
        ? Number(row.proyecto_id)
        : Number(row.proyecto_id),
    usuario_id: String(row.usuario_id),
    estado: String(row.estado ?? 'pendiente') as SolicitudEstado,
    mensaje: row.mensaje ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    ...(Object.prototype.hasOwnProperty.call(row, 'nombre')
      ? {
          nombre: (row as SolicitudListadoRow).nombre ?? '',
          apellido: (row as SolicitudListadoRow).apellido ?? '',
          email: (row as SolicitudListadoRow).email ?? '',
        }
      : {}),
  };
}

// POST /api/proyectos/[id]/solicitudes
// Crea una solicitud para un proyecto cuyo modo_acceso sea "solicitud"
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const proyectoId = Number(id);

    if (!Number.isFinite(proyectoId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const mensaje =
      typeof body?.mensaje === 'string' ? body.mensaje.trim() : null;

    const proyectoRes = await db.execute({
      sql: `
        SELECT id, visibilidad, modo_acceso, creador_id
        FROM proyectos
        WHERE id = ?
        LIMIT 1;
      `,
      args: [proyectoId],
    });

    const proyectoRows = castRows<ProyectoSolicitudRow>(proyectoRes.rows);
    const proyecto = proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    const esSolicitud = normalizarModoSolicitud(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    if (!esSolicitud) {
      return NextResponse.json(
        { ok: false, error: 'Este proyecto no es de solicitud' },
        { status: 400 }
      );
    }

    if (String(proyecto.creador_id) === String(sessionUser.id)) {
      return NextResponse.json(
        { ok: false, error: 'Eres el creador del proyecto' },
        { status: 400 }
      );
    }

    const memberRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1;
      `,
      args: [proyectoId, String(sessionUser.id)],
    });

    if (memberRes.rows?.length) {
      return NextResponse.json(
        { ok: false, error: 'Ya eres miembro del proyecto' },
        { status: 400 }
      );
    }

    try {
      await db.execute({
        sql: `
          INSERT INTO proyecto_solicitudes (proyecto_id, usuario_id, estado, mensaje)
          VALUES (?, ?, 'pendiente', ?);
        `,
        args: [proyectoId, String(sessionUser.id), mensaje],
      });

      return NextResponse.json(
        {
          ok: true,
          message: 'Solicitud creada correctamente',
          data: { estado: 'pendiente' },
          estado: 'pendiente',
        },
        { status: 201 }
      );
    } catch {
      const existingRes = await db.execute({
        sql: `
          SELECT id, proyecto_id, usuario_id, estado, mensaje, created_at, updated_at
          FROM proyecto_solicitudes
          WHERE proyecto_id = ? AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
          LIMIT 1;
        `,
        args: [proyectoId, String(sessionUser.id)],
      });

      const existingRows = castRows<SolicitudExistenteRow>(existingRes.rows);
      const solicitudExistente = existingRows[0];

      if (solicitudExistente) {
        const solicitud = mapSolicitud(solicitudExistente);

        return NextResponse.json(
          {
            ok: true,
            message: 'La solicitud ya existía',
            data: solicitud,
            solicitud,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { ok: false, error: 'No se pudo crear la solicitud' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('POST /api/proyectos/[id]/solicitudes error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/proyectos/[id]/solicitudes
// Lista solo solicitudes pendientes del proyecto (solo creador)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const proyectoId = Number(id);

    if (!Number.isFinite(proyectoId)) {
      return NextResponse.json(
        { ok: false, error: 'ID de proyecto inválido' },
        { status: 400 }
      );
    }

    const proyectoRes = await db.execute({
      sql: `
        SELECT creador_id
        FROM proyectos
        WHERE id = ?
        LIMIT 1;
      `,
      args: [proyectoId],
    });

    const proyectoRows = castRows<{ creador_id: string | null }>(proyectoRes.rows);
    const proyecto = proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    if (String(proyecto.creador_id) !== String(sessionUser.id)) {
      return NextResponse.json(
        { ok: false, error: 'Sin permiso' },
        { status: 403 }
      );
    }

    const solicitudesRes = await db.execute({
      sql: `
        SELECT
          s.id,
          s.proyecto_id,
          s.usuario_id,
          s.estado,
          s.mensaje,
          s.created_at,
          s.updated_at,
          u.nombre,
          u.apellido,
          u.email
        FROM proyecto_solicitudes s
        JOIN usuarios u ON CAST(u.id AS TEXT) = CAST(s.usuario_id AS TEXT)
        WHERE s.proyecto_id = ?
          AND s.estado = 'pendiente'
        ORDER BY s.created_at DESC;
      `,
      args: [proyectoId],
    });

    const solicitudesRows = castRows<SolicitudListadoRow>(solicitudesRes.rows);
    const solicitudes = solicitudesRows.map(mapSolicitud);

    return NextResponse.json(
      {
        ok: true,
        data: solicitudes,
        solicitudes,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/proyectos/[id]/solicitudes error:', error);
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}