/**
 * @file AnalyticsPanel.tsx
 * @description Real-time AVL tree analytics panel.
 *
 * REQ §4 — Métricas Analíticas del Árbol:
 *  - Altura actual.
 *  - Rotaciones por tipo (II, DD, ID, DI).
 *  - Cancelaciones masivas.
 *  - Recorridos BFS y DFS.
 *  - Cantidad de hojas.
 *
 * SOLID — (S) Only renders metrics. Fetching delegated to parent via props.
 */

import {
    ArrowLeftRight,
    BarChart2,
    ChevronDown, ChevronUp,
    Leaf,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import type { TreeMetrics } from '../services/TreeService';
import { TreeService } from '../services/TreeService';

// ─── Sub-component: Stat tile ─────────────────────────────────────────────────

const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  accent?: string;
}> = ({ label, value, accent = 'text-white' }) => (
  <div className="bg-zinc-800 rounded-xl px-3 py-2.5">
    <p className="text-zinc-500 text-[10px] uppercase tracking-wider">{label}</p>
    <p className={`text-xl font-bold mt-0.5 ${accent}`}>{value}</p>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface AnalyticsPanelProps {
  /** Auto-refreshes metrics every N ms when > 0. Default: 0 (manual only). */
  autoRefreshMs?: number;
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ autoRefreshMs = 0 }) => {
  const [metrics,    setMetrics]    = useState<TreeMetrics | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [showBFS,    setShowBFS]    = useState(false);
  const [showDFS,    setShowDFS]    = useState(false);
  const [showPostOrder, setShowPostOrder] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const m = await TreeService.getMetrics();
      setMetrics(m);
    } catch {
      setError('No se pudieron cargar las métricas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch + optional auto-refresh
  useEffect(() => {
    fetchMetrics();
    if (autoRefreshMs > 0) {
      const id = setInterval(fetchMetrics, autoRefreshMs);
      return () => clearInterval(id);
    }
  }, [fetchMetrics, autoRefreshMs]);

  return (
    <div className="bg-zinc-900 border-l border-zinc-800 w-72 flex-shrink-0 flex flex-col overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-zinc-400" />
          <h3 className="text-white font-bold text-sm">Métricas AVL</h3>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={isLoading}
          aria-label="Actualizar métricas"
          className="text-zinc-400 hover:text-white disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Loading */}
      {isLoading && !metrics && (
        <div className="flex items-center justify-center py-10 gap-2 text-zinc-500">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Calculando…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-xs px-4 py-3">{error}</p>
      )}

      {metrics && (
        <div className="flex-1 p-4 space-y-4">

          {/* ── Core stats ── */}
          <section>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">General</p>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Altura"      value={metrics.altura}      accent="text-blue-400" />
              <Stat label="Nodos"       value={metrics.nodos}       accent="text-green-400" />
              <Stat label="Hojas"       value={metrics.hojas}       accent="text-purple-400" />
              <Stat label="Cancelaciones" value={metrics.cancelaciones} accent="text-red-400" />
            </div>
          </section>

          {/* ── Rotations breakdown ── */}
          <section>
            <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">
              Rotaciones por tipo
            </p>
            <div className="bg-zinc-800 rounded-xl p-3 space-y-2">
              {(Object.entries(metrics.rotaciones) as [string, number][]).map(([type, count]) => {
                const total = Object.values(metrics.rotaciones).reduce((a, b) => a + b, 0);
                const pct   = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-zinc-300 text-xs font-semibold">{type}</span>
                      <span className="text-amber-400 text-xs font-bold">{count}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-zinc-600 text-[10px] text-right pt-1">
                Total: {Object.values(metrics.rotaciones).reduce((a, b) => a + b, 0)}
              </p>
            </div>
          </section>

          {/* ── BFS traversal ── */}
          <section>
            <button
              onClick={() => setShowBFS(v => !v)}
              className="w-full flex items-center justify-between text-zinc-400 hover:text-white
                         text-[10px] uppercase tracking-wider transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <ArrowLeftRight size={11} /> Recorrido BFS ({metrics.recorridoBFS.length} nodos)
              </span>
              {showBFS ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showBFS && (
              <div className="mt-2 bg-zinc-800 rounded-xl p-3 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {metrics.recorridoBFS.map((code, i) => (
                    <span
                      key={`${code}-${i}`}
                      className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded font-mono"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── DFS traversal ── */}
          <section>
            <button
              onClick={() => setShowDFS(v => !v)}
              className="w-full flex items-center justify-between text-zinc-400 hover:text-white
                         text-[10px] uppercase tracking-wider transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Leaf size={11} /> Recorrido DFS ({metrics.recorridoDFS.length} nodos)
              </span>
              {showDFS ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showDFS && (
              <div className="mt-2 bg-zinc-800 rounded-xl p-3 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {metrics.recorridoDFS.map((code, i) => (
                    <span
                      key={`${code}-${i}`}
                      className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded font-mono"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Post-Order traversal ── */}
          <section>
            <button
              onClick={() => setShowPostOrder(v => !v)}
              className="w-full flex items-center justify-between text-zinc-400 hover:text-white
                         text-[10px] uppercase tracking-wider transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Leaf size={11} /> Recorrido Post-Order ({metrics.recorridoPostOrder.length} nodos)
              </span>
              {showPostOrder ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showPostOrder && (
              <div className="mt-2 bg-zinc-800 rounded-xl p-3 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {metrics.recorridoPostOrder.map((code, i) => (
                    <span
                      key={`${code}-${i}`}
                      className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded font-mono"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPanel;