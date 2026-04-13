/**
 * @file ConcurrencyQueue.tsx
 * @description Concurrency simulation — pending flight insertion queue.
 *
 * REQ §3 — Simulación de Concurrencia:
 *  - User can add flights to a pending queue WITHOUT inserting them yet.
 *  - A "Procesar cola" button inserts them one by one and shows results.
 *  - Conflicts (critical balance events) are highlighted.
 *
 * SOLID — (S) Only queue UI. API calls delegated via callbacks.
 *         (D) onProcess callback owns the TreeService call.
 */

import axios from "axios";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  List,
  Loader2,
  Play,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type {
  FlightPayload,
  ParallelSimulationEvent,
  ParallelSimulationEventsPage,
  ParallelSimulationStartResult,
  ParallelSimulationStatus,
} from "../services/TreeService";

// ─── Props ────────────────────────────────────────────────────────────────────

interface QueueResult {
  processed: number;
  conflicts: string[];
}

interface ConcurrencyQueueProps {
  onProcess: (flights: FlightPayload[]) => Promise<QueueResult>;
  onEnqueue: (flights: FlightPayload[]) => Promise<void>;
  onStartParallel: (options: {
    workers: number;
    maxItems?: number;
    delayMs?: number;
  }) => Promise<ParallelSimulationStartResult>;
  onGetParallelStatus: (jobId: string) => Promise<ParallelSimulationStatus>;
  onGetParallelEvents: (
    jobId: string,
    offset: number,
    limit?: number,
  ) => Promise<ParallelSimulationEventsPage>;
  onStopParallel: (jobId: string) => Promise<void>;
  onParallelMutation?: () => Promise<void> | void;
}

// ─── Empty flight draft ───────────────────────────────────────────────────────

const emptyDraft = (): FlightPayload => ({
  codigo: "",
  origen: "",
  destino: "",
  horaSalida: "",
  precioBase: 0,
  precioFinal: 0,
  pasajeros: 0,
  prioridad: 1,
  promocion: false,
  alerta: false,
});

// ─── Component ────────────────────────────────────────────────────────────────

