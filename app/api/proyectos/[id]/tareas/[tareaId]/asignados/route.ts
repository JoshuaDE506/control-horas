// app/api/proyectos/[id]/tareas/[tareaId]/asignados/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { getUserIdFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type ModoAccesoProyecto = "privado" | "publico" | "solicitud";
type EstadoTarea = "todo" | "in-progress" | "review" | "completed";

type TareaProyectoRow = {
  id: string;
  proyecto_id: number | bigint;
  estado: string | null;
};

type ProyectoAccesoRow = {
  id: number | bigint;
  creador_id: string | null;
  modo_acceso: string | null;
  visibilidad: string | null;
};

type AsignadoRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  seleccionada_at: string | null;
  iniciado_en: string | null;
  completado_en: string | null;
  cronometro_estado: string | null;
  cronometro_total_segundos: number | bigint | null;
};

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function toNumber(value: number | bigint | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "bigint" ? Number(value) : Number(value);
}

function normalizeEstadoTarea(raw: unknown): EstadoTarea {
  const value = String(raw ?? "").toLowerCase().trim();

  if (value === "in-progress" || value === "in_progress") return "in-progress";
  if (value === "review" || value === "revision" || value === "revisión") {
    return "review";
  }
  if (value === "completed") return "completed";
  return "todo";
}

function normalizarModoAcceso(
  rawModo: unknown,
  rawVisibilidad?: unknown
): ModoAccesoProyecto {
  const modo = String(rawModo ?? "").toLowerCase().trim();
  const vis = String(rawVisibilidad ?? "").toLowerCase().trim();

  if (modo === "publico" || modo === "público" || modo === "public") {
    return "publico";
  }

  if (
    modo === "solicitud" ||
    modo === "request" ||
    modo === "invitacion" ||
    modo === "invitación" ||
    modo === "invite"
  ) {
    return "solicitud";
  }

  if (modo === "privado" || modo === "private") {
    return "privado";
  }

  if (vis === "publico" || vis === "público" || vis === "public") {
    return "publico";
  }

  return "privado";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tareaId: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id, tareaId } = await params;
    const proyectoId = Number(id);

    if (!Number.isFinite(proyectoId) || !tareaId) {
      return NextResponse.json(
        { error: "Parámetros inválidos" },
        { status: 400 }
      );
    }

    const tRes = await db.execute({
      sql: `
        SELECT id, proyecto_id, estado
        FROM tareas
        WHERE id = ? AND proyecto_id = ?
        LIMIT 1;
      `,
      args: [String(tareaId), proyectoId],
    });

    const tareaRows = castRows<TareaProyectoRow>(tRes.rows);
    const tarea = tareaRows[0];

    if (!tarea) {
      return NextResponse.json({ error: "Tarea no existe" }, { status: 404 });
    }

    const estadoTarea = normalizeEstadoTarea(tarea.estado);

    const pRes = await db.execute({
      sql: `
        SELECT id, creador_id, modo_acceso, visibilidad
        FROM proyectos
        WHERE id = ?
        LIMIT 1;
      `,
      args: [proyectoId],
    });

    const proyectoRows = castRows<ProyectoAccesoRow>(pRes.rows);
    const proyecto = proyectoRows[0];

    if (!proyecto) {
      return NextResponse.json(
        { error: "Proyecto no existe" },
        { status: 404 }
      );
    }

    const isCreator = String(proyecto.creador_id ?? "") === String(userId);

    const memberRes = await db.execute({
      sql: `
        SELECT 1
        FROM proyecto_usuarios
        WHERE proyecto_id = ?
          AND CAST(usuario_id AS TEXT) = CAST(? AS TEXT)
        LIMIT 1;
      `,
      args: [proyectoId, String(userId)],
    });

    const isMember = !!memberRes.rows?.length;
    const modoAcceso = normalizarModoAcceso(
      proyecto.modo_acceso,
      proyecto.visibilidad
    );

    let canAccess = false;
    let canRequestAccess = false;

    if (modoAcceso === "publico") {
      canAccess = true;
    } else if (modoAcceso === "solicitud") {
      canAccess = isCreator || isMember;
      canRequestAccess = !canAccess;
    } else {
      canAccess = isCreator || isMember;
    }

    if (!canAccess) {
      return NextResponse.json(
        {
          error:
            modoAcceso === "solicitud"
              ? "Requiere aprobación"
              : "Sin acceso a este proyecto",
          canRequestAccess,
        },
        { status: 403 }
      );
    }

    const aRes = await db.execute({
      sql: `
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u.email,
          COALESCE(ta.seleccionado_en, ta.creado_en) AS seleccionada_at,
          ta.iniciado_en,
          ta.completado_en,
          rh.estado AS cronometro_estado,
          rh.total_segundos AS cronometro_total_segundos
        FROM tarea_asignaciones ta
        JOIN usuarios u
          ON CAST(u.id AS TEXT) = CAST(ta.usuario_id AS TEXT)
        LEFT JOIN registro_horas rh
          ON rh.id = (
            SELECT rh2.id
            FROM registro_horas rh2
            WHERE rh2.tarea_id = ta.tarea_id
              AND CAST(rh2.usuario_id AS TEXT) = CAST(ta.usuario_id AS TEXT)
            ORDER BY rh2.creado_en DESC
            LIMIT 1
          )
        WHERE ta.tarea_id = ?
          AND ta.estado = 'activo'
        ORDER BY ta.creado_en ASC;
      `,
      args: [String(tareaId)],
    });

    const asignados = castRows<AsignadoRow>(aRes.rows).map((row) => ({
      id: String(row.id),
      nombre: row.nombre ?? "",
      apellido: row.apellido ?? "",
      email: row.email ?? "",
      seleccionada_at: row.seleccionada_at ?? null,
      iniciado_en: row.iniciado_en ?? null,
      completado_en: row.completado_en ?? null,
      ha_comenzado: !!row.iniciado_en,
      ha_completado: !!row.completado_en,
      cronometro: {
        estado: row.cronometro_estado ?? null,
        total_segundos: toNumber(row.cronometro_total_segundos),
      },
    }));

    return NextResponse.json(
      {
        asignados,
        meta: {
          modo_acceso: modoAcceso,
          es_creador: isCreator,
          es_miembro: isMember,
          estado_tarea: estadoTarea,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("GET asignados error:", e);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}