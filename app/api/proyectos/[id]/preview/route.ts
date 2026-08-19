// app/api/proyectos/[id]/preview/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

/**
 * =========================================================
 * 📌 TIPOS AUXILIARES
 * =========================================================
 */

type ModoAcceso =
  | 'publico'
  | 'solicitud'
  | 'privado';

type VisibilidadProyecto =
  | 'publico'
  | 'privado';

type RouteContext = {
  params:
    | { id: string }
    | Promise<{ id: string }>;
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

/**
 * =========================================================
 * 🔄 CAST DE RESULTADOS
 * =========================================================
 */
function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

/**
 * =========================================================
 * 🚪 NORMALIZAR MODO DE ACCESO
 * =========================================================
 *
 * IMPORTANTE:
 *
 * modo_acceso indica cómo puede ingresar un usuario
 * al proyecto.
 *
 * NO debe depender de visibilidad.
 */
function normalizarModoAcceso(
  value: unknown
): ModoAcceso {
  const raw = String(value ?? '')
    .toLowerCase()
    .trim();

  if (
    raw === 'publico' ||
    raw === 'público' ||
    raw === 'public'
  ) {
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

/**
 * =========================================================
 * 👁️ NORMALIZAR VISIBILIDAD
 * =========================================================
 *
 * visibilidad indica quién puede visualizar
 * información pública/básica del proyecto.
 */
function normalizarVisibilidad(
  value: unknown
): VisibilidadProyecto {
  const raw = String(value ?? '')
    .toLowerCase()
    .trim();

  if (
    raw === 'publico' ||
    raw === 'público' ||
    raw === 'public'
  ) {
    return 'publico';
  }

  return 'privado';
}

/**
 * =========================================================
 * 🆔 NORMALIZAR IDS
 * =========================================================
 */
function normId(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/**
 * =========================================================
 * 👤 OBTENER INFORMACIÓN BÁSICA DE USUARIO
 * =========================================================
 */
async function fetchUsuarioBasicoById(
  usuarioId: string
): Promise<UsuarioBasico | null> {
  const id = normId(usuarioId);

  const result = await db.execute({
    sql: `
      SELECT
        nombre,
        apellido,
        email,
        pais
      FROM usuarios
      WHERE LOWER(
        TRIM(
          CAST(id AS TEXT)
        )
      ) = ?
      LIMIT 1
    `,
    args: [id],
  });

  const rows =
    castRows<{
      nombre: string | null;
      apellido: string | null;
      email: string | null;
      pais: string | null;
    }>(
      result.rows
    );

  const user = rows[0];

  if (!user) {
    return null;
  }

  return {
    nombre:
      String(user.nombre ?? '—') ||
      '—',

    apellido:
      user.apellido
        ? String(user.apellido)
        : null,

    email:
      String(user.email ?? '—') ||
      '—',

    pais:
      user.pais ?? null,
  };
}

/**
 * =========================================================
 * 👥 NORMALIZAR ROL DE MIEMBRO
 * =========================================================
 */
function mapRol(
  rolDb: unknown
):
  | 'creador'
  | 'administrador'
  | 'miembro' {
  const rol = String(rolDb ?? '')
    .toLowerCase()
    .trim();

  if (
    rol === 'owner' ||
    rol === 'creador'
  ) {
    return 'creador';
  }

  if (
    rol === 'admin' ||
    rol === 'administrador'
  ) {
    return 'administrador';
  }

  return 'miembro';
}

/**
 * Debug únicamente durante desarrollo.
 */
const isDev =
  process.env.NODE_ENV !== 'production';

/**
 * =========================================================
 * GET /api/proyectos/[id]/preview
 * =========================================================
 *
 * Devuelve una vista previa del proyecto.
 *
 * Reglas:
 *
 * - Miembros y owner pueden ver el proyecto.
 * - Usuarios externos solo pueden verlo si
 *   visibilidad = publico.
 * - Las tareas internas solamente son visibles
 *   para miembros.
 * - modo_acceso determina si un externo puede:
 *      - unirse directamente
 *      - solicitar acceso
 *      - no ingresar
 */
export async function GET(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    /**
     * =====================================================
     * 🔐 VALIDAR SESIÓN
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
      normId(sessionUser.id);

    /**
     * =====================================================
     * 📁 VALIDAR ID DEL PROYECTO
     * =====================================================
     */
    const { id } = await params;
    const proyectoId = Number(id);

    if (
      !Number.isInteger(proyectoId) ||
      proyectoId < 1
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
     * 🔎 OBTENER PROYECTO
     * =====================================================
     */
    const proyectoRes =
      await db.execute({
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
     * 👁️ VISIBILIDAD
     * =====================================================
     */
    const visibilidad =
      normalizarVisibilidad(
        proyecto.visibilidad
      );

    /**
     * =====================================================
     * 🚪 MODO DE ACCESO
     * =====================================================
     */
    const modoAcceso =
      normalizarModoAcceso(
        proyecto.modo_acceso
      );

    const creadorIdRaw =
      String(
        proyecto.creador_id ?? ''
      );

    const creadorId =
      normId(creadorIdRaw);

    /**
     * =====================================================
     * 👑 VALIDAR CREADOR
     * =====================================================
     */
    const esCreador =
      creadorId === userId;

    /**
     * =====================================================
     * 👥 VALIDAR MEMBRESÍA
     * =====================================================
     */
    const miembroRes =
      await db.execute({
        sql: `
          SELECT 1
          FROM proyecto_usuarios
          WHERE proyecto_id = ?
            AND LOWER(
              TRIM(
                CAST(usuario_id AS TEXT)
              )
            ) = ?
          LIMIT 1
        `,
        args: [
          proyectoId,
          userId,
        ],
      });

    const esMiembro =
      esCreador ||
      Boolean(
        miembroRes.rows?.length
      );

    /**
     * =====================================================
     * 🔒 CONTROL DE ACCESO AL PREVIEW
     * =====================================================
     *
     * Un proyecto privado solamente puede ser
     * visualizado por sus miembros.
     *
     * Un proyecto público puede mostrar información
     * básica a usuarios externos.
     */
    const puedeVerPreview =
      esMiembro ||
      visibilidad === 'publico';

    if (!puedeVerPreview) {
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
     * 👥 CONTAR MIEMBROS
     * =====================================================
     */
    const countRes =
      await db.execute({
        sql: `
          SELECT
            COUNT(
              DISTINCT usuario_id
            ) AS total

          FROM (
            SELECT
              LOWER(
                TRIM(
                  CAST(
                    creador_id AS TEXT
                  )
                )
              ) AS usuario_id

            FROM proyectos
            WHERE id = ?

            UNION ALL

            SELECT
              LOWER(
                TRIM(
                  CAST(
                    usuario_id AS TEXT
                  )
                )
              ) AS usuario_id

            FROM proyecto_usuarios
            WHERE proyecto_id = ?
          ) x
        `,
        args: [
          proyectoId,
          proyectoId,
        ],
      });

    const countRows =
      castRows<{
        total:
          | number
          | bigint
          | null;
      }>(
        countRes.rows
      );

    const totalMiembros =
      Number(
        countRows[0]?.total ?? 0
      );

    /**
     * =====================================================
     * 🚪 ACCIONES DISPONIBLES
     * =====================================================
     *
     * Estas acciones sí dependen del modo_acceso.
     */
    const canJoinDirect =
      !esMiembro &&
      modoAcceso === 'publico';

    const canRequestInvite =
      !esMiembro &&
      modoAcceso === 'solicitud';

    /**
     * =====================================================
     * 📋 VISIBILIDAD DE TAREAS
     * =====================================================
     *
     * Las tareas forman parte del funcionamiento
     * interno del proyecto.
     *
     * Por eso solamente pueden verlas:
     *
     * - owner
     * - admin
     * - miembro
     */
    const puedeVerTareas =
      esMiembro;

    let tareas: any[] = [];

    let estadisticasTareas: {
      total: number;
      todo: number;
      'in-progress': number;
      completed: number;
      porcentajeCompletado: number;
    } | null = null;

    /**
     * =====================================================
     * 📋 OBTENER TAREAS
     * =====================================================
     *
     * Esta consulta se mantiene por ahora.
     *
     * La revisaremos cuando entremos al módulo
     * completo de tareas.
     */
    if (puedeVerTareas) {
      const tareasRes =
        await db.execute({
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
            LIMIT 25
          `,
          args: [proyectoId],
        });

      tareas =
        (tareasRes.rows ?? [])
          .map((tarea: any) => ({
            ...tarea,

            id:
              String(tarea.id),
          }));

      /**
       * ===================================================
       * 📊 ESTADÍSTICAS DE TAREAS
       * ===================================================
       */
      const estadisticasRes =
        await db.execute({
          sql: `
            SELECT
              COUNT(*) AS total,

              SUM(
                CASE
                  WHEN estado = 'todo'
                  THEN 1
                  ELSE 0
                END
              ) AS todo,

              SUM(
                CASE
                  WHEN estado = 'in-progress'
                  THEN 1
                  ELSE 0
                END
              ) AS in_progress,

              SUM(
                CASE
                  WHEN estado = 'completed'
                  THEN 1
                  ELSE 0
                END
              ) AS completed

            FROM tareas
            WHERE proyecto_id = ?
          `,
          args: [proyectoId],
        });

      const estadisticasRows =
        castRows<{
          total:
            | number
            | bigint
            | null;

          todo:
            | number
            | bigint
            | null;

          in_progress:
            | number
            | bigint
            | null;

          completed:
            | number
            | bigint
            | null;
        }>(
          estadisticasRes.rows
        );

      const row =
        estadisticasRows[0] ?? {
          total: 0,
          todo: 0,
          in_progress: 0,
          completed: 0,
        };

      const total =
        Number(
          row.total ?? 0
        );

      const todo =
        Number(
          row.todo ?? 0
        );

      const inProgress =
        Number(
          row.in_progress ?? 0
        );

      const completed =
        Number(
          row.completed ?? 0
        );

      const porcentajeCompletado =
        total > 0
          ? Math.round(
              (completed / total) *
                100
            )
          : 0;

      estadisticasTareas = {
        total,
        todo,

        'in-progress':
          inProgress,

        completed,

        porcentajeCompletado,
      };
    }

    /**
     * =====================================================
     * 🔑 CÓDIGO DE UNIÓN
     * =====================================================
     *
     * Solo los miembros pueden verlo.
     */
    const codigo_union =
      esMiembro
        ? proyecto.codigo_union ??
          null
        : null;

    /**
     * =====================================================
     * 👤 INFORMACIÓN DEL CREADOR
     * =====================================================
     */
    const creadorInfo =
      (await fetchUsuarioBasicoById(
        creadorIdRaw
      )) ?? {
        nombre: '—',
        apellido: null,
        email: '—',
        pais: null,
      };

    /**
     * =====================================================
     * 👥 LISTA DE MIEMBROS
     * =====================================================
     *
     * Para proyectos públicos permitimos mostrar
     * la lista básica de participantes.
     *
     * Para proyectos privados solamente llegamos aquí
     * si el usuario ya es miembro.
     */
    let miembros: any[] = [];

    const miembrosRes =
      await db.execute({
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
            ON LOWER(
              TRIM(
                CAST(u.id AS TEXT)
              )
            )
            =
            LOWER(
              TRIM(
                CAST(
                  pu.usuario_id AS TEXT
                )
              )
            )

          WHERE pu.proyecto_id = ?

          ORDER BY
            pu.fecha_union DESC
        `,
        args: [proyectoId],
      });

    const miembrosRows =
      castRows<MiembroPreviewRow>(
        miembrosRes.rows
      );

    const miembrosMap =
      new Map<string, any>();

    for (
      const row of miembrosRows
    ) {
      const uid =
        normId(
          row.usuario_id
        );

      miembrosMap.set(
        uid,
        {
          id:
            String(
              row.usuario_id
            ),

          nombre:
            String(
              row.nombre ?? '—'
            ) || '—',

          apellido:
            row.apellido
              ? String(
                  row.apellido
                )
              : null,

          email:
            String(
              row.email ?? '—'
            ) || '—',

          rol:
            mapRol(
              row.rol_en_proyecto
            ),

          fecha_union:
            row.fecha_union ??
            null,
        }
      );
    }

    /**
     * Garantizar que el creador aparezca.
     */
    if (
      !miembrosMap.has(
        creadorId
      )
    ) {
      miembrosMap.set(
        creadorId,
        {
          id:
            creadorIdRaw,

          nombre:
            creadorInfo.nombre,

          apellido:
            creadorInfo.apellido,

          email:
            creadorInfo.email,

          rol:
            'creador',

          fecha_union:
            proyecto.creado_en ??
            null,
        }
      );
    } else {
      /**
       * Si ya aparece en proyecto_usuarios,
       * forzamos su rol visual a creador.
       */
      const actual =
        miembrosMap.get(
          creadorId
        );

      miembrosMap.set(
        creadorId,
        {
          ...actual,
          rol: 'creador',
        }
      );
    }

    miembros =
      Array.from(
        miembrosMap.values()
      );

    /**
     * Creador primero.
     */
    miembros.sort((a, b) => {
      if (
        a.rol === 'creador' &&
        b.rol !== 'creador'
      ) {
        return -1;
      }

      if (
        b.rol === 'creador' &&
        a.rol !== 'creador'
      ) {
        return 1;
      }

      return 0;
    });

    /**
     * =====================================================
     * 📦 RESPUESTA FINAL
     * =====================================================
     */
    const payload = {
      proyecto: {
        id:
          Number(proyecto.id),

        nombre:
          proyecto.nombre,

        descripcion:
          proyecto.descripcion ??
          null,

        prioridad:
          proyecto.prioridad,

        /**
         * Ya se devuelve normalizada.
         */
        visibilidad,

        modo_acceso:
          modoAcceso,

        fecha_inicio:
          proyecto.fecha_inicio ??
          null,

        fecha_fin:
          proyecto.fecha_fin ??
          null,

        creador_id:
          creadorIdRaw,

        creador:
          creadorInfo,

        creado_en:
          proyecto.creado_en ??
          null,

        actualizado_en:
          proyecto.actualizado_en ??
          null,

        codigo_union,
      },

      meta: {
        totalMiembros,

        esMiembro,

        esCreador,

        canJoinDirect,

        canRequestInvite,

        puedeVerTareas,
      },

      tareas:
        puedeVerTareas
          ? tareas
          : [],

      estadisticasTareas:
        puedeVerTareas
          ? estadisticasTareas
          : null,

      miembros,

      /**
       * Información de depuración solamente
       * durante desarrollo.
       */
      ...(isDev
        ? {
            debug: {
              visibilidad,
              modoAcceso,
              esMiembro,
              esCreador,
              creador_id_raw:
                creadorIdRaw,
              creador_id_norm:
                creadorId,
              user_id_norm:
                userId,
              totalMiembros,
              miembrosReturned:
                miembros.length,
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
  } catch (error) {
    console.error(
      'GET preview proyecto error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: 'Error interno',

        ...(isDev
          ? {
              debug: {
                message:
                  error instanceof Error
                    ? error.message
                    : String(error),
              },
            }
          : {}),
      },
      { status: 500 }
    );
  }
}