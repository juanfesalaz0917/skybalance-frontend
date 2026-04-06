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

import React, { useState } from 'react';
import {
  List, Play, Trash2, Plus, AlertTriangle,
  CheckCircle2, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { FlightPayload } from '../services/TreeService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QueueResult {
  processed: number;
  conflicts: string[];
}

interface ConcurrencyQueueProps {
  onProcess: (flights: FlightPayload[]) => Promise<QueueResult>;
}

// ─── Empty flight draft ───────────────────────────────────────────────────────

const emptyDraft = (): FlightPayload => ({
  codigo:    '',
  origen:    '',
  destino:   '',
  horaSalida:'',
  precioBase: 0,
  precioFinal:0,
  pasajeros:  0,
  prioridad:  1,
  promocion:  false,
  alerta:     false,
});

// ─── Component ────────────────────────────────────────────────────────────────

const ConcurrencyQueue: React.FC<ConcurrencyQueueProps> = ({ onProcess }) => {
  const [queue,       setQueue]       = useState<FlightPayload[]>([]);
  const [draft,       setDraft]       = useState<FlightPayload>(emptyDraft());
  const [showForm,    setShowForm]    = useState(false);
  const [isProcessing,setIsProcessing]= useState(false);
  const [result,      setResult]      = useState<QueueResult | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // ── Add to queue (no API call yet) ──
  const addToQueue = () => {
    if (!draft.codigo.trim() || !draft.origen.trim() || !draft.destino.trim()) {
      setError('Código, origen y destino son obligatorios.');
      return;
    }
    setQueue(prev => [...prev, { ...draft }]);
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
      setError('Error al procesar la cola.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-900 border-l border-zinc-800 w-72 flex-shrink-0 flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-black">
        <List size={15} className="text-zinc-400" />
        <h3 className="text-white font-bold text-sm">Cola de inserción</h3>
        <span className="ml-auto bg-zinc-700 text-zinc-300 text-[10px] font-bold
                         px-1.5 py-0.5 rounded-full">
          {queue.length}
        </span>
      </div>

      {/* Queue items */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800">
        {queue.length === 0 ? (
          <p className="text-zinc-600 text-xs text-center py-6 px-3">
            Sin vuelos en cola. Agrega vuelos y luego procésalos de una vez.
          </p>
        ) : (
          queue.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 group">
              <div>
                <p className="text-white text-xs font-semibold">{f.codigo}</p>
                <p className="text-zinc-500 text-[10px]">{f.origen} → {f.destino}</p>
              </div>
              <button
                onClick={() => setQueue(prev => prev.filter((_, idx) => idx !== i))}
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
          onClick={() => setShowForm(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-zinc-400
                     hover:text-white text-xs font-semibold transition-colors"
        >
          <span className="flex items-center gap-1.5"><Plus size={13} /> Agregar vuelo a cola</span>
          {showForm ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showForm && (
          <div className="px-3 pb-3 space-y-2">
            {(['codigo','origen','destino','horaSalida'] as const).map(field => (
              <input
                key={field}
                type={field === 'horaSalida' ? 'time' : 'text'}
                placeholder={field}
                value={draft[field] as string}
                onChange={e => setDraft(prev => ({ ...prev, [field]: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5
                           text-xs text-white placeholder-zinc-500 outline-none
                           focus:border-zinc-500"
              />
            ))}
            {(['precioBase','precioFinal','pasajeros'] as const).map(field => (
              <input
                key={field}
                type="number"
                placeholder={field}
                value={draft[field] as number || ''}
                onChange={e => setDraft(prev => ({ ...prev, [field]: Number(e.target.value) }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5
                           text-xs text-white placeholder-zinc-500 outline-none
                           focus:border-zinc-500"
              />
            ))}
            {error && <p className="text-red-400 text-[10px]">{error}</p>}
            <button
              onClick={addToQueue}
              className="w-full py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs
                         font-semibold rounded-lg transition-colors"
            >
              Agregar a cola
            </button>
          </div>
        )}
      </div>

      {/* Process button */}
      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={handleProcess}
          disabled={queue.length === 0 || isProcessing}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg
                     bg-white text-black text-xs font-bold
                     hover:bg-gray-100 disabled:opacity-40 transition-colors"
        >
          {isProcessing
            ? <><Loader2 size={13} className="animate-spin" /> Procesando…</>
            : <><Play size={13} /> Procesar cola ({queue.length})</>}
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
                  <AlertTriangle size={10} /> {result.conflicts.length} conflicto(s)
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.conflicts.map(code => (
                    <span key={code}
                      className="text-[10px] bg-amber-900/50 text-amber-200 px-1.5 py-0.5
                                 rounded font-mono">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConcurrencyQueue;