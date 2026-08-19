//app/api/proyectos/route.ts

import { NextRequest, NextResponse } from 'next/server';

import {
  getProyectosVisiblesParaUsuario,
  getProyectosCreadosPorUsuario,
  getProyectosDondeSoyMiembro,
  createProyecto,
  type Proyecto,
  type PrioridadProyecto,
  type VisibilidadProyecto,
  type ModoAccesoProyecto,
} from '@/model/proyectModel';

import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

/**
 * =========================================================
 * 📌 VALORES PERMITIDOS
 * =========================================================
 */

const PRIORIDADES_VALIDAS: PrioridadProyecto[] = [
  'baja',
  'media',
  'alta',
  'critica',
];

const VISIBILIDADES_VALIDAS: VisibilidadProyecto[] = [
  'privado',
  'publico',
];

const MODOS_ACCESO_VALIDOS: ModoAccesoProyecto[] = [
  'privado',
  'publico',
  'solicitud',
];

/**
 * =========================================================
 * 🧹 HELPERS
 * =========================================================
 */

function sanitizarTexto(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function sanitizarTextoNullable(
  value: unknown
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const limpio = value.trim();

  return limpio === ''
    ? null
    : limpio;
}

/**
 * Valida prioridad.
 */
function esPrioridadValida(
  value: unknown
): value is PrioridadProyecto {
  return PRIORIDADES_VALIDAS.includes(
    value as PrioridadProyecto
  );
}

/**
 * =========================================================
 * 👁️ NORMALIZAR VISIBILIDAD
 * =========================================================
 *
 * Solo admite:
 *
 * - privado
 * - publico
 */
function normalizarVisibilidad(
  value: unknown
): VisibilidadProyecto {
  const raw = String(value ?? 'privado')
    .trim()
    .toLowerCase();

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
 * 🚪 NORMALIZAR MODO DE ACCESO
 * =========================================================
 *
 * Puede ser:
 *
 * privado
 * publico
 * solicitud
 */
function normalizarModoAcceso(
  value: unknown
): ModoAccesoProyecto {
  const raw = String(value ?? 'privado')
    .trim()
    .toLowerCase();

  if (
    raw === 'solicitud' ||
    raw === 'request' ||
    raw === 'invitacion' ||
    raw === 'invitación' ||
    raw === 'invite'
  ) {
    return 'solicitud';
  }

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
 * 👥 NORMALIZAR MIEMBROS
 * =========================================================
 *
 * - Convierte IDs a string.
 * - Elimina valores vacíos.
 * - Elimina al creador.
 * - Elimina IDs duplicados.
 */
function normalizarMiembros(
  miembros: unknown,
  currentUserId: string
): string[] {
  if (!Array.isArray(miembros)) {
    return [];
  }

  return [
    ...new Set(
      miembros
        .map((miembro) =>
          String(miembro ?? '').trim()
        )
        .filter(
          (miembro) =>
            miembro !== '' &&
            miembro !== currentUserId
        )
    ),
  ];
}

/**
 * =========================================================
 * GET /api/proyectos
 * =========================================================
 *
 * scope:
 *
 * visibles → proyectos que puede visualizar.
 * creados  → proyectos creados por el usuario.
 * miembro  → proyectos donde participa como miembro.
 */
export async function GET(req: NextRequest) {
  try {
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

    const scope =
      req.nextUrl.searchParams
        .get('scope')
        ?.toLowerCase();

    let proyectos: Proyecto[] = [];

    if (scope === 'creados') {
      proyectos =
        await getProyectosCreadosPorUsuario(
          sessionUser.id
        );
    } else if (scope === 'miembro') {
      proyectos =
        await getProyectosDondeSoyMiembro(
          sessionUser.id
        );
    } else {
      proyectos =
        await getProyectosVisiblesParaUsuario(
          sessionUser.id
        );
    }

    return NextResponse.json(
      {
        ok: true,

        /**
         * Se mantienen ambas propiedades por
         * compatibilidad con el frontend actual.
         */
        data: proyectos,
        proyectos,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/proyectos error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: 'Error al cargar proyectos',
      },
      { status: 500 }
    );
  }
}

/**
 * =========================================================
 * POST /api/proyectos
 * =========================================================
 *
 * Crea un proyecto y registra:
 *
 * - creador como owner
 * - miembros seleccionados
 */
export async function POST(req: NextRequest) {
  try {
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

    const body = await req
      .json()
      .catch(() => ({}));

    /**
     * =====================================================
     * 📝 NORMALIZAR DATOS
     * =====================================================
     */
    const nombre =
      sanitizarTexto(body?.nombre);

    const descripcion =
      sanitizarTexto(body?.descripcion);

    const prioridadRaw =
      body?.prioridad;

    const fechaInicio =
      sanitizarTextoNullable(
        body?.fecha_inicio
      );

    const fechaFin =
      sanitizarTextoNullable(
        body?.fecha_fin
      );

    if (!nombre) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El nombre del proyecto es obligatorio',
        },
        { status: 400 }
      );
    }

    /**
     * =====================================================
     * 🚩 PRIORIDAD
     * =====================================================
     */
    const prioridadFinal:
      PrioridadProyecto =
      esPrioridadValida(prioridadRaw)
        ? prioridadRaw
        : 'media';

    /**
     * =====================================================
     * 👁️ VISIBILIDAD
     * =====================================================
     */
    const visibilidadFinal =
      normalizarVisibilidad(
        body?.visibilidad
      );

    /**
     * =====================================================
     * 🚪 MODO DE ACCESO
     * =====================================================
     */
    const modoAccesoFinal =
      normalizarModoAcceso(
        body?.modo_acceso ??
          body?.modoAcceso
      );

    /**
     * =====================================================
     * 👥 MIEMBROS
     * =====================================================
     */
    const miembrosLimpios =
      normalizarMiembros(
        body?.miembros,
        sessionUser.id
      );

    /**
     * =====================================================
     * 🔎 VALIDAR MIEMBROS
     * =====================================================
     *
     * Solo permitimos agregar usuarios que:
     *
     * - existan
     * - estén activos
     */
    for (const miembroId of miembrosLimpios) {
      const usuarioResult =
        await db.execute({
          sql: `
            SELECT id
            FROM usuarios
            WHERE id = ?
              AND CAST(
                COALESCE(activo, 0)
                AS INTEGER
              ) = 1
            LIMIT 1
          `,
          args: [miembroId],
        });

      if (
        !usuarioResult.rows ||
        usuarioResult.rows.length === 0
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Uno de los miembros seleccionados no existe o está inactivo.',
          },
          { status: 400 }
        );
      }
    }

    /**
     * =====================================================
     * 📁 CREAR PROYECTO
     * =====================================================
     */
    const proyecto =
      await createProyecto({
        nombre,
        descripcion,
        prioridad: prioridadFinal,
        creadorId: sessionUser.id,
        visibilidad: visibilidadFinal,
        modoAcceso: modoAccesoFinal,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });

    /**
     * =====================================================
     * 👑 REGISTRAR CREADOR COMO OWNER
     * =====================================================
     */
    await db.execute({
      sql: `
        INSERT OR IGNORE INTO proyecto_usuarios (
          proyecto_id,
          usuario_id,
          rol_en_proyecto,
          tipo_union
        )
        VALUES (
          ?,
          ?,
          'owner',
          'owner'
        )
      `,
      args: [
        proyecto.id,
        sessionUser.id,
      ],
    });

    /**
     * =====================================================
     * 👥 REGISTRAR MIEMBROS
     * =====================================================
     */
    for (const miembroId of miembrosLimpios) {
      await db.execute({
        sql: `
          INSERT OR IGNORE INTO proyecto_usuarios (
            proyecto_id,
            usuario_id,
            rol_en_proyecto,
            tipo_union
          )
          VALUES (
            ?,
            ?,
            'miembro',
            'manual'
          )
        `,
        args: [
          proyecto.id,
          miembroId,
        ],
      });
    }

    /**
     * El creador acaba de ser registrado como owner,
     * por lo tanto también es miembro del proyecto.
     */
    proyecto.is_creator = 1;
    proyecto.is_member = 1;

    return NextResponse.json(
      {
        ok: true,
        message:
          'Proyecto creado correctamente',

        /**
         * Ambas propiedades se mantienen para evitar
         * romper el frontend actual.
         */
        data: proyecto,
        proyecto,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      'POST /api/proyectos error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al crear proyecto',
      },
      { status: 500 }
    );
  }
}