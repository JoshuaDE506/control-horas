//api/reportes/jornada/export/excel/route.ts
import { NextRequest } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

function esAdminOJefe(rol: string) {
  const r = String(rol ?? '').toLowerCase().trim();
  return r === 'admin' || r === 'jefe';
}

function normalizarTexto(value: string | null) {
  return String(value ?? '').trim();
}

type RegistroRow = {
  fecha: string | null;
  colaborador: string | null;
  puesto: string | null;
  supervisor: string | null;
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
      return new Response('No autenticado', { status: 401 });
    }

    if (!esAdminOJefe(String(user.rol ?? ''))) {
      return new Response('Sin permisos', { status: 403 });
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

    const res = await db.execute({
      sql: `
        SELECT
          rj.fecha,
          TRIM(COALESCE(uc.nombre, '') || ' ' || COALESCE(uc.apellido, '')) AS colaborador,
          uc.puesto AS puesto,
          TRIM(COALESCE(us.nombre, '') || ' ' || COALESCE(us.apellido, '')) AS supervisor,
          rj.estado,
          rj.hora_entrada,
          rj.hora_salida,
          rj.minutos_trabajados,
          rj.motivo
        FROM registro_jornada rj
        LEFT JOIN usuarios uc ON CAST(uc.id AS TEXT) = CAST(rj.usuario_id AS TEXT)
        LEFT JOIN usuarios us ON CAST(us.id AS TEXT) = CAST(rj.supervisor_id AS TEXT)
        ${whereSql}
        ORDER BY rj.fecha DESC, colaborador ASC
      `,
      args,
    });

    const rows = castRows<RegistroRow>(res.rows);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OpenAI';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Jornada');
    sheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Colaborador', key: 'colaborador', width: 28 },
      { header: 'Puesto', key: 'puesto', width: 22 },
      { header: 'Supervisor', key: 'supervisor', width: 28 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Hora entrada', key: 'hora_entrada', width: 14 },
      { header: 'Hora salida', key: 'hora_salida', width: 14 },
      { header: 'Horas trabajadas', key: 'horas', width: 16 },
      { header: 'Motivo', key: 'motivo', width: 32 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    for (const r of rows) {
      const minutos = Number(r.minutos_trabajados ?? 0);

      sheet.addRow({
        fecha: r.fecha ?? '',
        colaborador: r.colaborador ?? '',
        puesto: r.puesto ?? '',
        supervisor: r.supervisor ?? '',
        estado: r.estado ?? '',
        hora_entrada: r.hora_entrada ?? '',
        hora_salida: r.hora_salida ?? '',
        horas: (minutos / 60).toFixed(2),
        motivo: r.motivo ?? '',
      });
    }

    const total = rows.length;
    const presentes = rows.filter((r) => r.estado === 'presente').length;
    const ausentes = rows.filter((r) => r.estado === 'ausente').length;
    const justificados = rows.filter((r) => r.estado === 'justificado').length;
    const minutosTotales = rows.reduce(
      (acc, r) => acc + Number(r.minutos_trabajados ?? 0),
      0,
    );

    const resumen = workbook.addWorksheet('Resumen');
    resumen.columns = [
      { header: 'Concepto', key: 'concepto', width: 26 },
      { header: 'Valor', key: 'valor', width: 18 },
    ];
    resumen.getRow(1).font = { bold: true };

    resumen.addRow({ concepto: 'Total registros', valor: total });
    resumen.addRow({ concepto: 'Presentes', valor: presentes });
    resumen.addRow({ concepto: 'Ausentes', valor: ausentes });
    resumen.addRow({ concepto: 'Justificados', valor: justificados });
    resumen.addRow({ concepto: 'Horas totales', valor: (minutosTotales / 60).toFixed(2) });

    const porColaborador = new Map<
      string,
      {
        colaborador: string;
        presentes: number;
        ausentes: number;
        justificados: number;
        minutos: number;
      }
    >();

    for (const r of rows) {
      const key = r.colaborador ?? 'Sin nombre';
      if (!porColaborador.has(key)) {
        porColaborador.set(key, {
          colaborador: key,
          presentes: 0,
          ausentes: 0,
          justificados: 0,
          minutos: 0,
        });
      }

      const item = porColaborador.get(key)!;
      if (r.estado === 'presente') item.presentes += 1;
      if (r.estado === 'ausente') item.ausentes += 1;
      if (r.estado === 'justificado') item.justificados += 1;
      item.minutos += Number(r.minutos_trabajados ?? 0);
    }

    const resumenColab = workbook.addWorksheet('Por colaborador');
    resumenColab.columns = [
      { header: 'Colaborador', key: 'colaborador', width: 28 },
      { header: 'Presentes', key: 'presentes', width: 12 },
      { header: 'Ausentes', key: 'ausentes', width: 12 },
      { header: 'Justificados', key: 'justificados', width: 14 },
      { header: 'Horas totales', key: 'horas', width: 14 },
    ];
    resumenColab.getRow(1).font = { bold: true };

    for (const item of porColaborador.values()) {
      resumenColab.addRow({
        colaborador: item.colaborador,
        presentes: item.presentes,
        ausentes: item.ausentes,
        justificados: item.justificados,
        horas: (item.minutos / 60).toFixed(2),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="reporte_jornada.xlsx"',
      },
    });
  } catch (error) {
    console.error('GET /api/reportes/jornada/export/excel error:', error);
    return new Response('Error generando Excel', { status: 500 });
  }
}