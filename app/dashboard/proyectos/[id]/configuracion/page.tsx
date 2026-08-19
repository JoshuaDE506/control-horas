// app/dashboard/proyectos/[id]/configuracion/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ConfirmModal from '@/components/ConfirmModal';

// ─── Types ─────────────────────────────────────────────────────────────────────

type EstadoProyecto = 'activo' | 'pausado' | 'completado' | 'cancelado';
type ModoAcceso = 'privado' | 'solicitud' | 'publico';
type PrioridadProyecto = 'baja' | 'media' | 'alta' | 'critica';
type PermisoNivel = 'admin' | 'todos';

interface ProjectSettingsForm {
  nombre: string;
  descripcion: string;
  estado: EstadoProyecto;
  visibilidad: 'privado' | 'publico';
  modoAcceso: ModoAcceso;
  prioridad: PrioridadProyecto;
  fechaInicio: string;
  fechaFin: string;
  permisoEdicion: PermisoNivel;
  permisoGestionTareas: PermisoNivel;
}

interface ProyectoApi {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: string;
  visibilidad: string;
  modo_acceso: string;
  prioridad: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  configuracion?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDuration(
  start: string,
  end: string
): { text: string; isError: boolean } | null {
  if (!start || !end) return null;

  const [startYear, startMonth, startDay] = start
    .slice(0, 10)
    .split('-')
    .map(Number);

  const [endYear, endMonth, endDay] = end
    .slice(0, 10)
    .split('-')
    .map(Number);

  if (
    !startYear ||
    !startMonth ||
    !startDay ||
    !endYear ||
    !endMonth ||
    !endDay
  ) {
    return null;
  }

  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);

  const ms = endDate.getTime() - startDate.getTime();

  if (ms < 0) {
    return {
      text: 'La fecha de fin es anterior al inicio.',
      isError: true,
    };
  }

  const days = Math.round(ms / 86400000);

  return {
    text: `Duración estimada: ${days} día(s) (${Math.floor(days / 7)} semanas)`,
    isError: false,
  };
}

function permisoApiToUi(v?: string | null): PermisoNivel {
  const val = String(v ?? '')
    .toLowerCase()
    .trim();

  /*
   * Compatibilidad con valores antiguos:
   * owner       -> owner_admin
   * all_members -> todos_miembros
   */
  if (
    val === 'owner_admin' ||
    val === 'owner' ||
    val === 'admin'
  ) {
    return 'admin';
  }

  if (
    val === 'todos_miembros' ||
    val === 'all_members' ||
    val === 'todos'
  ) {
    return 'todos';
  }

  return 'admin';
}

function permisoUiToApi(
  v: PermisoNivel
): 'owner_admin' | 'todos_miembros' {
  return v === 'todos'
    ? 'todos_miembros'
    : 'owner_admin';
}

function normalizarEstado(raw: unknown): EstadoProyecto {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (
    value === 'activo' ||
    value === 'pausado' ||
    value === 'completado' ||
    value === 'cancelado'
  ) {
    return value;
  }

  return 'activo';
}

function normalizarPrioridad(raw: unknown): PrioridadProyecto {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (
    value === 'baja' ||
    value === 'media' ||
    value === 'alta' ||
    value === 'critica'
  ) {
    return value;
  }

  return 'media';
}

function normalizarVisibilidad(
  raw: unknown
): 'privado' | 'publico' {
  return String(raw ?? '')
    .trim()
    .toLowerCase() === 'publico'
    ? 'publico'
    : 'privado';
}

function normalizarModoAcceso(raw: unknown): ModoAcceso {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (
    value === 'privado' ||
    value === 'solicitud' ||
    value === 'publico'
  ) {
    return value;
  }

  return 'privado';
}

// ─── Default ───────────────────────────────────────────────────────────────────

const EMPTY_FORM: ProjectSettingsForm = {
  nombre: '',
  descripcion: '',
  estado: 'activo',
  visibilidad: 'privado',
  modoAcceso: 'privado',
  prioridad: 'media',
  fechaInicio: '',
  fechaFin: '',
  permisoEdicion: 'admin',
  permisoGestionTareas: 'admin',
};

// ─── Estilos compartidos ───────────────────────────────────────────────────────

const inputCls =
  'w-full px-4 py-3 bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none disabled:opacity-60 disabled:cursor-not-allowed';

