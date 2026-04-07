// app/api/reportes/tareas/export/excel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getUserIdFromRequest } from '@/lib/auth';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

type EstadoTarea = 'todo' | 'in-progress' | 'review' | 'completed';

type BaseTareaRow = {
  id: string;
  titulo: string | null;
  descripcion: string | null;
  prioridad: string | null;
  estado: string | null;
  created_at: string | null;
  updated_at: string | null;
  proyecto_id: number | bigint | null;
  proyecto_nombre: string | null;
  creador_id: string | null;
  creado_por: string | null;
  usuario_id: string | null;
  asignado_directo: string | null;
  asignados: string | null;
  tiempo_estimado_minutos: number | bigint | null;
  fecha_seleccionada: string | null;
  fecha_inicio_trabajo: string | null;
  fecha_envio_revision: string | null;
  fecha_aprobacion: string | null;
  aprobado_por: string | null;
  aprobado_por_nombre: string | null;
  ultimo_rechazo_comentario: string | null;
  minutos_reales: number | bigint | null;
  cantidad_selecciones: number | bigint | null;
  cantidad_completadas: number | bigint | null;
};

type ResumenRow = {
  total?: number | bigint | null;
  pendientes?: number | bigint | null;
  en_progreso?: number | bigint | null;
  revision?: number | bigint | null;
  completadas?: number | bigint | null;
};

