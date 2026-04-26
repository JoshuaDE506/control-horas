CREATE
---------------------------------
PRAGMA foreign_keys = ON;

-- =========================
-- TABLA: usuarios
-- =========================
CREATE TABLE usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    rol TEXT NOT NULL,
    activo INTEGER DEFAULT 1,
    creado_en TEXT NOT NULL,
    actualizado_en TEXT NOT NULL,
    codigo_recuperacion TEXT,
    expira_codigo_recuperacion TEXT,
    pais TEXT,
    telefono_completo TEXT,
    puesto TEXT,
    ultima_actividad TEXT
);

-- =========================
-- TABLA: proyectos
-- =========================
CREATE TABLE proyectos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    creador_id TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'activo',
    codigo_union TEXT UNIQUE NOT NULL,
    creado_en NUMERIC DEFAULT CURRENT_TIMESTAMP,
    actualizado_en NUMERIC DEFAULT CURRENT_TIMESTAMP,
    modo_acceso TEXT NOT NULL DEFAULT 'privado',
    prioridad TEXT NOT NULL DEFAULT 'media',
    visibilidad TEXT NOT NULL DEFAULT 'privado',
    fecha_inicio TEXT,
    fecha_fin TEXT,
    configuracion TEXT,
    ultima_actividad TEXT,
    permiso_editar_proyecto TEXT NOT NULL DEFAULT 'owner_admin',
    permiso_gestionar_tareas TEXT NOT NULL DEFAULT 'owner_admin',

    CONSTRAINT proyectos_estado_check CHECK (estado IN ('activo', 'pausado', 'completado', 'cancelado')),
    CONSTRAINT proyectos_modo_acceso_check CHECK (modo_acceso IN ('privado', 'publico', 'solicitud')),
    CONSTRAINT proyectos_prioridad_check CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
    CONSTRAINT proyectos_visibilidad_check CHECK (visibilidad IN ('privado', 'publico')),
    CONSTRAINT proyectos_permiso_editar_check CHECK (permiso_editar_proyecto IN ('owner', 'owner_admin', 'all_members')),
    CONSTRAINT proyectos_permiso_tareas_check CHECK (permiso_gestionar_tareas IN ('owner', 'owner_admin', 'all_members')),
    CONSTRAINT proyectos_creador_id_fk FOREIGN KEY (creador_id) REFERENCES usuarios(id)
);

-- =========================
-- TABLA: tareas
-- =========================
CREATE TABLE tareas (
    id TEXT PRIMARY KEY,
    usuario_id TEXT,
    creador_id TEXT NOT NULL,
    proyecto_id INTEGER,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    prioridad TEXT NOT NULL DEFAULT 'media',
    estado TEXT NOT NULL DEFAULT 'todo',
    fecha_seleccionada TEXT,
    fecha_inicio_trabajo TEXT,
    fecha_envio_revision TEXT,
    fecha_aprobacion TEXT,
    aprobado_por TEXT,
    ultimo_rechazo_comentario TEXT,
    tiempo_estimado_minutos INTEGER,
    max_participantes INTEGER DEFAULT 1,
    permiso_edicion TEXT NOT NULL DEFAULT 'dueno',
    creado_en TEXT NOT NULL,
    actualizado_en TEXT NOT NULL,

    CONSTRAINT tareas_prioridad_check CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
    CONSTRAINT tareas_estado_check CHECK (estado IN ('todo', 'in-progress', 'review', 'completed')),
    CONSTRAINT tareas_max_participantes_check CHECK (max_participantes >= 1),
    CONSTRAINT tareas_usuario_id_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT tareas_creador_id_fk FOREIGN KEY (creador_id) REFERENCES usuarios(id),
    CONSTRAINT tareas_proyecto_id_fk FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
    CONSTRAINT tareas_aprobado_por_fk FOREIGN KEY (aprobado_por) REFERENCES usuarios(id)
);

CREATE INDEX idx_tareas_estado ON tareas (estado);
CREATE INDEX idx_tareas_proyecto_id ON tareas (proyecto_id);
CREATE INDEX idx_tareas_usuario_id ON tareas (usuario_id);
CREATE INDEX idx_tareas_creador_id ON tareas (creador_id);
CREATE INDEX idx_tareas_creado_en ON tareas (creado_en);

-- =========================
-- TABLA: tarea_informes
-- =========================
CREATE TABLE tarea_informes (
    id TEXT PRIMARY KEY,
    tarea_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    titulo TEXT,
    descripcion TEXT,
    url_archivo TEXT,
    creado_en TEXT NOT NULL,

    CONSTRAINT tarea_informes_tipo_check CHECK (tipo IN ('avance', 'final')),
    CONSTRAINT tarea_informes_usuario_id_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT tarea_informes_tarea_id_fk FOREIGN KEY (tarea_id) REFERENCES tareas(id)
);

CREATE INDEX idx_tarea_informes_tipo ON tarea_informes (tipo);
CREATE INDEX idx_tarea_informes_creado_en ON tarea_informes (creado_en);
CREATE INDEX idx_tarea_informes_usuario_id ON tarea_informes (usuario_id);
CREATE INDEX idx_tarea_informes_tarea_id ON tarea_informes (tarea_id);

