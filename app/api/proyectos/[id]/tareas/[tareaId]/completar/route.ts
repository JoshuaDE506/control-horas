// app/api/proyectos/[id]/tareas/[tareaId]/completar/route.ts

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

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
};

type TareaRow = {
  id: string;
  estado: string | null;
};

type AsignacionRow = {
  id: string;
  iniciado_en: string | null;
  completado_en: string | null;
};

type RegistroHorasRow = {
  id: string;
  iniciado_en: string | null;
  pausado_en: string | null;
  detenido_en: string | null;
  total_segundos: number | bigint | null;
  estado: string | null;
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

function toNumber(
  value:
    | number
    | bigint
    | null
    | undefined
): number {
  if (value == null) {
    return 0;
  }

  return Number(value);
}

/**
 * =========================================================
 * 📋 NORMALIZAR ESTADO DE TAREA
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
 * ⏱️ CALCULAR SEGUNDOS
 * =========================================================
 */
function diffSeconds(
  fromIso: string,
  toIso: string
): number {
  const from =
    new Date(fromIso).getTime();

  const to =
    new Date(toIso).getTime();

  if (
    !Number.isFinite(from) ||
    !Number.isFinite(to)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (to - from) / 1000
    )
  );
}

/**
 * =========================================================
 * POST /api/proyectos/[id]/tareas/[tareaId]/completar
 * =========================================================
 *
 * IMPORTANTE:
 *
 * Esta ruta NO completa definitivamente la tarea.
 *
 * Su función real es:
 *
 * in-progress
 *      ↓
 * review
 *
 * Al enviar a revisión:
 *
 * - Se detiene el registro de horas actual.
 * - La asignación continúa activa.
 * - completado_en permanece NULL.
 * - El usuario queda esperando aprobación/rechazo.
 *
 * Si se aprueba:
 * - /aprobar marcará completed.
 *
 * Si se rechaza:
 * - /rechazar devolverá la tarea a in-progress.
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
          error:
            'No autenticado',
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
     * 👥 VALIDAR MEMBRESÍA
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
     */
    if (
      !esCreador &&
      !esMiembro
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Debes ser miembro del proyecto para enviar esta tarea a revisión',
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
            estado
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

    const estadoAnterior =
      normalizeEstado(
        tarea.estado
      );

    /**
     * =====================================================
     * 🔒 VALIDAR ESTADO
     * =====================================================
     */
    if (
      estadoAnterior === 'completed'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'La tarea ya está completada',
        },
        { status: 409 }
      );
    }

    if (
      estadoAnterior === 'review'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'La tarea ya fue enviada a revisión',
        },
        { status: 409 }
      );
    }

    if (
      estadoAnterior !==
      'in-progress'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo puedes enviar a revisión una tarea en progreso',
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
            iniciado_en,
            completado_en
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

    const asignacionRows =
      castRows<AsignacionRow>(
        asignacionRes.rows
      );

    const asignacion =
      asignacionRows[0];

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
     * =====================================================
     * ▶️ VALIDAR QUE REALMENTE HAYA COMENZADO
     * =====================================================
     *
     * No permitimos enviar a revisión una tarea
     * únicamente seleccionada.
     */
    if (!asignacion.iniciado_en) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Debes comenzar la tarea antes de enviarla a revisión',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * 🧹 LIMPIAR completado_en ANTIGUO
     * =====================================================
     *
     * Versiones anteriores marcaban completado_en
     * al enviar a revisión.
     *
     * Ahora ese campo queda reservado para aprobación.
     */
    if (asignacion.completado_en) {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET completado_en = NULL
          WHERE id = ?
        `,
        args: [
          String(
            asignacion.id
          ),
        ],
      });
    }

    /**
     * =====================================================
     * ⏱️ OBTENER REGISTRO ACTIVO/PAUSADO
     * =====================================================
     */
    const registroRes =
      await db.execute({
        sql: `
          SELECT
            id,
            iniciado_en,
            pausado_en,
            detenido_en,
            total_segundos,
            estado
          FROM registro_horas
          WHERE tarea_id = ?
            AND CAST(usuario_id AS TEXT)
              = CAST(? AS TEXT)
            AND estado IN (
              'activo',
              'pausado'
            )
          ORDER BY creado_en DESC
          LIMIT 1
        `,
        args: [
          String(tareaId),
          userId,
        ],
      });

    const registroRows =
      castRows<RegistroHorasRow>(
        registroRes.rows
      );

    const registro =
      registroRows[0];

    /**
     * =====================================================
     * ⏹️ DETENER CRONÓMETRO
     * =====================================================
     *
     * review significa que el usuario dejó de trabajar
     * y está esperando revisión.
     */
    if (registro) {
      const registroEstado =
        String(
          registro.estado ?? ''
        )
          .toLowerCase()
          .trim();

      const totalActual =
        toNumber(
          registro.total_segundos
        );

      /**
       * Si estaba activo sumamos el tramo actual.
       */
      if (
        registroEstado ===
          'activo' &&
        registro.iniciado_en
      ) {
        const extra =
          diffSeconds(
            registro.iniciado_en,
            now
          );

        await db.execute({
          sql: `
            UPDATE registro_horas
            SET
              total_segundos = ?,
              iniciado_en = NULL,
              pausado_en = NULL,
              detenido_en = ?,
              estado = 'finalizado'
            WHERE id = ?
          `,
          args: [
            totalActual + extra,
            now,
            String(registro.id),
          ],
        });
      } else {
        /**
         * Si estaba pausado, el total ya estaba
         * acumulado previamente.
         */
        await db.execute({
          sql: `
            UPDATE registro_horas
            SET
              iniciado_en = NULL,
              pausado_en = NULL,
              detenido_en = ?,
              estado = 'finalizado'
            WHERE id = ?
          `,
          args: [
            now,
            String(registro.id),
          ],
        });
      }
    }

    /**
     * =====================================================
     * 📋 CAMBIAR TAREA A REVIEW
     * =====================================================
     */
    await db.execute({
      sql: `
        UPDATE tareas
        SET
          estado = 'review',
          fecha_envio_revision = ?,
          ultimo_rechazo_comentario = NULL,
          actualizado_en = ?
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [
        now,
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
          estadoAnterior,
          'review',
          'Tarea enviada a revisión',
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
     * 📊 OBTENER TOTAL ACUMULADO DEL USUARIO
     * =====================================================
     *
     * Puede haber varios registros_horas porque una tarea
     * puede ser rechazada y retomada varias veces.
     */
    const totalHorasRes =
      await db.execute({
        sql: `
          SELECT
            COALESCE(
              SUM(total_segundos),
              0
            ) AS total
          FROM registro_horas
          WHERE tarea_id = ?
            AND CAST(usuario_id AS TEXT)
              = CAST(? AS TEXT)
        `,
        args: [
          String(tareaId),
          userId,
        ],
      });

    const totalRows =
      castRows<{
        total:
          | number
          | bigint
          | null;
      }>(
        totalHorasRes.rows
      );

    const totalSegundos =
      Number(
        totalRows[0]?.total ?? 0
      );

    /**
     * =====================================================
     * ✅ RESPUESTA FINAL
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        message:
          'Tarea enviada a revisión correctamente',

        estado:
          'review',

        review_sent_at:
          now,

        /**
         * Ya NO devolvemos completado_en = now.
         *
         * La participación aún no ha sido
         * aprobada definitivamente.
         */
        completado_en:
          null,

        total_segundos:
          totalSegundos,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/tareas/[tareaId]/completar error:',
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