// lib/auth.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/database";

/**
 * =========================================================
 * 🔑 Helper básico (mantener por compatibilidad)
 * =========================================================
 * Obtiene el userId desde la cookie de sesión
 */
export function getUserIdFromRequest(req: NextRequest): string | null {
  return req.cookies.get("session_user_id")?.value ?? null;
}

/**
 * =========================================================
 * 🧠 Tipo de usuario autenticado
 * =========================================================
 */
export type AuthUser = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
};

/**
 * =========================================================
 * 🔐 Helper principal recomendado
 * =========================================================
 * - Valida sesión
 * - Verifica que el usuario esté activo
 * - Devuelve el usuario listo para usar
 */
export async function getAuthenticatedUser(
  req: NextRequest
): Promise<AuthUser | null> {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) return null;

    const result = await db.execute({
      sql: `
        SELECT id, nombre, apellido, email, rol, activo
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [userId],
    });

    const user = result.rows[0] as any;

    // 🔒 Validación crítica
    if (!user || Number(user.activo ?? 0) !== 1) {
      return null;
    }

    return {
      id: String(user.id),
      nombre: String(user.nombre ?? ""),
      apellido: String(user.apellido ?? ""),
      email: String(user.email ?? ""),
      rol: String(user.rol ?? "colaborador"),
    };
  } catch (error) {
    console.error("getAuthenticatedUser error:", error);
    return null;
  }
}

/**
 * =========================================================
 * 🛡️ Helper para proteger rutas (opcional pero PRO)
 * =========================================================
 * Lanza error si no está autenticado
 */
export async function requireUser(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthenticatedUser(req);

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

/**
 * =========================================================
 * 🔑 Helper de roles (muy útil para tu sistema tipo Jira)
 * =========================================================
 */
export function isAdmin(user: AuthUser): boolean {
  return user.rol === "admin" || user.rol === "jefe";
}

export function isJefe(user: AuthUser): boolean {
  return user.rol === "jefe";
}

