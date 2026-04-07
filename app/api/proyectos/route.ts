//app/api/proyectos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getProyectosVisiblesParaUsuario,
  getProyectosCreadosPorUsuario,
  getProyectosDondeSoyMiembro,
  createProyecto,
  type PrioridadProyecto,
} from '@/model/proyectModel';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

/* ==========================================================
   Helpers
========================================================== */

const PRIORIDADES_VALIDAS: PrioridadProyecto[] = [
  'baja',
  'media',
  'alta',
  'critica',
];

const VISIBILIDADES_VALIDAS = ['privado', 'publico'] as const;
const MODOS_ACCESO_VALIDOS = ['privado', 'publico', 'solicitud'] as const;

function sanitizarTexto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizarTextoNullable(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;

  const limpio = value.trim();
  return limpio === '' ? null : limpio;
}

function esPrioridadValida(value: unknown): value is PrioridadProyecto {
  return PRIORIDADES_VALIDAS.includes(value as PrioridadProyecto);
}

function normalizarVisibilidad(
  value: unknown
): (typeof VISIBILIDADES_VALIDAS)[number] {
  const raw = String(value ?? 'privado').trim().toLowerCase();

  return VISIBILIDADES_VALIDAS.includes(
    raw as (typeof VISIBILIDADES_VALIDAS)[number]
  )
    ? (raw as (typeof VISIBILIDADES_VALIDAS)[number])
    : 'privado';
}

function normalizarModoAcceso(
  value: unknown
): (typeof MODOS_ACCESO_VALIDOS)[number] {
  const raw = String(value ?? 'privado').trim().toLowerCase();

  if (
    raw === 'solicitud' ||
    raw === 'request' ||
    raw === 'invitacion' ||
    raw === 'invitación' ||
    raw === 'invite'
  ) {
    return 'solicitud';
  }

  return MODOS_ACCESO_VALIDOS.includes(
    raw as (typeof MODOS_ACCESO_VALIDOS)[number]
  )
    ? (raw as (typeof MODOS_ACCESO_VALIDOS)[number])
    : 'privado';
}

function normalizarMiembros(miembros: unknown, currentUserId: string): string[] {
  if (!Array.isArray(miembros)) return [];

  return miembros
    .map((miembro) => String(miembro ?? '').trim())
    .filter((miembro) => miembro !== '' && miembro !== currentUserId);
}

/* ==========================================================
   GET /api/proyectos?scope=visibles|creados|miembro
========================================================== */

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const scope = req.nextUrl.searchParams.get('scope')?.toLowerCase();
    let proyectos: any[] = [];

    if (scope === 'creados') {
      proyectos = await getProyectosCreadosPorUsuario(String(sessionUser.id));
    } else if (scope === 'miembro') {
      proyectos = await getProyectosDondeSoyMiembro(String(sessionUser.id));
    } else {
      proyectos = await getProyectosVisiblesParaUsuario(String(sessionUser.id));
    }

    return NextResponse.json(
      {
        ok: true,
        data: proyectos,
        proyectos,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/proyectos error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al cargar proyectos' },
      { status: 500 }
    );
  }
}

/* ==========================================================
   POST /api/proyectos
========================================================== */

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser(req);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const nombre = sanitizarTexto(body?.nombre);
    const descripcion = sanitizarTexto(body?.descripcion);
    const prioridadRaw = body?.prioridad;
    const fechaInicio = sanitizarTextoNullable(body?.fecha_inicio);
    const fechaFin = sanitizarTextoNullable(body?.fecha_fin);

    if (!nombre) {
      return NextResponse.json(
        { ok: false, error: 'El nombre del proyecto es obligatorio' },
        { status: 400 }
      );
    }

    const prioridadFinal: PrioridadProyecto = esPrioridadValida(prioridadRaw)
      ? prioridadRaw
      : 'media';

    const visibilidadFinal = normalizarVisibilidad(body?.visibilidad);

    const modoAccesoFinal = normalizarModoAcceso(
      body?.modo_acceso ?? body?.modoAcceso
    );

    const miembrosLimpios = normalizarMiembros(
      body?.miembros,
      String(sessionUser.id)
    );

    const proyecto = await createProyecto({
      nombre,
      descripcion,
      prioridad: prioridadFinal,
      creadorId: String(sessionUser.id),
      visibilidad: visibilidadFinal,
      modoAcceso: modoAccesoFinal,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    });

    await db.execute({
      sql: `
        INSERT OR IGNORE INTO proyecto_usuarios (
          proyecto_id,
          usuario_id,
          rol_en_proyecto,
          tipo_union
        )
        VALUES (?, ?, 'owner', 'owner')
      `,
      args: [proyecto.id, String(sessionUser.id)],
    });

    for (const miembroId of miembrosLimpios) {
      await db.execute({
        sql: `
          INSERT OR IGNORE INTO proyecto_usuarios (
            proyecto_id,
            usuario_id,
            rol_en_proyecto,
            tipo_union
          )
          VALUES (?, ?, 'miembro', 'manual')
        `,
        args: [proyecto.id, miembroId],
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Proyecto creado correctamente',
        data: proyecto,
        proyecto,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/proyectos error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al crear proyecto' },
      { status: 500 }
    );
  }
}