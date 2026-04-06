/**
 * @file StressModeBar.tsx
 * @description Toolbar that surfaces all advanced tree controls.
 *
 * Covers requirements:
 *  REQ §1.2 — Ctrl+Z undo button
 *  REQ §1.3 — Export tree to JSON
 *  REQ §5   — Stress mode toggle + Global rebalance button
 *  REQ §6   — Critical depth input (editable at any time)
 *  REQ §7   — "Verificar Propiedad AVL" button (only in stress mode)
 *  REQ §8   — "Eliminar nodo de menor rentabilidad" button
 *
 * SOLID — (S) Only renders the toolbar UI.
 *         (D) All actions are injected as callbacks.
 */

import React, { useState } from 'react';
import {
  Zap, ZapOff, RotateCcw, Download, Undo2,
  ShieldCheck, TrendingDown, AlertTriangle, Loader2, Settings,
} from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StressModeBarProps {
  // ── State ──
  stressMode:    boolean;
  criticalDepth: number;
  lastUndoLabel: string | null;   // null = undo stack is empty
  isTogglingStress: boolean;

  // ── Callbacks ──
  onToggleStress:       () => void;
  onRebalance:          () => Promise<void>;
  onVerifyAVL:          () => Promise<void>;
  onUndo:               () => void;
  onExportJSON:         () => void;
  onDeleteMinProfit:    () => Promise<void>;
  onCriticalDepthChange:(depth: number) => Promise<void>;
  onCancelSubtree:      (codigo: string) => Promise<void>;

  // ── Result states ──
  rebalanceResult?: { rotaciones: Record<string, number>; nodesFixed: number } | null;
  avlVerifyResult?: { valid: boolean; issues: unknown[] } | null;
  minProfitResult?: { deleted: { codigo: string }; subtree: string[] } | null;
}

// ─── Sub-component: ToolButton ────────────────────────────────────────────────

