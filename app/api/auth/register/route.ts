// app/api/auth/register/route.ts
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { countries } from '@/lib/countries';

function isValidPassword(password: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?]).{8,}$/.test(
    password
  );
}

function isValidPhone(phone: string): boolean {
  return /^\+?[0-9]{7,20}$/.test(phone);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateShortId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function normalizarTexto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizarEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const nombre = normalizarTexto(body?.nombre);
    const apellido = normalizarTexto(body?.apellido);
    const email = normalizarEmail(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';
    const pais = normalizarTexto(body?.pais);
    const phoneFull = normalizarTexto(body?.telefono_completo);

    if (!nombre || !apellido || !email || !password || !pais) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Nombre, apellido, correo, país y contraseña son obligatorios.',
        },
        { status: 400 }
      );
    }

    if (nombre.length < 2) {
      return NextResponse.json(
        { ok: false, error: 'El nombre debe tener al menos 2 caracteres.' },
        { status: 400 }
      );
    }

    if (apellido.length < 2) {
      return NextResponse.json(
        { ok: false, error: 'El apellido debe tener al menos 2 caracteres.' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'El correo electrónico no es válido.' },
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo.',
        },
        { status: 400 }
      );
    }

    const paisEntry = countries.find((c) => c.pais === pais);

    if (!paisEntry) {
      return NextResponse.json(
        { ok: false, error: 'El país de residencia no es válido.' },
        { status: 400 }
      );
    }

    let phoneFullToSave: string | null = null;

    if (phoneFull !== '') {
      if (!isValidPhone(phoneFull)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'El número de teléfono no es válido.',
          },
          { status: 400 }
        );
      }

      phoneFullToSave = phoneFull;
    }

    const existingUser = await db.execute({
      sql: `
        SELECT id
        FROM usuarios
        WHERE email = ?
        LIMIT 1
      `,
      args: [email],
    });

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'El correo ya está registrado.' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const userId = generateShortId();

    await db.execute({
      sql: `
        INSERT INTO usuarios (
          id,
          nombre,
          apellido,
          email,
          password,
          rol,
          activo,
          creado_en,
          actualizado_en,
          pais,
          telefono_completo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        userId,
        nombre,
        apellido,
        email,
        hashedPassword,
        'colaborador',
        0,
        now,
        now,
        paisEntry.name,
        phoneFullToSave,
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          'Usuario registrado correctamente. Tu cuenta está pendiente de activación por un administrador.',
        data: {
          id: userId,
          email,
          activo: false,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/auth/register error:', error);

    const rawMessage = String(error?.message || '');

    if (
      rawMessage.includes('UNIQUE constraint failed') ||
      rawMessage.includes('UNIQUE')
    ) {
      return NextResponse.json(
        { ok: false, error: 'El correo ya está registrado.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}