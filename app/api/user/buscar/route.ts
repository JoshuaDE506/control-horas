// app/api/user/buscar/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type UsuarioBusquedaRow = {
  id: string | number;
  nombre: string | null;
  apellido: string | null;
  nombreCompleto:
    | string
    | null;
  email: string | null;
  pais: string | null;
  rol: string | null;
  activo:
    | number
    | bigint
    | string
    | boolean
    | null;
  puesto: string | null;
};

function castRows<T>(
  rows: unknown[]
): T[] {
  return rows as T[];
}

function normalizarActivo(
  value: unknown
): boolean {
  if (
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    return Number(value) === 1;
  }

  const normalized =
    String(value ?? '')
      .toLowerCase()
      .trim();

  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'activo'
  );
}

export async function GET(
  req: NextRequest
) {
  try {
    /**
     * =====================================================
     * AUTENTICACIÓN
     * =====================================================
     */

    const sessionUser =
      await getAuthenticatedUser(
        req
      );

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

    /**
     * =====================================================
     * BÚSQUEDA
     * =====================================================
     */

    const {
      searchParams,
    } = new URL(req.url);

    const q =
      String(
        searchParams.get(
          'q'
        ) ?? ''
      ).trim();

    if (q.length < 2) {
      return NextResponse.json(
        {
          ok: true,
          data: [],
          usuarios: [],
        },
        { status: 200 }
      );
    }

    /**
     * Limitamos longitud para evitar búsquedas absurdamente
     * grandes.
     */
    if (q.length > 100) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'La búsqueda es demasiado larga',
        },
        { status: 400 }
      );
    }

    const qLower =
      q.toLowerCase();

    /**
     * =====================================================
     * CONSULTA
     * =====================================================
     */

    const result =
      await db.execute({
        sql: `
          SELECT
            id,
            nombre,
            apellido,

            TRIM(
              COALESCE(
                nombre,
                ''
              )
              || ' ' ||
              COALESCE(
                apellido,
                ''
              )
            ) AS nombreCompleto,

            email,
            pais,
            rol,
            activo,
            puesto

          FROM usuarios

          WHERE
            (
              CAST(id AS TEXT)
                =
              CAST(? AS TEXT)

              OR LOWER(
                   COALESCE(
                     nombre,
                     ''
                   )
                 )
                 LIKE ?

              OR LOWER(
                   COALESCE(
                     apellido,
                     ''
                   )
                 )
                 LIKE ?

              OR LOWER(
                   TRIM(
                     COALESCE(
                       nombre,
                       ''
                     )
                     || ' ' ||
                     COALESCE(
                       apellido,
                       ''
                     )
                   )
                 )
                 LIKE ?

              OR LOWER(
                   COALESCE(
                     email,
                     ''
                   )
                 )
                 LIKE ?
            )

            AND (
              activo = 1
              OR LOWER(
                   CAST(
                     activo AS TEXT
                   )
                 )
                 IN (
                   '1',
                   'true',
                   'activo'
                 )
            )

            AND CAST(id AS TEXT)
                <>
                CAST(? AS TEXT)

          ORDER BY
            nombre ASC,
            apellido ASC

          LIMIT 20
        `,
        args: [
          q,

          `%${qLower}%`,
          `%${qLower}%`,
          `%${qLower}%`,
          `%${qLower}%`,

          String(
            sessionUser.id
          ),
        ],
      });

    const rows =
      castRows<UsuarioBusquedaRow>(
        result.rows
      );

    const usuarios =
      rows.map((row) => {
        const nombre =
          String(
            row.nombre ?? ''
          ).trim();

        const apellido =
          String(
            row.apellido ?? ''
          ).trim();

        const nombreCompleto =
          String(
            row.nombreCompleto ??
              ''
          ).trim() ||
          `${nombre} ${apellido}`
            .trim();

        return {
          id:
            String(row.id),

          nombre,

          apellido,

          nombreCompleto,

          email:
            String(
              row.email ?? ''
            ).trim(),

          pais:
            row.pais ?? null,

          rol:
            row.rol
              ? String(row.rol)
              : null,

          activo:
            normalizarActivo(
              row.activo
            ),

          puesto:
            row.puesto ??
            null,
        };
      });

    return NextResponse.json(
      {
        ok: true,

        data:
          usuarios,

        usuarios,

        total:
          usuarios.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/user/buscar error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al buscar usuarios',
      },
      { status: 500 }
    );
  }
}