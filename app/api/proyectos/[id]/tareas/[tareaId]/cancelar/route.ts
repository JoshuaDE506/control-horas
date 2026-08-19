// app/api/proyectos/[id]/tareas/[tareaId]/informes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

/**
 * =========================================================
 * 📌 TIPOS AUXILIARES
 * =========================================================
 */

type EstadoTarea =
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'completed';

type TipoInforme =
  | 'avance'
  | 'final';

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
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

/**
 * =========================================================
 * 🔄 HELPERS
 * =========================================================
 */

function castRows<T>(
  rows: unknown[]
): T[] {
  return rows as T[];
}

function toProjectId(
  value: string
): number | null {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return null;
  }

  return parsed;
}

/**
 * =========================================================
 * 📋 NORMALIZAR ESTADO
 * =========================================================
 */
function normalizeEstado(
  raw: unknown
): EstadoTarea {
  const value = String(raw ?? '')
    .toLowerCase()
    .trim();

  if (
    value === 'in-progress' ||
    value === 'in_progress' ||
    value === 'en progreso' ||
    value === 'en_progreso'
  ) {
    return 'in-progress';
  }

  if (
    value === 'review' ||
    value === 'revision' ||
    value === 'revisión'
  ) {
    return 'review';
  }

  if (
    value === 'completed' ||
    value === 'completado' ||
    value === 'completada'
  ) {
    return 'completed';
  }

  return 'todo';
}

/**
 * =========================================================
 * 📄 NORMALIZAR TIPO DE INFORME
 * =========================================================
 */
function normalizeTipoInforme(
  raw: unknown
): TipoInforme | null {
  const value = String(raw ?? '')
    .toLowerCase()
    .trim();

  if (value === 'avance') {
    return 'avance';
  }

  if (value === 'final') {
    return 'final';
  }

  return null;
}

/**
 * =========================================================
 * 📦 MAPEAR INFORME
 * =========================================================
 */
function mapInforme(
  row: InformeRow
) {
  return {
    id:
      String(row.id),

    tarea_id:
      String(row.tarea_id),

    usuario_id:
      String(row.usuario_id),

    tipo:
      normalizeTipoInforme(
        row.tipo
      ),

    titulo:
      row.titulo ?? '',

    descripcion:
      row.descripcion ?? '',

    url_archivo:
      row.url_archivo ?? null,

    creado_en:
      row.creado_en ?? null,
  };
}

/**
 * =========================================================
 * 🔐 VALIDAR ACCESO AL PROYECTO
 * =========================================================
 *
 * Los informes forman parte de la información interna.
 *
 * Solo pueden acceder:
 *
 * - owner
 * - admin
 * - miembro
 */
