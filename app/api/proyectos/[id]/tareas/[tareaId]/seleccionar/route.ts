// app/api/proyectos/[id]/tareas/[tareaId]/seleccionar/route.ts

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

type TareaRow = {
  id: string;
  estado: string | null;
  max_participantes: number | bigint | null;
  proyecto_id: number | bigint | null;
};

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
};

type IdRow = {
  id: string;
};

type CountRow = {
  c: number | bigint | null;
};

/**
 * =========================================================
 * 🔄 HELPERS
 * =========================================================
 */

function castRows<T>(rows: unknown[]): T[] {
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
    value === 'en_progreso' ||
    value === 'en progreso'
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
 * POST /api/proyectos/[id]/tareas/[tareaId]/seleccionar
 * =========================================================
 *
 * Selecciona una tarea para el usuario autenticado.
 *
 * IMPORTANTE:
 *
 * Seleccionar NO inicia el cronómetro.
 *
 * Solo crea o reactiva la asignación.
 *
 * El cronómetro comenzará posteriormente mediante:
 *
 * /comenzar
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

    const now =
      new Date().toISOString();

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
            max_participantes,
            proyecto_id
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
     * No permitimos seleccionar tareas cerradas
     * o pendientes de revisión.
     */
    if (
      estadoTarea === 'completed'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes seleccionar una tarea completada',
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
            'No puedes seleccionar una tarea que está en revisión',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * 📁 VALIDAR PROYECTO
     * =====================================================
     */
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
      proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Proyecto no existe',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 👑 VALIDAR OWNER / MEMBRESÍA
     * =====================================================
     */
    const esCreador =
      String(
        proyecto.creador_id ?? ''
      ) === userId;

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

    /**
     * Las tareas son internas.
     *
     * Un proyecto público NO permite que un externo
     * seleccione una tarea.
     */
    if (
      !esCreador &&
      !esMiembro
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Debes ser miembro del proyecto para seleccionar tareas',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 👥 MÁXIMO DE PARTICIPANTES
     * =====================================================
     */
    const maxParticipantesRaw =
      Number(
        tarea.max_participantes ?? 1
      );

    const maxParticipantes =
      Number.isInteger(
        maxParticipantesRaw
      ) &&
      maxParticipantesRaw > 0
        ? maxParticipantesRaw
        : 1;

    /**
     * =====================================================
     * 🔎 COMPROBAR ASIGNACIÓN ACTIVA EXISTENTE
     * =====================================================
     */
    const yaActivoRes =
      await db.execute({
        sql: `
          SELECT id
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

    const yaActivoRows =
      castRows<IdRow>(
        yaActivoRes.rows
      );

    const asignacionActiva =
      yaActivoRows[0];

    /**
     * =====================================================
     * ✅ YA ESTABA SELECCIONADA
     * =====================================================
     *
     * No generamos otra asignación.
     *
     * Tampoco modificamos iniciado_en.
     */
    if (asignacionActiva) {
      const activosRes =
        await db.execute({
          sql: `
            SELECT COUNT(*) AS c
            FROM tarea_asignaciones
            WHERE tarea_id = ?
              AND estado = 'activo'
          `,
          args: [
            String(tareaId),
          ],
        });

      const activosRows =
        castRows<CountRow>(
          activosRes.rows
        );

      const activos =
        Number(
          activosRows[0]?.c ?? 0
        );

      const payload = {
        ya_estaba_activo: true,

        activos,

        max_participantes:
          maxParticipantes,
      };

      return NextResponse.json(
        {
          ok: true,
          data: payload,
          ...payload,
        },
        { status: 200 }
      );
    }

    /**
     * =====================================================
     * 📊 COMPROBAR CUPO
     * =====================================================
     */
    const countRes =
      await db.execute({
        sql: `
          SELECT COUNT(*) AS c
          FROM tarea_asignaciones
          WHERE tarea_id = ?
            AND estado = 'activo'
        `,
        args: [
          String(tareaId),
        ],
      });

    const countRows =
      castRows<CountRow>(
        countRes.rows
      );

    const activos =
      Number(
        countRows[0]?.c ?? 0
      );

    if (
      activos >= maxParticipantes
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cupo lleno',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * ♻️ BUSCAR ASIGNACIÓN ANTERIOR
     * =====================================================
     *
     * Puede existir una asignación cancelada
     * anteriormente.
     */
    const previaRes =
      await db.execute({
        sql: `
          SELECT id
          FROM tarea_asignaciones
          WHERE tarea_id = ?
            AND CAST(usuario_id AS TEXT)
              = CAST(? AS TEXT)
          ORDER BY creado_en DESC
          LIMIT 1
        `,
        args: [
          String(tareaId),
          userId,
        ],
      });

    const previaRows =
      castRows<IdRow>(
        previaRes.rows
      );

    const asignacionPrevia =
      previaRows[0];

    /**
     * =====================================================
     * ♻️ REACTIVAR ASIGNACIÓN
     * =====================================================
     */
    if (asignacionPrevia) {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET
            estado = 'activo',
            seleccionado_en = ?,
            iniciado_en = NULL,
            completado_en = NULL,
            cancelado_en = NULL
          WHERE id = ?
        `,
        args: [
          now,
          String(
            asignacionPrevia.id
          ),
        ],
      });

      const activosLuegoRes =
        await db.execute({
          sql: `
            SELECT COUNT(*) AS c
            FROM tarea_asignaciones
            WHERE tarea_id = ?
              AND estado = 'activo'
          `,
          args: [
            String(tareaId),
          ],
        });

      const activosLuegoRows =
        castRows<CountRow>(
          activosLuegoRes.rows
        );

      const activosLuego =
        Number(
          activosLuegoRows[0]?.c ??
            0
        );

      const payload = {
        reactivada: true,

        activos:
          activosLuego,

        max_participantes:
          maxParticipantes,
      };

      return NextResponse.json(
        {
          ok: true,
          data: payload,
          ...payload,
        },
        { status: 200 }
      );
    }

    /**
     * =====================================================
     * ➕ CREAR NUEVA ASIGNACIÓN
     * =====================================================
     *
     * IMPORTANTE:
     *
     * iniciado_en queda NULL porque seleccionar
     * no significa comenzar a trabajar.
     */
    const asignacionId =
      randomUUID();

    await db.execute({
      sql: `
        INSERT INTO tarea_asignaciones (
          id,
          tarea_id,
          usuario_id,
          rol,
          estado,
          creado_en,
          seleccionado_en
        )
        VALUES (
          ?,
          ?,
          ?,
          'miembro',
          'activo',
          ?,
          ?
        )
      `,
      args: [
        asignacionId,
        String(tareaId),
        userId,
        now,
        now,
      ],
    });

    /**
     * =====================================================
     * 📊 RECALCULAR PARTICIPANTES
     * =====================================================
     */
    const activosFinalRes =
      await db.execute({
        sql: `
          SELECT COUNT(*) AS c
          FROM tarea_asignaciones
          WHERE tarea_id = ?
            AND estado = 'activo'
        `,
        args: [
          String(tareaId),
        ],
      });

    const activosFinalRows =
      castRows<CountRow>(
        activosFinalRes.rows
      );

    const activosFinal =
      Number(
        activosFinalRows[0]?.c ??
          0
      );

    const payload = {
      asignacion_id:
        asignacionId,

      activos:
        activosFinal,

      max_participantes:
        maxParticipantes,
    };

    /**
     * =====================================================
     * ✅ RESPUESTA
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        message:
          'Tarea seleccionada correctamente',

        data: payload,
        ...payload,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    /**
     * Puede ocurrir si dos solicitudes intentan
     * crear la misma asignación simultáneamente.
     */
    if (
      message
        .toLowerCase()
        .includes('unique') ||
      message
        .toLowerCase()
        .includes('constraint')
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Ya tienes una selección activa o el cupo fue ocupado al mismo tiempo',
        },
        { status: 409 }
      );
    }

    console.error(
      'POST /api/proyectos/[id]/tareas/[tareaId]/seleccionar error:',
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