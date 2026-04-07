'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useUser } from '@/app/dashboard/layout';
import ConfirmModal from '@/components/ConfirmModal';
import TaskFormModal, { TaskFormData } from '@/components/TaskFormalModal';
import InformeModal from '@/components/InformeModal';

// ============================================================================
// TIPOS
// ============================================================================

type Prioridad = 'baja' | 'media' | 'alta' | 'critica';
type Estado = 'todo' | 'in-progress' | 'review' | 'completed';
type RolUsuario = 'admin' | 'jefe' | 'colaborador' | 'owner' | 'miembro';

interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: Prioridad;
  estado: Estado;
  created_at: string;
  updated_at: string;
  proyecto_id: number;
  creador_id: string;
  tiempo_estimado_minutos: number | null;
  max_participantes: number;
}

interface Proyecto {
  id: number;
  nombre: string;
  descripcion: string | null;
  creador_id: string;
  permiso_gestionar_tareas?: PermisoGestionTareas;
}

type FormData = TaskFormData;

type Asignado = {
  id: string | number;
  nombre: string;
  apellido?: string;
  email: string;
};

type PermisoGestionTareas = 'owner' | 'owner_admin' | 'all_members';

// ============================================================================
// HELPERS
// ============================================================================

function normalizarPrioridad(valor: unknown): Prioridad {
  const v = String(valor ?? '').trim().toLowerCase();
  if (v === 'baja') return 'baja';
  if (v === 'alta') return 'alta';
  if (v === 'critica' || v === 'crítica') return 'critica';
  return 'media';
}

function normalizarEstado(valor: unknown): Estado {
  const v = String(valor ?? '').trim().toLowerCase();
  if (v === 'in-progress' || v === 'in_progress' || v === 'en_progreso' || v === 'en progreso') {
    return 'in-progress';
  }
  if (v === 'review' || v === 'revision' || v === 'revisión') return 'review';
  if (v === 'completed' || v === 'completado' || v === 'completada') return 'completed';
  return 'todo';
}

function normalizarRolUsuario(valor: unknown): RolUsuario {
  const v = String(valor ?? '').trim().toLowerCase();
  if (v === 'owner' || v === 'dueno' || v === 'dueño') return 'owner';
  if (v === 'admin' || v === 'administrador') return 'admin';
  if (v === 'miembro' || v === 'member') return 'miembro';
  if (v === 'jefe') return 'jefe';
  if (v === 'colaborador') return 'colaborador';
  return 'miembro';
}

