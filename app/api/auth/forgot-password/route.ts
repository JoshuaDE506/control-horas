// app/api/auth/forgot-password/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { resend } from '@/lib/email';

type UserRow = {
  id: string;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email =
      typeof body?.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';

    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'Email requerido' },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT id
        FROM usuarios
        WHERE email = ?
        LIMIT 1
      `,
      args: [email],
    });

    const rows = castRows<UserRow>(result.rows);
    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        {
          ok: true,
          message: 'Si el correo existe, se generó un código de recuperación.',
        },
        { status: 200 }
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const updatedAt = new Date().toISOString();

    await db.execute({
      sql: `
        UPDATE usuarios
        SET reset_code = ?, reset_expires = ?, updated_at = ?
        WHERE id = ?
      `,
      args: [code, expiresAt, updatedAt, user.id],
    });

    const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

    try {
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Código de recuperación de contraseña',
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
              <h2 style="margin: 0 0 16px; color: #111827;">Recuperación de contraseña</h2>

              <p style="margin: 0 0 12px; font-size: 15px;">
                Hola.
              </p>

              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6;">
                Usa el siguiente código de verificación para restablecer tu contraseña:
              </p>

              <div style="text-align: center; margin: 24px 0;">
                <div style="
                  display: inline-block;
                  font-size: 32px;
                  font-weight: bold;
                  letter-spacing: 8px;
                  padding: 16px 24px;
                  border-radius: 10px;
                  background: #f1f5f9;
                  color: #7c3aed;
                  border: 1px solid #ddd6fe;
                ">
                  ${code}
                </div>
              </div>

              <p style="margin: 20px 0 8px; font-size: 14px; line-height: 1.6; color: #334155;">
                Este código expirará en <strong>15 minutos</strong>.
              </p>

              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b;">
                Si no solicitaste este cambio, puedes ignorar este correo.
              </p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Error enviando correo con Resend:', emailError);

      return NextResponse.json(
        {
          ok: false,
          error: 'No se pudo enviar el correo de recuperación.',
        },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('==============================');
      console.log('CÓDIGO DE RECUPERACIÓN');
      console.log('Email:', email);
      console.log('Código:', code);
      console.log('Expira:', expiresAt);
      console.log('==============================');
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Si el correo existe, se generó un código de recuperación.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/auth/forgot-password error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}