// app/api/proyectos/[id]/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type ModoAcceso = 'publico' | 'solicitud' | 'privado';

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

type ProyectoRow = {
  id: number | bigint;
  nombre: string | null;
  descripcion: string | null;
  prioridad: string | null;
  visibilidad: string | null;
  modo_acceso: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  codigo_union: string | null;
  creador_id: string | null;
  creado_en: string | null;
  actualizado_en: string | null;
};

type UsuarioBasico = {
  nombre: string;
  apellido: string | null;
  email: string;
  pais: string | null;
};

type MiembroPreviewRow = {
  usuario_id: string;
  rol_en_proyecto: string | null;
  fecha_union: string | null;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarModoAcceso(row: {
  modo_acceso?: unknown;
  visibilidad?: unknown;
}): ModoAcceso {
  const raw = String(row?.modo_acceso ?? row?.visibilidad ?? '')
    .toLowerCase()
    .trim();

  if (raw === 'publico' || raw === 'público' || raw === 'public') {
    return 'publico';
  }

  if (
    raw === 'solicitud' ||
    raw === 'request' ||
    raw === 'invite' ||
    raw === 'invitacion' ||
    raw === 'invitación'
  ) {
    return 'solicitud';
  }

  return 'privado';
}

function normId(v: unknown) {
  return String(v ?? '').trim().toLowerCase();
}

async function fetchUsuarioBasicoById(usuarioId: string): Promise<UsuarioBasico | null> {
  const id = normId(usuarioId);

  const r = await db.execute({
    sql: `
      SELECT nombre, apellido, email, pais AS pais
      FROM usuarios
      WHERE LOWER(TRIM(CAST(id AS TEXT))) = ?
      LIMIT 1;
    `,
    args: [id],
  });

  const rows = castRows<{
    nombre: string | null;
    apellido: string | null;
    email: string | null;
    pais: string | null;
  }>(r.rows);

  const u = rows[0];
  if (!u) return null;

  return {
    nombre: String(u.nombre ?? '—') || '—',
    apellido: u.apellido ? String(u.apellido) : null,
    email: String(u.email ?? '—') || '—',
    pais: u.pais ?? null,
  };
}

function mapRol(rolDb: unknown): 'creador' | 'administrador' | 'miembro' {
  const r = String(rolDb ?? '').toLowerCase().trim();

  if (r === 'owner' || r === 'creador') return 'creador';
  if (r === 'admin' || r === 'administrador') return 'administrador';
  return 'miembro';
}

const isDev = process.env.NODE_ENV !== 'production';

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = normId(sessionUser.id);

    const { id } = await params;
    const proyectoId = Number(id);

    if (!Number.isFinite(proyectoId)) {
      return NextResponse.json(
        { ok: false, error: 'Parámetros inválidos' },
        { status: 400 }
      );
    }

    // 1) Proyecto
    const pRes = await db.execute({
      sql: `
        SELECT
          id,
          nombre,
          descripcion,
          prioridad,
          visibilidad,
          modo_acceso,
          fecha_inicio,
          fecha_fin,
          codigo_union,
          creador_id,
          creado_en,
          actualizado_en
        FROM proyectos
        WHERE id = ?
        LIMIT 1;
      `,
      args: [proyectoId],
    });

    const proyectoRows = castRows<ProyectoRow>(pRes.rows);
    const proyecto = proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        { ok: false, error: 'Proyecto no existe' },
        { status: 404 }
      );
    }

    const modoAcceso = normalizarModoAcceso(proyecto);

    const creadorIdRaw = String(proyecto.creador_id ?? '');
    const creadorId = normId(creadorIdRaw);

    // 2) Miembro / creador
    const esCreador = creadorId === userId;

    const mRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND LOWER(TRIM(CAST(usuario_id AS TEXT))) = ?
        LIMIT 1;
      `,
      args: [proyectoId, userId],
    });

    const esMiembro = esCreador || !!mRes.rows?.length;
    const esPrivadoYNoMiembro = modoAcceso === 'privado' && !esMiembro;

    // 3) Total miembros real
    const countRes = await db.execute({
      sql: `
        SELECT COUNT(DISTINCT usuario_id) AS total
        FROM (
          SELECT LOWER(TRIM(CAST(creador_id AS TEXT))) AS usuario_id
          FROM proyectos
          WHERE id = ?

          UNION ALL

          SELECT LOWER(TRIM(CAST(usuario_id AS TEXT))) AS usuario_id
          FROM proyecto_usuarios
          WHERE proyecto_id = ?
        ) x;
      `,
      args: [proyectoId, proyectoId],
    });

    const countRows = castRows<{ total: number | bigint | null }>(countRes.rows);
    const totalMiembrosRaw = Number(countRows[0]?.total ?? 0);
    const totalMiembros = esPrivadoYNoMiembro ? 0 : totalMiembrosRaw;

    // 4) Acciones
    const canJoinDirect = !esMiembro && modoAcceso === 'publico';
    const canRequestInvite = !esMiembro && modoAcceso === 'solicitud';

    // 5) Tareas + estadísticas
    const puedeVerTareas = modoAcceso === 'publico' || esMiembro;

    let tareas: any[] = [];
    let estadisticasTareas: {
      total: number;
      todo: number;
      'in-progress': number;
      completed: number;
      porcentajeCompletado: number;
    } | null = null;

    if (puedeVerTareas) {
      const tRes = await db.execute({
        sql: `
          SELECT
            id,
            titulo,
            descripcion,
            prioridad,
            estado,
            creado_en,
            actualizado_en,
            tiempo_estimado_minutos,
            max_participantes
          FROM tareas
          WHERE proyecto_id = ?
          ORDER BY creado_en DESC
          LIMIT 25;
        `,
        args: [proyectoId],
      });

      tareas = (tRes.rows ?? []).map((t: any) => ({
        ...t,
        id: String(t.id),
      }));

      const sRes = await db.execute({
        sql: `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN estado = 'todo' THEN 1 ELSE 0 END) AS todo,
            SUM(CASE WHEN estado = 'in-progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN estado = 'completed' THEN 1 ELSE 0 END) AS completed
          FROM tareas
          WHERE proyecto_id = ?;
        `,
        args: [proyectoId],
      });

      const sRows = castRows<{
        total: number | bigint | null;
        todo: number | bigint | null;
        in_progress: number | bigint | null;
        completed: number | bigint | null;
      }>(sRes.rows);

      const row = sRows[0] ?? {
        total: 0,
        todo: 0,
        in_progress: 0,
        completed: 0,
      };

      const total = Number(row.total ?? 0);
      const todo = Number(row.todo ?? 0);
      const inProgress = Number(row.in_progress ?? 0);
      const completed = Number(row.completed ?? 0);
      const porcentajeCompletado =
        total > 0 ? Math.round((completed / total) * 100) : 0;

      estadisticasTareas = {
        total,
        todo,
        'in-progress': inProgress,
        completed,
        porcentajeCompletado,
      };
    }

    // 6) codigo_union solo si es miembro
    const codigo_union = esMiembro ? (proyecto.codigo_union ?? null) : null;

    // 7) creador siempre
    const creadorInfo =
      (await fetchUsuarioBasicoById(creadorIdRaw)) ?? {
        nombre: '—',
        apellido: null,
        email: '—',
        pais: null,
      };

    // 8) miembros
    let miembros: any[] = [];

    if (!esPrivadoYNoMiembro) {
      const puRes = await db.execute({
        sql: `
          SELECT
            pu.usuario_id,
            pu.rol_en_proyecto,
            pu.fecha_union,
            u.nombre,
            u.apellido,
            u.email
          FROM proyecto_usuarios pu
          JOIN usuarios u
            ON LOWER(TRIM(CAST(u.id AS TEXT))) = LOWER(TRIM(CAST(pu.usuario_id AS TEXT)))
          WHERE pu.proyecto_id = ?
          ORDER BY pu.fecha_union DESC;
        `,
        args: [proyectoId],
      });

      const puRows = castRows<MiembroPreviewRow>(puRes.rows);
      const map = new Map<string, any>();

      for (const row of puRows) {
        const uid = normId(row.usuario_id);

        map.set(uid, {
          id: String(row.usuario_id),
          nombre: String(row.nombre ?? '—') || '—',
          apellido: row.apellido ? String(row.apellido) : null,
          email: String(row.email ?? '—') || '—',
          rol: mapRol(row.rol_en_proyecto),
          fecha_union: row.fecha_union ?? null,
        });
      }

      if (!map.has(creadorId)) {
        map.set(creadorId, {
          id: String(creadorIdRaw),
          nombre: creadorInfo.nombre,
          apellido: creadorInfo.apellido,
          email: creadorInfo.email,
          rol: 'creador',
          fecha_union: proyecto.creado_en ?? null,
        });
      } else {
        const cur = map.get(creadorId);
        map.set(creadorId, { ...cur, rol: 'creador' });
      }

      miembros = Array.from(map.values());
      miembros.sort(
        (a, b) =>
          (a.rol === 'creador' ? -1 : 0) - (b.rol === 'creador' ? -1 : 0)
      );
    }

    const payload = {
      proyecto: {
        id:
          typeof proyecto.id === 'bigint'
            ? Number(proyecto.id)
            : Number(proyecto.id),
        nombre: proyecto.nombre,
        descripcion: proyecto.descripcion ?? null,
        prioridad: proyecto.prioridad,
        visibilidad: proyecto.visibilidad ?? null,
        modo_acceso: modoAcceso,
        fecha_inicio: proyecto.fecha_inicio ?? null,
        fecha_fin: proyecto.fecha_fin ?? null,
        creador_id: String(proyecto.creador_id ?? ''),
        creador: creadorInfo,
        creado_en: proyecto.creado_en ?? null,
        actualizado_en: proyecto.actualizado_en ?? null,
        codigo_union,
      },
      meta: {
        totalMiembros,
        esMiembro,
        canJoinDirect,
        canRequestInvite,
        puedeVerTareas,
      },
      tareas: puedeVerTareas ? tareas : [],
      estadisticasTareas,
      miembros,
      ...(isDev
        ? {
            debug: {
              modoAcceso,
              esMiembro,
              esPrivadoYNoMiembro,
              creador_id_raw: creadorIdRaw,
              creador_id_norm: creadorId,
              user_id_norm: userId,
              totalMiembrosRaw,
              miembrosReturned: miembros.length,
            },
          }
        : {}),
    };

    return NextResponse.json(
      {
        ok: true,
        data: payload,
        ...payload,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error('GET preview proyecto error:', e);
    return NextResponse.json(
      {
        ok: false,
        error: 'Error interno',
        ...(isDev
          ? { debug: { message: e instanceof Error ? e.message : String(e) } }
          : {}),
      },
      { status: 500 }
    );
  }
}