// app/api/user/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type RolSistema = 'jefe' | 'admin' | 'colaborador';

type UsuarioListadoRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  pais: string | null;
  telefono_completo: string | null;
  rol: string | null;
  activo: number | string | boolean | null;
  creado_en: string | null;
  puesto: string | null;
  proyectos_creados_count: number | bigint | null;
  proyectos_miembro_count: number | bigint | null;
};

type UsuarioEditableRow = {
  id: string;
  rol: string | null;
  puesto: string | null;
  activo: number | string | boolean | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function normalizarRolSistema(raw: unknown): RolSistema {
  const value = String(raw ?? '').toLowerCase().trim();

  if (value === 'jefe') return 'jefe';
  if (value === 'admin') return 'admin';
  return 'colaborador';
}

function puedeAdministrarUsuarios(rol: RolSistema): boolean {
  return rol === 'jefe' || rol === 'admin';
}

function normalizarActivo(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const v = String(value ?? '').toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'activo';
}

function parseActivo(value: unknown): 0 | 1 | null {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value === 1 ? 1 : 0;

  const normalized = String(value ?? '').toLowerCase().trim();
  if (['1', 'true', 'activo'].includes(normalized)) return 1;
  if (['0', 'false', 'inactivo'].includes(normalized)) return 0;

  return null;
}

function sanitizarTexto(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser(request);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const miRol = normalizarRolSistema(sessionUser.rol);

    if (!puedeAdministrarUsuarios(miRol)) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permisos para ver usuarios' },
        { status: 403 }
      );
    }

    const result = await db.execute({
      sql: `
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u.email,
          u.pais AS pais,
          u.telefono_completo,
          u.rol,
          u.activo,
          u.creado_en,
          u.puesto,
          (
            SELECT COUNT(*)
            FROM proyectos p
            WHERE p.creador_id = u.id
          ) AS proyectos_creados_count,
          (
            SELECT COUNT(DISTINCT pu.proyecto_id)
            FROM proyecto_usuarios pu
            WHERE pu.usuario_id = u.id
          ) AS proyectos_miembro_count
        FROM usuarios u
        ORDER BY u.creado_en DESC, u.id DESC
      `,
      args: [],
    });

    const rows = castRows<UsuarioListadoRow>(result.rows);

    const usuarios = rows.map((row) => ({
      id: String(row.id),
      nombre: String(row.nombre ?? ''),
      apellido: String(row.apellido ?? ''),
      email: String(row.email ?? ''),
      pais: row.pais ?? null,
      telefono: row.telefono_completo ?? null,
      rol: normalizarRolSistema(row.rol),
      activo: normalizarActivo(row.activo),
      creado_en: row.creado_en ?? null,
      puesto: row.puesto ?? null,
      proyectos_creados_count: Number(row.proyectos_creados_count ?? 0),
      proyectos_miembro_count: Number(row.proyectos_miembro_count ?? 0),
    }));

    return NextResponse.json(
      {
        ok: true,
        usuarios,
        total: usuarios.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/user/usuarios error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al listar usuarios' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser(request);

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const miRol = normalizarRolSistema(sessionUser.rol);

    if (!puedeAdministrarUsuarios(miRol)) {
      return NextResponse.json(
        { ok: false, error: 'No tienes permisos para editar usuarios' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const targetUserId =
      typeof body?.id === 'string' ? body.id.trim() : '';

    if (!targetUserId) {
      return NextResponse.json(
        { ok: false, error: 'El id del usuario es obligatorio' },
        { status: 400 }
      );
    }

    const rolFueEnviado = body?.rol !== undefined;
    const puestoInput = sanitizarTexto(body?.puesto);
    const activoInput = parseActivo(body?.activo);

    if (
      body?.rol === undefined &&
      body?.puesto === undefined &&
      body?.activo === undefined
    ) {
      return NextResponse.json(
        { ok: false, error: 'No se enviaron campos para actualizar' },
        { status: 400 }
      );
    }

    if (body?.activo !== undefined && activoInput === null) {
      return NextResponse.json(
        { ok: false, error: 'El campo activo no es válido' },
        { status: 400 }
      );
    }

    const currentResult = await db.execute({
      sql: `
        SELECT id, rol, puesto, activo
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [targetUserId],
    });

    const currentRows = castRows<UsuarioEditableRow>(currentResult.rows);
    const currentUser = currentRows[0];

    if (!currentUser) {
      return NextResponse.json(
        { ok: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const rolActual = normalizarRolSistema(currentUser.rol);

    // Admin no puede editar a un jefe
    if (miRol === 'admin' && rolActual === 'jefe') {
      return NextResponse.json(
        { ok: false, error: 'No puedes editar a un usuario con rol jefe' },
        { status: 403 }
      );
    }

    // Solo jefe puede cambiar roles
    if (rolFueEnviado && miRol !== 'jefe') {
      return NextResponse.json(
        { ok: false, error: 'Solo un jefe puede cambiar roles' },
        { status: 403 }
      );
    }

    // Evitar auto-desactivación
    if (targetUserId === sessionUser.id && activoInput === 0) {
      return NextResponse.json(
        { ok: false, error: 'No puedes desactivar tu propia cuenta' },
        { status: 400 }
      );
    }

    const nuevoRol: RolSistema = rolFueEnviado
      ? normalizarRolSistema(body?.rol)
      : rolActual;

    const nuevoPuesto =
      puestoInput !== undefined
        ? puestoInput
        : (currentUser.puesto ?? null);

    const nuevoActivo =
      activoInput !== null && activoInput !== undefined
        ? activoInput
        : normalizarActivo(currentUser.activo)
          ? 1
          : 0;

    await db.execute({
      sql: `
        UPDATE usuarios
        SET rol = ?, puesto = ?, activo = ?, actualizado_en = datetime('now')
        WHERE id = ?
      `,
      args: [nuevoRol, nuevoPuesto, nuevoActivo, targetUserId],
    });

    const updatedResult = await db.execute({
      sql: `
        SELECT id, nombre, apellido, email, pais AS pais, telefono_completo, rol, activo, creado_en, puesto
        FROM usuarios
        WHERE id = ?
        LIMIT 1
      `,
      args: [targetUserId],
    });

    const updatedRows = castRows<UsuarioListadoRow>(updatedResult.rows);
    const updated = updatedRows[0];

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'Usuario actualizado no encontrado' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Usuario actualizado correctamente',
        data: {
          id: String(updated.id),
          nombre: String(updated.nombre ?? ''),
          apellido: String(updated.apellido ?? ''),
          email: String(updated.email ?? ''),
          pais: updated.pais ?? null,
          telefono: updated.telefono_completo ?? null,
          rol: normalizarRolSistema(updated.rol),
          activo: normalizarActivo(updated.activo),
          creado_en: updated.creado_en ?? null,
          puesto: updated.puesto ?? null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PATCH /api/user/usuarios error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al actualizar usuario' },
      { status: 500 }
    );
  }
}