async function validarAccesoProyecto(
  proyectoId: number,
  userId: string
): Promise<{
  proyecto: ProyectoRow | null;
  esCreador: boolean;
  esMiembro: boolean;
}> {
  const proyectoRes =
    await db.execute({
      sql: `
        SELECT
          id,
          creador_id
        FROM proyectos
        WHERE id = ?
        LIMIT 1
      `,
      args: [proyectoId],
    });

  const proyectoRows =
    castRows<ProyectoRow>(
      proyectoRes.rows
    );

  const proyecto =
    proyectoRows[0] ?? null;

  if (!proyecto) {
    return {
      proyecto: null,
      esCreador: false,
      esMiembro: false,
    };
  }

  const esCreador =
    String(
      proyecto.creador_id ?? ''
    ) === String(userId);

  const memberRes =
    await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT)
            = CAST(? AS TEXT)
        LIMIT 1
      `,
      args: [
        proyectoId,
        userId,
      ],
    });

  const esMiembro =
    Boolean(
      memberRes.rows?.length
    );

  return {
    proyecto,
    esCreador,
    esMiembro,
  };
}

/**
 * =========================================================
 * GET /api/proyectos/[id]/tareas/[tareaId]/informes
 * =========================================================
 *
 * Lista todos los informes asociados a una tarea.
 */
export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      tareaId: string;
    }>;
  }
) {
  try {
    /**
     * =====================================================
     * 🔐 VALIDAR USUARIO
     * =====================================================
     */
    const sessionUser =
      await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No autenticado',
        },
        { status: 401 }
      );
    }

    const userId =
      String(sessionUser.id);

    /**
     * =====================================================
     * 📁 VALIDAR PARÁMETROS
     * =====================================================
     */
    const {
      id,
      tareaId,
    } = await params;

    const proyectoId =
      toProjectId(id);

    if (
      proyectoId == null ||
      !tareaId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Parámetros inválidos',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 📋 VALIDAR TAREA
     * =====================================================
     */
    const tareaRes =
      await db.execute({
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
        args: [
          String(tareaId),
          proyectoId,
        ],
      });

    const tareaRows =
      castRows<TareaRow>(
        tareaRes.rows
      );

    const tarea =
      tareaRows[0];

    if (!tarea) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Tarea no existe',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 🔐 VALIDAR ACCESO AL PROYECTO
     * =====================================================
     */
    const acceso =
      await validarAccesoProyecto(
        proyectoId,
        userId
      );

    if (!acceso.proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no existe',
        },
        { status: 404 }
      );
    }

    if (
      !acceso.esCreador &&
      !acceso.esMiembro
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sin acceso a los informes de esta tarea',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 📄 OBTENER INFORMES
     * =====================================================
     */
    const informesRes =
      await db.execute({
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
        args: [
          String(tareaId),
        ],
      });

    const informes =
      castRows<InformeRow>(
        informesRes.rows
      ).map(
        mapInforme
      );

    /**
     * =====================================================
     * ✅ RESPUESTA
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        informes,

        meta: {
          estado_tarea:
            normalizeEstado(
              tarea.estado
            ),

          comentario_revision:
            tarea
              .ultimo_rechazo_comentario ??
            null,

          es_creador:
            acceso.esCreador,

          es_miembro:
            true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/proyectos/[id]/tareas/[tareaId]/informes error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * POST /api/proyectos/[id]/tareas/[tareaId]/informes
 * =========================================================
 *
 * Permite subir:
 *
 * - informe de avance
 * - informe final
 *
 * El usuario debe:
 *
 * - formar parte del proyecto
 * - estar asignado activamente a la tarea
 * - haber comenzado la tarea
 *
 * IMPORTANTE:
 *
 * Crear un informe final NO cambia automáticamente
 * el estado de la tarea a review.
 *
 * /completar sigue siendo la ruta encargada de:
 *
 * in-progress → review
 *
 * y de detener el cronómetro.
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      id: string;
      tareaId: string;
    }>;
  }
) {
  try {
    /**
     * =====================================================
     * 🔐 VALIDAR USUARIO
     * =====================================================
     */
    const sessionUser =
      await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No autenticado',
        },
        { status: 401 }
      );
    }

    const userId =
      String(sessionUser.id);

    /**
     * =====================================================
     * 📁 VALIDAR PARÁMETROS
     * =====================================================
     */
    const {
      id,
      tareaId,
    } = await params;

    const proyectoId =
      toProjectId(id);

    if (
      proyectoId == null ||
      !tareaId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Parámetros inválidos',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 📝 LEER INFORME
     * =====================================================
     */
    const body =
      await req
        .json()
        .catch(() => ({}));

    const tipo =
      normalizeTipoInforme(
        body?.tipo
      );

    const titulo =
      typeof body?.titulo === 'string'
        ? body.titulo.trim()
        : '';

    const descripcion =
      typeof body?.descripcion === 'string'
        ? body.descripcion.trim()
        : '';

    const archivoUrl =
      typeof body?.url_archivo === 'string' &&
      body.url_archivo.trim()
        ? body.url_archivo.trim()
        : null;

    /**
     * =====================================================
     * ✅ VALIDACIONES DEL INFORME
     * =====================================================
     */
    if (!tipo) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El tipo de informe es inválido',
        },
        { status: 400 }
      );
    }

    if (!titulo) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El título del informe es obligatorio',
        },
        { status: 400 }
      );
    }

    if (!descripcion) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'La descripción del informe es obligatoria',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 🔐 VALIDAR PROYECTO
     * =====================================================
     */
    const acceso =
      await validarAccesoProyecto(
        proyectoId,
        userId
      );

    if (!acceso.proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no existe',
        },
        { status: 404 }
      );
    }

    if (
      !acceso.esCreador &&
      !acceso.esMiembro
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sin acceso a este proyecto',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 📋 VALIDAR TAREA
     * =====================================================
     */
    const tareaRes =
      await db.execute({
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
        args: [
          String(tareaId),
          proyectoId,
        ],
      });

    const tareaRows =
      castRows<TareaRow>(
        tareaRes.rows
      );

    const tarea =
      tareaRows[0];

    if (!tarea) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Tarea no existe',
        },
        { status: 404 }
      );
    }

    const estadoTarea =
      normalizeEstado(
        tarea.estado
      );

    /**
     * =====================================================
     * 🔒 VALIDAR ESTADO
     * =====================================================
     */
    if (
      estadoTarea ===
      'completed'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes crear informes para una tarea completada',
        },
        { status: 409 }
      );
    }

    if (
      estadoTarea === 'review'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes crear informes mientras la tarea está en revisión',
        },
        { status: 409 }
      );
    }

    /**
     * Una tarea en "todo" todavía no ha comenzado.
     */
    if (
      estadoTarea !==
      'in-progress'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Debes comenzar la tarea antes de crear informes',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * 👤 VALIDAR ASIGNACIÓN ACTIVA
     * =====================================================
     */
    const asignacionRes =
      await db.execute({
        sql: `
          SELECT
            id,
            iniciado_en
          FROM tarea_asignaciones
          WHERE tarea_id = ?
            AND CAST(usuario_id AS TEXT)
              = CAST(? AS TEXT)
            AND estado = 'activo'
          LIMIT 1
        `,
        args: [
          String(tareaId),
          userId,
        ],
      });

    const asignacion =
      asignacionRes.rows?.[0] as
        | {
            id?: string;
            iniciado_en?: string | null;
          }
        | undefined;

    if (!asignacion) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No estás asignado activamente a esta tarea',
        },
        { status: 403 }
      );
    }

    /**
     * Además de seleccionarla, debe haber iniciado
     * realmente el trabajo.
     */
    if (!asignacion.iniciado_en) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Debes comenzar la tarea antes de crear informes',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * ➕ CREAR INFORME
     * =====================================================
     */
    const informeId =
      randomUUID();

    const now =
      new Date().toISOString();

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
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `,
      args: [
        informeId,
        String(tareaId),
        userId,
        tipo,
        titulo,
        descripcion,
        archivoUrl,
        now,
      ],
    });

    /**
     * =====================================================
     * 🧹 LIMPIAR COMENTARIO DE RECHAZO
     * =====================================================
     *
     * Si el colaborador volvió a trabajar tras un rechazo
     * y presenta un nuevo informe, eliminamos el comentario
     * pendiente de la tarea.
     *
     * El historial conserva el rechazo anterior.
     */
    await db.execute({
      sql: `
        UPDATE tareas
        SET
          ultimo_rechazo_comentario = NULL,
          actualizado_en = ?
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [
        now,
        String(tareaId),
        proyectoId,
      ],
    });

    /**
     * =====================================================
     * 📜 HISTORIAL
     * =====================================================
     */
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
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
        `,
        args: [
          randomUUID(),
          String(tareaId),
          userId,
          estadoTarea,
          estadoTarea,
          tipo === 'final'
            ? 'Subió informe final'
            : 'Subió informe de avance',
          now,
        ],
      });
    } catch (error) {
      console.warn(
        'No se pudo insertar en tarea_historial:',
        error
      );
    }

    /**
     * =====================================================
     * 🔎 RECARGAR INFORME
     * =====================================================
     */
    const informeRes =
      await db.execute({
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
        args: [
          informeId,
        ],
      });

    const informeRows =
      castRows<InformeRow>(
        informeRes.rows
      );

    const informe =
      informeRows[0]
        ? mapInforme(
            informeRows[0]
          )
        : null;

    if (!informe) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El informe fue guardado, pero no pudo recargarse',
        },
        { status: 500 }
      );
    }

    /**
     * =====================================================
     * ✅ RESPUESTA
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        message:
          'Informe guardado correctamente',

        data: {
          informe,
        },

        informe,

        meta: {
          estado_tarea:
            estadoTarea,

          requiere_envio_revision:
            tipo === 'final',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/tareas/[tareaId]/informes error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}