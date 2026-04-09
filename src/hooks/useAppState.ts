/**
 * @file useAppState.ts
 * @description Central application state hook for SkyBalance Airlines.
 *
 * Manages all cross-cutting state that multiple components depend on:
 *  - Stress mode toggle          (REQ §5)
 *  - Critical depth threshold    (REQ §6)
 *  - Undo/redo stack             (REQ §1.2 — Ctrl+Z)
 *  - Named version snapshots     (REQ §2)
 *
 * SOLID principles applied:
 *  - (S) Each concern (undo, versions, stress) is in its own sub-object.
 *  - (O) New state slices are added by extending the return interface.
 *  - (D) TreeService is the only external dependency.
 */

import { useCallback, useEffect, useState } from 'react';
import type { TreeResponse } from '../models/FlightNode';
import { TreeService } from '../services/TreeService';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single undoable action recorded in the undo stack (REQ §1.2). */
export interface UndoAction {
  /** Human-readable description shown in the undo tooltip. */
  description: string;
  /** Snapshot of the full tree BEFORE this action was applied. */
  snapshot:    TreeResponse;
  timestamp:   Date;
}

/** A named version saved by the user (REQ §2). */
export interface TreeVersion {
  id:        string;       // backend version key (same as name)
  name:      string;       // e.g. "Simulación Alta Demanda"
  snapshot?: TreeResponse;
  savedAt:   Date;
}

// ─── Return Interface ─────────────────────────────────────────────────────────

export interface UseAppStateReturn {
  // ── Stress mode ──────────────────────────────────────────────────────────
  /** True when stress mode (no auto-rebalancing) is active. */
  stressMode:       boolean;
  isTogglingStress: boolean;
  toggleStressMode: () => Promise<void>;

  // ── Critical depth (REQ §6) ──────────────────────────────────────────────
  /** Depth at which nodes are flagged as critical and price is +25%. */
  criticalDepth:    number;
  isSettingDepth:   boolean;
  setCriticalDepth: (depth: number) => Promise<void>;

  // ── Undo stack (REQ §1.2) ────────────────────────────────────────────────
  /** Push a snapshot onto the undo stack BEFORE applying a mutation. */
  pushUndo:         (description: string, snapshot: TreeResponse) => void;
  /** The last undoable action, or null if the stack is empty. */
  lastUndo:         UndoAction | null;
  /** Pops the last action and restores its snapshot. */
  performUndo:      () => UndoAction | null;
  undoStack:        UndoAction[];

  // ── Named versions (REQ §2) ──────────────────────────────────────────────
  versions:         TreeVersion[];
  saveVersion:      (name: string) => Promise<void>;
  restoreVersion:   (id: string) => Promise<void>;
  deleteVersion:    (id: string) => Promise<void>;
  refreshVersions:  () => Promise<void>;

  // ── Error ─────────────────────────────────────────────────────────────────
  error: string | null;
  clearError: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAppState = (): UseAppStateReturn => {

  const [stressMode,        setStressMode]        = useState(false);
  const [isTogglingStress,  setIsTogglingStress]  = useState(false);
  const [criticalDepth,     setCriticalDepthState] = useState(3);
  const [isSettingDepth,    setIsSettingDepth]    = useState(false);
  const [undoStack,         setUndoStack]         = useState<UndoAction[]>([]);
  const [versions,          setVersions]          = useState<TreeVersion[]>([]);
  const [error,             setError]             = useState<string | null>(null);

  const refreshVersions = useCallback(async () => {
    const names = await TreeService.listVersions();
    setVersions(
      names.map((name) => ({
        id: name,
        name,
        savedAt: new Date(),
      })),
    );
  }, []);

  useEffect(() => {
    refreshVersions().catch(() => {
      setError('No se pudieron cargar las versiones guardadas.');
    });
  }, [refreshVersions]);

  // ── Stress mode ──────────────────────────────────────────────────────────

  /**
   * REQ §5 — Toggles stress mode on the backend.
   * When ON: operations run without auto-rebalancing.
   * When returning OFF: caller should trigger triggerRebalance().
   */
  const toggleStressMode = useCallback(async () => {
    setIsTogglingStress(true);
    setError(null);
    try {
      const res = await TreeService.setStressMode(!stressMode);
      setStressMode(res.stressMode);
    } catch {
      setError('No se pudo cambiar el modo estrés.');
    } finally {
      setIsTogglingStress(false);
    }
  }, [stressMode]);

  // ── Critical depth ────────────────────────────────────────────────────────

  /**
   * REQ §6 — Updates the critical depth threshold.
   * Immediately calls the backend so ALL nodes are recalculated.
   */
  const setCriticalDepth = useCallback(async (depth: number) => {
    setIsSettingDepth(true);
    setError(null);
    try {
      await TreeService.setCriticalDepth(depth);
      setCriticalDepthState(depth);
    } catch {
      setError('No se pudo actualizar la profundidad crítica.');
    } finally {
      setIsSettingDepth(false);
    }
  }, []);

  // ── Undo stack ───────────────────────────────────────────────────────────

  /**
   * REQ §1.2 — Records a snapshot before a mutation so it can be undone.
   * The stack is capped at 50 entries to prevent memory bloat.
   */
  const pushUndo = useCallback((description: string, snapshot: TreeResponse) => {
    setUndoStack(prev => [
      { description, snapshot, timestamp: new Date() },
      ...prev.slice(0, 49),
    ]);
  }, []);

  /**
   * Pops the top of the undo stack and returns the action.
   * The caller is responsible for restoring the snapshot to the backend.
   */
  const performUndo = useCallback((): UndoAction | null => {
    let popped: UndoAction | null = null;
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      [popped] = prev;
      return prev.slice(1);
    });
    return popped;
  }, []);

  const lastUndo = undoStack[0] ?? null;

  // ── Named versions ────────────────────────────────────────────────────────

  /** REQ §2 — Persists a named version in backend and refreshes the list. */
  const saveVersion = useCallback(async (name: string) => {
    setError(null);
    try {
      const versionName = name.trim() || `Versión ${new Date().toLocaleTimeString('es-CO')}`;
      await TreeService.saveVersion(versionName);
      await refreshVersions();
    } catch {
      setError('No se pudo guardar la versión.');
    }
  }, [refreshVersions]);

  /** REQ §2 — Restores a named backend version. */
  const restoreVersion = useCallback(async (id: string) => {
    setError(null);
    try {
      await TreeService.restoreVersion(id);
    } catch {
      setError('No se pudo restaurar la versión.');
    }
  }, []);

  const deleteVersion = useCallback(async (id: string) => {
    setError(null);
    try {
      await TreeService.deleteVersion(id);
      await refreshVersions();
    } catch {
      setError('No se pudo eliminar la versión.');
    }
  }, [refreshVersions]);

  const clearError = useCallback(() => setError(null), []);

  return {
    stressMode,
    isTogglingStress,
    toggleStressMode,
    criticalDepth,
    isSettingDepth,
    setCriticalDepth,
    pushUndo,
    lastUndo,
    performUndo,
    undoStack,
    versions,
    saveVersion,
    restoreVersion,
    deleteVersion,
    refreshVersions,
    error,
    clearError,
  };
};