const ConcurrencyQueue: React.FC<ConcurrencyQueueProps> = ({
  onProcess,
  onEnqueue,
  onStartParallel,
  onGetParallelStatus,
  onGetParallelEvents,
  onStopParallel,
  onParallelMutation,
}) => {
  const [queue, setQueue] = useState<FlightPayload[]>([]);
  const [draft, setDraft] = useState<FlightPayload>(emptyDraft());
  const [showForm, setShowForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<QueueResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [workers, setWorkers] = useState(2);
  const [maxItems, setMaxItems] = useState<number | "">("");
  const [delayMs, setDelayMs] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [parallelStatus, setParallelStatus] =
    useState<ParallelSimulationStatus | null>(null);
  const [parallelEvents, setParallelEvents] = useState<
    ParallelSimulationEvent[]
  >([]);
  const [parallelError, setParallelError] = useState<string | null>(null);
  const [isStartingParallel, setIsStartingParallel] = useState(false);
  const [isStoppingParallel, setIsStoppingParallel] = useState(false);
  const eventsOffsetRef = useRef(0);

  // ── Add to queue (no API call yet) ──
  const addToQueue = () => {
    if (!draft.codigo.trim() || !draft.origen.trim() || !draft.destino.trim()) {
      setError("Código, origen y destino son obligatorios.");
      return;
    }
    setQueue((prev) => [...prev, { ...draft }]);
    setDraft(emptyDraft());
    setShowForm(false);
    setError(null);
  };

  // ── Process the entire queue ──
  const handleProcess = async () => {
    if (queue.length === 0) return;
    setIsProcessing(true);
    setResult(null);
    setError(null);
    try {
      const res = await onProcess(queue);
      setResult(res);
      setQueue([]); // clear after processing
    } catch {
      setError("Error al procesar la cola.");
    } finally {
      setIsProcessing(false);
    }
  };

  const appendEvents = (events: ParallelSimulationEvent[]) => {
    if (events.length === 0) return;
    setParallelEvents((prev) => [...prev, ...events].slice(-120));
    eventsOffsetRef.current += events.length;
  };

  const toErrorMessage = (e: unknown, fallback: string) => {
    if (axios.isAxiosError(e)) {
      const apiError = e.response?.data?.error;
      if (typeof apiError === "string" && apiError.trim()) return apiError;
      if (typeof e.message === "string" && e.message.trim()) return e.message;
      return fallback;
    }
    if (e instanceof Error && e.message.trim()) return e.message;
    return fallback;
  };

  const pollSimulation = useCallback(
    async (jobId: string) => {
      const [status, eventsPage] = await Promise.all([
        onGetParallelStatus(jobId),
        onGetParallelEvents(jobId, eventsOffsetRef.current, 100),
      ]);
      setParallelStatus(status);
      appendEvents(eventsPage.events);
      if (eventsPage.events.length > 0 || status.status !== "running") {
        await onParallelMutation?.();
      }
      return status;
    },
    [onGetParallelEvents, onGetParallelStatus, onParallelMutation],
  );

  const handleStartParallel = async () => {
    setParallelError(null);
    setIsStartingParallel(true);
    setParallelEvents([]);
    setParallelStatus(null);
    eventsOffsetRef.current = 0;

    try {
      if (queue.length > 0) {
        await onEnqueue(queue);
      }
      const started = await onStartParallel({
        workers: Math.max(1, workers || 1),
        delayMs: Math.max(0, delayMs || 0),
        maxItems:
          typeof maxItems === "number" && maxItems > 0 ? maxItems : undefined,
      });
      setCurrentJobId(started.jobId);
      setQueue([]);
      await pollSimulation(started.jobId);
    } catch (e) {
      const msg = toErrorMessage(e, "No se pudo iniciar la simulación.");
      setParallelError(msg);
      setCurrentJobId(null);
    } finally {
      setIsStartingParallel(false);
    }
  };

  const handleStopParallel = async () => {
    if (!currentJobId) return;
    setIsStoppingParallel(true);
    setParallelError(null);
    try {
      await onStopParallel(currentJobId);
      await pollSimulation(currentJobId);
    } catch (e) {
      const msg = toErrorMessage(e, "No se pudo detener la simulación.");
      setParallelError(msg);
    } finally {
      setIsStoppingParallel(false);
    }
  };

  useEffect(() => {
    if (!currentJobId) return;
    if (parallelStatus && parallelStatus.status !== "running") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const status = await pollSimulation(currentJobId);
        if (cancelled || status.status !== "running") return;
      } catch (e) {
        const msg = toErrorMessage(
          e,
          "Fallo al consultar estado de simulación.",
        );
        setParallelError(msg);
        return;
      }
      timer = setTimeout(tick, 1200);
    };

    timer = setTimeout(tick, 600);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentJobId, parallelStatus, pollSimulation]);

  const parallelIsRunning = parallelStatus?.status === "running";
  const progress = parallelStatus?.progressPercent ?? 0;

  return (
    <div className="relative bg-zinc-900 border-l border-zinc-800 w-72 flex-shrink-0 h-full min-h-0 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-black">
        <List size={15} className="text-zinc-400" />
        <h3 className="text-white font-bold text-sm">Cola de inserción</h3>
        <span
          className="ml-auto bg-zinc-700 text-zinc-300 text-[10px] font-bold
                         px-1.5 py-0.5 rounded-full"
        >
          {queue.length}
        </span>
      </div>

      {/* Queue items */}
      <div className="min-h-0 divide-y divide-zinc-800">
        {queue.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-6 px-3">
            Sin vuelos en cola. Agrega vuelos y luego procésalos de una vez.
          </p>
        ) : (
          queue.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 group"
            >
              <div>
                <p className="text-white text-xs font-semibold">{f.codigo}</p>
                <p className="text-zinc-500 text-[10px]">
                  {f.origen} → {f.destino}
                </p>
              </div>
              <button
                onClick={() =>
                  setQueue((prev) => prev.filter((_, idx) => idx !== i))
                }
                aria-label={`Quitar ${f.codigo} de la cola`}
                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400
                           transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add flight form */}
      <div className="border-t border-zinc-800">
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-zinc-400
                     hover:text-white text-xs font-semibold transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Plus size={13} /> Agregar vuelo a cola
          </span>
          <span className="text-[10px] text-zinc-500">Abrir formulario</span>
        </button>
      </div>

      {showForm && (
        <div className="absolute inset-0 z-30 bg-black/45 p-3 flex items-end">
          <div className="w-full border border-zinc-700 rounded-xl bg-zinc-900 shadow-2xl overflow-hidden max-h-[85%] overflow-y-auto">
            <div className="sticky top-0 z-10 px-3 py-2.5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-zinc-200">
                Agregar vuelo a cola
              </p>
              <button
                onClick={() => setShowForm(false)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
                aria-label="Cerrar formulario"
              >
                <X size={13} />
              </button>
            </div>

            <div className="px-3 py-3 space-y-2">
              {(["codigo", "origen", "destino", "horaSalida"] as const).map(
                (field) => (
                  <input
                    key={field}
                    type={field === "horaSalida" ? "time" : "text"}
                    placeholder={field}
                    value={draft[field] as string}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5
                           text-xs text-white placeholder-zinc-500 outline-none
                           focus:border-zinc-500"
                  />
                ),
              )}
              {(["precioBase", "precioFinal", "pasajeros"] as const).map(
                (field) => (
                  <div key={field} className="space-y-1">
                    <input
                      type="number"
                      placeholder={field}
                      value={(draft[field] as number) || ""}
                      onChange={(e) => {
                        if (field === "precioFinal") return;
                        setDraft((prev) => ({
                          ...prev,
                          [field]: Number(e.target.value),
                        }));
                      }}
                      readOnly={field === "precioFinal"}
                      className={`w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none
                           ${
                             field === "precioFinal"
                               ? "bg-zinc-800 border-zinc-700 text-zinc-400 cursor-not-allowed"
                               : "bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-zinc-500"
                           }`}
                    />
                    {field === "precioFinal" && (
                      <p className="text-[10px] text-zinc-500">
                        Calculado automáticamente por el sistema.
                      </p>
                    )}
                  </div>
                ),
              )}
              {error && <p className="text-red-400 text-[10px]">{error}</p>}
              <button
                onClick={addToQueue}
                className="w-full py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs
                         font-semibold rounded-lg transition-colors"
              >
                Agregar a cola
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Process button */}
      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={handleProcess}
          disabled={queue.length === 0 || isProcessing}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                     bg-white text-black text-xs font-bold
                     hover:bg-gray-100 disabled:opacity-40 transition-colors"
        >
          {isProcessing ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Procesando…
            </>
          ) : (
            <>
              <Play size={13} /> Procesar cola ({queue.length})
            </>
          )}
        </button>

        {/* Result */}
        {result && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-green-400 text-xs">
              <CheckCircle2 size={12} />
              {result.processed} vuelos insertados
            </div>
            {result.conflicts.length > 0 && (
              <div className="bg-amber-900/40 border border-amber-800 rounded-lg px-2 py-1.5">
                <p className="text-amber-300 text-[10px] font-semibold flex items-center gap-1 mb-1">
                  <AlertTriangle size={10} /> {result.conflicts.length}{" "}
                  conflicto(s)
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.conflicts.map((code) => (
                    <span
                      key={code}
                      className="text-[10px] bg-amber-900/50 text-amber-200 px-1.5 py-0.5
                                 rounded font-mono"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 border border-zinc-800 rounded-lg bg-zinc-950/70">
          <div className="px-2.5 py-2 border-b border-zinc-800 flex items-center gap-1.5">
            <Activity size={12} className="text-sky-400" />
            <p className="text-[11px] font-semibold text-zinc-200">
              Simulación paralela
            </p>
          </div>

          <div className="p-2.5 space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                min={1}
                value={workers}
                onChange={(e) =>
                  setWorkers(Math.max(1, Number(e.target.value) || 1))
                }
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[11px] text-white"
                placeholder="workers"
              />
              <input
                type="number"
                min={1}
                value={maxItems}
                onChange={(e) => {
                  if (e.target.value === "") setMaxItems("");
                  else setMaxItems(Math.max(1, Number(e.target.value) || 1));
                }}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[11px] text-white"
                placeholder="max"
              />
              <input
                type="number"
                min={0}
                value={delayMs}
                onChange={(e) =>
                  setDelayMs(Math.max(0, Number(e.target.value) || 0))
                }
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[11px] text-white"
                placeholder="delay"
              />
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={handleStartParallel}
                disabled={isStartingParallel || parallelIsRunning}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded
                           bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold
                           disabled:opacity-40"
              >
                {isStartingParallel ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Iniciando
                  </>
                ) : (
                  <>
                    <Play size={12} /> Start
                  </>
                )}
              </button>
              <button
                onClick={handleStopParallel}
                disabled={!parallelIsRunning || isStoppingParallel}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded
                           bg-rose-700 hover:bg-rose-600 text-white text-[11px] font-semibold
                           disabled:opacity-40"
              >
                {isStoppingParallel ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Deteniendo
                  </>
                ) : (
                  <>
                    <Square size={12} /> Stop
                  </>
                )}
              </button>
            </div>

            {parallelStatus && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>
                    {parallelStatus.status} · {parallelStatus.processed}/
                    {parallelStatus.total}
                  </span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] text-zinc-500">
                  <span>ok: {parallelStatus.inserted}</span>
                  <span>err: {parallelStatus.failed}</span>
                  <span>warn: {parallelStatus.warnings}</span>
                </div>
              </div>
            )}

            {parallelError && (
              <p className="text-red-400 text-[10px]">{parallelError}</p>
            )}

            <div className="max-h-36 overflow-y-auto border border-zinc-800 rounded bg-zinc-900/70">
              {parallelEvents.length === 0 ? (
                <p className="text-[10px] text-zinc-600 px-2 py-2">
                  Sin eventos aún.
                </p>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {parallelEvents.map((event, idx) => (
                    <div
                      key={`${event.timestamp}-${idx}`}
                      className="px-2 py-1.5 text-[10px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={
                            event.result === "inserted"
                              ? "text-emerald-300"
                              : "text-red-300"
                          }
                        >
                          W{event.workerId} · {event.result}
                        </span>
                        <span className="text-zinc-500 font-mono">
                          {event.codigo ?? "---"}
                        </span>
                      </div>
                      {event.conflict?.hasConflict && (
                        <p className="text-amber-300 mt-0.5">
                          conflicto: {event.conflict.types.join(", ")}
                        </p>
                      )}
                      {event.message && (
                        <p className="text-zinc-500 mt-0.5">{event.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConcurrencyQueue;
