//app/dashboard/colaboradores/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ColaboradoresModal, {
  Colaborador as ColaboradorBase,
  RolSistema,
} from '@/components/ColaboradoresModal';

type SortField = 'nombre' | 'creado_en' | 'rol' | 'puesto' | 'pais';
type ViewMode = 'grid' | 'list';
type FiltroEstado = 'todos' | 'activos' | 'inactivos';

type ProyectoUsuario = {
  id: string;
  nombre: string;
  descripcion: string | null;
  estado: string | null;
  prioridad: string | null;
  modo_acceso: string | null;
  visibilidad: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  creador_id: string | null;
  rol_en_proyecto: string | null;
  tipo_union: string | null;
};

type Colaborador = ColaboradorBase & {
  proyectos_creados_count?: number;
  proyectos_miembro_count?: number;
  tareas_seleccionadas?: number;
  tareas_en_proceso?: number;
  tareas_completadas?: number;
  proyectos?: ProyectoUsuario[];
};

const fullName = (c: Colaborador) => `${c.nombre} ${c.apellido}`.trim();

function getInitials(c: Colaborador) {
  return `${c.nombre?.[0] ?? ''}${c.apellido?.[0] ?? ''}`.toUpperCase();
}

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-700',
  'from-rose-500 to-pink-700',
  'from-orange-500 to-amber-600',
  'from-indigo-500 to-blue-700',
  'from-fuchsia-500 to-violet-700',
  'from-teal-500 to-emerald-700',
];

function avatarGradient(id: string) {
  const n = id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[n % AVATAR_GRADIENTS.length];
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizarRolSistema(raw: unknown): RolSistema {
  const v = String(raw ?? '').toLowerCase().trim();
  if (v === 'jefe') return 'jefe';
  if (v === 'admin') return 'admin';
  return 'colaborador';
}

function mapUsuarioToColaborador(u: any): Colaborador {
  return {
    id: String(u.id),
    nombre: String(u.nombre ?? ''),
    apellido: String(u.apellido ?? ''),
    email: String(u.email ?? ''),
    telefono: (u.telefono ?? u.telefono_completo ?? null) as string | null,
    pais: (u.pais ?? u.pais ?? null) as string | null,
    rol: normalizarRolSistema(u.rol),
    puesto: (u.puesto ?? null) as string | null,
    creado_en: u.creado_en ? String(u.creado_en) : '',
    avatar_url: u.avatar_url ?? null,
    proyectos_count:
      Number(
        u.proyectos_count ??
          (Number(u.proyectos_creados_count ?? 0) +
            Number(u.proyectos_miembro_count ?? 0)),
      ) || 0,
    activo: u.activo !== undefined ? Boolean(u.activo) : true,

    proyectos_creados_count: Number(u.proyectos_creados_count ?? 0),
    proyectos_miembro_count: Number(u.proyectos_miembro_count ?? 0),
    tareas_seleccionadas: Number(u.tareas_seleccionadas ?? 0),
    tareas_en_proceso: Number(u.tareas_en_proceso ?? 0),
    tareas_completadas: Number(u.tareas_completadas ?? 0),
    proyectos: Array.isArray(u.proyectos) ? u.proyectos : [],
  };
}

const ROL: Record<RolSistema, { label: string; dot: string; badge: string }> = {
  jefe: {
    label: 'Jefe',
    dot: '#e879f9',
    badge: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10',
  },
  admin: {
    label: 'Admin',
    dot: '#60a5fa',
    badge: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
  },
  colaborador: {
    label: 'Colaborador',
    dot: '#94a3b8',
    badge: 'text-slate-300 border-slate-500/40 bg-slate-500/10',
  },
};

const Ic = {
  arrow: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 12H5M12 5l-7 7 7 7"
      />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  ),
  close: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  ),
  grid: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  ),
  list: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  ),
  chevron: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  mail: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  ),
  phone: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  ),
  globe: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"
      />
    </svg>
  ),
  calendar: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
      />
    </svg>
  ),
  sortUp: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ),
};

