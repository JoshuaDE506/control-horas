// app/api/jornada/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type EstadoJornada = 'presente' | 'ausente' | 'justificado';

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

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const fecha = normalizarTexto(searchParams.get('fecha'));

    if (!fecha) {
      return NextResponse.json(
        { ok: false, error: 'Fecha requerida' },
        { status: 400 }
      );
    }

    const res = await db.execute({
      sql: `
        SELECT
          rj.id,
          rj.usuario_id,
          u.nombre,
          u.apellido,
          rj.fecha,
          rj.hora_entrada,
          rj.hora_salida,
          rj.minutos_trabajados,
          rj.estado,
          rj.motivo
        FROM registro_jornada rj
        JOIN usuarios u ON u.id = rj.usuario_id
        WHERE rj.supervisor_id = ?
          AND rj.fecha = ?
        ORDER BY u.nombre ASC, u.apellido ASC
      `,
      args: [String(user.id), fecha],
    });

    return NextResponse.json({
      ok: true,
      data: res.rows ?? [],
    });
  } catch (error) {
    console.error('GET /api/jornada error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al obtener registros' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();

    const usuario_id = normalizarTexto(body?.usuario_id);
    const fecha = normalizarTexto(body?.fecha);
    const estado = normalizarTexto(body?.estado).toLowerCase() as EstadoJornada;

    let hora_entrada = normalizarTexto(body?.hora_entrada);
    let hora_salida = normalizarTexto(body?.hora_salida);
    let motivo = normalizarTexto(body?.motivo);

    if (!usuario_id || !fecha || !estado) {
      return NextResponse.json(
        { ok: false, error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    if (!['presente', 'ausente', 'justificado'].includes(estado)) {
      return NextResponse.json(
        { ok: false, error: 'Estado inválido' },
        { status: 400 }
      );
    }

    const usuarioRes = await db.execute({
      sql: `
        SELECT id, rol, activo
        FROM usuarios
        WHERE id = ?
          AND CAST(COALESCE(activo, 0) AS INTEGER) = 1
          AND LOWER(TRIM(COALESCE(rol, ''))) IN ('colaborador', 'admin', 'jefe')
        LIMIT 1
      `,
      args: [usuario_id],
    });

    if (!usuarioRes.rows || usuarioRes.rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'El usuario no existe, está inactivo o su rol no puede registrarse en jornada',
        },
        { status: 400 }
      );
    }

    const asignacionRes = await db.execute({
      sql: `
        SELECT id
        FROM supervisor_usuarios
        WHERE supervisor_id = ?
          AND usuario_id = ?
          AND DATE(COALESCE(fecha_inicio, '1900-01-01')) <= DATE(?)
          AND (
            fecha_fin IS NULL
            OR fecha_fin = ''
            OR DATE(fecha_fin) >= DATE(?)
          )
        LIMIT 1
      `,
      args: [String(user.id), usuario_id, fecha, fecha],
    });

    if (!asignacionRes.rows || asignacionRes.rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'El usuario no está asignado a este supervisor para esa fecha',
        },
        { status: 400 }
      );
    }

    let minutos = 0;

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
      } else {
        minutos = 0;
      }

      motivo = '';
    }

    if (estado === 'justificado') {
      if (!motivo) {
        return NextResponse.json(
          { ok: false, error: 'Debe ingresar un motivo' },
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
      } else {
        minutos = 0;
      }
    }

    const existenteRes = await db.execute({
      sql: `
        SELECT id
        FROM registro_jornada
        WHERE usuario_id = ?
          AND fecha = ?
        LIMIT 1
      `,
      args: [usuario_id, fecha],
    });

    const existente = existenteRes.rows?.[0] as { id?: string } | undefined;

    if (existente?.id) {
      await db.execute({
        sql: `
          UPDATE registro_jornada
          SET
            supervisor_id = ?,
            hora_entrada = ?,
            hora_salida = ?,
            minutos_trabajados = ?,
            estado = ?,
            motivo = ?,
            actualizado_en = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [
          String(user.id),
          hora_entrada || null,
          hora_salida || null,
          minutos,
          estado,
          motivo || null,
          String(existente.id),
        ],
      });

      return NextResponse.json({
        ok: true,
        action: 'updated',
        id: String(existente.id),
      });
    }

    const nuevoId = crypto.randomUUID();

    await db.execute({
      sql: `
        INSERT INTO registro_jornada (
          id,
          usuario_id,
          supervisor_id,
          fecha,
          hora_entrada,
          hora_salida,
          minutos_trabajados,
          estado,
          motivo,
          creado_en,
          actualizado_en
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      args: [
        nuevoId,
        usuario_id,
        String(user.id),
        fecha,
        hora_entrada || null,
        hora_salida || null,
        minutos,
        estado,
        motivo || null,
      ],
    });

    return NextResponse.json({
      ok: true,
      action: 'created',
      id: nuevoId,
    });
  } catch (error) {
    console.error('POST /api/jornada error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al guardar registro' },
      { status: 500 }
    );
  }
}