-- =========================
-- TABLA: tarea_historial
-- =========================
CREATE TABLE tarea_historial (
    id TEXT PRIMARY KEY,
    tarea_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    estado_anterior TEXT,
    estado_nuevo TEXT,
    comentario TEXT,
    creado_en TEXT NOT NULL,

    CONSTRAINT tarea_historial_tarea_id_fk FOREIGN KEY (tarea_id) REFERENCES tareas(id),
    CONSTRAINT tarea_historial_usuario_id_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_tarea_historial_creado_en ON tarea_historial (creado_en);
CREATE INDEX idx_tarea_historial_usuario_id ON tarea_historial (usuario_id);
CREATE INDEX idx_tarea_historial_tarea_id ON tarea_historial (tarea_id);

-- =========================
-- TABLA: tarea_asignaciones
-- =========================
CREATE TABLE tarea_asignaciones (
    id TEXT PRIMARY KEY,
    tarea_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'miembro',
    estado TEXT NOT NULL DEFAULT 'activo',
    creado_en TEXT NOT NULL,
    iniciado_en TEXT,
    completado_en TEXT,
    seleccionado_en TEXT,
    cancelado_en TEXT,

    CONSTRAINT tarea_asignaciones_rol_check CHECK (rol IN ('miembro', 'admin', 'owner')),
    CONSTRAINT tarea_asignaciones_estado_check CHECK (estado IN ('activo', 'cancelado', 'completado', 'pausado')),
    CONSTRAINT tarea_asignaciones_tarea_id_fk FOREIGN KEY (tarea_id) REFERENCES tareas(id),
    CONSTRAINT tarea_asignaciones_usuario_id_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE INDEX idx_ta_tarea_id ON tarea_asignaciones (tarea_id);
CREATE INDEX idx_ta_usuario_id ON tarea_asignaciones (usuario_id);
CREATE INDEX idx_ta_tarea_estado ON tarea_asignaciones (tarea_id, estado);
CREATE UNIQUE INDEX idx_unique_activo ON tarea_asignaciones (tarea_id, usuario_id);

-- =========================
-- TABLA: supervisor_usuarios
-- =========================
CREATE TABLE supervisor_usuarios (
    id TEXT PRIMARY KEY,
    supervisor_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    fecha_inicio TEXT,
    fecha_fin TEXT,
    creado_en TEXT,
    actualizado_en TEXT
);

-- =========================
-- TABLA: registro_jornada
-- =========================
CREATE TABLE registro_jornada (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    supervisor_id TEXT NOT NULL,
    fecha NUMERIC NOT NULL,
    hora_entrada TEXT,
    hora_salida TEXT,
    minutos_trabajados INTEGER DEFAULT 0,
    estado TEXT NOT NULL,
    motivo TEXT,
    creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TEXT
);

-- =========================
-- TABLA: registro_horas
-- =========================
CREATE TABLE registro_horas (
    id TEXT PRIMARY KEY,
    tarea_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    iniciado_en TEXT,
    pausado_en TEXT,
    detenido_en TEXT,
    total_segundos INTEGER DEFAULT 0,
    estado TEXT NOT NULL,
    creado_en TEXT NOT NULL,

    CONSTRAINT fk_registro_horas_usuario_id_usuarios_id_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT fk_registro_horas_tarea_id_tareas_id_fk FOREIGN KEY (tarea_id) REFERENCES tareas(id)
);

CREATE INDEX idx_registro_horas_usuario_id ON registro_horas (usuario_id);
CREATE INDEX idx_registro_horas_tarea_id ON registro_horas (tarea_id);

-- =========================
-- TABLA: proyecto_usuarios
-- =========================
CREATE TABLE proyecto_usuarios (
    proyecto_id INTEGER NOT NULL,
    usuario_id TEXT NOT NULL,
    rol_en_proyecto TEXT NOT NULL,
    fecha_union TEXT,
    tipo_union TEXT,

    CONSTRAINT proyecto_usuarios_rol_check CHECK (rol_en_proyecto IN ('owner', 'admin', 'miembro')),
    CONSTRAINT proyecto_usuarios_tipo_union_check CHECK (tipo_union IS NULL OR tipo_union IN ('owner', 'manual', 'publico', 'solicitud')),
    CONSTRAINT proyecto_usuarios_usuario_id_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT proyecto_usuarios_proyecto_id_fk FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
    CONSTRAINT proyecto_usuarios_unique UNIQUE (proyecto_id, usuario_id)
);

CREATE INDEX idx_proyecto_usuarios_usuario_id ON proyecto_usuarios (usuario_id);
CREATE INDEX idx_proyecto_usuarios_proyecto_id ON proyecto_usuarios (proyecto_id);

-- =========================
-- TABLA: proyecto_solicitudes
-- =========================
CREATE TABLE proyecto_solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL,
    usuario_id TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente',
    mensaje TEXT,
    creado_en NUMERIC DEFAULT CURRENT_TIMESTAMP,
    actualizado_en NUMERIC DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT proyecto_solicitudes_estado_check CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    CONSTRAINT proyecto_solicitudes_proyecto_id_fk FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
    CONSTRAINT proyecto_solicitudes_usuario_id_fk FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    CONSTRAINT proyecto_solicitudes_unique UNIQUE (proyecto_id, usuario_id)
);

CREATE INDEX idx_proyecto_solicitudes_estado ON proyecto_solicitudes (estado);
CREATE INDEX idx_proyecto_solicitudes_usuario_id ON proyecto_solicitudes (usuario_id);
CREATE INDEX idx_proyecto_solicitudes_proyecto_id ON proyecto_solicitudes (proyecto_id);




CREATE TABLE sesiones_trabajo (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    inicio TEXT NOT NULL,
    fin TEXT,
    actualizado_en TEXT,

    CONSTRAINT fk_sesiones_trabajo_usuario_id_usuarios_id_fk
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);


