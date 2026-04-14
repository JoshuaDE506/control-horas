// api/jornada/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

type AsignacionActiva = {
  id: string;
  usuario_id: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

function esAdminOJefe(rol: string) {
  const r = String(rol ?? '').trim().toLowerCase();
  return r === 'admin' || r === 'jefe';
}

function normalizarTexto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function limpiarIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((id) => String(id ?? '').trim())
        .filter(Boolean)
    ),
  ];
}

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!esAdminOJefe(String(user.rol ?? ''))) {
      return NextResponse.json(
        { ok: false, error: 'Sin permisos' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const modo = normalizarTexto(searchParams.get('modo')).toLowerCase();
    const fecha = normalizarTexto(searchParams.get('fecha')) || hoyISO();

    if (modo === 'disponibles') {
      const disponiblesRes = await db.execute({
        sql: `
          SELECT
            id,
            nombre,
            apellido,
            rol,
            puesto
          FROM usuarios
          WHERE CAST(COALESCE(activo, 0) AS INTEGER) = 1
            AND LOWER(TRIM(COALESCE(rol, ''))) IN ('colaborador', 'admin', 'jefe')
          ORDER BY nombre ASC, apellido ASC
        `,
        args: [],
      });

      const disponibles = (disponiblesRes.rows ?? []).map((row) => ({
        id: String(row.id ?? ''),
        nombre: String(row.nombre ?? ''),
        apellido: String(row.apellido ?? ''),
        rol: String(row.rol ?? ''),
        puesto: String(row.puesto ?? ''),
      }));

      return NextResponse.json({
        ok: true,
        data: disponibles,
      });
    }

    const asignadosRes = await db.execute({
      sql: `
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u.rol,
          u.puesto,
          su.fecha_inicio,
          su.fecha_fin
        FROM supervisor_usuarios su
        JOIN usuarios u ON u.id = su.usuario_id
        WHERE su.supervisor_id = ?
          AND CAST(COALESCE(u.activo, 0) AS INTEGER) = 1
          AND DATE(COALESCE(su.fecha_inicio, '1900-01-01')) <= DATE(?)
          AND (
            su.fecha_fin IS NULL
            OR su.fecha_fin = ''
            OR DATE(su.fecha_fin) >= DATE(?)
          )
        ORDER BY u.nombre ASC, u.apellido ASC
      `,
      args: [String(user.id), fecha, fecha],
    });

    const asignados = (asignadosRes.rows ?? []).map((row) => ({
      id: String(row.id ?? ''),
      nombre: String(row.nombre ?? ''),
      apellido: String(row.apellido ?? ''),
      rol: String(row.rol ?? ''),
      puesto: String(row.puesto ?? ''),
      fecha_inicio: row.fecha_inicio ? String(row.fecha_inicio) : null,
      fecha_fin: row.fecha_fin ? String(row.fecha_fin) : null,
    }));

    return NextResponse.json({
      ok: true,
      data: asignados,
    });
  } catch (error) {
    console.error('GET /api/jornada/usuarios error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (!esAdminOJefe(String(user.rol ?? ''))) {
      return NextResponse.json(
        { ok: false, error: 'Sin permisos' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const idsLimpios = limpiarIds(body?.usuarios_ids);
    const fecha = normalizarTexto(body?.fecha) || hoyISO();

    for (const usuarioId of idsLimpios) {
      const validacionRes = await db.execute({
        sql: `
          SELECT id
          FROM usuarios
          WHERE id = ?
            AND CAST(COALESCE(activo, 0) AS INTEGER) = 1
            AND LOWER(TRIM(COALESCE(rol, ''))) IN ('colaborador', 'admin', 'jefe')
          LIMIT 1
        `,
        args: [usuarioId],
      });

      if (!validacionRes.rows || validacionRes.rows.length === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: `El usuario ${usuarioId} no es válido o no está activo`,
          },
          { status: 400 }
        );
      }
    }

    const activasRes = await db.execute({
      sql: `
        SELECT
          id,
          usuario_id,
          fecha_inicio,
          fecha_fin
        FROM supervisor_usuarios
        WHERE supervisor_id = ?
          AND DATE(COALESCE(fecha_inicio, '1900-01-01')) <= DATE(?)
          AND (
            fecha_fin IS NULL
            OR fecha_fin = ''
            OR DATE(fecha_fin) >= DATE(?)
          )
      `,
      args: [String(user.id), fecha, fecha],
    });

    const activas: AsignacionActiva[] = (activasRes.rows ?? []).map((row) => ({
      id: String(row.id ?? ''),
      usuario_id: String(row.usuario_id ?? ''),
      fecha_inicio: row.fecha_inicio ? String(row.fecha_inicio) : null,
      fecha_fin: row.fecha_fin ? String(row.fecha_fin) : null,
    }));

    const activosIds = new Set(activas.map((a) => a.usuario_id));
    const nuevosIds = new Set(idsLimpios);

    const paraCerrar = activas.filter((a) => !nuevosIds.has(a.usuario_id));
    const paraAgregar = idsLimpios.filter((id) => !activosIds.has(id));

    for (const asignacion of paraCerrar) {
      await db.execute({
        sql: `
          UPDATE supervisor_usuarios
          SET
            fecha_fin = DATE(?, '-1 day'),
            actualizado_en = CURRENT_TIMESTAMP
          WHERE id = ?
            AND supervisor_id = ?
        `,
        args: [fecha, asignacion.id, String(user.id)],
      });
    }

    for (const usuarioId of paraAgregar) {
      const existenteActivaRes = await db.execute({
        sql: `
          SELECT id
          FROM supervisor_usuarios
          WHERE supervisor_id = ?
            AND usuario_id = ?
            AND fecha_fin IS NULL
          LIMIT 1
        `,
        args: [String(user.id), usuarioId],
      });

      const yaActivaAbierta =
        existenteActivaRes.rows && existenteActivaRes.rows.length > 0;

      if (!yaActivaAbierta) {
        await db.execute({
          sql: `
            INSERT INTO supervisor_usuarios (
              id,
              supervisor_id,
              usuario_id,
              fecha_inicio,
              fecha_fin,
              creado_en,
              actualizado_en
            )
            VALUES (?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          args: [
            crypto.randomUUID(),
            String(user.id),
            usuarioId,
            fecha,
          ],
        });
      }
    }

    const asignadosRes = await db.execute({
      sql: `
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u.rol,
          u.puesto,
          su.fecha_inicio,
          su.fecha_fin
        FROM supervisor_usuarios su
        JOIN usuarios u ON u.id = su.usuario_id
        WHERE su.supervisor_id = ?
          AND CAST(COALESCE(u.activo, 0) AS INTEGER) = 1
          AND DATE(COALESCE(su.fecha_inicio, '1900-01-01')) <= DATE(?)
          AND (
            su.fecha_fin IS NULL
            OR su.fecha_fin = ''
            OR DATE(su.fecha_fin) >= DATE(?)
          )
        ORDER BY u.nombre ASC, u.apellido ASC
      `,
      args: [String(user.id), fecha, fecha],
    });

    const asignados = (asignadosRes.rows ?? []).map((row) => ({
      id: String(row.id ?? ''),
      nombre: String(row.nombre ?? ''),
      apellido: String(row.apellido ?? ''),
      rol: String(row.rol ?? ''),
      puesto: String(row.puesto ?? ''),
      fecha_inicio: row.fecha_inicio ? String(row.fecha_inicio) : null,
      fecha_fin: row.fecha_fin ? String(row.fecha_fin) : null,
    }));

    return NextResponse.json({
      ok: true,
      data: asignados,
      total_asignados: asignados.length,
    });
  } catch (error) {
    console.error('POST /api/jornada/usuarios error:', error);

    return NextResponse.json(
      { ok: false, error: 'Error al asignar usuarios' },
      { status: 500 }
    );
  }
}