const dateInputCls =
  'w-full px-4 py-3 bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none [color-scheme:dark] disabled:opacity-60 disabled:cursor-not-allowed';

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon,
  children,
  danger = false,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`${
        danger
          ? 'border-red-500/20 bg-red-950/20'
          : 'border-slate-700/50 bg-slate-900/40'
      } rounded-2xl border p-4 shadow-xl backdrop-blur-sm sm:p-6`}
    >
      <div className="mb-5 flex items-start gap-3">
        <div
          className={`mt-0.5 h-6 w-1 shrink-0 rounded-full ${
            danger
              ? 'bg-gradient-to-b from-red-500 to-rose-600'
              : 'bg-gradient-to-b from-purple-500 to-blue-500'
          }`}
        />

        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={`shrink-0 ${
              danger ? 'text-red-400' : 'text-gray-400'
            }`}
          >
            {icon}
          </span>

          <div className="min-w-0">
            <h2 className="leading-tight text-white text-base sm:text-lg font-bold">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-500">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  hintColor = 'text-gray-500',
  children,
}: {
  label: string;
  hint?: string;
  hintColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {label}
      </label>

      {children}

      {hint && (
        <p className={`mt-2 text-xs ${hintColor}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface ChipOption {
  value: string;
  label: string;
  dot?: string;
}

function ChipGroup({
  options,
  value,
  onChange,
  activeColorFn,
  disabled,
}: {
  options: ChipOption[];
  value: string;
  onChange: (v: string) => void;
  activeColorFn: (v: string) => string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = value === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                onChange(opt.value);
              }
            }}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 sm:px-4
              ${disabled ? 'cursor-not-allowed opacity-60' : ''}
              ${
                isActive
                  ? activeColorFn(opt.value)
                  : 'border-slate-700/50 bg-slate-800/50 text-gray-400 hover:bg-slate-700/50 hover:text-gray-200'
              }`}
          >
            {opt.dot && (
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full transition-colors"
                style={{
                  background: isActive
                    ? opt.dot
                    : '#4b5563',
                }}
              />
            )}

            <span className="break-words text-left">
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Iconos ────────────────────────────────────────────────────────────────────

const IconId = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0"
    />
  </svg>
);

const IconFlag = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 21V3m0 0l9 4 9-4v12l-9 4-9-4V3z"
    />
  </svg>
);

const IconChart = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
    />
  </svg>
);

const IconGlobe = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      strokeWidth={2}
    />

    <path
      strokeWidth={2}
      d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"
    />
  </svg>
);

const IconCalendar = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const IconLock = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const IconArrowLeft = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 12H5M12 5l-7 7 7 7"
    />
  </svg>
);

