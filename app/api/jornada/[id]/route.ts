//api/jornada/[id]/route.te
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

function normalizarTexto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizarRol(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function esAdminOJefe(rol: string) {
  const normalizado = normalizarRol(rol);
  return normalizado === 'admin' || normalizado === 'jefe';
}

function esHoraValida(hora: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(hora);
}

function calcularMinutos(inicio: string, fin: string) {
  if (!inicio || !fin) return 0;

  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);

  return h2 * 60 + m2 - (h1 * 60 + m1);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!esAdminOJefe(String(user.rol ?? ''))) {
      return NextResponse.json(
        { ok: false, error: 'Sin permisos' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    let estado = normalizarTexto(body?.estado).toLowerCase();
    let hora_entrada = normalizarTexto(body?.hora_entrada);
    let hora_salida = normalizarTexto(body?.hora_salida);
    let motivo = normalizarTexto(body?.motivo);

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'ID requerido' },
        { status: 400 }
      );
    }

    if (!estado) {
      return NextResponse.json(
        { ok: false, error: 'Estado requerido' },
        { status: 400 }
      );
    }

    if (!['presente', 'ausente', 'justificado'].includes(estado)) {
      return NextResponse.json(
        { ok: false, error: 'Estado inválido' },
        { status: 400 }
      );
    }

    if (hora_entrada && !esHoraValida(hora_entrada)) {
      return NextResponse.json(
        { ok: false, error: 'Hora de entrada inválida' },
        { status: 400 }
      );
    }

    if (hora_salida && !esHoraValida(hora_salida)) {
      return NextResponse.json(
        { ok: false, error: 'Hora de salida inválida' },
        { status: 400 }
      );
    }

    let minutos = 0;

    if (estado === 'ausente') {
      hora_entrada = '';
      hora_salida = '';
      minutos = 0;
      motivo = '';
    }

    if (estado === 'presente') {
      if (!hora_entrada) {
        return NextResponse.json(
          { ok: false, error: 'La hora de entrada es requerida' },
          { status: 400 }
        );
      }

      if (hora_entrada && hora_salida) {
        minutos = calcularMinutos(hora_entrada, hora_salida);

        if (minutos <= 0) {
          return NextResponse.json(
            { ok: false, error: 'La hora de salida debe ser mayor que la de entrada' },
            { status: 400 }
          );
        }
      }

      motivo = '';
    }

    if (estado === 'justificado') {
      if (!motivo) {
        return NextResponse.json(
          { ok: false, error: 'Motivo requerido' },
          { status: 400 }
        );
      }

      if (hora_entrada && hora_salida) {
        minutos = calcularMinutos(hora_entrada, hora_salida);

        if (minutos <= 0) {
          return NextResponse.json(
            { ok: false, error: 'La hora de salida debe ser mayor que la de entrada' },
            { status: 400 }
          );
        }
      }
    }

    const existeRes = await db.execute({
      sql: `
        SELECT id
        FROM registro_jornada
        WHERE id = ?
          AND supervisor_id = ?
        LIMIT 1
      `,
      args: [String(id), String(user.id)],
    });

    if (!existeRes.rows || existeRes.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Registro no encontrado o sin permisos' },
        { status: 404 }
      );
    }

    await db.execute({
      sql: `
        UPDATE registro_jornada
        SET
          hora_entrada = ?,
          hora_salida = ?,
          minutos_trabajados = ?,
          estado = ?,
          motivo = ?,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE id = ?
          AND supervisor_id = ?
      `,
      args: [
        hora_entrada || null,
        hora_salida || null,
        minutos,
        estado,
        motivo || null,
        String(id),
        String(user.id),
      ],
    });

    return NextResponse.json({
      ok: true,
      action: 'updated',
      id: String(id),
    });
  } catch (error) {
    console.error('PUT /api/jornada/[id] error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al actualizar registro' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!esAdminOJefe(String(user.rol ?? ''))) {
      return NextResponse.json(
        { ok: false, error: 'Sin permisos' },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'ID requerido' },
        { status: 400 }
      );
    }

    const existeRes = await db.execute({
      sql: `
        SELECT id
        FROM registro_jornada
        WHERE id = ?
          AND supervisor_id = ?
        LIMIT 1
      `,
      args: [String(id), String(user.id)],
    });

    if (!existeRes.rows || existeRes.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Registro no encontrado o sin permisos' },
        { status: 404 }
      );
    }

    await db.execute({
      sql: `
        DELETE FROM registro_jornada
        WHERE id = ?
          AND supervisor_id = ?
      `,
      args: [String(id), String(user.id)],
    });

    return NextResponse.json({
      ok: true,
      action: 'deleted',
      id: String(id),
    });
  } catch (error) {
    console.error('DELETE /api/jornada/[id] error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al eliminar registro' },
      { status: 500 }
    );
  }
}