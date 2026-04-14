// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(req: NextRequest) {
  const response = NextResponse.json(
    {
      ok: true,
      message: 'Logout correcto',
    },
    { status: 200 }
  );

  try {
    const userId = req.cookies.get('session_user_id')?.value;

    if (userId) {
      const now = new Date().toISOString();

      await db.execute({
        sql: `
          UPDATE sesiones_trabajo
          SET fin = ?, actualizado_en = ?
          WHERE usuario_id = ? AND fin IS NULL
        `,
        args: [now, now, userId],
      });
    }
  } catch (error) {
    console.error('POST /api/auth/logout DB error:', error);
  }

  response.cookies.set('session_user_id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('session', '', {
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('role', '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}