function puedeRevisarRol(rol: RolUsuario) {
  return rol === 'admin' || rol === 'owner';
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

type ConfirmType = 'default' | 'danger' | 'success' | 'warning';

export default function TareasPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useUser();
  const proyectoId = params.id;

  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState<Tarea | null>(null);

  const [showInformeModal, setShowInformeModal] = useState(false);
  const [tareaInforme, setTareaInforme] = useState<Tarea | null>(null);

  const [asignados, setAsignados] = useState<Record<string, Asignado[]>>({});
  const [starting, setStarting] = useState<Record<string, boolean>>({});

  const asignadosFetchedAtRef = useRef<Record<string, number>>({});

  const [formData, setFormData] = useState<FormData>({
    titulo: '',
    descripcion: '',
    prioridad: 'media',
    estado: 'todo',
    tiempo_estimado_dias: '',
    tiempo_estimado_horas: '',
    tiempo_estimado_minutos: '',
    horas_por_dia: '8',
    max_participantes: '1',
  });

  const [formError, setFormError] = useState<string | null>(null);

  const [puedeGestionarTareas, setPuedeGestionarTareas] = useState(false);
  const [permisoGestionTareas, setPermisoGestionTareas] = useState<PermisoGestionTareas>('owner_admin');
  const [rolUsuario, setRolUsuario] = useState<RolUsuario>('miembro');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('Confirmar acción');
  const [confirmMessage, setConfirmMessage] = useState('¿Deseas continuar?');
  const [confirmType, setConfirmType] = useState<ConfirmType>('default');
  const [confirmText, setConfirmText] = useState('Confirmar');
  const [cancelText, setCancelText] = useState('Cancelar');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const pendingActionRef = useRef<null | (() => Promise<void>)>(null);

  const openConfirm = useCallback(
    (opts: {
      title: string;
      message: string;
      type?: ConfirmType;
      confirmText?: string;
      cancelText?: string;
      action: () => Promise<void>;
    }) => {
      setConfirmTitle(opts.title);
      setConfirmMessage(opts.message);
      setConfirmType(opts.type ?? 'default');
      setConfirmText(opts.confirmText ?? 'Confirmar');
      setCancelText(opts.cancelText ?? 'Cancelar');
      pendingActionRef.current = opts.action;
      setConfirmOpen(true);
    },
    []
  );

  const closeConfirm = useCallback(() => {
    if (confirmLoading) return;
    setConfirmOpen(false);
    pendingActionRef.current = null;
  }, [confirmLoading]);

  const runConfirmAction = useCallback(async () => {
    if (!pendingActionRef.current || confirmLoading) return;
    try {
      setConfirmLoading(true);
      await pendingActionRef.current();
      setConfirmOpen(false);
      pendingActionRef.current = null;
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setConfirmLoading(false);
    }
  }, [confirmLoading]);

  const normalizarTareas = (raw: any[]): Tarea[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((t: any) => ({
      id: String(t?.id ?? ''),
      titulo: String(t?.titulo ?? ''),
      descripcion: t?.descripcion ?? null,
      prioridad: normalizarPrioridad(t?.prioridad),
      estado: normalizarEstado(t?.estado),
      created_at: String(t?.created_at ?? ''),
      updated_at: String(t?.updated_at ?? ''),
      proyecto_id: Number(t?.proyecto_id ?? 0),
      creador_id: String(t?.creador_id ?? ''),
      tiempo_estimado_minutos:
        t?.tiempo_estimado_minutos == null ? null : Number(t.tiempo_estimado_minutos),
      max_participantes: t?.max_participantes == null ? 1 : Number(t.max_participantes),
    }));
  };

  const extraerListaTareas = (payload: any): Tarea[] => {
    return normalizarTareas(payload?.tareas ?? payload?.data ?? []);
  };

  const extraerTarea = (payload: any): Tarea | null => {
    const raw = payload?.tarea ?? payload?.data ?? null;
    if (!raw) return null;
    return {
      id: String(raw?.id ?? ''),
      titulo: String(raw?.titulo ?? ''),
      descripcion: raw?.descripcion ?? null,
      prioridad: normalizarPrioridad(raw?.prioridad),
      estado: normalizarEstado(raw?.estado),
      created_at: String(raw?.created_at ?? ''),
      updated_at: String(raw?.updated_at ?? ''),
      proyecto_id: Number(raw?.proyecto_id ?? 0),
      creador_id: String(raw?.creador_id ?? ''),
      tiempo_estimado_minutos:
        raw?.tiempo_estimado_minutos == null ? null : Number(raw.tiempo_estimado_minutos),
      max_participantes: raw?.max_participantes == null ? 1 : Number(raw.max_participantes),
    };
  };

  const fetchAsignados = useCallback(
    async (tareaId: string, force = false) => {
      const last = asignadosFetchedAtRef.current[tareaId];
      const now = Date.now();
      if (!force && last && now - last < 5000) return;

      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/tareas/${tareaId}/asignados`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          const lista = Array.isArray(data?.asignados)
            ? data.asignados
            : Array.isArray(data?.data?.asignados)
            ? data.data.asignados
            : [];
          setAsignados((prev) => ({ ...prev, [tareaId]: lista }));
          asignadosFetchedAtRef.current[tareaId] = Date.now();
        }
      } catch (e) {
        console.error('Error cargando asignados:', e);
      }
    },
    [proyectoId]
  );

  const refetchTareas = useCallback(async () => {
    try {
      const tareasRes = await fetch(`/api/proyectos/${proyectoId}/tareas`, {
        credentials: 'include',
      });
      const tareasData = await tareasRes.json().catch(() => ({}));
      if (tareasRes.ok) {
        const tareasArray = extraerListaTareas(tareasData);
        setTareas(tareasArray);
        tareasArray.forEach((t: Tarea) => void fetchAsignados(t.id, false));
      }
    } catch (e) {
      console.error('Error refetch tareas:', e);
    }
  }, [proyectoId, fetchAsignados]);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true);
        setError(null);

        const [proyectoRes, tareasRes] = await Promise.all([
          fetch(`/api/proyectos/${proyectoId}`, { credentials: 'include' }),
          fetch(`/api/proyectos/${proyectoId}/tareas`, { credentials: 'include' }),
        ]);

        const proyectoData = await proyectoRes.json().catch(() => ({}));
        const tareasData = await tareasRes.json().catch(() => ({}));

        if (!proyectoRes.ok) throw new Error(proyectoData?.error || 'Error al cargar el proyecto');
        if (!tareasRes.ok) throw new Error(tareasData?.error || 'Error al cargar las tareas');

        const p = (proyectoData?.proyecto as Proyecto | null) ?? null;
        setProyecto(p);

        const permisoRaw =
          (proyectoData?.proyecto?.permiso_gestionar_tareas as PermisoGestionTareas | undefined) ??
          'owner_admin';
        setPermisoGestionTareas(permisoRaw);

        const puedeFromBackend =
          proyectoData?.puede_gestionar_tareas ??
          proyectoData?.meta?.puede_gestionar_tareas ??
          false;
        setPuedeGestionarTareas(Boolean(puedeFromBackend));

        const rolRaw =
          proyectoData?.rol ??
          proyectoData?.meta?.rol ??
          proyectoData?.meta?.rol_en_proyecto ??
          (p?.creador_id && user?.id && String(p.creador_id) === String(user.id)
            ? 'owner'
            : 'miembro');

        setRolUsuario(normalizarRolUsuario(rolRaw));

        const tareasArray = extraerListaTareas(tareasData);
        setTareas(tareasArray);
        tareasArray.forEach((tarea: Tarea) => void fetchAsignados(tarea.id, false));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [proyectoId, fetchAsignados, user]);

  useEffect(() => {
    if (!tareaSeleccionada) return;
    void fetchAsignados(tareaSeleccionada.id, true);
  }, [tareaSeleccionada, fetchAsignados]);

  const openModal = useCallback(
    (tarea: Tarea) => {
      void fetchAsignados(tarea.id, true);
      setTareaSeleccionada(tarea);
    },
    [fetchAsignados]
  );

  const abrirInformeFinal = useCallback((tarea: Tarea) => {
    setTareaInforme(tarea);
    setShowInformeModal(true);
  }, []);

  const cerrarInformeModal = useCallback(() => {
    setShowInformeModal(false);
    setTareaInforme(null);
  }, []);

  const buildMensajeSinPermisoCrear = () => {
    if (permisoGestionTareas === 'owner') {
      return 'No tienes permiso para crear tareas. Solo el dueño del proyecto puede crear y gestionar tareas.';
    }
    if (permisoGestionTareas === 'owner_admin') {
      return 'No tienes permiso para crear tareas. Debes ser dueño o administrador del proyecto para crear y gestionar tareas.';
    }
    return 'No tienes permiso para crear tareas. Debes ser miembro del proyecto para poder crear y gestionar tareas.';
  };

  const buildResumenPermiso = () => {
    if (permisoGestionTareas === 'owner') {
      return 'Solo el dueño del proyecto puede crear y gestionar tareas.';
    }
    if (permisoGestionTareas === 'owner_admin') {
      return 'El dueño y los administradores del proyecto pueden crear y gestionar tareas.';
    }
    return 'Cualquier miembro del proyecto puede crear y gestionar tareas.';
  };

  const crearTarea = useCallback(async () => {
    if (!formData.titulo.trim()) {
      setFormError('El título es obligatorio');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const diasRaw = Number.parseInt(formData.tiempo_estimado_dias || '0', 10);
      const horasRaw = Number.parseInt(formData.tiempo_estimado_horas || '0', 10);
      const minutosRaw = Number.parseInt(formData.tiempo_estimado_minutos || '0', 10);
      const horasPorDiaRaw = Number.parseInt(formData.horas_por_dia || '8', 10);

      const dias = Number.isFinite(diasRaw) && diasRaw > 0 ? diasRaw : 0;
      const horas = Number.isFinite(horasRaw) && horasRaw > 0 ? horasRaw : 0;
      const minutos =
        Number.isFinite(minutosRaw) && minutosRaw > 0 ? Math.min(minutosRaw, 59) : 0;
      const horasPorDia = horasPorDiaRaw === 12 ? 12 : 8;

      const tiempoTotalMinutos = dias * horasPorDia * 60 + horas * 60 + minutos;

      const maxRaw = Number.parseInt(formData.max_participantes || '1', 10);
      const maxParticipantes = Number.isFinite(maxRaw) && maxRaw >= 1 ? maxRaw : 1;

      const payload = {
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim() || null,
        prioridad: formData.prioridad,
        estado: 'todo',
        tiempo_estimado_minutos: tiempoTotalMinutos > 0 ? tiempoTotalMinutos : null,
        max_participantes: maxParticipantes,
      };

      const response = await fetch(`/api/proyectos/${proyectoId}/tareas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Error al crear la tarea');

      const nuevaTarea = extraerTarea(data);
      if (nuevaTarea) {
        setTareas((prev) => [nuevaTarea, ...prev]);
      } else {
        await refetchTareas();
      }

      setFormData({
        titulo: '',
        descripcion: '',
        prioridad: 'media',
        estado: 'todo',
        tiempo_estimado_dias: '',
        tiempo_estimado_horas: '',
        tiempo_estimado_minutos: '',
        horas_por_dia: '8',
        max_participantes: '1',
      });

      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }, [formData, proyectoId, refetchTareas]);

  const handleSubmitTaskModal = () => {
    if (!formData.titulo.trim()) {
      setFormError('El título es obligatorio');
      return;
    }

    if (!puedeGestionarTareas) {
      setFormError(buildMensajeSinPermisoCrear());
      return;
    }

    openConfirm({
      title: 'Crear tarea',
      message: '¿Confirmas la creación de esta nueva tarea?',
      type: 'success',
      confirmText: 'Crear tarea',
      cancelText: 'Cancelar',
      action: async () => {
        await crearTarea();
      },
    });
  };

  const assertOk = async (res: Response) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
    return data;
  };

  const seleccionarTarea = async (tareaId: string) => {
    setStarting((p) => ({ ...p, [tareaId]: true }));
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/tareas/${tareaId}/seleccionar`, {
        method: 'POST',
        credentials: 'include',
      });
      await assertOk(res);
      await fetchAsignados(tareaId, true);
      setTareaSeleccionada(null);
      await refetchTareas();
    } finally {
      setStarting((p) => ({ ...p, [tareaId]: false }));
    }
  };

  const comenzarTarea = async (tareaId: string) => {
    setStarting((p) => ({ ...p, [tareaId]: true }));
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/tareas/${tareaId}/comenzar`, {
        method: 'POST',
        credentials: 'include',
      });
      await assertOk(res);
      setTareas((prev) =>
        prev.map((t) => (t.id === tareaId ? { ...t, estado: 'in-progress' } : t))
      );
      await fetchAsignados(tareaId, true);
      await refetchTareas();
    } finally {
      setStarting((p) => ({ ...p, [tareaId]: false }));
    }
  };

  const cancelarSeleccion = async (tareaId: string) => {
    setStarting((p) => ({ ...p, [tareaId]: true }));
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/tareas/${tareaId}/cancelar`, {
        method: 'POST',
        credentials: 'include',
      });
      await assertOk(res);
      await fetchAsignados(tareaId, true);
      await refetchTareas();
    } finally {
      setStarting((p) => ({ ...p, [tareaId]: false }));
    }
  };

  const cambiarEstado = async (tareaId: string, nuevoEstado: Estado) => {
    setStarting((p) => ({ ...p, [tareaId]: true }));
    try {
      const tareaActual = tareas.find((t) => t.id === tareaId);
      const body: Record<string, unknown> = { estado: nuevoEstado };

      if (tareaActual?.estado === 'completed' && nuevoEstado === 'todo') {
        body.reopen = true;
        body.comentario = 'Tarea reabierta manualmente';
      }

      const res = await fetch(`/api/proyectos/${proyectoId}/tareas/${tareaId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      await assertOk(res);
      setTareas((prev) =>
        prev.map((t) => (t.id === tareaId ? { ...t, estado: nuevoEstado } : t))
      );
      await refetchTareas();
    } finally {
      setStarting((p) => ({ ...p, [tareaId]: false }));
    }
  };

  const confirmarSeleccion = (tareaId: string) => {
    openConfirm({
      title: 'Seleccionar tarea',
      message: '¿Confirmar selección de esta tarea?',
      type: 'default',
      confirmText: 'Seleccionar',
      action: async () => {
        await seleccionarTarea(tareaId);
      },
    });
  };

  const confirmarComenzar = (tareaId: string) => {
    openConfirm({
      title: 'Comenzar tarea',
      message: '¿Confirmar comenzar esta tarea?',
      type: 'success',
      confirmText: 'Comenzar',
      action: async () => {
        await comenzarTarea(tareaId);
      },
    });
  };

  const confirmarCancelarSeleccion = (tareaId: string) => {
    openConfirm({
      title: 'Cancelar selección',
      message: '¿Confirmar cancelar tu selección? Se liberará el cupo.',
      type: 'danger',
      confirmText: 'Cancelar selección',
      action: async () => {
        await cancelarSeleccion(tareaId);
      },
    });
  };

  const confirmarCambioEstado = (tareaId: string, nuevoEstado: Estado) => {
    const mensajes: Record<
      Exclude<Estado, 'review'>,
      { title: string; message: string; type: ConfirmType; confirmText: string }
    > = {
      completed: {
        title: 'Completar tarea',
        message: '¿Confirmar marcar como completada?',
        type: 'success',
        confirmText: 'Completar',
      },
      'in-progress': {
        title: 'Volver a en progreso',
        message: '¿Confirmar mover esta tarea a en progreso?',
        type: 'warning',
        confirmText: 'Mover',
      },
      todo: {
        title: 'Reabrir tarea',
        message: '¿Confirmar reabrir esta tarea y devolverla a Por Hacer?',
        type: 'warning',
        confirmText: 'Reabrir',
      },
    };

    if (nuevoEstado === 'review') return;
    const cfg = mensajes[nuevoEstado];

    openConfirm({
      title: cfg.title,
      message: cfg.message,
      type: cfg.type,
      confirmText: cfg.confirmText,
      action: async () => {
        await cambiarEstado(tareaId, nuevoEstado);
      },
    });
  };

  const tareasPorEstado = {
    todo: tareas.filter((t) => t.estado === 'todo'),
    'in-progress': tareas.filter((t) => t.estado === 'in-progress'),
    review: tareas.filter((t) => t.estado === 'review'),
    completed: tareas.filter((t) => t.estado === 'completed'),
  };

  const formatearFecha = (fecha: string) => {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
  };

  const formatearTiempo = (minutos: number | null) => {
    if (!minutos || minutos <= 0) return null;

    const dias8h = Math.floor(minutos / (8 * 60));
    const restoDespuesDias = minutos % (8 * 60);
    const horas = Math.floor(restoDespuesDias / 60);
    const mins = restoDespuesDias % 60;

    const partes: string[] = [];
    if (dias8h > 0) partes.push(`${dias8h}d`);
    if (horas > 0) partes.push(`${horas}h`);
    if (mins > 0) partes.push(`${mins}m`);

    return partes.join(' ');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />
          <div className="mt-4 text-center text-gray-400">Cargando tareas...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 backdrop-blur-xl sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <svg className="h-6 w-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="text-lg font-semibold text-red-400">Error al cargar</h2>
          </div>
          <p className="break-words text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <ConfirmModal
        isOpen={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        type={confirmType}
        confirmText={confirmText}
        cancelText={cancelText}
        isLoading={confirmLoading}
        onCancel={closeConfirm}
        onConfirm={runConfirmAction}
      />

      <TaskFormModal
        isOpen={showForm && puedeGestionarTareas}
        mode="create"
        formData={formData}
        error={formError}
        saving={saving}
        canManage={puedeGestionarTareas}
        onChange={(data) => {
          setFormData(data);
          if (formError) setFormError(null);
        }}
        onClose={() => {
          if (saving) return;
          setShowForm(false);
        }}
        onSubmit={handleSubmitTaskModal}
      />

      {showInformeModal && tareaInforme && (
        <InformeModal
          key={`${tareaInforme.id}-${tareaInforme.estado}-${rolUsuario}`}
          isOpen={showInformeModal}
          proyectoId={proyectoId}
          tareaId={tareaInforme.id}
          tareaEstado={tareaInforme.estado}
          rolUsuario={rolUsuario}
          nombreUsuario={user?.nombre || user?.email || ''}
          tipoInforme="final"
          onClose={cerrarInformeModal}
          onSuccess={async () => {
            await refetchTareas();
            await fetchAsignados(tareaInforme.id, true);
          }}
        />
      )}

      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-white">
              {proyecto?.nombre || 'Proyecto'}
            </h1>

            {proyecto?.descripcion && (
              <p className="mt-1 break-words text-sm text-gray-400">{proyecto.descripcion}</p>
            )}

            <p className="mt-2 text-[11px] text-gray-400">
              <span className="font-semibold text-purple-300">
                Quién puede crear y gestionar tareas:{' '}
              </span>
              {buildResumenPermiso()}
            </p>

            <p className="mt-1 text-[11px] text-cyan-300">
              Rol detectado en este proyecto: <span className="font-semibold">{rolUsuario}</span>
            </p>

            {!puedeGestionarTareas && (
              <p className="mt-1 text-[11px] text-amber-300">{buildMensajeSinPermisoCrear()}</p>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/proyectos/${proyectoId}/miembros`)}
              className="rounded-lg border border-slate-700/60 bg-slate-900/60 px-4 py-2 text-xs font-medium text-gray-200 transition-all hover:border-slate-500 hover:bg-slate-800/80 hover:text-white sm:text-sm"
            >
              Ver miembros
            </button>

            <button
              type="button"
              onClick={() => router.push(`/dashboard/proyectos/${proyectoId}/configuracion`)}
              className="rounded-lg border border-purple-500/40 bg-slate-900/60 px-4 py-2 text-xs font-medium text-purple-200 transition-all hover:border-purple-400 hover:bg-purple-600/20 hover:text-white sm:text-sm"
            >
              Editar proyecto
            </button>

            <button
              type="button"
              onClick={() => {
                if (!puedeGestionarTareas) return;
                setShowForm((prev) => !prev);
              }}
              disabled={!puedeGestionarTareas}
              title={
                puedeGestionarTareas
                  ? 'Crear una nueva tarea'
                  : 'No tienes permiso para crear tareas en este proyecto'
              }
              className={`rounded-lg px-6 py-2 text-xs font-semibold text-white shadow-lg transition-all duration-300 sm:text-sm ${
                puedeGestionarTareas
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:scale-[1.01] hover:shadow-purple-500/50 sm:hover:scale-105'
                  : 'cursor-not-allowed bg-slate-700/60 opacity-60'
              }`}
            >
              {showForm && puedeGestionarTareas ? 'Cancelar' : '+ Nueva Tarea'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <ColumnaKanban
            titulo="Por Hacer"
            color="gray"
            tareas={tareasPorEstado.todo}
            user={user}
            rolUsuario={rolUsuario}
            asignados={asignados}
            onSeleccionar={openModal}
            onComenzar={confirmarComenzar}
            onCancelarSeleccion={confirmarCancelarSeleccion}
            onCambiarEstado={confirmarCambioEstado}
            onAbrirInforme={abrirInformeFinal}
            formatearFecha={formatearFecha}
            formatearTiempo={formatearTiempo}
            starting={starting}
          />

          <ColumnaKanban
            titulo="En Progreso"
            color="blue"
            tareas={tareasPorEstado['in-progress']}
            user={user}
            rolUsuario={rolUsuario}
            asignados={asignados}
            onSeleccionar={openModal}
            onComenzar={confirmarComenzar}
            onCancelarSeleccion={confirmarCancelarSeleccion}
            onCambiarEstado={confirmarCambioEstado}
            onAbrirInforme={abrirInformeFinal}
            formatearFecha={formatearFecha}
            formatearTiempo={formatearTiempo}
            starting={starting}
          />

          <ColumnaKanban
            titulo="Revisión"
            color="amber"
            tareas={tareasPorEstado.review}
            user={user}
            rolUsuario={rolUsuario}
            asignados={asignados}
            onSeleccionar={openModal}
            onComenzar={confirmarComenzar}
            onCancelarSeleccion={confirmarCancelarSeleccion}
            onCambiarEstado={confirmarCambioEstado}
            onAbrirInforme={abrirInformeFinal}
            formatearFecha={formatearFecha}
            formatearTiempo={formatearTiempo}
            starting={starting}
          />

          <ColumnaKanban
            titulo="Completadas"
            color="green"
            tareas={tareasPorEstado.completed}
            user={user}
            rolUsuario={rolUsuario}
            asignados={asignados}
            onSeleccionar={openModal}
            onComenzar={confirmarComenzar}
            onCancelarSeleccion={confirmarCancelarSeleccion}
            onCambiarEstado={confirmarCambioEstado}
            onAbrirInforme={abrirInformeFinal}
            formatearFecha={formatearFecha}
            formatearTiempo={formatearTiempo}
            starting={starting}
          />
        </div>
      </div>

      {tareaSeleccionada && (
        <ModalSeleccion
          tarea={tareaSeleccionada}
          asignados={asignados[tareaSeleccionada.id] ?? []}
          onSeleccionar={() => confirmarSeleccion(tareaSeleccionada.id)}
          onCancelar={() => setTareaSeleccionada(null)}
          comenzando={!!starting[tareaSeleccionada.id]}
          formatearTiempo={formatearTiempo}
        />
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTE: COLUMNA KANBAN
// ============================================================================

interface ColumnaKanbanProps {
  titulo: string;
  color: 'gray' | 'blue' | 'amber' | 'green';
  tareas: Tarea[];
  user: any;
  rolUsuario: RolUsuario;
  asignados: Record<string, Asignado[]>;
  onSeleccionar: (tarea: Tarea) => void;
  onComenzar: (id: string) => void;
  onCancelarSeleccion: (id: string) => void;
  onCambiarEstado: (id: string, estado: Estado) => void;
  onAbrirInforme: (tarea: Tarea) => void;
  formatearFecha: (fecha: string) => string;
  formatearTiempo: (minutos: number | null) => string | null;
  starting: Record<string, boolean>;
}

function ColumnaKanban({
  titulo,
  color,
  tareas,
  user,
  rolUsuario,
  asignados,
  onSeleccionar,
  onComenzar,
  onCancelarSeleccion,
  onCambiarEstado,
  onAbrirInforme,
  formatearFecha,
  formatearTiempo,
  starting,
}: ColumnaKanbanProps) {
  const colorConfig = {
    gray: 'from-gray-500/20 to-gray-600/20 border-gray-500/30',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    amber: 'from-amber-500/20 to-amber-600/20 border-amber-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
  };

  const badgeConfig = {
    gray: 'bg-gray-500/10 text-gray-300',
    blue: 'bg-blue-500/10 text-blue-300',
    amber: 'bg-amber-500/10 text-amber-300',
    green: 'bg-green-500/10 text-green-300',
  };

  return (
    <div className="flex min-h-[280px] flex-col 2xl:min-h-0">
      <div className={`mb-3 rounded-lg border bg-gradient-to-r p-3 backdrop-blur-xl ${colorConfig[color]}`}>
        <h3 className="flex items-center justify-between text-sm font-semibold text-white">
          {titulo}
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeConfig[color]}`}>
            {tareas.length}
          </span>
        </h3>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto 2xl:max-h-[calc(100vh-300px)]">
        {tareas.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No hay tareas</div>
        ) : (
          tareas.map((tarea) => (
            <TareaCard
              key={tarea.id}
              tarea={tarea}
              user={user}
              rolUsuario={rolUsuario}
              asignados={asignados[tarea.id] ?? []}
              onSeleccionar={onSeleccionar}
              onComenzar={onComenzar}
              onCancelarSeleccion={onCancelarSeleccion}
              onCambiarEstado={onCambiarEstado}
              onAbrirInforme={onAbrirInforme}
              formatearFecha={formatearFecha}
              formatearTiempo={formatearTiempo}
              starting={!!starting[tarea.id]}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE: TARJETA DE TAREA
// ============================================================================

interface TareaCardProps {
  tarea: Tarea;
  user: any;
  rolUsuario: RolUsuario;
  asignados: Asignado[];
  onSeleccionar: (tarea: Tarea) => void;
  onComenzar: (id: string) => void;
  onCancelarSeleccion: (id: string) => void;
  onCambiarEstado: (id: string, estado: Estado) => void;
  onAbrirInforme: (tarea: Tarea) => void;
  formatearFecha: (fecha: string) => string;
  formatearTiempo: (minutos: number | null) => string | null;
  starting: boolean;
}

function TareaCard({
  tarea,
  user,
  rolUsuario,
  asignados,
  onSeleccionar,
  onComenzar,
  onCancelarSeleccion,
  onCambiarEstado,
  onAbrirInforme,
  formatearFecha,
  formatearTiempo,
  starting,
}: TareaCardProps) {
  const router = useRouter();

  const getPrioridadConfig = (prioridad: Prioridad) => {
    const configs: Record<Prioridad, { badge: string; texto: string; icon: string }> = {
      critica: {
        badge: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
        texto: 'Crítica',
        icon: '🟣',
      },
      alta: {
        badge: 'bg-red-500/10 text-red-400 border-red-500/30',
        texto: 'Alta',
        icon: '🔴',
      },
      media: {
        badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        texto: 'Media',
        icon: '🟡',
      },
      baja: {
        badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        texto: 'Baja',
        icon: '🔵',
      },
    };
    return configs[prioridad];
  };

  const esUsuarioAsignado = asignados.some((a) => a.email === user?.email);
  const puedeRevisar = puedeRevisarRol(rolUsuario);
  const prioridadConfig = getPrioridadConfig(tarea.prioridad);
  const tiempoFormateado = formatearTiempo(tarea.tiempo_estimado_minutos);

  const irAConfiguracionesTarea = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/dashboard/proyectos/${tarea.proyecto_id}/tareas/${tarea.id}/configuracion`);
  };

  return (
    <div className="group cursor-pointer rounded-lg border border-white/10 bg-slate-900/50 p-3 backdrop-blur-xl transition-all hover:border-purple-500/30">
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSeleccionar(tarea);
        }}
      >
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <h4 className="line-clamp-2 flex-1 text-sm font-medium text-white transition-colors group-hover:text-purple-300">
            {tarea.titulo}
          </h4>
          <button
            type="button"
            onClick={irAConfiguracionesTarea}
            className="shrink-0 self-start rounded-md border border-slate-600/70 bg-slate-800/60 px-2 py-1 text-[11px] font-semibold text-gray-200 transition-all hover:border-purple-400 hover:bg-purple-600/30 hover:text-white"
            title="Editar configuración de la tarea"
          >
            Editar
          </button>
        </div>

        {tarea.descripcion && (
          <p className="mb-2 line-clamp-2 break-words text-xs text-gray-400">{tarea.descripcion}</p>
        )}

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${prioridadConfig.badge}`}>
            <span>{prioridadConfig.icon}</span>
            <span>{prioridadConfig.texto}</span>
          </span>

          {tiempoFormateado && (
            <span className="flex items-center gap-1 rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-400">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              {tiempoFormateado}
            </span>
          )}

          <span className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.972 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            {asignados.length}/{tarea.max_participantes}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{formatearFecha(tarea.created_at)}</span>
        </div>
      </div>

      {tarea.estado === 'todo' && esUsuarioAsignado && (
        <div className="mt-2 space-y-2 border-t border-white/5 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onComenzar(tarea.id);
            }}
            disabled={starting}
            className="w-full rounded bg-gradient-to-r from-purple-600 to-pink-600 px-2 py-1 text-xs font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
          >
            {starting ? 'Comenzando...' : '▶️ Comenzar Tarea'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancelarSeleccion(tarea.id);
            }}
            disabled={starting}
            className="w-full rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
          >
            ✕ Cancelar Selección
          </button>
        </div>
      )}

      {tarea.estado === 'in-progress' && esUsuarioAsignado && (
        <div className="mt-2 space-y-2 border-t border-white/5 pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAbrirInforme(tarea);
            }}
            disabled={starting}
            className="w-full rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-50"
          >
            📝 Enviar informe final
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCambiarEstado(tarea.id, 'todo');
            }}
            disabled={starting}
            className="w-full rounded border border-white/10 bg-slate-700/50 px-2 py-1 text-xs font-semibold text-gray-300 transition-all hover:bg-slate-700 disabled:opacity-50"
          >
            ← Volver a Por Hacer
          </button>
        </div>
      )}

      {tarea.estado === 'review' && (
        <div className="mt-2 space-y-2 border-t border-white/5 pt-2">
          <div className="w-full rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-center text-xs font-semibold text-amber-300">
            En espera de revisión
          </div>

          {puedeRevisar && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAbrirInforme(tarea);
              }}
              className="w-full rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-400 transition-all hover:bg-green-500/20"
            >
              🔍 Revisar informe
            </button>
          )}
        </div>
      )}

      {tarea.estado === 'completed' && (
        <div className="mt-2 space-y-2 border-t border-white/5 pt-2">
          <div className="w-full rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-center text-xs font-semibold text-emerald-300">
            Tarea completada
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAbrirInforme(tarea);
            }}
            className="w-full rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            👁 Ver informe
          </button>

          {esUsuarioAsignado && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCambiarEstado(tarea.id, 'todo');
              }}
              disabled={starting}
              className="w-full rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-400 transition-all hover:bg-blue-500/20 disabled:opacity-50"
            >
              ↻ Reabrir
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENTE: MODAL DE SELECCIÓN
// ============================================================================