type ActividadRow = {
  periodo: string | null;
  total: number | bigint | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeEstado(raw: unknown): EstadoTarea {
  const value = String(raw ?? '').trim().toLowerCase();

  if (
    value === 'in-progress' ||
    value === 'in_progress' ||
    value === 'en progreso' ||
    value === 'en_progreso'
  ) {
    return 'in-progress';
  }

  if (value === 'review' || value === 'revision' || value === 'revisión') {
    return 'review';
  }

  if (value === 'completed' || value === 'completado' || value === 'completada') {
    return 'completed';
  }

  return 'todo';
}

function estadoLabel(estado: EstadoTarea) {
  switch (estado) {
    case 'todo':
      return 'Por hacer';
    case 'in-progress':
      return 'En progreso';
    case 'review':
      return 'En revisión';
    case 'completed':
      return 'Completada';
  }
}

function prioridadLabel(prioridad: unknown) {
  const value = String(prioridad ?? '').trim().toLowerCase();
  if (value === 'critica' || value === 'crítica') return 'Crítica';
  if (value === 'alta') return 'Alta';
  if (value === 'baja') return 'Baja';
  return 'Media';
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-CR');
}

function minutosAHoras(minutos: number) {
  return Number((minutos / 60).toFixed(2));
}

function construirFechasBase() {
  const now = new Date();

  const inicioHoy = new Date(now);
  inicioHoy.setHours(0, 0, 0, 0);

  const inicioSemana = new Date(now);
  const day = inicioSemana.getDay();
  const diff = day === 0 ? 6 : day - 1;
  inicioSemana.setDate(inicioSemana.getDate() - diff);
  inicioSemana.setHours(0, 0, 0, 0);

  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    inicioHoy: inicioHoy.toISOString(),
    inicioSemana: inicioSemana.toISOString(),
    inicioMes: inicioMes.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const sessionUserId = await getUserIdFromRequest(req);

    if (!sessionUserId) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = String(sessionUserId);
    const { searchParams } = new URL(req.url);

    const fechaInicio = searchParams.get('fecha_inicio')?.trim() || '';
    const fechaFin = searchParams.get('fecha_fin')?.trim() || '';
    const proyectoId = searchParams.get('proyecto_id')?.trim() || '';
    const usuarioIdFiltro = searchParams.get('usuario_id')?.trim() || '';
    const estadoFiltro = searchParams.get('estado')?.trim() || '';
    const prioridadFiltro = searchParams.get('prioridad')?.trim() || '';

    const where: string[] = [];
    const args: Array<string | number> = [];

    where.push(`
      (
        CAST(t.creador_id AS TEXT) = CAST(? AS TEXT)
        OR CAST(p.creador_id AS TEXT) = CAST(? AS TEXT)
        OR EXISTS (
          SELECT 1
          FROM proyecto_usuarios pu
          WHERE pu.proyecto_id = p.id
            AND CAST(pu.usuario_id AS TEXT) = CAST(? AS TEXT)
        )
        OR CAST(COALESCE(t.usuario_id, '') AS TEXT) = CAST(? AS TEXT)
        OR EXISTS (
          SELECT 1
          FROM tarea_asignaciones ta_self
          WHERE ta_self.tarea_id = t.id
            AND CAST(ta_self.usuario_id AS TEXT) = CAST(? AS TEXT)
        )
      )
    `);
    args.push(userId, userId, userId, userId, userId);

    if (proyectoId) {
      where.push(`CAST(t.proyecto_id AS TEXT) = CAST(? AS TEXT)`);
      args.push(proyectoId);
    }

    if (fechaInicio) {
      where.push(`datetime(t.created_at) >= datetime(?)`);
      args.push(fechaInicio);
    }

    if (fechaFin) {
      where.push(`datetime(t.created_at) <= datetime(?)`);
      args.push(fechaFin);
    }

    if (estadoFiltro) {
      where.push(`LOWER(TRIM(t.estado)) = LOWER(TRIM(?))`);
      args.push(estadoFiltro);
    }

    if (prioridadFiltro) {
      where.push(`LOWER(TRIM(t.prioridad)) = LOWER(TRIM(?))`);
      args.push(prioridadFiltro);
    }

    if (usuarioIdFiltro) {
      where.push(`
        (
          CAST(COALESCE(t.usuario_id, '') AS TEXT) = CAST(? AS TEXT)
          OR EXISTS (
            SELECT 1
            FROM tarea_asignaciones ta_filter
            WHERE ta_filter.tarea_id = t.id
              AND CAST(ta_filter.usuario_id AS TEXT) = CAST(? AS TEXT)
          )
        )
      `);
      args.push(usuarioIdFiltro, usuarioIdFiltro);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const baseFromSql = `
      FROM tareas t
      INNER JOIN proyectos p
        ON p.id = t.proyecto_id
      LEFT JOIN usuarios uc
        ON CAST(uc.id AS TEXT) = CAST(t.creador_id AS TEXT)
      LEFT JOIN usuarios ua
        ON CAST(ua.id AS TEXT) = CAST(t.usuario_id AS TEXT)
      LEFT JOIN usuarios uap
        ON CAST(uap.id AS TEXT) = CAST(t.aprobado_por AS TEXT)
      LEFT JOIN (
        SELECT
          ta.tarea_id,
          GROUP_CONCAT(
            TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, '')),
            ', '
          ) AS asignados,
          SUM(CASE WHEN ta.selected_at IS NOT NULL THEN 1 ELSE 0 END) AS cantidad_selecciones,
          SUM(CASE WHEN ta.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS cantidad_completadas
        FROM tarea_asignaciones ta
        INNER JOIN usuarios u
          ON CAST(u.id AS TEXT) = CAST(ta.usuario_id AS TEXT)
        WHERE ta.estado IN ('activo', 'completado', 'pausado')
        GROUP BY ta.tarea_id
      ) ta_agg
        ON ta_agg.tarea_id = t.id
      LEFT JOIN (
        SELECT
          rh.tarea_id,
          ROUND(SUM(COALESCE(rh.total_seconds, 0)) / 60.0, 2) AS minutos_reales
        FROM registro_horas rh
        GROUP BY rh.tarea_id
      ) rh_agg
        ON rh_agg.tarea_id = t.id
    `;

    const resumenRes = await db.execute({
      sql: `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN t.estado = 'todo' THEN 1 ELSE 0 END) AS pendientes,
          SUM(CASE WHEN t.estado = 'in-progress' THEN 1 ELSE 0 END) AS en_progreso,
          SUM(CASE WHEN t.estado = 'review' THEN 1 ELSE 0 END) AS revision,
          SUM(CASE WHEN t.estado = 'completed' THEN 1 ELSE 0 END) AS completadas
        ${baseFromSql}
        ${whereSql}
      `,
      args,
    });

    const resumenRow = castRows<ResumenRow>(resumenRes.rows)[0] ?? {};

    const tareasRes = await db.execute({
      sql: `
        SELECT
          t.id,
          t.titulo,
          t.descripcion,
          t.prioridad,
          t.estado,
          t.created_at,
          t.updated_at,
          t.proyecto_id,
          p.nombre AS proyecto_nombre,
          t.creador_id,
          TRIM(COALESCE(uc.nombre, '') || ' ' || COALESCE(uc.apellido, '')) AS creado_por,
          t.usuario_id,
          TRIM(COALESCE(ua.nombre, '') || ' ' || COALESCE(ua.apellido, '')) AS asignado_directo,
          ta_agg.asignados,
          t.tiempo_estimado_minutos,
          t.fecha_seleccionada,
          t.fecha_inicio_trabajo,
          t.fecha_envio_revision,
          t.fecha_aprobacion,
          t.aprobado_por,
          TRIM(COALESCE(uap.nombre, '') || ' ' || COALESCE(uap.apellido, '')) AS aprobado_por_nombre,
          t.ultimo_rechazo_comentario,
          COALESCE(rh_agg.minutos_reales, 0) AS minutos_reales,
          COALESCE(ta_agg.cantidad_selecciones, 0) AS cantidad_selecciones,
          COALESCE(ta_agg.cantidad_completadas, 0) AS cantidad_completadas
        ${baseFromSql}
        ${whereSql}
        ORDER BY datetime(t.created_at) DESC
      `,
      args,
    });

    const tareasRows = castRows<BaseTareaRow>(tareasRes.rows);

    const tareas = tareasRows.map((row) => {
      const estado = normalizeEstado(row.estado);
      const asignadoA =
        (row.asignados && row.asignados.trim()) ||
        (row.asignado_directo && row.asignado_directo.trim()) ||
        '—';

      return {
        id: String(row.id),
        titulo: row.titulo ?? '',
        descripcion: row.descripcion ?? '',
        prioridad: row.prioridad ?? 'media',
        prioridad_label: prioridadLabel(row.prioridad),
        estado,
        estado_label: estadoLabel(estado),
        proyecto_id: toNumber(row.proyecto_id),
        proyecto_nombre: row.proyecto_nombre ?? '',
        creador_id: row.creador_id ?? '',
        creado_por: row.creado_por?.trim() || '—',
        usuario_id: row.usuario_id ?? null,
        asignado_a: asignadoA,
        fecha_creacion: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        fecha_seleccionada: row.fecha_seleccionada ?? null,
        fecha_inicio_trabajo: row.fecha_inicio_trabajo ?? null,
        fecha_envio_revision: row.fecha_envio_revision ?? null,
        fecha_aprobacion: row.fecha_aprobacion ?? null,
        fecha_completado: row.fecha_aprobacion ?? null,
        aprobado_por: row.aprobado_por ?? null,
        aprobado_por_nombre: row.aprobado_por_nombre?.trim() || null,
        ultimo_rechazo_comentario: row.ultimo_rechazo_comentario ?? null,
        tiempo_estimado_minutos: toNumber(row.tiempo_estimado_minutos),
        minutos_reales: toNumber(row.minutos_reales),
        cantidad_selecciones: toNumber(row.cantidad_selecciones),
        cantidad_completadas: toNumber(row.cantidad_completadas),
        rendimiento_porcentaje:
          toNumber(row.tiempo_estimado_minutos) > 0 && toNumber(row.minutos_reales) > 0
            ? Number(
                (
                  (toNumber(row.tiempo_estimado_minutos) / toNumber(row.minutos_reales)) *
                  100
                ).toFixed(2)
              )
            : null,
      };
    });

    const { inicioHoy, inicioSemana, inicioMes } = construirFechasBase();

    const filtrosHoras: string[] = [
      `CAST(rh.usuario_id AS TEXT) = CAST(? AS TEXT)`,
    ];
    const argsHoras: Array<string | number> = [userId];

    if (proyectoId) {
      filtrosHoras.push(`CAST(t.proyecto_id AS TEXT) = CAST(? AS TEXT)`);
      argsHoras.push(proyectoId);
    }

    if (fechaInicio) {
      filtrosHoras.push(`datetime(rh.started_at) >= datetime(?)`);
      argsHoras.push(fechaInicio);
    }

    if (fechaFin) {
      filtrosHoras.push(`datetime(rh.started_at) <= datetime(?)`);
      argsHoras.push(fechaFin);
    }

    const whereHorasSql = filtrosHoras.length
      ? `WHERE ${filtrosHoras.join(' AND ')}`
      : '';

    const horasRes = await db.execute({
      sql: `
        SELECT
          SUM(CASE WHEN datetime(rh.started_at) >= datetime(?) THEN COALESCE(rh.total_seconds, 0) ELSE 0 END) AS hoy,
          SUM(CASE WHEN datetime(rh.started_at) >= datetime(?) THEN COALESCE(rh.total_seconds, 0) ELSE 0 END) AS semana,
          SUM(CASE WHEN datetime(rh.started_at) >= datetime(?) THEN COALESCE(rh.total_seconds, 0) ELSE 0 END) AS mes,
          SUM(COALESCE(rh.total_seconds, 0)) AS rango
        FROM registro_horas rh
        INNER JOIN tareas t
          ON t.id = rh.tarea_id
        ${whereHorasSql}
      `,
      args: [inicioHoy, inicioSemana, inicioMes, ...argsHoras],
    });

    const horasRow =
      (horasRes.rows?.[0] as {
        hoy?: number | bigint | null;
        semana?: number | bigint | null;
        mes?: number | bigint | null;
        rango?: number | bigint | null;
      }) ?? {};

    const actividadRes = await db.execute({
      sql: `
        SELECT
          strftime('%Y-%m-%d', t.created_at) AS periodo,
          COUNT(*) AS total
        ${baseFromSql}
        ${whereSql}
        GROUP BY strftime('%Y-%m-%d', t.created_at)
        ORDER BY periodo ASC
      `,
      args,
    });

    const actividad = castRows<ActividadRow>(actividadRes.rows).map((row) => ({
      periodo: row.periodo ?? '',
      total: toNumber(row.total),
    }));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OpenAI';
    workbook.created = new Date();
    workbook.modified = new Date();

    const wsResumen = workbook.addWorksheet('Resumen');
    const wsTareas = workbook.addWorksheet('Tareas');
    const wsActividad = workbook.addWorksheet('Actividad');

    // RESUMEN
    wsResumen.columns = [
      { header: 'Métrica', key: 'metrica', width: 32 },
      { header: 'Valor', key: 'valor', width: 18 },
    ];

    wsResumen.addRow({ metrica: 'Total tareas', valor: toNumber(resumenRow.total) });
    wsResumen.addRow({ metrica: 'Por hacer', valor: toNumber(resumenRow.pendientes) });
    wsResumen.addRow({ metrica: 'En progreso', valor: toNumber(resumenRow.en_progreso) });
    wsResumen.addRow({ metrica: 'En revisión', valor: toNumber(resumenRow.revision) });
    wsResumen.addRow({ metrica: 'Completadas', valor: toNumber(resumenRow.completadas) });
    wsResumen.addRow({ metrica: 'Canceladas', valor: 0 });
    wsResumen.addRow({ metrica: 'Horas hoy', valor: Number((toNumber(horasRow.hoy) / 3600).toFixed(2)) });
    wsResumen.addRow({ metrica: 'Horas semana', valor: Number((toNumber(horasRow.semana) / 3600).toFixed(2)) });
    wsResumen.addRow({ metrica: 'Horas mes', valor: Number((toNumber(horasRow.mes) / 3600).toFixed(2)) });
    wsResumen.addRow({ metrica: 'Horas rango', valor: Number((toNumber(horasRow.rango) / 3600).toFixed(2)) });

    wsResumen.getRow(1).font = { bold: true };
    wsResumen.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    wsResumen.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // TAREAS
    wsTareas.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Título', key: 'titulo', width: 28 },
      { header: 'Descripción', key: 'descripcion', width: 36 },
      { header: 'Proyecto', key: 'proyecto_nombre', width: 24 },
      { header: 'Estado', key: 'estado_label', width: 16 },
      { header: 'Prioridad', key: 'prioridad_label', width: 14 },
      { header: 'Asignado a', key: 'asignado_a', width: 28 },
      { header: 'Creado por', key: 'creado_por', width: 24 },
      { header: 'Fecha creación', key: 'fecha_creacion', width: 22 },
      { header: 'Inicio trabajo', key: 'fecha_inicio_trabajo', width: 22 },
      { header: 'Envío revisión', key: 'fecha_envio_revision', width: 22 },
      { header: 'Fecha aprobación', key: 'fecha_aprobacion', width: 22 },
      { header: 'Aprobado por', key: 'aprobado_por_nombre', width: 24 },
      { header: 'Rechazo comentario', key: 'ultimo_rechazo_comentario', width: 34 },
      { header: 'Tiempo estimado (min)', key: 'tiempo_estimado_minutos', width: 20 },
      { header: 'Tiempo real (min)', key: 'minutos_reales', width: 18 },
      { header: 'Tiempo real (h)', key: 'horas_reales', width: 16 },
      { header: 'Selecciones', key: 'cantidad_selecciones', width: 14 },
      { header: 'Completadas', key: 'cantidad_completadas', width: 14 },
      { header: 'Rendimiento %', key: 'rendimiento_porcentaje', width: 16 },
    ];

    for (const tarea of tareas) {
      wsTareas.addRow({
        ...tarea,
        fecha_creacion: formatDateSafe(tarea.fecha_creacion),
        fecha_inicio_trabajo: formatDateSafe(tarea.fecha_inicio_trabajo),
        fecha_envio_revision: formatDateSafe(tarea.fecha_envio_revision),
        fecha_aprobacion: formatDateSafe(tarea.fecha_aprobacion),
        horas_reales: minutosAHoras(tarea.minutos_reales),
      });
    }

    wsTareas.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF312E81' },
    };
    wsTareas.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // ACTIVIDAD
    wsActividad.columns = [
      { header: 'Fecha', key: 'periodo', width: 18 },
      { header: 'Total tareas', key: 'total', width: 14 },
    ];

    for (const item of actividad) {
      wsActividad.addRow(item);
    }

    wsActividad.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' },
    };
    wsActividad.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Bordes y alineación general
    [wsResumen, wsTareas, wsActividad].forEach((ws) => {
      ws.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF334155' } },
            left: { style: 'thin', color: { argb: 'FF334155' } },
            bottom: { style: 'thin', color: { argb: 'FF334155' } },
            right: { style: 'thin', color: { argb: 'FF334155' } },
          };

          if (rowNumber > 1) {
            cell.alignment = { vertical: 'middle' };
          }
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `reporte_tareas_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error exportando reporte de tareas:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}