function RolBadge({ rol }: { rol: RolSistema }) {
  const cfg = ROL[rol];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap ${cfg.badge}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: cfg.dot }}
      />
      {cfg.label}
    </span>
  );
}

function Avatar({
  c,
  size = 'md',
}: {
  c: Colaborador;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sz: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
  };

  return (
    <div
      className={`${sz[size]} rounded-full bg-gradient-to-br ${avatarGradient(
        c.id,
      )} flex items-center justify-center font-bold text-white flex-shrink-0 ring-2 ring-slate-900`}
    >
      {getInitials(c)}
    </div>
  );
}

function GridCard({ c, onClick }: { c: Colaborador; onClick: () => void }) {
  const inactive = !c.activo;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left bg-slate-900/40 border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/50 hover:border-slate-600/60 hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-200 ${
        inactive ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <Avatar c={c} size="md" />
        <RolBadge rol={c.rol} />
      </div>

      <h3 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
        {fullName(c)}
      </h3>
      <p className="text-xs text-gray-400 mt-0.5 truncate">{c.puesto ?? 'Sin puesto'}</p>

      <div className="flex items-center gap-2 mt-3">
        <span className="text-gray-600 flex-shrink-0">{Ic.mail}</span>
        <span className="text-xs text-gray-400 truncate font-mono">{c.email}</span>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600">{Ic.globe}</span>
          <span className="text-xs text-gray-500">{c.pais ?? '—'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-600">{Ic.calendar}</span>
          <span className="text-xs text-gray-600">{fmtDate(c.creado_en ?? null)}</span>
        </div>
      </div>
    </button>
  );
}

function ListRow({ c, onClick }: { c: Colaborador; onClick: () => void }) {
  const inactive = !c.activo;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30 transition-colors ${
        inactive ? 'opacity-70' : ''
      }`}
    >
      <Avatar c={c} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
            {fullName(c)}
          </p>
          <span
            className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
              c.activo
                ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                : 'border-red-500/40 text-red-300 bg-red-500/10'
            }`}
          >
            {c.activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <p className="text-xs text-gray-500 font-mono truncate">{c.email}</p>
      </div>

      <div className="hidden md:block w-36 flex-shrink-0">
        <p className="text-xs text-gray-300 truncate">{c.puesto ?? '—'}</p>
      </div>

      <div className="hidden lg:block w-36 flex-shrink-0">
        <p className="text-xs text-gray-400">{c.telefono ?? '—'}</p>
      </div>

      <div className="hidden lg:flex items-center gap-1.5 w-28 flex-shrink-0">
        <span className="text-gray-600">{Ic.globe}</span>
        <span className="text-xs text-gray-400">{c.pais ?? '—'}</span>
      </div>

      <div className="hidden sm:block flex-shrink-0">
        <RolBadge rol={c.rol} />
      </div>

      <div className="hidden md:flex items-center gap-1.5 w-28 flex-shrink-0">
        <span className="text-gray-600">{Ic.calendar}</span>
        <span className="text-xs text-gray-500">{fmtDate(c.creado_en ?? null)}</span>
      </div>

      <span className="text-gray-600 group-hover:text-purple-400 transition-colors flex-shrink-0">
        {Ic.chevron}
      </span>
    </button>
  );
}

function SortTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 transition-colors text-left ${
        active ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {label}
      {active && (
        <span className={`transition-transform ${dir === 'desc' ? 'rotate-180' : ''}`}>
          {Ic.sortUp}
        </span>
      )}
    </button>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24">
      <div className="w-16 h-16 mb-5 bg-slate-800/50 rounded-2xl border border-slate-700/50 flex items-center justify-center text-gray-500">
        {Ic.users}
      </div>
      <p className="text-gray-300 font-semibold">Sin resultados</p>
      <p className="text-gray-600 text-sm mt-1 mb-5">
        Prueba con otros filtros o términos de búsqueda
      </p>
      <button
        type="button"
        onClick={onClear}
        className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 text-gray-400 hover:text-white rounded-xl text-sm transition-all"
      >
        Limpiar filtros
      </button>
    </div>
  );
}

