// app/api/reportes/jornada/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

function esAdminOJefe(rol: string) {
  const r = String(rol ?? '').toLowerCase().trim();
  return r === 'admin' || r === 'jefe';
}

function normalizarTexto(value: string | null) {
  return String(value ?? '').trim();
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

type RegistroRow = {
  id: string;
  fecha: string;
  usuario_id: string;
  colaborador_nombre: string | null;
  colaborador_apellido: string | null;
  puesto: string | null;
  supervisor_id: string;
  supervisor_nombre: string | null;
  supervisor_apellido: string | null;
  estado: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  minutos_trabajados: number | bigint | null;
  motivo: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
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

    const fechaInicio = normalizarTexto(searchParams.get('fecha_inicio'));
    const fechaFin = normalizarTexto(searchParams.get('fecha_fin'));
    const usuarioId = normalizarTexto(searchParams.get('usuario_id'));
    const supervisorId = normalizarTexto(searchParams.get('supervisor_id'));
    const estado = normalizarTexto(searchParams.get('estado')).toLowerCase();

    const where: string[] = [];
    const args: (string | number)[] = [];

    if (fechaInicio) {
      where.push('rj.fecha >= ?');
      args.push(fechaInicio);
    }

    if (fechaFin) {
      where.push('rj.fecha <= ?');
      args.push(fechaFin);
    }

    if (usuarioId) {
      where.push('CAST(rj.usuario_id AS TEXT) = CAST(? AS TEXT)');
      args.push(usuarioId);
    }

    if (supervisorId) {
      where.push('CAST(rj.supervisor_id AS TEXT) = CAST(? AS TEXT)');
      args.push(supervisorId);
    }

    if (estado && ['presente', 'ausente', 'justificado'].includes(estado)) {
      where.push("LOWER(COALESCE(rj.estado, '')) = ?");
      args.push(estado);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const registrosRes = await db.execute({
      sql: `
        SELECT
          rj.id,
          rj.fecha,
          CAST(rj.usuario_id AS TEXT) AS usuario_id,
          uc.nombre AS colaborador_nombre,
          uc.apellido AS colaborador_apellido,
          uc.puesto AS puesto,
          CAST(rj.supervisor_id AS TEXT) AS supervisor_id,
          us.nombre AS supervisor_nombre,
          us.apellido AS supervisor_apellido,
          rj.estado,
          rj.hora_entrada,
          rj.hora_salida,
          rj.minutos_trabajados,
          rj.motivo
        FROM registro_jornada rj
        LEFT JOIN usuarios uc
          ON CAST(uc.id AS TEXT) = CAST(rj.usuario_id AS TEXT)
        LEFT JOIN usuarios us
          ON CAST(us.id AS TEXT) = CAST(rj.supervisor_id AS TEXT)
        ${whereSql}
        ORDER BY rj.fecha DESC, uc.nombre ASC, uc.apellido ASC
      `,
      args,
    });

    const registros = castRows<RegistroRow>(registrosRes.rows).map((r) => {
      const minutos = toNumber(r.minutos_trabajados);

      return {
        id: String(r.id),
        fecha: r.fecha ?? '',
        usuario_id: String(r.usuario_id),
        colaborador: `${r.colaborador_nombre ?? ''} ${r.colaborador_apellido ?? ''}`.trim(),
        puesto: r.puesto ?? null,
        supervisor_id: String(r.supervisor_id),
        supervisor: `${r.supervisor_nombre ?? ''} ${r.supervisor_apellido ?? ''}`.trim(),
        estado: String(r.estado ?? ''),
        hora_entrada: r.hora_entrada ?? null,
        hora_salida: r.hora_salida ?? null,
        minutos_trabajados: minutos,
        horas_trabajadas: Number((minutos / 60).toFixed(2)),
        motivo: r.motivo ?? null,
      };
    });

    const resumen_general = {
      total_registros: registros.length,
      presentes: registros.filter((r) => r.estado === 'presente').length,
      ausentes: registros.filter((r) => r.estado === 'ausente').length,
      justificados: registros.filter((r) => r.estado === 'justificado').length,
      minutos_totales: registros.reduce((acc, r) => acc + r.minutos_trabajados, 0),
    };

    const resumenMap = new Map<
      string,
      {
        usuario_id: string;
        colaborador: string;
        puesto: string | null;
        presentes: number;
        ausentes: number;
        justificados: number;
        minutos_totales: number;
      }
    >();

    for (const r of registros) {
      if (!resumenMap.has(r.usuario_id)) {
        resumenMap.set(r.usuario_id, {
          usuario_id: r.usuario_id,
          colaborador: r.colaborador,
          puesto: r.puesto,
          presentes: 0,
          ausentes: 0,
          justificados: 0,
          minutos_totales: 0,
        });
      }

      const item = resumenMap.get(r.usuario_id)!;

      if (r.estado === 'presente') item.presentes += 1;
      if (r.estado === 'ausente') item.ausentes += 1;
      if (r.estado === 'justificado') item.justificados += 1;

      item.minutos_totales += r.minutos_trabajados;
    }

    const resumen_por_colaborador = Array.from(resumenMap.values()).map((r) => ({
      ...r,
      horas_totales: Number((r.minutos_totales / 60).toFixed(2)),
    }));

    return NextResponse.json({
      ok: true,
      filtros: {
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        usuario_id: usuarioId || null,
        supervisor_id: supervisorId || null,
        estado: estado || null,
      },
      resumen_general: {
        ...resumen_general,
        horas_totales: Number((resumen_general.minutos_totales / 60).toFixed(2)),
      },
      resumen_por_colaborador,
      registros,
    });
  } catch (error) {
    console.error('GET /api/reportes/jornada error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al obtener reporte de jornada' },
      { status: 500 }
    );
  }
}