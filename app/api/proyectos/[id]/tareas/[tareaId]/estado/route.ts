// app/api/proyectos/[id]/tareas/[tareaId]/estado/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

/**
 * =========================================================
 * 📌 TIPOS
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

type RolProyecto =
  | 'owner'
  | 'admin'
  | 'miembro'
  | 'ninguno';

type ProyectoRow = {
  id: number | bigint | null;
  creador_id: string | null;
};

type TareaRow = {
  id: string;
  proyecto_id: number | bigint | null;
  estado: string | null;
  creador_id: string | null;
};

type RolRow = {
  rol?: string | null;
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

async function getParams(
  context: {
    params:
      | Params
      | Promise<Params>;
  }
): Promise<Params> {
  return await context.params;
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
  value: unknown
): EstadoTarea | null {
  const estado =
    String(value ?? '')
      .trim()
      .toLowerCase();

  if (estado === 'todo') {
    return 'todo';
  }

  if (
    estado === 'in-progress' ||
    estado === 'in_progress' ||
    estado === 'en progreso' ||
    estado === 'en_progreso'
  ) {
    return 'in-progress';
  }

  if (
    estado === 'review' ||
    estado === 'revision' ||
    estado === 'revisión'
  ) {
    return 'review';
  }

  if (
    estado === 'completed' ||
    estado === 'completado' ||
    estado === 'completada'
  ) {
    return 'completed';
  }

  return null;
}

/**
 * =========================================================
 * 👤 NORMALIZAR ROL
 * =========================================================
 */
function normalizarRol(
  raw: unknown
): RolProyecto {
  const value =
    String(raw ?? '')
      .trim()
      .toLowerCase();

  if (
    value === 'owner' ||
    value === 'dueño' ||
    value === 'dueno'
  ) {
    return 'owner';
  }

  if (
    value === 'admin' ||
    value === 'administrador'
  ) {
    return 'admin';
  }

  if (
    value === 'miembro' ||
    value === 'member'
  ) {
    return 'miembro';
  }

  return 'ninguno';
}

/**
 * =========================================================
 * PATCH /api/proyectos/[id]/tareas/[tareaId]/estado
 * =========================================================
 *
 * IMPORTANTE:
 *
 * Esta ruta YA NO maneja el flujo normal:
 *
 * todo → in-progress
 *      usar /comenzar
 *
 * in-progress → review
 *      usar /completar
 *
 * review → in-progress
 *      usar /rechazar
 *
 * review → completed
 *      usar /aprobar
 *
 * Esta ruta queda solamente para:
 *
 * completed → todo
 *
 * mediante una reapertura administrativa explícita.
 */