export default function ColaboradoresPage() {
  const router = useRouter();

  const [items, setItems] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filtroRol, setFiltroRol] = useState<'todos' | RolSistema>('todos');
  const [filtroPais, setFiltroPais] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [sortField, setSortField] = useState<SortField>('creado_en');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [view, setView] = useState<ViewMode>('grid');

  const [selected, setSelected] = useState<Colaborador | null>(null);
  const [currentUserRol, setCurrentUserRol] = useState<RolSistema>('colaborador');
  const [loadingDetalleId, setLoadingDetalleId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [listaRes, meRes] = await Promise.all([
          fetch('/api/user/usuarios', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          }),
          fetch('/api/user', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          }),
        ]);

        const listaData = await listaRes.json().catch(() => ({}));
        const meData = await meRes.json().catch(() => ({}));

        if (!listaRes.ok || !listaData?.ok) {
          throw new Error(listaData?.error || 'Error al cargar colaboradores');
        }

        if (!meRes.ok || !meData?.ok || !meData?.data) {
          throw new Error(meData?.error || 'No se pudo obtener el usuario actual');
        }

        const currentUserId = String(meData.data.id);

        const raw = (
          Array.isArray(listaData?.usuarios)
            ? listaData.usuarios
            : Array.isArray(listaData?.colaboradores)
              ? listaData.colaboradores
              : Array.isArray(listaData?.data)
                ? listaData.data
                : []
        ) as any[];

        const mapped: Colaborador[] = raw.map(mapUsuarioToColaborador);

        setItems(mapped);
        setError('');

        const meFromList = mapped.find((u) => u.id === currentUserId);
        if (meFromList) {
          setCurrentUserRol(meFromList.rol);
        }
      } catch (e: any) {
        setError(e?.message || 'Error cargando colaboradores');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const cargarDetalleColaborador = useCallback(
    async (c: Colaborador) => {
      try {
        setLoadingDetalleId(c.id);
        setSelected(c);

        const res = await fetch(`/api/user/usuarios/${c.id}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok || !data?.usuario) {
          throw new Error(data?.error || 'No se pudo cargar el detalle del colaborador');
        }

        const detalle = mapUsuarioToColaborador(data.usuario);

        setSelected((prev) => (prev && prev.id === detalle.id ? { ...prev, ...detalle } : detalle));
        setItems((prev) =>
          prev.map((item) => (item.id === detalle.id ? { ...item, ...detalle } : item)),
        );
      } catch (e: any) {
        setError(e?.message || 'Error al cargar el detalle del colaborador');
      } finally {
        setLoadingDetalleId(null);
      }
    },
    [],
  );

  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir(field === 'creado_en' ? 'desc' : 'asc');
      }
    },
    [sortField],
  );

  const paises = [
    'todos',
    ...(Array.from(new Set(items.map((c) => c.pais).filter(Boolean))) as string[]),
  ];

  const filtered = items
    .filter((c) => {
      const q = search.toLowerCase().trim();

      const matchSearch =
        !q ||
        fullName(c).toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.puesto ?? '').toLowerCase().includes(q) ||
        (c.pais ?? '').toLowerCase().includes(q) ||
        (c.telefono ?? '').includes(q);

      const matchRol = filtroRol === 'todos' || c.rol === filtroRol;
      const matchPais = filtroPais === 'todos' || c.pais === filtroPais;
      const matchEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && c.activo) ||
        (filtroEstado === 'inactivos' && !c.activo);

      return matchSearch && matchRol && matchPais && matchEstado;
    })
    .sort((a, b) => {
      let cmp = 0;

      switch (sortField) {
        case 'nombre':
          cmp = fullName(a).localeCompare(fullName(b));
          break;
        case 'creado_en':
          cmp =
            new Date(a.creado_en ?? 0).getTime() -
            new Date(b.creado_en ?? 0).getTime();
          break;
        case 'rol':
          cmp = a.rol.localeCompare(b.rol);
          break;
        case 'puesto':
          cmp = (a.puesto ?? '').localeCompare(b.puesto ?? '');
          break;
        case 'pais':
          cmp = (a.pais ?? '').localeCompare(b.pais ?? '');
          break;
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });

  const stats = {
    total: items.length,
    activos: items.filter((c) => c.activo).length,
    inactivos: items.filter((c) => !c.activo).length,
    admins: items.filter((c) => c.rol === 'admin' || c.rol === 'jefe').length,
    colaboradores: items.filter((c) => c.rol === 'colaborador').length,
    paises: new Set(items.map((c) => c.pais).filter(Boolean)).size,
  };

  const clearFilters = () => {
    setSearch('');
    setFiltroRol('todos');
    setFiltroPais('todos');
    setFiltroEstado('todos');
  };

  const hasFilters =
    !!search ||
    filtroRol !== 'todos' ||
    filtroPais !== 'todos' ||
    filtroEstado !== 'todos';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Cargando colaboradores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto mb-7">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 p-8 shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5" />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 bg-gradient-to-b from-purple-500 to-blue-500 rounded-full" />
                <div>
                  <h1 className="text-3xl font-bold text-white">Colaboradores</h1>
                  <p className="text-gray-400 mt-1 text-sm">
                    Directorio del equipo y gestión de accesos
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 text-gray-300 hover:text-white hover:border-slate-600 rounded-xl text-sm font-medium transition-all"
              >
                {Ic.arrow} Volver
              </button>
            </div>

            <div className="mt-6 ml-5 flex items-center gap-5 flex-wrap">
              {[
                { label: 'Total', value: stats.total, color: 'bg-white' },
                { label: 'Activos', value: stats.activos, color: 'bg-emerald-400' },
                { label: 'Inactivos', value: stats.inactivos, color: 'bg-red-400' },
                { label: 'Admins/Jefes', value: stats.admins, color: 'bg-blue-400' },
                { label: 'Colaboradores', value: stats.colaboradores, color: 'bg-slate-400' },
                { label: 'Países', value: stats.paises, color: 'bg-cyan-400' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className="font-semibold text-gray-300">{s.value}</span>
                  <span className="text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l6.518 11.59C19.021 16.92 18.245 18 17.014 18H2.986c-1.23 0-2.007-1.08-1.247-2.31l6.518-11.59z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              {Ic.search}
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email, puesto, país..."
              className="w-full pl-10 pr-10 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-sm transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {Ic.close}
              </button>
            )}
          </div>

          <select
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value as 'todos' | RolSistema)}
            className="px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-gray-300 focus:border-purple-500 outline-none text-sm transition-all [color-scheme:dark] cursor-pointer"
          >
            <option value="todos">Todos los roles</option>
            <option value="jefe">Jefe</option>
            <option value="admin">Admin</option>
            <option value="colaborador">Colaborador</option>
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
            className="px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-gray-300 focus:border-purple-500 outline-none text-sm transition-all [color-scheme:dark] cursor-pointer"
          >
            <option value="todos">Todos los estados</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>

          <select
            value={filtroPais}
            onChange={(e) => setFiltroPais(e.target.value)}
            className="px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-gray-300 focus:border-purple-500 outline-none text-sm transition-all [color-scheme:dark] cursor-pointer"
          >
            {paises.map((p) => (
              <option key={p} value={p}>
                {p === 'todos' ? 'Todos los países' : p}
              </option>
            ))}
          </select>

          <select
            value={sortField}
            onChange={(e) => {
              const value = e.target.value as SortField;
              setSortField(value);
              setSortDir(value === 'creado_en' ? 'desc' : 'asc');
            }}
            className="px-4 py-3 bg-slate-900/40 border border-slate-700/50 rounded-xl text-gray-300 focus:border-purple-500 outline-none text-sm transition-all [color-scheme:dark] cursor-pointer"
          >
            <option value="creado_en">Fecha de ingreso</option>
            <option value="nombre">Nombre</option>
            <option value="rol">Rol</option>
            <option value="puesto">Puesto</option>
            <option value="pais">País</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            title={`Orden ${sortDir === 'asc' ? 'ascendente' : 'descendente'}`}
            className="px-3.5 py-3 bg-slate-900/40 border border-slate-700/50 text-gray-400 hover:text-white hover:border-slate-600 rounded-xl transition-all"
          >
            <span
              className={`inline-block transition-transform duration-200 ${
                sortDir === 'desc' ? 'rotate-180' : ''
              }`}
            >
              {Ic.sortUp}
            </span>
          </button>

          <div className="flex overflow-hidden bg-slate-900/40 border border-slate-700/50 rounded-xl">
            {(['grid', 'list'] as ViewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setView(m)}
                className={`px-3.5 py-3 transition-all ${
                  view === m ? 'bg-slate-700/60 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {m === 'grid' ? Ic.grid : Ic.list}
              </button>
            ))}
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Mostrando <span className="text-gray-300 font-medium">{filtered.length}</span> de{' '}
              <span className="text-gray-300 font-medium">{items.length}</span> colaboradores
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-300 underline transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {view === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.length === 0 ? (
              <EmptyState onClear={clearFilters} />
            ) : (
              filtered.map((c) => (
                <GridCard key={c.id} c={c} onClick={() => cargarDetalleColaborador(c)} />
              ))
            )}
          </div>
        )}

        {view === 'list' && (
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
            <div
              className="hidden md:grid border-b border-slate-800/60 bg-slate-900/30 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ gridTemplateColumns: '40px 1fr 150px 150px 130px 120px 140px 32px' }}
            >
              <div />
              <SortTh
                label="Nombre"
                active={sortField === 'nombre'}
                dir={sortDir}
                onClick={() => toggleSort('nombre')}
              />
              <SortTh
                label="Puesto"
                active={sortField === 'puesto'}
                dir={sortDir}
                onClick={() => toggleSort('puesto')}
              />
              <div className="text-gray-500">Teléfono</div>
              <SortTh
                label="País"
                active={sortField === 'pais'}
                dir={sortDir}
                onClick={() => toggleSort('pais')}
              />
              <SortTh
                label="Rol"
                active={sortField === 'rol'}
                dir={sortDir}
                onClick={() => toggleSort('rol')}
              />
              <SortTh
                label="Ingreso"
                active={sortField === 'creado_en'}
                dir={sortDir}
                onClick={() => toggleSort('creado_en')}
              />
              <div />
            </div>

            {filtered.length === 0 ? (
              <EmptyState onClear={clearFilters} />
            ) : (
              <div className="divide-y divide-slate-800/50">
                {filtered.map((c) => (
                  <ListRow key={c.id} c={c} onClick={() => cargarDetalleColaborador(c)} />
                ))}
              </div>
            )}

            {filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-800/50 bg-slate-900/20">
                <p className="text-xs text-gray-600">
                  <span className="text-gray-400 font-medium">{filtered.length}</span>{' '}
                  colaborador{filtered.length !== 1 ? 'es' : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {loadingDetalleId && (
        <div className="fixed bottom-6 right-6 z-[350] px-4 py-2 rounded-xl border border-slate-700/50 bg-slate-900/90 text-sm text-gray-300 shadow-xl">
          Cargando detalle...
        </div>
      )}

      <ColaboradoresModal
        colaborador={selected}
        onClose={() => setSelected(null)}
        currentUserRol={currentUserRol}
        onUpdated={(updated) => {
          const normalizado = mapUsuarioToColaborador(updated);
          setItems((prev) =>
            prev.map((c) => (c.id === normalizado.id ? { ...c, ...normalizado } : c)),
          );
          setSelected((prev) =>
            prev && prev.id === normalizado.id ? { ...prev, ...normalizado } : prev,
          );
        }}
        onDeleted={(id) => {
          setItems((prev) => prev.map((c) => (c.id === id ? { ...c, activo: false } : c)));
          setSelected(null);
        }}
      />
    </div>
  );
}