// app/api/test-email/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAuthenticatedUser } from '@/lib/auth';

export const runtime = 'nodejs';

function esAdmin(
  rol: unknown
): boolean {
  return (
    String(rol ?? '')
      .toLowerCase()
      .trim() === 'admin'
  );
}

export async function POST(
  req: NextRequest
) {
  try {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No autenticado',
        },
        { status: 401 }
      );
    }

    if (!esAdmin(user.rol)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sin permisos',
        },
        { status: 403 }
      );
    }

    const apiKey =
      process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error(
        'RESEND_API_KEY no configurada'
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            'Servicio de correo no configurado',
        },
        { status: 500 }
      );
    }

    const body =
      await req
        .json()
        .catch(() => ({}));

    const destino =
      typeof body?.email === 'string'
        ? body.email
            .trim()
            .toLowerCase()
        : '';

    if (
      !destino ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        destino
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Debes indicar un correo válido',
        },
        { status: 400 }
      );
    }

    const resend =
      new Resend(apiKey);

    const result =
      await resend.emails.send({
        from:
          'Código Fácil <onboarding@resend.dev>',

        to: destino,

        subject:
          'Prueba de correo - Código Fácil',

        html: `
          <h2>Correo de prueba</h2>
          <p>
            El servicio de correo de Código Fácil
            está funcionando correctamente.
          </p>
        `,
      });

    if (result.error) {
      console.error(
        'RESEND ERROR:',
        result.error
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            'No se pudo enviar el correo',
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          'Correo de prueba enviado correctamente',
        data: result.data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'POST /api/test-email error:',
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
