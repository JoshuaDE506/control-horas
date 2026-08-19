// app/api/proyectos/[id]/tareas/[tareaId]/comenzar/route.ts

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

type EstadoRegistroHoras =
  | 'activo'
  | 'pausado'
  | 'finalizado';

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
};

type TareaRow = {
  id: string;
  proyecto_id: number | bigint | null;
  estado: string | null;
  fecha_inicio_trabajo: string | null;
};

type AsignacionRow = {
  id: string;
  iniciado_en: string | null;
  completado_en: string | null;
  estado: string | null;
};

type RegistroHorasRow = {
  id: string;
  iniciado_en: string | null;
  pausado_en: string | null;
  detenido_en: string | null;
  total_segundos: number | bigint | null;
  estado: string | null;
  creado_en: string | null;
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

function toSafeNumber(
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
 * ⏱️ NORMALIZAR ESTADO DEL REGISTRO DE HORAS
 * =========================================================
 */
function normalizeEstadoRegistro(
  raw: unknown
): EstadoRegistroHoras {
  const value = String(raw ?? '')
    .toLowerCase()
    .trim();

  if (value === 'pausado') {
    return 'pausado';
  }

  if (value === 'finalizado') {
    return 'finalizado';
  }

  return 'activo';
}

/**
 * =========================================================
 * POST /api/proyectos/[id]/tareas/[tareaId]/comenzar
 * =========================================================
 *
 * Flujo:
 *
 * seleccionar
 *    ↓
 * comenzar
 *    ↓
 * tarea = in-progress
 *    ↓
 * asignación.iniciado_en
 *    ↓
 * registro_horas = activo
 *
 * Si la tarea fue rechazada anteriormente:
 *
 * review → rechazo → in-progress
 *
 * el cronómetro NO se reactiva durante el rechazo.
 *
 * Se reactiva únicamente cuando el usuario vuelve
 * a ejecutar esta ruta.
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
            'Debes ser miembro del proyecto para comenzar esta tarea',
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
            proyecto_id,
            estado,
            fecha_inicio_trabajo
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

    const estadoActual =
      normalizeEstado(
        tarea.estado
      );

    /**
     * Tareas completadas no pueden reiniciarse.
     */
    if (
      estadoActual === 'completed'
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

    /**
     * Mientras esté en revisión el usuario
     * debe esperar aprobación o rechazo.
     */
    if (
      estadoActual === 'review'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'La tarea está en revisión y no puede comenzarse',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * 👤 VALIDAR ASIGNACIÓN
     * =====================================================
     *
     * El usuario debe haber seleccionado primero
     * la tarea.
     */
    const asignacionRes =
      await db.execute({
        sql: `
          SELECT
            id,
            iniciado_en,
            completado_en,
            estado
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
            'Debes seleccionar la tarea antes de comenzar',
          requiereSeleccion: true,
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * 🛡️ COMPATIBILIDAD CON DATOS ANTERIORES
     * =====================================================
     *
     * En la versión anterior, al enviar una tarea
     * a revisión se establecía completado_en.
     *
     * Si la tarea está nuevamente en in-progress,
     * significa que fue rechazada y debemos permitir
     * continuar.
     *
     * Limpiamos completado_en para evitar que datos
     * antiguos bloqueen al usuario.
     */
    if (
      estadoActual === 'in-progress' &&
      asignacion.completado_en
    ) {
      await db.execute({
        sql: `
          UPDATE tarea_asignaciones
          SET completado_en = NULL
          WHERE id = ?
        `,
        args: [
          String(asignacion.id),
        ],
      });
    }

    /**
     * =====================================================
     * ⏱️ MARCAR INICIO DE PARTICIPACIÓN
     * =====================================================
     *
     * iniciado_en representa cuándo el usuario comenzó
     * por primera vez su participación en la tarea.
     *
     * No se reemplaza al retomar una tarea rechazada.
     */
    await db.execute({
      sql: `
        UPDATE tarea_asignaciones
        SET
          iniciado_en = COALESCE(
            iniciado_en,
            ?
          ),
          completado_en = NULL
        WHERE id = ?
      `,
      args: [
        now,
        String(asignacion.id),
      ],
    });

    /**
     * =====================================================
     * 📋 CAMBIAR TAREA A IN-PROGRESS
     * =====================================================
     */
    if (
      estadoActual === 'todo'
    ) {
      await db.execute({
        sql: `
          UPDATE tareas
          SET
            estado = 'in-progress',
            fecha_inicio_trabajo =
              COALESCE(
                fecha_inicio_trabajo,
                ?
              ),
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
       * Historial.
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
            'todo',
            'in-progress',
            'Comenzó la tarea',
            now,
          ],
        });
      } catch (error) {
        console.warn(
          'No se pudo insertar en tarea_historial:',
          error
        );
      }
    } else if (
      estadoActual === 'in-progress' &&
      !tarea.fecha_inicio_trabajo
    ) {
      /**
       * Protección para registros antiguos.
       */
      await db.execute({
        sql: `
          UPDATE tareas
          SET
            fecha_inicio_trabajo =
              COALESCE(
                fecha_inicio_trabajo,
                ?
              ),
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
    }

    /**
     * =====================================================
     * ⏱️ BUSCAR ÚLTIMO REGISTRO DE HORAS
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
            estado,
            creado_en
          FROM registro_horas
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

    const registroRows =
      castRows<RegistroHorasRow>(
        registroRes.rows
      );

    const registro =
      registroRows[0];

    let registroFinalId: string;

    /**
     * =====================================================
     * ⏱️ NO EXISTE REGISTRO PREVIO
     * =====================================================
     *
     * Creamos el primer bloque de tiempo.
     */
    if (!registro) {
      registroFinalId =
        randomUUID();

      await db.execute({
        sql: `
          INSERT INTO registro_horas (
            id,
            tarea_id,
            usuario_id,
            iniciado_en,
            pausado_en,
            detenido_en,
            total_segundos,
            estado,
            creado_en
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            NULL,
            NULL,
            0,
            'activo',
            ?
          )
        `,
        args: [
          registroFinalId,
          String(tareaId),
          userId,
          now,
          now,
        ],
      });
    } else {
      const estadoRegistro =
        normalizeEstadoRegistro(
          registro.estado
        );

      /**
       * ===================================================
       * ▶️ REGISTRO PAUSADO
       * ===================================================
       *
       * Se retoma manteniendo el tiempo acumulado.
       */
      if (
        estadoRegistro === 'pausado'
      ) {
        registroFinalId =
          String(registro.id);

        await db.execute({
          sql: `
            UPDATE registro_horas
            SET
              iniciado_en = ?,
              pausado_en = NULL,
              detenido_en = NULL,
              estado = 'activo'
            WHERE id = ?
          `,
          args: [
            now,
            registroFinalId,
          ],
        });
      }

      /**
       * ===================================================
       * ▶️ REGISTRO YA ACTIVO
       * ===================================================
       *
       * No reiniciamos el cronómetro.
       */
      else if (
        estadoRegistro === 'activo'
      ) {
        registroFinalId =
          String(registro.id);

        await db.execute({
          sql: `
            UPDATE registro_horas
            SET
              iniciado_en =
                COALESCE(
                  iniciado_en,
                  ?
                ),
              pausado_en = NULL,
              detenido_en = NULL,
              estado = 'activo'
            WHERE id = ?
          `,
          args: [
            now,
            registroFinalId,
          ],
        });
      }

      /**
       * ===================================================
       * 🔁 REGISTRO FINALIZADO
       * ===================================================
       *
       * Esto ocurre, por ejemplo, después de:
       *
       * trabajo → review → rechazo → continuar
       *
       * El registro anterior conserva sus segundos.
       * Creamos uno nuevo para contar únicamente
       * el nuevo período de trabajo.
       */
      else {
        registroFinalId =
          randomUUID();

        await db.execute({
          sql: `
            INSERT INTO registro_horas (
              id,
              tarea_id,
              usuario_id,
              iniciado_en,
              pausado_en,
              detenido_en,
              total_segundos,
              estado,
              creado_en
            )
            VALUES (
              ?,
              ?,
              ?,
              ?,
              NULL,
              NULL,
              0,
              'activo',
              ?
            )
          `,
          args: [
            registroFinalId,
            String(tareaId),
            userId,
            now,
            now,
          ],
        });
      }
    }

    /**
     * =====================================================
     * 🔎 OBTENER REGISTRO ACTUAL
     * =====================================================
     */
    const registroFinalRes =
      await db.execute({
        sql: `
          SELECT
            id,
            iniciado_en,
            pausado_en,
            detenido_en,
            total_segundos,
            estado,
            creado_en
          FROM registro_horas
          WHERE id = ?
          LIMIT 1
        `,
        args: [
          registroFinalId,
        ],
      });

    const registroFinalRows =
      castRows<RegistroHorasRow>(
        registroFinalRes.rows
      );

    const registroFinal =
      registroFinalRows[0] ??
      null;

    /**
     * =====================================================
     * 👥 OBTENER PARTICIPANTES ACTIVOS
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
     * 📦 RESPUESTA
     * =====================================================
     */
    const payload = {
      asignados:
        asignadosRes.rows ?? [],

      iniciado_en:
        registroFinal
          ?.iniciado_en ??
        now,

      detenido_en:
        registroFinal
          ?.detenido_en ??
        null,

      estado:
        'in-progress' as const,

      registro_horas:
        registroFinal
          ? {
              id:
                String(
                  registroFinal.id
                ),

              iniciado_en:
                registroFinal
                  .iniciado_en ??
                null,

              pausado_en:
                registroFinal
                  .pausado_en ??
                null,

              detenido_en:
                registroFinal
                  .detenido_en ??
                null,

              total_segundos:
                toSafeNumber(
                  registroFinal
                    .total_segundos
                ),

              estado:
                normalizeEstadoRegistro(
                  registroFinal.estado
                ),

              creado_en:
                registroFinal
                  .creado_en ??
                null,
            }
          : null,
    };

    return NextResponse.json(
      {
        ok: true,

        message:
          'Tarea iniciada correctamente',

        data: payload,
        ...payload,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/tareas/[tareaId]/comenzar error:',
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