const IconCheck = () => (
  <svg
    className="h-4 w-4"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const IconTrash = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

// ─── Página principal ──────────────────────────────────────────────────────────

export default function ProjectSettingsView() {
  const router = useRouter();

  const params = useParams() as {
    id?: string | string[];
  };

  const proyectoId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [form, setForm] =
    useState<ProjectSettingsForm>(EMPTY_FORM);

  const [initialForm, setInitialForm] =
    useState<ProjectSettingsForm | null>(null);

  const [isDirty, setIsDirty] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [
    puedeEditarConfig,
    setPuedeEditarConfig,
  ] = useState(false);

  const [
    puedeEliminarProyecto,
    setPuedeEliminarProyecto,
  ] = useState(false);

  const [
    showSaveConfirm,
    setShowSaveConfirm,
  ] = useState(false);

  const [
    showNoPermission,
    setShowNoPermission,
  ] = useState(false);

  const [
    showDeleteConfirm,
    setShowDeleteConfirm,
  ] = useState(false);

  const canEdit = puedeEditarConfig;

  const update = (
    key: keyof ProjectSettingsForm,
    value: any
  ) => {
    if (!canEdit) return;

    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

    setIsDirty(true);
    setSaved(false);
  };

  const handleModoAcceso = (v: string) => {
    if (!canEdit) return;

    const modo = v as ModoAcceso;

    /*
     * modo_acceso y visibilidad son independientes.
     * Cambiar uno no debe modificar automáticamente
     * el otro.
     */
    setForm((prev) => ({
      ...prev,
      modoAcceso: modo,
    }));

    setIsDirty(true);
    setSaved(false);
  };

  useEffect(() => {
    if (!proyectoId) {
      setLoading(false);
      setError('ID de proyecto no válido');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(
          `/api/proyectos/${proyectoId}/configuracion`,
          {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          }
        );

        const data: any = await res
          .json()
          .catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            typeof data?.error === 'string'
              ? data.error
              : 'No se pudo cargar la configuración'
          );
        }

        const p = (
          data?.proyecto ??
          data?.data?.proyecto
        ) as ProyectoApi;

        if (!p) {
          throw new Error(
            'Proyecto no encontrado'
          );
        }

        const meta =
          data?.meta ??
          data?.data?.meta ??
          {};

        const permsMeta =
          meta.permisosConfiguracion ??
          {};

        const mapped: ProjectSettingsForm = {
          nombre: String(
            p.nombre ?? ''
          ),

          descripcion: String(
            p.descripcion ?? ''
          ),

          estado:
            normalizarEstado(
              p.estado
            ),

          visibilidad:
            normalizarVisibilidad(
              p.visibilidad
            ),

          modoAcceso:
            normalizarModoAcceso(
              p.modo_acceso
            ),

          prioridad:
            normalizarPrioridad(
              p.prioridad
            ),

          fechaInicio:
            p.fecha_inicio ?? '',

          fechaFin:
            p.fecha_fin ?? '',

          permisoEdicion:
            permisoApiToUi(
              permsMeta.permisoEdicion
            ),

          permisoGestionTareas:
            permisoApiToUi(
              permsMeta.permisoGestionTareas
            ),
        };

        setForm(mapped);
        setInitialForm(mapped);
        setIsDirty(false);

        const puedeEditar =
          meta.puedeEditarProyecto === true;

        const puedeEliminar =
          meta.puedeEliminarProyecto === true;

        setPuedeEditarConfig(
          puedeEditar
        );

        setPuedeEliminarProyecto(
          puedeEliminar
        );

        if (!puedeEditar) {
          setShowNoPermission(true);
        }
      } catch (err) {
        console.error(
          'Error cargando configuración:',
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : 'Error cargando configuración'
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [proyectoId]);

  const handleSave = async () => {
    if (
      !proyectoId ||
      !canEdit ||
      saving
    ) {
      return;
    }

    const nombre =
      form.nombre.trim();

    const descripcion =
      form.descripcion.trim();

    if (!nombre) {
      setError(
        'El nombre del proyecto es obligatorio'
      );
      return;
    }

    if (
      form.fechaInicio &&
      form.fechaFin &&
      form.fechaFin < form.fechaInicio
    ) {
      setError(
        'La fecha de fin no puede ser anterior a la fecha de inicio'
      );
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        nombre,

        descripcion:
          descripcion || null,

        estado:
          form.estado,

        visibilidad:
          form.visibilidad,

        modo_acceso:
          form.modoAcceso,

        prioridad:
          form.prioridad,

        fecha_inicio:
          form.fechaInicio || null,

        fecha_fin:
          form.fechaFin || null,

        permisoEdicion:
          permisoUiToApi(
            form.permisoEdicion
          ),

        permisoGestionTareas:
          permisoUiToApi(
            form.permisoGestionTareas
          ),
      };

      const res = await fetch(
        `/api/proyectos/${proyectoId}/configuracion`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(
            payload
          ),
        }
      );

      const data: any = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Error al guardar la configuración'
        );
      }

      const p = (
        data?.proyecto ??
        data?.data?.proyecto
      ) as ProyectoApi | null;

      const meta =
        data?.meta ??
        data?.data?.meta ??
        {};

      const permsMeta =
        meta.permisosConfiguracion ??
        {};

      if (p) {
        const mapped: ProjectSettingsForm = {
          nombre: String(
            p.nombre ?? ''
          ),

          descripcion: String(
            p.descripcion ?? ''
          ),

          estado:
            normalizarEstado(
              p.estado
            ),

          visibilidad:
            normalizarVisibilidad(
              p.visibilidad
            ),

          modoAcceso:
            normalizarModoAcceso(
              p.modo_acceso
            ),

          prioridad:
            normalizarPrioridad(
              p.prioridad
            ),

          fechaInicio:
            p.fecha_inicio ?? '',

          fechaFin:
            p.fecha_fin ?? '',

          permisoEdicion:
            permisoApiToUi(
              permsMeta.permisoEdicion
            ),

          permisoGestionTareas:
            permisoApiToUi(
              permsMeta.permisoGestionTareas
            ),
        };

        setForm(mapped);
        setInitialForm(mapped);
      }

      setPuedeEditarConfig(
        meta.puedeEditarProyecto === true
      );

      setPuedeEliminarProyecto(
        meta.puedeEliminarProyecto === true
      );

      setIsDirty(false);
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (err) {
      console.error(
        'Error guardando configuración:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Error al guardar configuración'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (
      !proyectoId ||
      !puedeEliminarProyecto ||
      deleting
    ) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const res = await fetch(
        `/api/proyectos/${proyectoId}/configuracion`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data: any = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Error al eliminar el proyecto'
        );
      }

      setShowDeleteConfirm(false);

      router.push(
        '/dashboard/proyectos'
      );

      router.refresh();
    } catch (err) {
      console.error(
        'Error eliminando proyecto:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Error al eliminar proyecto'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDiscard = () => {
    if (initialForm) {
      setForm(initialForm);
      setIsDirty(false);
      setSaved(false);
      setError('');
    }
  };

  const duration =
    getDuration(
      form.fechaInicio,
      form.fechaFin
    );

  const nombreLeft =
    80 - form.nombre.length;

  const descLeft =
    400 - form.descripcion.length;

  const showSaveBar =
    canEdit && isDirty;

  const estadoColor = (
    v: EstadoProyecto
  ) =>
    ({
      activo:
        'bg-green-500/10 text-green-400 border-green-500/30',
      pausado:
        'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      completado:
        'bg-blue-500/10 text-blue-400 border-blue-500/30',
      cancelado:
        'bg-red-500/10 text-red-400 border-red-500/30',
    }[v]);

  const prioridadColor = (
    v: PrioridadProyecto
  ) =>
    ({
      baja:
        'bg-blue-500/10 text-blue-400 border-blue-500/30',
      media:
        'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      alta:
        'bg-orange-500/10 text-orange-400 border-orange-500/30',
      critica:
        'bg-red-500/10 text-red-400 border-red-500/30',
    }[v]);

  const gradientActive = () =>
    'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-purple-500/50 shadow-lg';

  const estadoOptions: ChipOption[] = [
    {
      value: 'activo',
      label: 'Activo',
      dot: '#4ade80',
    },
    {
      value: 'pausado',
      label: 'Pausado',
      dot: '#facc15',
    },
    {
      value: 'completado',
      label: 'Completado',
      dot: '#60a5fa',
    },
    {
      value: 'cancelado',
      label: 'Cancelado',
      dot: '#f87171',
    },
  ];

  const prioridadOptions: ChipOption[] = [
    {
      value: 'baja',
      label: 'Baja',
      dot: '#60a5fa',
    },
    {
      value: 'media',
      label: 'Media',
      dot: '#facc15',
    },
    {
      value: 'alta',
      label: 'Alta',
      dot: '#fb923c',
    },
    {
      value: 'critica',
      label: 'Crítica',
      dot: '#f87171',
    },
  ];

  const modoAccesoOptions: ChipOption[] = [
    {
      value: 'privado',
      label: 'Privado',
    },
    {
      value: 'solicitud',
      label: 'Por solicitud',
    },
    {
      value: 'publico',
      label: 'Público',
    },
  ];

  const visOptions: ChipOption[] = [
    {
      value: 'privado',
      label: 'Privado',
    },
    {
      value: 'publico',
      label: 'Público',
    },
  ];

  const permisoOptions: ChipOption[] = [
    {
      value: 'admin',
      label: 'Admins',
    },
    {
      value: 'todos',
      label: 'Todos los miembros',
    },
  ];

  const ACCESS_HINTS: Record<
    ModoAcceso,
    string
  > = {
    privado:
      'Solo miembros invitados pueden unirse al proyecto.',
    solicitud:
      'Los usuarios deben solicitar acceso y esperar aprobación.',
    publico:
      'Cualquiera puede unirse directamente al proyecto.',
  };

  const ESTADO_HINTS: Record<
    EstadoProyecto,
    string
  > = {
    activo:
      'El proyecto está en marcha actualmente.',
    pausado:
      'El proyecto está pausado temporalmente.',
    completado:
      'El proyecto ha finalizado exitosamente.',
    cancelado:
      'El proyecto fue cancelado.',
  };

  const PRIORIDAD_HINTS: Record<
    PrioridadProyecto,
    string
  > = {
    baja:
      'Sin urgencia inmediata.',
    media:
      'Prioridad estándar del proyecto.',
    alta:
      'Requiere atención prioritaria.',
    critica:
      'Máxima urgencia, atención inmediata.',
  };

  const PERM_EDICION_HINTS: Record<
    PermisoNivel,
    string
  > = {
    admin:
      'El dueño y los admins del proyecto pueden editar.',
    todos:
      'Cualquier miembro del proyecto puede editar la configuración.',
  };

  const PERM_TAREAS_HINTS: Record<
    PermisoNivel,
    string
  > = {
    admin:
      'Dueño y admins pueden crear y editar tareas.',
    todos:
      'Cualquier miembro puede crear y editar tareas.',
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />

          <p className="text-center text-sm text-gray-400">
            Cargando configuración del proyecto...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-4 pb-32 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
      <div className="mx-auto mb-6 max-w-4xl sm:mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 shadow-xl backdrop-blur-sm sm:p-6 lg:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />

          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-7 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-purple-500 to-blue-500 sm:h-8" />

                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-white sm:text-3xl">
                    Configuración del Proyecto
                  </h1>

                  <p className="mt-1 text-sm text-gray-400">
                    {canEdit
                      ? 'Editando:'
                      : 'Viendo:'}{' '}
                    <span className="font-medium text-purple-400 break-words">
                      {form.nombre ||
                        'Sin nombre'}
                    </span>
                  </p>

                  {proyectoId && (
                    <p className="mt-0.5 break-all text-xs text-gray-500">
                      ID del proyecto: #
                      {proyectoId}
                    </p>
                  )}

                  {!canEdit && (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-400">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      Solo lectura
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2.5 text-sm font-medium text-gray-300 transition-all hover:border-slate-600 hover:text-white sm:w-auto"
            >
              <IconArrowLeft />
              Volver
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-auto mb-5 max-w-4xl">
          <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.59C19.021 16.92 18.245 18 17.014 18H2.986c-1.23 0-2.007-1.08-1.247-2.31l6.518-11.59zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1z"
                clipRule="evenodd"
              />
            </svg>

            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl space-y-5">
        <Section
          title="Identidad"
          subtitle="Nombre y descripción del proyecto"
          icon={<IconId />}
        >
          <Field
            label="Nombre del proyecto *"
            hint={
              canEdit
                ? `${nombreLeft} caracteres restantes`
                : undefined
            }
            hintColor={
              nombreLeft < 16
                ? 'text-yellow-400'
                : 'text-gray-500'
            }
          >
            <input
              type="text"
              maxLength={80}
              value={form.nombre}
              onChange={(e) =>
                update(
                  'nombre',
                  e.target.value
                )
              }
              placeholder="Ej: Control de Horas"
              className={inputCls}
              disabled={!canEdit}
            />
          </Field>

          <Field
            label="Descripción"
            hint={
              canEdit
                ? `${descLeft} caracteres restantes`
                : undefined
            }
            hintColor={
              descLeft < 50
                ? 'text-yellow-400'
                : 'text-gray-500'
            }
          >
            <textarea
              maxLength={400}
              rows={3}
              value={form.descripcion}
              onChange={(e) =>
                update(
                  'descripcion',
                  e.target.value
                )
              }
              placeholder="Describe el proyecto, sus objetivos y alcance..."
              className={`${inputCls} resize-none`}
              disabled={!canEdit}
            />
          </Field>
        </Section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section
            title="Estado"
            subtitle="Fase operativa actual"
            icon={<IconFlag />}
          >
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-300">
                Estado del proyecto
              </label>

              <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
                {estadoOptions.map(
                  (opt) => {
                    const isActive =
                      form.estado ===
                      (opt.value as EstadoProyecto);

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          update(
                            'estado',
                            opt.value as EstadoProyecto
                          )
                        }
                        disabled={!canEdit}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200
                        ${
                          isActive
                            ? estadoColor(
                                opt.value as EstadoProyecto
                              )
                            : 'border-slate-700/50 bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
                        }
                        ${
                          !canEdit
                            ? 'cursor-not-allowed opacity-60'
                            : ''
                        }`}
                      >
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{
                            background:
                              isActive
                                ? opt.dot
                                : '#4b5563',
                          }}
                        />

                        {opt.label}
                      </button>
                    );
                  }
                )}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                {
                  ESTADO_HINTS[
                    form.estado
                  ]
                }
              </p>
            </div>
          </Section>

          <Section
            title="Prioridad"
            subtitle="Urgencia en la organización"
            icon={<IconChart />}
          >
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-300">
                Nivel de prioridad
              </label>

              <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
                {prioridadOptions.map(
                  (opt) => {
                    const isActive =
                      form.prioridad ===
                      (opt.value as PrioridadProyecto);

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          update(
                            'prioridad',
                            opt.value as PrioridadProyecto
                          )
                        }
                        disabled={!canEdit}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200
                        ${
                          isActive
                            ? prioridadColor(
                                opt.value as PrioridadProyecto
                              )
                            : 'border-slate-700/50 bg-slate-800/50 text-gray-400 hover:bg-slate-700/50'
                        }
                        ${
                          !canEdit
                            ? 'cursor-not-allowed opacity-60'
                            : ''
                        }`}
                      >
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{
                            background:
                              isActive
                                ? opt.dot
                                : '#4b5563',
                          }}
                        />

                        {opt.label}
                      </button>
                    );
                  }
                )}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                {
                  PRIORIDAD_HINTS[
                    form.prioridad
                  ]
                }
              </p>
            </div>
          </Section>
        </div>

        <Section
          title="Visibilidad y Acceso"
          subtitle="¿Quién puede ver y unirse al proyecto?"
          icon={<IconGlobe />}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field
              label="Visibilidad"
              hint={
                form.visibilidad ===
                'publico'
                  ? 'Cualquiera puede encontrar y ver este proyecto.'
                  : 'Solo miembros e invitados pueden ver el proyecto.'
              }
            >
              <ChipGroup
                options={visOptions}
                value={
                  form.visibilidad
                }
                onChange={(v) =>
                  update(
                    'visibilidad',
                    v as
                      | 'privado'
                      | 'publico'
                  )
                }
                activeColorFn={
                  gradientActive
                }
                disabled={!canEdit}
              />
            </Field>

            <Field
              label="Modo de acceso / membresía"
              hint={
                ACCESS_HINTS[
                  form.modoAcceso
                ]
              }
            >
              <ChipGroup
                options={
                  modoAccesoOptions
                }
                value={
                  form.modoAcceso
                }
                onChange={
                  handleModoAcceso
                }
                activeColorFn={
                  gradientActive
                }
                disabled={!canEdit}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Fechas"
          subtitle="Plazos formales del proyecto"
          icon={<IconCalendar />}
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Fecha de inicio">
              <input
                type="date"
                value={
                  form.fechaInicio
                }
                onChange={(e) =>
                  update(
                    'fechaInicio',
                    e.target.value
                  )
                }
                className={
                  dateInputCls
                }
                disabled={!canEdit}
              />
            </Field>

            <Field label="Fecha de fin estimada">
              <input
                type="date"
                value={
                  form.fechaFin
                }
                onChange={(e) =>
                  update(
                    'fechaFin',
                    e.target.value
                  )
                }
                className={
                  dateInputCls
                }
                disabled={!canEdit}
              />
            </Field>
          </div>

          {duration && (
            <p
              className={`mt-1 text-xs ${
                duration.isError
                  ? 'text-red-400'
                  : 'text-gray-500'
              }`}
            >
              {duration.isError
                ? '⚠ '
                : ''}
              {duration.text}
            </p>
          )}
        </Section>

        <Section
          title="Permisos"
          subtitle="Control de acceso para edición del proyecto y gestión de tareas"
          icon={<IconLock />}
        >
          <Field
            label="Edición del proyecto"
            hint={
              PERM_EDICION_HINTS[
                form.permisoEdicion
              ]
            }
          >
            <ChipGroup
              options={
                permisoOptions
              }
              value={
                form.permisoEdicion
              }
              onChange={(v) =>
                update(
                  'permisoEdicion',
                  v as PermisoNivel
                )
              }
              activeColorFn={
                gradientActive
              }
              disabled={!canEdit}
            />
          </Field>

          <div className="border-t border-slate-700/40" />

          <Field
            label="Creación y edición de tareas"
            hint={
              PERM_TAREAS_HINTS[
                form
                  .permisoGestionTareas
              ]
            }
          >
            <ChipGroup
              options={
                permisoOptions
              }
              value={
                form
                  .permisoGestionTareas
              }
              onChange={(v) =>
                update(
                  'permisoGestionTareas',
                  v as PermisoNivel
                )
              }
              activeColorFn={
                gradientActive
              }
              disabled={!canEdit}
            />
          </Field>
        </Section>

        {puedeEliminarProyecto && (
          <Section
            title="Zona de peligro"
            subtitle="Acciones irreversibles sobre el proyecto"
            icon={<IconTrash />}
            danger
          >
            <div className="flex flex-col gap-4 rounded-xl border border-red-500/20 bg-red-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  Eliminar proyecto
                </p>

                <p className="mt-0.5 text-xs text-gray-400">
                  Se eliminará el proyecto junto con sus tareas, asignaciones y datos relacionados.
                  Esta acción no se puede deshacer.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowDeleteConfirm(
                    true
                  )
                }
                disabled={deleting}
                className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-600/80 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <IconTrash />

                {deleting
                  ? 'Eliminando...'
                  : 'Eliminar'}
              </button>
            </div>
          </Section>
        )}
      </div>

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700/50 bg-slate-950/90 px-4 py-4 backdrop-blur-xl transition-transform duration-300 ease-out sm:px-6 lg:px-8 ${
          showSaveBar
            ? 'translate-y-0'
            : 'translate-y-full'
        }`}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-sm text-gray-400 sm:block">
            Tienes cambios{' '}
            <span className="font-medium text-white">
              sin guardar
            </span>
          </p>

          <div className="ml-auto flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={
                handleDiscard
              }
              className="w-full rounded-xl border border-slate-700/50 bg-slate-900/40 px-5 py-2.5 text-sm font-medium text-gray-300 transition-all hover:border-slate-600 hover:text-white sm:w-auto"
            >
              Descartar
            </button>

            <button
              type="button"
              onClick={() => {
                if (
                  canEdit &&
                  !saving &&
                  isDirty
                ) {
                  setShowSaveConfirm(
                    true
                  );
                }
              }}
              disabled={
                saving ||
                !isDirty ||
                !canEdit
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.01] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 sm:w-auto sm:hover:scale-105"
            >
              {saving && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              )}

              {saving
                ? 'Guardando...'
                : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed right-4 top-4 z-[200] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-400 shadow-xl transition-all duration-300 sm:right-6 sm:top-6 sm:max-w-none sm:px-5 ${
          saved
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        <IconCheck />

        <span className="break-words">
          Configuración guardada correctamente
        </span>
      </div>

      <ConfirmModal
        isOpen={
          showSaveConfirm
        }
        title="Guardar configuración"
        message={`¿Deseas guardar los cambios en "${
          form.nombre ||
          'este proyecto'
        }"? La configuración se actualizará para todos los miembros.`}
        confirmText="Guardar cambios"
        cancelText="Cancelar"
        type="default"
        isLoading={saving}
        onConfirm={() => {
          setShowSaveConfirm(
            false
          );

          void handleSave();
        }}
        onCancel={() =>
          setShowSaveConfirm(
            false
          )
        }
      />

      <ConfirmModal
        isOpen={
          showNoPermission
        }
        title="Sin permisos de edición"
        message={`No tienes permisos para modificar la configuración de "${
          form.nombre ||
          'este proyecto'
        }". Puedes ver los datos pero los campos están bloqueados. Contacta al dueño o un administrador si necesitas hacer cambios.`}
        confirmText="Entendido"
        cancelText="Cerrar"
        type="warning"
        onConfirm={() =>
          setShowNoPermission(
            false
          )
        }
        onCancel={() =>
          router.back()
        }
      />

      <ConfirmModal
        isOpen={
          showDeleteConfirm
        }
        title="Eliminar proyecto"
        message={`¿Seguro que deseas eliminar "${
          form.nombre ||
          'este proyecto'
        }"? Se borrará permanentemente junto con sus tareas y datos relacionados. Esta acción no se puede deshacer.`}
        confirmText="Eliminar proyecto"
        cancelText="Cancelar"
        type="danger"
        isLoading={deleting}
        onConfirm={
          handleDeleteProject
        }
        onCancel={() =>
          setShowDeleteConfirm(
            false
          )
        }
      />
    </div>
  );
}