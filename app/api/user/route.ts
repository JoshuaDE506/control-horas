// app/api/user/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

type UserRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
};

function castRows<T>(
  rows: unknown[]
): T[] {
  return rows as T[];
}

function sanitizarTexto(
  value: unknown
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== 'string'
  ) {
    return undefined;
  }

  return value.trim();
}

/**
 * =========================================================
 * GET /api/user
 * =========================================================
 */

export async function GET(
  request: NextRequest
) {
  try {
    const sessionUser =
      await getAuthenticatedUser(
        request
      );

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

    const result =
      await db.execute({
        sql: `
          SELECT
            id,
            nombre,
            apellido,
            email
          FROM usuarios
          WHERE CAST(id AS TEXT)
              = CAST(? AS TEXT)
          LIMIT 1
        `,
        args: [userId],
      });

    const row =
      castRows<UserRow>(
        result.rows
      )[0];

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Usuario no encontrado',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,

        data: {
          id:
            String(row.id),

          nombre:
            String(
              row.nombre ?? ''
            ),

          apellido:
            String(
              row.apellido ?? ''
            ),

          email:
            String(
              row.email ?? ''
            ),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'GET /api/user error:',
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
 * PUT /api/user
 * =========================================================
 */

export async function PUT(
  request: NextRequest
) {
  try {
    const sessionUser =
      await getAuthenticatedUser(
        request
      );

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

    const body =
      await request
        .json()
        .catch(() => ({}));

    const currentResult =
      await db.execute({
        sql: `
          SELECT
            id,
            nombre,
            apellido,
            email
          FROM usuarios
          WHERE CAST(id AS TEXT)
              = CAST(? AS TEXT)
          LIMIT 1
        `,
        args: [userId],
      });

    const currentRow =
      castRows<UserRow>(
        currentResult.rows
      )[0];

    if (!currentRow) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Usuario no encontrado',
        },
        { status: 404 }
      );
    }

    const nombreInput =
      sanitizarTexto(
        body?.nombre
      );

    const apellidoInput =
      sanitizarTexto(
        body?.apellido
      );

    if (
      body?.nombre !== undefined &&
      !nombreInput
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El nombre no puede estar vacío',
        },
        { status: 400 }
      );
    }

    if (
      body?.apellido !== undefined &&
      !apellidoInput
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'El apellido no puede estar vacío',
        },
        { status: 400 }
      );
    }

    const nuevoNombre =
      nombreInput ??
      String(
        currentRow.nombre ?? ''
      );

    const nuevoApellido =
      apellidoInput ??
      String(
        currentRow.apellido ??
          ''
      );

    await db.execute({
      sql: `
        UPDATE usuarios
        SET
          nombre = ?,
          apellido = ?,
          actualizado_en = CURRENT_TIMESTAMP
        WHERE CAST(id AS TEXT)
            = CAST(? AS TEXT)
      `,
      args: [
        nuevoNombre,
        nuevoApellido,
        userId,
      ],
    });

    const updatedResult =
      await db.execute({
        sql: `
          SELECT
            id,
            nombre,
            apellido,
            email
          FROM usuarios
          WHERE CAST(id AS TEXT)
              = CAST(? AS TEXT)
          LIMIT 1
        `,
        args: [userId],
      });

    const updatedRow =
      castRows<UserRow>(
        updatedResult.rows
      )[0];

    if (!updatedRow) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'No se pudo recargar el usuario',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,

        message:
          'Perfil actualizado correctamente',

        data: {
          id:
            String(
              updatedRow.id
            ),

          nombre:
            String(
              updatedRow.nombre ??
                ''
            ),

          apellido:
            String(
              updatedRow.apellido ??
                ''
            ),

          email:
            String(
              updatedRow.email ??
                ''
            ),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'PUT /api/user error:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          'Error al actualizar el perfil',
      },
      { status: 500 }
    );
  }
}