// app/api/auth/me/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

/**
 * =========================================================
 * 👤 GET — OBTENER USUARIO AUTENTICADO
 * =========================================================
 *
 * Esta ruta devuelve la información básica del usuario
 * que actualmente tiene una sesión válida.
 *
 * La validación se centraliza en:
 *
 * lib/auth.ts
 *
 * De esta forma evitamos repetir consultas y lógica
 * relacionada con:
 *
 * - Lectura de la cookie de sesión.
 * - Búsqueda del usuario en la base de datos.
 * - Validación del estado activo.
 */
export async function GET(req: NextRequest) {
  try {
    /**
     * =====================================================
     * 🔐 VALIDAR SESIÓN Y USUARIO
     * =====================================================
     *
     * getAuthenticatedUser() devuelve:
     *
     * - El usuario autenticado si todo es correcto.
     * - null si no existe sesión, el usuario no existe
     *   o se encuentra desactivado.
     */
    const user = await getAuthenticatedUser(req);

    /**
     * =====================================================
     * 🚫 USUARIO NO AUTENTICADO
     * =====================================================
     */
    if (!user) {
      const response = NextResponse.json(
        {
          ok: false,
          error: 'No autenticado',
        },
        { status: 401 }
      );

      /**
       * Se elimina cualquier cookie de sesión inválida
       * o perteneciente a un usuario desactivado.
       */
      response.cookies.set('session_user_id', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });

      return response;
    }

    /**
     * =====================================================
     * ✅ USUARIO AUTENTICADO
     * =====================================================
     *
     * La contraseña y otros datos sensibles nunca
     * se incluyen en la respuesta.
     */
    return NextResponse.json(
      {
        ok: true,
        data: {
          id: user.id,
          nombre: user.nombre,
          apellido: user.apellido,
          email: user.email,
          rol: user.rol,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    /**
     * =====================================================
     * ⚠️ ERROR INTERNO
     * =====================================================
     */
    console.error('GET /api/auth/me error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}