export async function PATCH(
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
     * 🔐 AUTENTICACIÓN
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
     * 📁 PARÁMETROS
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

    /**
     * =====================================================
     * 📝 BODY
     * =====================================================
     */
    const body =
      await req
        .json()
        .catch(() => ({}));

    const nuevoEstado =
      normalizeEstado(
        body?.estado
      );

    const reopen =
      body?.reopen === true;

    const comentario =
      typeof body?.comentario ===
        'string'
        ? body.comentario.trim()
        : '';

    if (!nuevoEstado) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Estado inválido',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 📁 OBTENER PROYECTO
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
     * 👤 RESOLVER ROL
     * =====================================================
     */
    const esOwnerProyecto =
      String(
        proyecto.creador_id ?? ''
      ) === userId;

    let rolProyecto:
      RolProyecto;

    if (esOwnerProyecto) {
      rolProyecto =
        'owner';
    } else {
      const rolRes =
        await db.execute({
          sql: `
            SELECT
              rol_en_proyecto
                AS rol
            FROM proyecto_usuarios
            WHERE proyecto_id = ?
              AND CAST(
                    usuario_id
                    AS TEXT
                  )
                  =
                  CAST(
                    ?
                    AS TEXT
                  )
            LIMIT 1
          `,
          args: [
            proyectoId,
            userId,
          ],
        });

      const rolRows =
        castRows<RolRow>(
          rolRes.rows
        );

      rolProyecto =
        normalizarRol(
          rolRows[0]?.rol
        );
    }

    /**
     * =====================================================
     * 🔒 VALIDAR ACCESO
     * =====================================================
     */
    if (
      rolProyecto ===
      'ninguno'
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
     * 🛡️ SOLO OWNER / ADMIN
     * =====================================================
     *
     * Una reapertura modifica una tarea que ya había
     * sido aprobada, por lo que solamente owner/admin
     * pueden realizarla.
     */
    const esAdminProyecto =
      rolProyecto === 'admin';

    if (
      !esOwnerProyecto &&
      !esAdminProyecto
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Solo el owner o un admin pueden cambiar administrativamente el estado de una tarea',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 📋 OBTENER TAREA
     * =====================================================
     */
    const tareaRes =
      await db.execute({
        sql: `
          SELECT
            id,
            proyecto_id,
            estado,
            creador_id
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
      ) ?? 'todo';

    /**
     * =====================================================
     * 🔁 MISMO ESTADO
     * =====================================================
     */
    if (
      estadoActual ===
      nuevoEstado
    ) {
      return NextResponse.json(
        {
          ok: true,
          message:
            'La tarea ya se encuentra en ese estado',
          tarea: {
            id:
              String(tarea.id),
            estado:
              estadoActual,
          },
        },
        { status: 200 }
      );
    }

    /**
     * =====================================================
     * 🚫 BLOQUEAR TRANSICIONES OPERATIVAS
     * =====================================================
     */
    if (
      estadoActual === 'todo' &&
      nuevoEstado ===
        'in-progress'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Para comenzar una tarea utiliza la ruta /comenzar',
        },
        { status: 409 }
      );
    }

    if (
      estadoActual ===
        'in-progress' &&
      nuevoEstado === 'review'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Para enviar una tarea a revisión utiliza la ruta /completar',
        },
        { status: 409 }
      );
    }

    if (
      estadoActual === 'review' &&
      nuevoEstado ===
        'in-progress'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Para rechazar una tarea utiliza la ruta /rechazar',
        },
        { status: 409 }
      );
    }

    if (
      estadoActual === 'review' &&
      nuevoEstado ===
        'completed'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Para aprobar una tarea utiliza la ruta /aprobar',
        },
        { status: 409 }
      );
    }

    /**
     * =====================================================
     * ✅ ÚNICA TRANSICIÓN ADMINISTRATIVA PERMITIDA
     * =====================================================
     *
     * completed → todo
     *
     * Debe enviarse:
     *
     * {
     *   "estado": "todo",
     *   "reopen": true
     * }
     */
    const esReapertura =
      estadoActual ===
        'completed' &&
      nuevoEstado ===
        'todo' &&
      reopen;

    if (!esReapertura) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `No se permite cambiar manualmente de "${estadoActual}" a "${nuevoEstado}"`,
        },
        { status: 409 }
      );
    }

    const now =
      new Date().toISOString();

    /**
     * =====================================================
     * 🔄 REABRIR TAREA
     * =====================================================
     *
     * Regresa la tarea a todo.
     *
     * Se eliminan únicamente los datos correspondientes
     * a la aprobación anterior.
     *
     * El historial y los registros de horas anteriores
     * NO se eliminan.
     */
    await db.execute({
      sql: `
        UPDATE tareas
        SET
          estado = 'todo',

          fecha_aprobacion = NULL,

          aprobado_por = NULL,

          fecha_envio_revision = NULL,

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
     * 👥 REINICIAR ESTADO DE ASIGNACIONES
     * =====================================================
     *
     * La tarea fue reabierta.
     *
     * Los participantes anteriores dejan de aparecer como
     * completados.
     *
     * No eliminamos iniciado_en porque representa cuándo
     * comenzaron originalmente su participación.
     */
    await db.execute({
      sql: `
        UPDATE tarea_asignaciones
        SET
          completado_en = NULL
        WHERE tarea_id = ?
          AND estado = 'activo'
      `,
      args: [
        String(tareaId),
      ],
    });

    /**
     * =====================================================
     * ⏱️ REGISTRO DE HORAS
     * =====================================================
     *
     * NO iniciamos ningún cronómetro.
     *
     * Los registros anteriores permanecen finalizados.
     *
     * Cuando alguien vuelva a trabajar:
     *
     * /comenzar
     *
     * creará un nuevo registro_horas.
     */

    /**
     * =====================================================
     * 📜 HISTORIAL
     * =====================================================
     */
    const comentarioHistorial =
      comentario ||
      'Tarea reabierta';

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
          'completed',
          'todo',
          comentarioHistorial,
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
     * 🔎 RECARGAR TAREA
     * =====================================================
     */
    const tareaUpdatedRes =
      await db.execute({
        sql: `
          SELECT
            id,
            proyecto_id,
            estado,
            creador_id,
            fecha_aprobacion,
            aprobado_por,
            fecha_envio_revision,
            ultimo_rechazo_comentario,
            actualizado_en
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

    const tareaUpdated =
      tareaUpdatedRes.rows?.[0] ??
      null;

    /**
     * =====================================================
     * ✅ RESPUESTA FINAL
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        message:
          'Tarea reabierta correctamente',

        tarea:
          tareaUpdated,

        meta: {
          estado_anterior:
            estadoActual,

          estado_nuevo:
            'todo',

          reabierta:
            true,

          rol_proyecto:
            rolProyecto,

          es_owner_proyecto:
            esOwnerProyecto,

          es_admin_proyecto:
            esAdminProyecto,

          cronometro_activo:
            false,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'PATCH /api/proyectos/[id]/tareas/[tareaId]/estado error:',
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