// app/api/reportes/tareas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getUserIdFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type EstadoTarea = 'todo' | 'in-progress' | 'review' | 'completed';

type BaseTareaRow = {
  id: string;
  titulo: string | null;
  descripcion: string | null;
  prioridad: string | null;
  estado: string | null;
  creado_en: string | null;
  actualizado_en: string | null;
  proyecto_id: number | bigint | null;
  proyecto_nombre: string | null;
  creador_id: string | null;
  creado_por: string | null;
  usuario_id: string | null;
  asignado_directo: string | null;
  asignados: string | null;
  tiempo_estimado_minutos: number | bigint | null;
  seleccionado_en: string | null;
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

function normalizarRolProyecto(raw: unknown) {
  const rol = String(raw ?? '').trim().toLowerCase();

  if (rol === 'owner' || rol === 'dueño' || rol === 'dueno') return 'owner';
  if (rol === 'admin' || rol === 'administrador') return 'admin';
  if (rol === 'miembro' || rol === 'member') return 'miembro';

  return 'ninguno';
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
    const proyectoIdRaw = searchParams.get('proyecto_id');
    const proyectoId =
      proyectoIdRaw && proyectoIdRaw.trim() !== '' ? proyectoIdRaw.trim() : null;
    const usuarioIdFiltro = searchParams.get('usuario_id')?.trim() || '';
    const estadoFiltro = searchParams.get('estado')?.trim() || '';
    const prioridadFiltro = searchParams.get('prioridad')?.trim() || '';

    if (proyectoId) {
      const accesoProyectoRes = await db.execute({
        sql: `
          SELECT
            p.id,
            p.creador_id,
            pu.rol_en_proyecto
          FROM proyectos p
          LEFT JOIN proyecto_usuarios pu
            ON pu.proyecto_id = p.id
           AND CAST(pu.usuario_id AS TEXT) = CAST(? AS TEXT)
          WHERE CAST(p.id AS TEXT) = CAST(? AS TEXT)
          LIMIT 1
        `,
        args: [userId, proyectoId],
      });

      const proyecto = accesoProyectoRes.rows?.[0] as
        | {
            id?: number | bigint | null;
            creador_id?: string | null;
            rol_en_proyecto?: string | null;
          }
        | undefined;

      if (!proyecto?.id) {
        return NextResponse.json(
          { ok: false, error: 'Proyecto no encontrado' },
          { status: 404 }
        );
      }

      const esCreador = String(proyecto.creador_id ?? '') === userId;
      const rol = normalizarRolProyecto(proyecto.rol_en_proyecto);
      const esMiembro =
        esCreador || rol === 'owner' || rol === 'admin' || rol === 'miembro';

      if (!esMiembro) {
        return NextResponse.json(
          { ok: false, error: 'Sin acceso a este proyecto' },
          { status: 403 }
        );
      }
    }

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
      where.push(`datetime(t.creado_en) >= datetime(?)`);
      args.push(fechaInicio);
    }

    if (fechaFin) {
      where.push(`datetime(t.creado_en) <= datetime(?)`);
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
          OR CAST(COALESCE(t.creador_id, '') AS TEXT) = CAST(? AS TEXT)
          OR CAST(COALESCE(p.creador_id, '') AS TEXT) = CAST(? AS TEXT)
          OR EXISTS (
            SELECT 1
            FROM tarea_asignaciones ta_filter
            WHERE ta_filter.tarea_id = t.id
              AND CAST(ta_filter.usuario_id AS TEXT) = CAST(? AS TEXT)
          )
          OR EXISTS (
            SELECT 1
            FROM proyecto_usuarios pu_filter
            WHERE pu_filter.proyecto_id = p.id
              AND CAST(pu_filter.usuario_id AS TEXT) = CAST(? AS TEXT)
          )
        )
      `);
      args.push(
        usuarioIdFiltro,
        usuarioIdFiltro,
        usuarioIdFiltro,
        usuarioIdFiltro,
        usuarioIdFiltro
      );
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
          SUM(CASE WHEN ta.seleccionado_en IS NOT NULL THEN 1 ELSE 0 END) AS cantidad_selecciones,
          SUM(CASE WHEN ta.completado_en IS NOT NULL THEN 1 ELSE 0 END) AS cantidad_completadas
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
          ROUND(SUM(COALESCE(rh.total_segundos, 0)) / 60.0, 2) AS minutos_reales
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
          t.creado_en,
          t.actualizado_en,
          t.proyecto_id,
          p.nombre AS proyecto_nombre,
          t.creador_id,
          TRIM(COALESCE(uc.nombre, '') || ' ' || COALESCE(uc.apellido, '')) AS creado_por,
          t.usuario_id,
          TRIM(COALESCE(ua.nombre, '') || ' ' || COALESCE(ua.apellido, '')) AS asignado_directo,
          ta_agg.asignados,
          t.tiempo_estimado_minutos,
          t.fecha_seleccionada AS seleccionado_en,
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
        ORDER BY datetime(t.creado_en) DESC
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
        estado,
        estado_label: estadoLabel(estado),
        proyecto_id: toNumber(row.proyecto_id),
        proyecto_nombre: row.proyecto_nombre ?? '',
        creador_id: row.creador_id ?? '',
        creado_por: row.creado_por?.trim() || '—',
        usuario_id: row.usuario_id ?? null,
        asignado_a: asignadoA,
        fecha_limite: null,
        fecha_creacion: row.creado_en ?? null,
        creado_en: row.creado_en ?? null,
        actualizado_en: row.actualizado_en ?? null,
        seleccionado_en: row.seleccionado_en ?? null,
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
      filtrosHoras.push(`datetime(rh.iniciado_en) >= datetime(?)`);
      argsHoras.push(fechaInicio);
    }

    if (fechaFin) {
      filtrosHoras.push(`datetime(rh.iniciado_en) <= datetime(?)`);
      argsHoras.push(fechaFin);
    }

    const whereHorasSql = filtrosHoras.length
      ? `WHERE ${filtrosHoras.join(' AND ')}`
      : '';

    const horasRes = await db.execute({
      sql: `
        SELECT
          SUM(CASE WHEN datetime(rh.iniciado_en) >= datetime(?) THEN COALESCE(rh.total_segundos, 0) ELSE 0 END) AS hoy,
          SUM(CASE WHEN datetime(rh.iniciado_en) >= datetime(?) THEN COALESCE(rh.total_segundos, 0) ELSE 0 END) AS semana,
          SUM(CASE WHEN datetime(rh.iniciado_en) >= datetime(?) THEN COALESCE(rh.total_segundos, 0) ELSE 0 END) AS mes,
          SUM(COALESCE(rh.total_segundos, 0)) AS rango
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
          strftime('%Y-%m-%d', t.creado_en) AS periodo,
          COUNT(*) AS total
        ${baseFromSql}
        ${whereSql}
        GROUP BY strftime('%Y-%m-%d', t.creado_en)
        ORDER BY periodo ASC
      `,
      args,
    });

    const actividad = castRows<ActividadRow>(actividadRes.rows).map((row) => ({
      periodo: row.periodo ?? '',
      total: toNumber(row.total),
    }));

    const tareasPorEstado = [
      {
        estado: 'todo',
        label: estadoLabel('todo'),
        total: toNumber(resumenRow.pendientes),
      },
      {
        estado: 'in-progress',
        label: estadoLabel('in-progress'),
        total: toNumber(resumenRow.en_progreso),
      },
      {
        estado: 'review',
        label: estadoLabel('review'),
        total: toNumber(resumenRow.revision),
      },
      {
        estado: 'completed',
        label: estadoLabel('completed'),
        total: toNumber(resumenRow.completadas),
      },
    ];

    return NextResponse.json(
      {
        ok: true,
        resumen: {
          total: toNumber(resumenRow.total),
          pendientes: toNumber(resumenRow.pendientes),
          en_progreso: toNumber(resumenRow.en_progreso),
          revision: toNumber(resumenRow.revision),
          completadas: toNumber(resumenRow.completadas),
          canceladas: 0,
          horas_hoy: Number((toNumber(horasRow.hoy) / 3600).toFixed(2)),
          horas_semana: Number((toNumber(horasRow.semana) / 3600).toFixed(2)),
          horas_mes: Number((toNumber(horasRow.mes) / 3600).toFixed(2)),
          horas_rango: Number((toNumber(horasRow.rango) / 3600).toFixed(2)),
        },
        graficas: {
          tareas_por_estado: tareasPorEstado,
          actividad_por_dia: actividad,
        },
        tareas,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error reportes tareas:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}