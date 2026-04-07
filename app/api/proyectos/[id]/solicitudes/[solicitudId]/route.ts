// app/api/proyectos/[id]/solicitudes/[solicitudId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type SolicitudRow = {
  id: number | bigint;
  usuario_id: string;
  estado: string | null;
};

type ProyectoRow = {
  creador_id: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

// POST /api/proyectos/[id]/solicitudes/[solicitudId]
// Body: { accion: "aprobar" } | { accion: "rechazar" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; solicitudId: string }> }
) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id, solicitudId } = await params;
    const proyectoIdNum = Number(id);
    const solicitudIdNum = Number(solicitudId);

    if (!Number.isInteger(proyectoIdNum) || !Number.isInteger(solicitudIdNum)) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const accion = body?.accion;

    if (accion !== 'aprobar' && accion !== 'rechazar') {
      return NextResponse.json(
        { ok: false, error: "Acción inválida. Usa 'aprobar' o 'rechazar'." },
        { status: 400 }
      );
    }

    // 1) Verificar que el proyecto exista y que el usuario autenticado sea el creador
    const proyectoRes = await db.execute({
      sql: `
        SELECT creador_id
        FROM proyectos
        WHERE id = ?
        LIMIT 1;
      `,
      args: [proyectoIdNum],
    });

    const proyectoRows = castRows<ProyectoRow>(proyectoRes.rows);
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

    // 2) Validación previa rápida
    const solicitudRes = await db.execute({
      sql: `
        SELECT id, usuario_id, estado
        FROM proyecto_solicitudes
        WHERE id = ? AND proyecto_id = ?
        LIMIT 1;
      `,
      args: [solicitudIdNum, proyectoIdNum],
    });

    const solicitudRows = castRows<SolicitudRow>(solicitudRes.rows);
    const solicitud = solicitudRows[0];

    if (!solicitud) {
      return NextResponse.json(
        { ok: false, error: 'Solicitud no existe' },
        { status: 404 }
      );
    }

    const estadoActual = String(solicitud.estado ?? '').toLowerCase();

    if (estadoActual !== 'pendiente') {
      return NextResponse.json(
        {
          ok: false,
          error: 'La solicitud ya fue procesada',
          estado: estadoActual,
        },
        { status: 409 }
      );
    }

    const nuevoEstado = accion === 'aprobar' ? 'aprobada' : 'rechazada';
    const ahora = new Date().toISOString();

    // 3) Transacción real usando el objeto tx del cliente
    const tx = await db.transaction('write');

    try {
      const solicitudTxRes = await tx.execute({
        sql: `
          SELECT id, usuario_id, estado
          FROM proyecto_solicitudes
          WHERE id = ? AND proyecto_id = ?
          LIMIT 1;
        `,
        args: [solicitudIdNum, proyectoIdNum],
      });

      const solicitudTxRows = castRows<SolicitudRow>(solicitudTxRes.rows);
      const solicitudTx = solicitudTxRows[0];

      if (!solicitudTx) {
        await tx.rollback();
        return NextResponse.json(
          { ok: false, error: 'Solicitud no existe' },
          { status: 404 }
        );
      }

      const estadoTx = String(solicitudTx.estado ?? '').toLowerCase();
      const solicitanteIdTx = String(solicitudTx.usuario_id);

      if (estadoTx !== 'pendiente') {
        await tx.rollback();
        return NextResponse.json(
          {
            ok: false,
            error: 'La solicitud ya fue procesada',
            estado: estadoTx,
          },
          { status: 409 }
        );
      }

      await tx.execute({
        sql: `
          UPDATE proyecto_solicitudes
          SET estado = ?, updated_at = ?
          WHERE id = ?;
        `,
        args: [nuevoEstado, ahora, solicitudIdNum],
      });

      if (accion === 'aprobar') {
        await tx.execute({
          sql: `
            INSERT OR IGNORE INTO proyecto_usuarios (
              proyecto_id,
              usuario_id,
              rol_en_proyecto,
              tipo_union,
              fecha_union
            )
            VALUES (?, ?, 'miembro', 'solicitud', ?);
          `,
          args: [proyectoIdNum, solicitanteIdTx, ahora],
        });
      }

      await tx.commit();

      return NextResponse.json(
        {
          ok: true,
          message:
            accion === 'aprobar'
              ? 'Solicitud aprobada correctamente'
              : 'Solicitud rechazada correctamente',
          data: {
            estado: nuevoEstado,
            usuario_id: solicitanteIdTx,
          },
          estado: nuevoEstado,
          usuario_id: solicitanteIdTx,
        },
        { status: 200 }
      );
    } catch (txError) {
      try {
        await tx.rollback();
      } catch {
        // ignorar rollback fallido
      }

      throw txError;
    }
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/solicitudes/[solicitudId] error:',
      error
    );

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}