const ToolButton: React.FC<{
  label:    string;
  icon:     React.ReactNode;
  onClick:  () => void;
  disabled?: boolean;
  loading?:  boolean;
  variant?:  'default' | 'danger' | 'warning' | 'success';
  title?:   string;
}> = ({ label, icon, onClick, disabled, loading, variant = 'default', title }) => {
  const colors = {
    default: 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border-zinc-700',
    danger:  'bg-red-900/50 text-red-300 hover:bg-red-800 hover:text-white border-red-800',
    warning: 'bg-amber-900/50 text-amber-300 hover:bg-amber-800 hover:text-white border-amber-800',
    success: 'bg-green-900/50 text-green-300 hover:bg-green-800 hover:text-white border-green-800',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title ?? label}
      aria-label={label}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-lg border
        text-xs font-semibold transition-all duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${colors[variant]}
      `}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const StressModeBar: React.FC<StressModeBarProps> = ({
  stressMode,
  criticalDepth,
  lastUndoLabel,
  isTogglingStress,
  onToggleStress,
  onRebalance,
  onVerifyAVL,
  onUndo,
  onExportJSON,
  onDeleteMinProfit,
  onCriticalDepthChange,
  rebalanceResult,
  avlVerifyResult,
  minProfitResult,
}) => {
  const [localDepth,     setLocalDepth]     = useState(criticalDepth);
  const [loadingRebal,   setLoadingRebal]   = useState(false);
  const [loadingVerify,  setLoadingVerify]  = useState(false);
  const [loadingMinProfit, setLoadingMinProfit] = useState(false);
  const [showDepthInput, setShowDepthInput] = useState(false);

  const handleRebalance = async () => {
    setLoadingRebal(true);
    try { await onRebalance(); } finally { setLoadingRebal(false); }
  };

  const handleVerify = async () => {
    setLoadingVerify(true);
    try { await onVerifyAVL(); } finally { setLoadingVerify(false); }
  };

  const handleMinProfit = async () => {
    setLoadingMinProfit(true);
    try { await onDeleteMinProfit(); } finally { setLoadingMinProfit(false); }
  };

  const handleDepthSubmit = async () => {
    await onCriticalDepthChange(localDepth);
    setShowDepthInput(false);
  };

  return (
    <div className={`
      border-b flex flex-col
      ${stressMode
        ? 'bg-red-950/30 border-red-900/60'
        : 'bg-zinc-900 border-zinc-800'}
    `}>
      {/* ── Main toolbar row ── */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap">

        {/* Stress mode indicator label */}
        {stressMode && (
          <span className="flex items-center gap-1.5 text-red-400 text-xs font-bold
                           animate-pulse mr-1">
            <AlertTriangle size={13} />
            MODO ESTRÉS ACTIVO
          </span>
        )}

        {/* ── REQ §1.2 — Undo ── */}
        <ToolButton
          label={lastUndoLabel ? `Deshacer: ${lastUndoLabel}` : 'Deshacer'}
          icon={<Undo2 size={13} />}
          onClick={onUndo}
          disabled={!lastUndoLabel}
          title={lastUndoLabel ? `Deshacer: ${lastUndoLabel}` : 'Sin acciones para deshacer'}
        />

        {/* ── REQ §1.3 — Export JSON ── */}
        <ToolButton
          label="Exportar JSON"
          icon={<Download size={13} />}
          onClick={onExportJSON}
          variant="success"
        />

        {/* ── REQ §6 — Critical depth ── */}
        <div className="relative">
          <ToolButton
            label={`Prof. crítica: ${criticalDepth}`}
            icon={<Settings size={13} />}
            onClick={() => setShowDepthInput(v => !v)}
            variant="warning"
          />
          {showDepthInput && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-zinc-800 border border-zinc-600
                            rounded-xl p-3 shadow-xl flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={localDepth}
                onChange={e => setLocalDepth(Number(e.target.value))}
                className="w-16 bg-zinc-700 text-white text-sm px-2 py-1 rounded-lg
                           border border-zinc-600 outline-none focus:border-zinc-400"
                autoFocus
              />
              <button
                onClick={handleDepthSubmit}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs
                           font-semibold rounded-lg transition-colors"
              >
                Aplicar
              </button>
              <button
                onClick={() => setShowDepthInput(false)}
                className="px-2 py-1 text-zinc-400 hover:text-white text-xs transition-colors"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* ── REQ §5 — Stress mode toggle ── */}
        <ToolButton
          label={stressMode ? 'Rebalanceo Global' : 'Modo Estrés'}
          icon={stressMode ? <ZapOff size={13} /> : <Zap size={13} />}
          onClick={stressMode ? handleRebalance : onToggleStress}
          loading={stressMode ? loadingRebal : isTogglingStress}
          variant={stressMode ? 'default' : 'warning'}
          title={stressMode
            ? 'Salir del modo estrés y rebalancear el árbol completo'
            : 'Activar modo estrés (sin balanceo automático)'}
        />

        {/* ── REQ §7 — Verify AVL (only in stress mode) ── */}
        {stressMode && (
          <ToolButton
            label="Verificar AVL"
            icon={<ShieldCheck size={13} />}
            onClick={handleVerify}
            loading={loadingVerify}
            variant="warning"
            title="Recorre el árbol y verifica que todos los factores de equilibrio y alturas sean correctos"
          />
        )}

        {/* ── REQ §8 — Delete min-profit ── */}
        <ToolButton
          label="Eliminar menor rentabilidad"
          icon={<TrendingDown size={13} />}
          onClick={handleMinProfit}
          loading={loadingMinProfit}
          variant="danger"
          title="Cancela el nodo (y su subárbol) de menor rentabilidad. En empate: más profundo; si persiste: código mayor."
        />
      </div>

      {/* ── Result banners ── */}

      {/* Rebalance result (REQ §5) */}
      {rebalanceResult && (
        <div className="px-4 pb-2">
          <div className="bg-green-900/40 border border-green-800 rounded-lg px-3 py-2
                          flex items-center gap-3 flex-wrap">
            <RotateCcw size={13} className="text-green-400 flex-shrink-0" />
            <span className="text-green-300 text-xs font-semibold">Rebalanceo completado</span>
            <span className="text-green-400 text-xs">
              {rebalanceResult.nodesFixed} nodos corregidos
            </span>
            {(Object.entries(rebalanceResult.rotaciones) as [string, number][])
              .filter(([, v]) => v > 0)
              .map(([type, count]) => (
                <span key={type} className="text-zinc-400 text-xs">
                  {type}: <span className="text-amber-400 font-semibold">{count}</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* AVL verify result (REQ §7) */}
      {avlVerifyResult && (
        <div className="px-4 pb-2">
          <div className={`
            border rounded-lg px-3 py-2 flex items-start gap-3
            ${avlVerifyResult.valid
              ? 'bg-green-900/40 border-green-800'
              : 'bg-red-900/40 border-red-800'}
          `}>
            <ShieldCheck size={13} className={`flex-shrink-0 mt-0.5
              ${avlVerifyResult.valid ? 'text-green-400' : 'text-red-400'}`}
            />
            <div>
              <p className={`text-xs font-semibold
                ${avlVerifyResult.valid ? 'text-green-300' : 'text-red-300'}`}>
                {avlVerifyResult.valid ? 'Árbol válido AVL ✓' : `${avlVerifyResult.issues.length} inconsistencias encontradas`}
              </p>
              {!avlVerifyResult.valid && (
                <p className="text-red-400 text-[10px] mt-0.5">
                  Abre la consola o el panel de árbol para ver los nodos afectados.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Min-profit deletion result (REQ §8) */}
      {minProfitResult && (
        <div className="px-4 pb-2">
          <div className="bg-red-900/40 border border-red-800 rounded-lg px-3 py-2
                          flex items-center gap-3 flex-wrap">
            <TrendingDown size={13} className="text-red-400 flex-shrink-0" />
            <span className="text-red-300 text-xs font-semibold">
              Cancelado: {minProfitResult.deleted.codigo}
            </span>
            <span className="text-zinc-400 text-xs">
              + {minProfitResult.subtree.length} nodo(s) descendientes eliminados
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StressModeBar;