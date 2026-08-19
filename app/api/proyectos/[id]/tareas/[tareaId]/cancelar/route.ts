// app/api/proyectos/[id]/tareas/[tareaId]/cancelar/route.ts

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

type Params = {
  id: string;
  tareaId: string;
};

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

type CountRow = {
  c: number | bigint | null;
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

async function getParams(
  context: {
    params:
      | Params
      | Promise<Params>;
  }
): Promise<Params> {
  return await context.params;
}

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
 * POST /api/proyectos/[id]/tareas/[tareaId]/cancelar
 * =========================================================
 *
 * Cancela la participación del usuario actual.
 *
 * Flujo:
 *
 * selección activa
 *      ↓
 * cancelar
 *      ↓
 * registro_horas = finalizado
 *      ↓
 * tarea_asignaciones.estado = cancelado
 *
 * Luego se revisa si quedan otros participantes trabajando.
 *
 * Si queda alguien trabajando:
 *   tarea = in-progress
 *
 * Si nadie está trabajando:
 *   tarea = todo
 */
export async function POST(
  req: NextRequest,
  context: {
    params:
      | Params
      | Promise<Params>;
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
    } = await getParams(
      context
    );

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
        args: [
          proyectoId,
        ],
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

    if (
      !esCreador &&
      !esMiembro
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
     * No se puede cancelar una tarea ya finalizada.
     */
    if (
      estadoAnterior ===
      'completed'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes cancelar una tarea completada',
        },
        { status: 409 }
      );
    }

    /**
     * Durante review se espera decisión del supervisor.
     */
    if (
      estadoAnterior ===
      'review'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No puedes cancelar una tarea que está en revisión',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * 👤 OBTENER ASIGNACIÓN ACTIVA
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
            'No tienes una selección activa en esta tarea',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * ⏱️ CERRAR REGISTRO DE HORAS
     * =====================================================
     *
     * Si el usuario había comenzado a trabajar,
     * cerramos su bloque de tiempo.
     *
     * Si solo seleccionó pero nunca comenzó,
     * probablemente no exista registro_horas.
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
       * Si estaba activo, sumamos el tramo abierto.
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
         * Si estaba pausado, el tiempo ya estaba
         * acumulado.
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
     * ❌ CANCELAR ASIGNACIÓN
     * =====================================================
     *
     * completado_en NO se establece.
     *
     * El usuario abandonó la tarea; no la completó.
     */
    await db.execute({
      sql: `
        UPDATE tarea_asignaciones
        SET
          estado = 'cancelado',
          cancelado_en = ?,
          completado_en = NULL
        WHERE id = ?
      `,
      args: [
        now,
        String(
          asignacion.id
        ),
      ],
    });

    /**
     * =====================================================
     * 👷 CONTAR PARTICIPANTES TRABAJANDO
     * =====================================================
     *
     * Solo cuentan como trabajando los participantes:
     *
     * - activos
     * - que ya iniciaron
     * - que no están completados
     */
    const trabajandoRes =
      await db.execute({
        sql: `
          SELECT
            COUNT(*) AS c
          FROM tarea_asignaciones
          WHERE tarea_id = ?
            AND estado = 'activo'
            AND iniciado_en IS NOT NULL
            AND completado_en IS NULL
        `,
        args: [
          String(tareaId),
        ],
      });

    const trabajandoRows =
      castRows<CountRow>(
        trabajandoRes.rows
      );

    const trabajando =
      toNumber(
        trabajandoRows[0]?.c
      );

    /**
     * =====================================================
     * 👥 CONTAR ASIGNACIONES ACTIVAS
     * =====================================================
     */
    const activosRes =
      await db.execute({
        sql: `
          SELECT
            COUNT(*) AS c
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
      toNumber(
        activosRows[0]?.c
      );

    /**
     * =====================================================
     * 📋 RECALCULAR ESTADO DE LA TAREA
     * =====================================================
     *
     * Si todavía existe alguien trabajando:
     *
     * in-progress
     *
     * Si nadie está trabajando:
     *
     * todo
     *
     * Puede haber usuarios que solo hayan seleccionado
     * la tarea. Eso no significa que ya haya comenzado.
     */
    const nuevoEstado:
      EstadoTarea =
      trabajando > 0
        ? 'in-progress'
        : 'todo';

    await db.execute({
      sql: `
        UPDATE tareas
        SET
          estado = ?,
          actualizado_en = ?
        WHERE id = ?
          AND proyecto_id = ?
      `,
      args: [
        nuevoEstado,
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
          nuevoEstado,
          'Canceló selección',
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
     * 👥 RECARGAR ASIGNADOS ACTIVOS
     * =====================================================
     */
    const asignadosRes =
      await db.execute({
        sql: `
          SELECT
            u.id,
            u.nombre,
            u.apellido,
            u.email,

            COALESCE(
              ta.seleccionado_en,
              ta.creado_en
            ) AS seleccionada_at,

            ta.iniciado_en,
            ta.completado_en

          FROM tarea_asignaciones ta

          JOIN usuarios u
            ON CAST(u.id AS TEXT)
             = CAST(ta.usuario_id AS TEXT)

          WHERE ta.tarea_id = ?
            AND ta.estado = 'activo'

          ORDER BY
            ta.creado_en ASC
        `,
        args: [
          String(tareaId),
        ],
      });

    /**
     * =====================================================
     * 📊 TOTAL DE TIEMPO DEL USUARIO EN LA TAREA
     * =====================================================
     *
     * Aunque haya cancelado, el tiempo realmente trabajado
     * se conserva para reportes.
     */
    const totalHorasRes =
      await db.execute({
        sql: `
          SELECT
            COALESCE(
              SUM(total_segundos),
              0
            ) AS total_segundos
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

    const totalRow =
      totalHorasRes.rows?.[0] as
        | {
            total_segundos?:
              | number
              | bigint
              | null;
          }
        | undefined;

    const totalSegundos =
      Number(
        totalRow?.total_segundos ??
          0
      );

    /**
     * =====================================================
     * 📦 RESPUESTA
     * =====================================================
     */
    const payload = {
      asignados:
        asignadosRes.rows ?? [],

      activos,

      trabajando,

      estado:
        nuevoEstado,

      cancelado_en:
        now,

      total_segundos:
        totalSegundos,
    };

    return NextResponse.json(
      {
        ok: true,

        message:
          'Selección cancelada correctamente',

        data:
          payload,

        ...payload,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/tareas/[tareaId]/cancelar error:',
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