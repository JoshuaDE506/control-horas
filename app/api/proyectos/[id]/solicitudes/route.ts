// app/api/proyectos/[id]/solicitudes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

/**
 * =========================================================
 * 📌 TIPOS AUXILIARES
 * =========================================================
 */

type SolicitudEstado =
  | 'pendiente'
  | 'aprobada'
  | 'rechazada';

type ProyectoSolicitudRow = {
  id: number | bigint;
  visibilidad: string | null;
  modo_acceso: string | null;
  creador_id: string | null;
};

type SolicitudExistenteRow = {
  id: number | bigint;
  proyecto_id: number | bigint;
  usuario_id: string;
  estado: string | null;
  mensaje: string | null;
  creado_en: string | null;
  actualizado_en: string | null;
};

type SolicitudListadoRow = {
  id: number | bigint;
  proyecto_id: number | bigint;
  usuario_id: string;
  estado: string | null;
  mensaje: string | null;
  creado_en: string | null;
  actualizado_en: string | null;

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
 * 🚪 VALIDAR MODO DE ACCESO POR SOLICITUD
 * =========================================================
 *
 * IMPORTANTE:
 *
 * Las solicitudes dependen únicamente de:
 *
 * modo_acceso = "solicitud"
 *
 * La visibilidad NO determina el modo de ingreso.
 */
function esModoSolicitud(
  modoAcceso: unknown
): boolean {
  const modo = String(modoAcceso ?? '')
    .toLowerCase()
    .trim();

  return (
    modo === 'solicitud' ||
    modo === 'request' ||
    modo === 'invitacion' ||
    modo === 'invitación' ||
    modo === 'invite'
  );
}

/**
 * =========================================================
 * 📦 MAPEAR SOLICITUD
 * =========================================================
 *
 * Convierte los resultados provenientes de Turso
 * al formato utilizado por la API.
 */
function mapSolicitud(
  row: SolicitudExistenteRow | SolicitudListadoRow
) {
  return {
    id: Number(row.id),

    proyecto_id:
      Number(row.proyecto_id),

    usuario_id:
      String(row.usuario_id),

    estado:
      String(
        row.estado ?? 'pendiente'
      ) as SolicitudEstado,

    mensaje:
      row.mensaje ?? null,

    creado_en:
      row.creado_en ?? null,

    actualizado_en:
      row.actualizado_en ?? null,

    /**
     * Los datos personales solamente existen
     * cuando la consulta incluye JOIN con usuarios.
     */
    ...(Object.prototype.hasOwnProperty.call(
      row,
      'nombre'
    )
      ? {
          nombre:
            (row as SolicitudListadoRow)
              .nombre ?? '',

          apellido:
            (row as SolicitudListadoRow)
              .apellido ?? '',

          email:
            (row as SolicitudListadoRow)
              .email ?? '',
        }
      : {}),
  };
}

/**
 * =========================================================
 * POST /api/proyectos/[id]/solicitudes
 * =========================================================
 *
 * Crea una solicitud para ingresar a un proyecto.
 *
 * Solamente puede utilizarse cuando:
 *
 * modo_acceso = "solicitud"
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
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

    /**
     * =====================================================
     * 📁 VALIDAR PROYECTO
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
            'ID de proyecto inválido',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 📝 OBTENER MENSAJE OPCIONAL
     * =====================================================
     */
    const body = await req
      .json()
      .catch(() => ({}));

    const mensaje =
      typeof body?.mensaje === 'string'
        ? body.mensaje.trim() || null
        : null;

    /**
     * =====================================================
     * 🔎 CONSULTAR PROYECTO
     * =====================================================
     */
    const proyectoRes =
      await db.execute({
        sql: `
          SELECT
            id,
            visibilidad,
            modo_acceso,
            creador_id
          FROM proyectos
          WHERE id = ?
          LIMIT 1
        `,
        args: [proyectoId],
      });

    const proyectoRows =
      castRows<ProyectoSolicitudRow>(
        proyectoRes.rows
      );

    const proyecto =
      proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Proyecto no existe',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 🚪 VALIDAR MODO DE ACCESO
     * =====================================================
     *
     * Ya NO se utiliza visibilidad para determinar
     * si el proyecto requiere solicitud.
     */
    if (
      !esModoSolicitud(
        proyecto.modo_acceso
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Este proyecto no utiliza acceso por solicitud',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 👑 EVITAR QUE EL OWNER SOLICITE ACCESO
     * =====================================================
     */
    if (
      String(proyecto.creador_id) ===
      String(sessionUser.id)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Eres el creador del proyecto',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 👥 VERIFICAR SI YA ES MIEMBRO
     * =====================================================
     */
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
          sessionUser.id,
        ],
      });

    if (memberRes.rows?.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Ya eres miembro del proyecto',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 📩 BUSCAR SOLICITUD EXISTENTE
     * =====================================================
     *
     * Primero verificamos si el usuario ya tiene
     * una solicitud para evitar depender de un error
     * generado por INSERT.
     */
    const existingRes =
      await db.execute({
        sql: `
          SELECT
            id,
            proyecto_id,
            usuario_id,
            estado,
            mensaje,
            creado_en,
            actualizado_en
          FROM proyecto_solicitudes
          WHERE proyecto_id = ?
            AND CAST(usuario_id AS TEXT)
              = CAST(? AS TEXT)
          LIMIT 1
        `,
        args: [
          proyectoId,
          sessionUser.id,
        ],
      });

    const existingRows =
      castRows<SolicitudExistenteRow>(
        existingRes.rows
      );

    const solicitudExistente =
      existingRows[0];

    /**
     * =====================================================
     * ♻️ SOLICITUD YA EXISTENTE
     * =====================================================
     */
    if (solicitudExistente) {
      const estadoActual =
        String(
          solicitudExistente.estado ??
            'pendiente'
        )
          .toLowerCase()
          .trim();

      /**
       * Si continúa pendiente, simplemente devolvemos
       * la solicitud existente.
       */
      if (estadoActual === 'pendiente') {
        const solicitud =
          mapSolicitud(
            solicitudExistente
          );

        return NextResponse.json(
          {
            ok: true,
            message:
              'Ya existe una solicitud pendiente',
            data: solicitud,
            solicitud,
          },
          { status: 200 }
        );
      }

      /**
       * Si anteriormente fue rechazada, permitimos
       * volver a solicitar acceso reutilizando
       * el mismo registro.
       */
      if (estadoActual === 'rechazada') {
        const ahora =
          new Date().toISOString();

        await db.execute({
          sql: `
            UPDATE proyecto_solicitudes
            SET
              estado = 'pendiente',
              mensaje = ?,
              actualizado_en = ?
            WHERE id = ?
          `,
          args: [
            mensaje,
            ahora,
            Number(
              solicitudExistente.id
            ),
          ],
        });

        return NextResponse.json(
          {
            ok: true,
            message:
              'Solicitud enviada nuevamente',
            data: {
              id: Number(
                solicitudExistente.id
              ),
              proyecto_id:
                proyectoId,
              usuario_id:
                sessionUser.id,
              estado:
                'pendiente',
              mensaje,
              actualizado_en:
                ahora,
            },
            estado:
              'pendiente',
          },
          { status: 200 }
        );
      }

      /**
       * Si aparece como aprobada pero el usuario
       * no está en proyecto_usuarios, existe una
       * inconsistencia de datos.
       */
      if (estadoActual === 'aprobada') {
        return NextResponse.json(
          {
            ok: false,
            error:
              'La solicitud ya fue aprobada',
          },
          { status: 409 }
        );
      }
    }

    /**
     * =====================================================
     * ➕ CREAR NUEVA SOLICITUD
     * =====================================================
     */
    await db.execute({
      sql: `
        INSERT INTO proyecto_solicitudes (
          proyecto_id,
          usuario_id,
          estado,
          mensaje
        )
        VALUES (
          ?,
          ?,
          'pendiente',
          ?
        )
      `,
      args: [
        proyectoId,
        sessionUser.id,
        mensaje,
      ],
    });

    return NextResponse.json(
      {
        ok: true,

        message:
          'Solicitud creada correctamente',

        data: {
          estado: 'pendiente',
        },

        estado: 'pendiente',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos/[id]/solicitudes error:',
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
 * GET /api/proyectos/[id]/solicitudes
 * =========================================================
 *
 * Obtiene las solicitudes pendientes del proyecto.
 *
 * Actualmente solamente el creador/owner puede
 * administrar solicitudes.
 */
export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
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
            'ID de proyecto inválido',
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
          SELECT creador_id
          FROM proyectos
          WHERE id = ?
          LIMIT 1
        `,
        args: [proyectoId],
      });

    const proyectoRows =
      castRows<{
        creador_id: string | null;
      }>(
        proyectoRes.rows
      );

    const proyecto =
      proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Proyecto no existe',
        },
        { status: 404 }
      );
    }

    /**
     * =====================================================
     * 👑 VALIDAR OWNER
     * =====================================================
     */
    if (
      String(proyecto.creador_id) !==
      String(sessionUser.id)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sin permiso',
        },
        { status: 403 }
      );
    }

    /**
     * =====================================================
     * 📩 OBTENER SOLICITUDES PENDIENTES
     * =====================================================
     */
    const solicitudesRes =
      await db.execute({
        sql: `
          SELECT
            s.id,
            s.proyecto_id,
            s.usuario_id,
            s.estado,
            s.mensaje,
            s.creado_en,
            s.actualizado_en,
            u.nombre,
            u.apellido,
            u.email
          FROM proyecto_solicitudes s

          JOIN usuarios u
            ON CAST(u.id AS TEXT)
             = CAST(s.usuario_id AS TEXT)

          WHERE s.proyecto_id = ?
            AND LOWER(
              COALESCE(
                s.estado,
                'pendiente'
              )
            ) = 'pendiente'

          ORDER BY s.creado_en DESC
        `,
        args: [proyectoId],
      });

    const solicitudesRows =
      castRows<SolicitudListadoRow>(
        solicitudesRes.rows
      );

    const solicitudes =
      solicitudesRows.map(
        mapSolicitud
      );

    /**
     * =====================================================
     * ✅ RESPUESTA
     * =====================================================
     */
    return NextResponse.json(
      {
        ok: true,

        /**
         * Se mantienen ambas propiedades para
         * compatibilidad con el frontend existente.
         */
        data: solicitudes,
        solicitudes,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/proyectos/[id]/solicitudes error:',
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