interface ModalSeleccionProps {
  tarea: Tarea;
  asignados: Asignado[];
  onSeleccionar: () => void;
  onCancelar: () => void;
  comenzando: boolean;
  formatearTiempo: (minutos: number | null) => string | null;
}

function ModalSeleccion({
  tarea,
  asignados,
  onSeleccionar,
  onCancelar,
  comenzando,
  formatearTiempo,
}: ModalSeleccionProps) {
  const cupoLleno = asignados.length >= tarea.max_participantes;
  const tareaBloqueada = tarea.estado === 'completed' || tarea.estado === 'review';

  const getPrioridadConfig = (prioridad: Prioridad) => {
    const configs: Record<Prioridad, { badge: string; texto: string; icon: string }> = {
      critica: { badge: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30', texto: 'Crítica', icon: '🟣' },
      alta: { badge: 'bg-red-500/10 text-red-400 border-red-500/30', texto: 'Alta', icon: '🔴' },
      media: { badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', texto: 'Media', icon: '🟡' },
      baja: { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30', texto: 'Baja', icon: '🔵' },
    };
    return configs[prioridad];
  };

  const prioridadConfig = getPrioridadConfig(tarea.prioridad);
  const tiempoFormateado = formatearTiempo(tarea.tiempo_estimado_minutos);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl sm:p-6">
        <h3 className="mb-2 break-words text-xl font-bold text-white">{tarea.titulo}</h3>

        {tarea.descripcion && (
          <p className="mb-4 break-words text-sm text-gray-400">{tarea.descripcion}</p>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <span className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${prioridadConfig.badge}`}>
            <span>{prioridadConfig.icon}</span>
            <span>Prioridad: {prioridadConfig.texto}</span>
          </span>

          {tiempoFormateado && (
            <span className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-sm font-semibold text-purple-400">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              {tiempoFormateado}
            </span>
          )}

          <span className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-sm font-semibold text-indigo-400">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.972 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <span>Max: {tarea.max_participantes}</span>
          </span>
        </div>

        <div className="mb-4 rounded-lg border border-white/5 bg-slate-800/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs text-gray-400">Participantes seleccionados</div>
            <div className="text-sm font-semibold text-white">
              {asignados.length} / {tarea.max_participantes}
            </div>
          </div>

          {asignados.length > 0 ? (
            <div className="mt-3 space-y-2">
              {asignados.map((asignado, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-900/50 p-2 transition-colors hover:border-purple-500/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-xs font-semibold text-white">
                    {asignado.nombre.charAt(0).toUpperCase()}
                    {asignado.apellido?.charAt(0).toUpperCase() || ''}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {asignado.nombre} {asignado.apellido || ''}
                    </p>
                    <p className="truncate text-xs text-gray-500">{asignado.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-400">
                    Activo
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center">
              <svg className="mx-auto mb-2 h-10 w-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.972 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-xs text-gray-500">Nadie ha seleccionado esta tarea aún</p>
            </div>
          )}
        </div>

        {tarea.estado === 'completed' ? (
          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <p className="text-sm text-green-400">
              Esta tarea está completada. No se pueden agregar más participantes.
            </p>
          </div>
        ) : tarea.estado === 'review' ? (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-300">
              Esta tarea está en revisión. No se pueden agregar más participantes.
            </p>
          </div>
        ) : cupoLleno ? (
          <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <p className="text-sm text-yellow-400">
              Esta tarea ya alcanzó el máximo de participantes.
            </p>
          </div>
        ) : (
          <div className="mb-4 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
            <p className="text-sm text-purple-300">
              ¿Deseas seleccionar esta tarea? Podrás comenzarla después.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 font-semibold text-gray-300 transition-all hover:bg-slate-700/50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSeleccionar}
            disabled={comenzando || cupoLleno || tareaBloqueada}
            className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 font-semibold text-white transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            {comenzando ? 'Seleccionando...' : 'Seleccionar Tarea'}
          </button>
        </div>
      </div>
    </div>
  );
}