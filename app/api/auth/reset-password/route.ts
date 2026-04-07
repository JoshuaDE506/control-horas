import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/database';
import { resend } from '@/lib/email';

type UserRow = {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  password: string;
  reset_code: string | null;
  reset_expires: string | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function isValidPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?]).{8,}$/.test(
    password
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const email =
      typeof body?.email === 'string'
        ? body.email.trim().toLowerCase()
        : '';

    const code =
      typeof body?.code === 'string'
        ? body.code.trim()
        : '';

    const newPassword =
      typeof body?.newPassword === 'string'
        ? body.newPassword
        : '';

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { ok: false, error: 'Email, código y nueva contraseña son requeridos.' },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { ok: false, error: 'El código debe tener 6 dígitos.' },
        { status: 400 }
      );
    }

    if (!isValidPassword(newPassword)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.',
        },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT id, email, nombre, apellido, password, reset_code, reset_expires
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
        { ok: false, error: 'Usuario no encontrado.' },
        { status: 404 }
      );
    }

    if (!user.reset_code || !user.reset_expires) {
      return NextResponse.json(
        { ok: false, error: 'No hay una solicitud de recuperación activa.' },
        { status: 400 }
      );
    }

    if (user.reset_code !== code) {
      return NextResponse.json(
        { ok: false, error: 'Código inválido.' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const expiresAt = new Date(user.reset_expires).getTime();

    if (Number.isNaN(expiresAt) || expiresAt < now) {
      return NextResponse.json(
        { ok: false, error: 'El código ha expirado.' },
        { status: 400 }
      );
    }

    const samePassword = await bcrypt.compare(newPassword, user.password);
    if (samePassword) {
      return NextResponse.json(
        { ok: false, error: 'La nueva contraseña no puede ser igual a la anterior.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedAt = new Date().toISOString();

    await db.execute({
      sql: `
        UPDATE usuarios
        SET password = ?, reset_code = NULL, reset_expires = NULL, updated_at = ?
        WHERE id = ?
      `,
      args: [hashedPassword, updatedAt, user.id],
    });

    try {
      await resend.emails.send({
        from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
        to: user.email,
        subject: 'Contraseña actualizada',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
            <h2 style="color: #7c3aed;">Contraseña actualizada</h2>
            <p>Hola${user.nombre ? ` ${user.nombre}` : ''},</p>
            <p>Tu contraseña se ha actualizado exitosamente.</p>
            <p>Si tú realizaste este cambio, no necesitas hacer nada más.</p>
            <p>Si no fuiste tú, te recomendamos contactar al administrador o cambiar tu contraseña de inmediato.</p>
            <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
            <p style="font-size: 12px; color: #6b7280;">
              Este es un mensaje automático de seguridad.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Error enviando correo de confirmación de cambio de contraseña:', emailError);
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Contraseña actualizada correctamente.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('POST /api/auth/reset-password error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}