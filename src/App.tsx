/**
 * @file App.tsx
 * @description Root orchestrator for SkyBalance Airlines.
 *
 * Wires together ALL project requirements:
 *  REQ §1.1 — JSON file loader (JSONLoader modal)
 *  REQ §1.2 — Undo stack (Ctrl+Z via StressModeBar)
 *  REQ §1.3 — Export tree to JSON (StressModeBar)
 *  REQ §2   — Named version management (VersioningPanel)
 *  REQ §3   — Concurrency queue (ConcurrencyQueue)
 *  REQ §4   — Real-time analytics (AnalyticsPanel)
 *  REQ §5   — Stress mode + global rebalance (StressModeBar)
 *  REQ §6   — Critical depth threshold (StressModeBar + JSONLoader)
 *  REQ §7   — AVL verification (StressModeBar, only in stress mode)
 *  REQ §8   — Delete min-profit node (StressModeBar)
 *  View toggle: Lista ↔ Árbol AVL (Navbar)
 *
 * SOLID principles applied:
 *  - (S) App only orchestrates; all domain logic lives in hooks/components.
 *  - (D) Hooks (useFlights, useAppState, useTreeData) are the only dependencies.
 */

import React, { useCallback, useEffect, useState } from "react";
import AVLvsBSTModal from "./components/AVLvsBSTModal.tsx";

import FlightModal from "./components/FlightModal";
import JSONLoader from "./components/JSONLoader";
import Navbar from "./components/Navbar";
import StressModeBar from "./components/StressModeBar";
import TreeView from "./components/TreeView";

import ConcurrencyQueue from "./components/ConcurrencyQueue";
import VersioningPanel from "./components/VersioningPanel";

import { useAppState } from "./hooks/useAppState";
import { useAuth } from "./hooks/useAuth";
import { useFlights } from "./hooks/useFlights";
import { useTreeData } from "./hooks/useTreeData";

import AnalyticsPanel from "./components/AnaliticsPanel";
import FlightsPage from "./components/Flightspage";
import LoginPage from "./components/LoginPage";
import type { FlightData, TreeNode } from "./models/FlightNode";
import type {
  AVLVerifyResult,
  ComparativeTreeStats,
  MinProfitResult,
  ParallelSimulationEventsPage,
  ParallelSimulationStartResult,
  ParallelSimulationStatus,
  RebalanceResult,
} from "./services/TreeService";
import { TreeService } from "./services/TreeService";

// ─── Modal mode type ──────────────────────────────────────────────────────────

type ModalMode = "create" | "edit" | null;

/** Controls which right side-panel is visible in the dashboard. */
type SidePanel = "analytics" | "versions" | "queue" | null;

interface ComparativeSnapshot {
  avlTree: TreeNode | null;
  bstTree: TreeNode | null;
  avlStats?: ComparativeTreeStats;
  bstStats?: ComparativeTreeStats | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { isAuthenticated, login, logout } = useAuth();

  // ── Flight list ───────────────────────────────────────────────────────────
  const {
    flights,
    isLoading,
    error,
    hasMore,
    editTarget,
    loadMore,
    addFlight,
    updateFlight,
    deleteFlight,
    openEditModal,
    closeEditModal,
    newDraft,
    refresh: refreshFlights,
  } = useFlights();

  // ── AVL tree data (for tree view) ─────────────────────────────────────────
  const { refresh: refreshTree } = useTreeData();

  // ── Global app state ──────────────────────────────────────────────────────
  const {
    stressMode,
    isTogglingStress,
    toggleStressMode,
    criticalDepth,
    setCriticalDepth,
    pushUndo,
    lastUndo,
    performUndo,
    undoStack,
    versions,
    saveVersion,
    restoreVersion,
    deleteVersion,
  } = useAppState();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [jsonLoaderOpen, setJsonLoaderOpen] = useState(false);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [lastLoadMode, setLastLoadMode] = useState<
    "topology" | "insertion" | null
  >(null);
  const [comparativeOpen, setComparativeOpen] = useState(false);
  const [comparativeSnapshot, setComparativeSnapshot] =
    useState<ComparativeSnapshot | null>(null);
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);

  // ── Advanced action results (for StressModeBar banners) ───────────────────
  const [rebalanceResult, setRebalanceResult] =
    useState<RebalanceResult | null>(null);
  const [avlVerifyResult, setAvlVerifyResult] =
    useState<AVLVerifyResult | null>(null);
  const [minProfitResult, setMinProfitResult] =
    useState<MinProfitResult | null>(null);

  // ── Keyboard shortcut: Ctrl+Z ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const isModalOpen = modalMode !== null;
  const modalInitialFlight: FlightData | undefined =
    modalMode === "edit" && editTarget ? editTarget : undefined;

  const handleOpenCreate = () => {
    newDraft();
    setModalMode("create");
  };
  const handleOpenEdit = (f: FlightData) => {
    openEditModal(f);
    setModalMode("edit");
  };
  const handleCloseModal = () => {
    setModalMode(null);
    closeEditModal();
  };

  const refreshComparativeSnapshot = useCallback(
    async (force = false) => {
      if (!force && lastLoadMode !== "insertion") return;

      try {
        const snapshot = await TreeService.getCurrentComparativeSnapshot();

        if (snapshot.mode === "insertion" && snapshot.bst) {
          setLastLoadMode("insertion");
          setComparativeSnapshot({
            avlTree: snapshot.avl.tree,
            bstTree: snapshot.bst,
            avlStats: snapshot.avlStats,
            bstStats: snapshot.bstStats,
          });
          return;
        }

        setLastLoadMode("topology");
        setComparativeSnapshot(null);
        setComparativeOpen(false);
      } catch {
        // Keep previous comparative state if backend snapshot fetch fails.
      }
    },
    [lastLoadMode],
  );

  useEffect(() => {
    refreshComparativeSnapshot(true).catch(() => {
      // Ignore startup comparative fetch failures.
    });
  }, [refreshComparativeSnapshot]);

  // ── Save + undo wrapper ───────────────────────────────────────────────────

  /** Registers an undoable action label after a successful mutation. */
  const withUndo = async (description: string, action: () => Promise<void>) => {
    await action();
    pushUndo(description);
  };

  const handleSave = async (flight: FlightData) => {
    const desc =
      modalMode === "create"
        ? `Crear vuelo ${flight.codigo}`
        : `Editar vuelo ${flight.codigo}`;
    await withUndo(desc, async () => {
      if (modalMode === "create") await addFlight(flight);
      else await updateFlight(flight);
    });
    handleCloseModal();
    await refreshTree();
    await refreshComparativeSnapshot();
  };

  const handleDelete = async (codigo: string) => {
    await withUndo(`Eliminar vuelo ${codigo}`, async () => {
      await deleteFlight(codigo);
    });
    await refreshTree();
    await refreshComparativeSnapshot();
  };

  /** REQ §1.2 — Cancels a node AND all its descendants */
  const handleCancelSubtree = async (codigo: string) => {
    await withUndo(`Cancelar vuelo ${codigo} + descendientes`, async () => {
      await TreeService.cancelFlight(codigo);
      await refreshFlights();
    });
    await refreshTree();
    await refreshComparativeSnapshot();
  };

  // ── Undo ──────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    if (!lastUndo) return;
    try {
      await TreeService.undo();
      performUndo();
      await refreshFlights();
      await refreshTree();
      setAnalyticsRefreshKey((v) => v + 1);

      if (lastLoadMode === "insertion") {
        await refreshComparativeSnapshot();
      }
    } catch {
      /* Restore failed silently */
    }
  }, [
    lastLoadMode,
    lastUndo,
    performUndo,
    refreshComparativeSnapshot,
    refreshFlights,
    refreshTree,
  ]);

  // ── REQ §1.1 — Load JSON ──────────────────────────────────────────────────

  const handleLoadJSON = async (
    file: File,
    mode: "topology" | "insertion",
    depth: number,
  ) => {
    setJsonLoading(true);
    setJsonError(null);
    try {
      const loaded = await TreeService.loadTreeFromJSON(file, mode, depth);

      if (loaded.mode === "insertion" && loaded.bst) {
        setLastLoadMode("insertion");
        setComparativeSnapshot({
          avlTree: loaded.avl.tree,
          bstTree: loaded.bst,
          avlStats: loaded.avlStats,
          bstStats: loaded.bstStats,
        });
        setComparativeOpen(true);
      } else {
        setLastLoadMode("topology");
        setComparativeSnapshot(null);
        setComparativeOpen(false);
      }

      await setCriticalDepth(depth);
      await refreshFlights();
      await refreshTree();
      setJsonLoaderOpen(false);
    } catch (err) {
      setJsonError(
        err instanceof Error ? err.message : "Error al cargar el archivo.",
      );
    } finally {
      setJsonLoading(false);
    }
  };

  // ── REQ §1.3 — Export JSON ────────────────────────────────────────────────

  const handleExportJSON = async () => {
    try {
      const json = await TreeService.exportTreeJSON();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skybalance-avl-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* Silent fail */
    }
  };

  // ── REQ §5 — Stress mode + rebalance ─────────────────────────────────────

  const handleRebalance = async () => {
    const res = await TreeService.triggerRebalance();
    setRebalanceResult(res);
    await toggleStressMode(); // exits stress mode
    await refreshFlights();
    await refreshTree();
    await refreshComparativeSnapshot();
  };

  // ── REQ §7 — Verify AVL ───────────────────────────────────────────────────

  const handleVerifyAVL = async () => {
    try {
      const res = await TreeService.verifyAVL();
      setAvlVerifyResult(res);
    } catch {
      setAvlVerifyResult({ valid: false, issues: [] });
    }
  };

  // ── REQ §8 — Min-profit delete ────────────────────────────────────────────

  const handleDeleteMinProfit = async () => {
    await withUndo("Eliminar nodo de menor rentabilidad", async () => {
      const res = await TreeService.deleteMinProfit();
      setMinProfitResult(res);
      await refreshFlights();
    });
    await refreshTree();
  };

  // ── REQ §3 — Process concurrency queue ───────────────────────────────────

  const handleProcessQueue = async (
    pending: Parameters<typeof TreeService.enqueueFlights>[0],
  ) => {
    let processed = 0;
    let conflicts: string[] = [];
    await withUndo(`Procesar cola (${pending.length} vuelo(s))`, async () => {
      await TreeService.enqueueFlights(pending);
      const res = await TreeService.processQueue();
      processed = res.processed;
      conflicts = res.conflicts;
    });
    await refreshFlights();
    await refreshTree();
    await refreshComparativeSnapshot();
    return { processed, conflicts };
  };

  const handleStartParallelSimulation = async (options: {
    workers: number;
    maxItems?: number;
    delayMs?: number;
  }): Promise<ParallelSimulationStartResult> => {
    const res = await TreeService.startParallelSimulation(options);
    return res;
  };

  const handleEnqueueFlights = async (
    pending: Parameters<typeof TreeService.enqueueFlights>[0],
  ) => {
    await TreeService.enqueueFlights(pending);
  };

  const handleGetParallelStatus = async (
    jobId: string,
  ): Promise<ParallelSimulationStatus> => {
    return TreeService.getParallelSimulationStatus(jobId);
  };

  const handleGetParallelEvents = async (
    jobId: string,
    offset: number,
    limit = 100,
  ): Promise<ParallelSimulationEventsPage> => {
    return TreeService.getParallelSimulationEvents(jobId, offset, limit);
  };

  const handleStopParallelSimulation = async (jobId: string) => {
    await TreeService.stopParallelSimulation(jobId);
  };

  const handleParallelMutation = async () => {
    await refreshFlights();
    await refreshTree();
    await refreshComparativeSnapshot();
  };

  // ── REQ §2 — Version management ──────────────────────────────────────────

  const handleSaveVersion = async (name: string) => {
    try {
      await saveVersion(name);
    } catch {
      /* Silent fail */
    }
  };

  const handleRestoreVersion = async (version: { id: string }) => {
    try {
      await restoreVersion(version.id);
      await refreshFlights();
      await refreshTree();
      await refreshComparativeSnapshot(true);
    } catch {
      /* Silent fail */
    }
  };

  // ─── Guard: show login ─────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  const canReopenComparative =
    lastLoadMode === "insertion" && Boolean(comparativeSnapshot?.bstTree);

  const sharedNavbar = (
    <Navbar
      onSearch={() => {}}
      onMenuToggle={logout}
      viewMode={viewMode}
      onViewChange={setViewMode}
      onOpenLoader={() => setJsonLoaderOpen(true)}
      sidePanel={sidePanel}
      onSidePanelChange={setSidePanel}
    />
  );

  return (
    <>
      {/* ── Modals ── */}
      <JSONLoader
        isOpen={jsonLoaderOpen}
        criticalDepth={criticalDepth}
        isLoading={jsonLoading}
        error={jsonError}
        onLoad={handleLoadJSON}
        onClose={() => setJsonLoaderOpen(false)}
      />

      <FlightModal
        isOpen={isModalOpen}
        initialFlight={modalInitialFlight}
        onSave={handleSave}
        onClose={handleCloseModal}
      />

      <AVLvsBSTModal
        isOpen={comparativeOpen && Boolean(comparativeSnapshot)}
        avlTree={comparativeSnapshot?.avlTree ?? null}
        bstTree={comparativeSnapshot?.bstTree ?? null}
        avlStats={comparativeSnapshot?.avlStats}
        bstStats={comparativeSnapshot?.bstStats ?? null}
        onClose={() => setComparativeOpen(false)}
      />

      {/* ── Tree view ── */}
      {viewMode === "tree" ? (
        <div className="flex flex-col h-screen bg-zinc-950">
          {sharedNavbar}
          <StressModeBar
            stressMode={stressMode}
            criticalDepth={criticalDepth}
            lastUndoLabel={lastUndo?.description ?? null}
            isTogglingStress={isTogglingStress}
            onToggleStress={toggleStressMode}
            onRebalance={handleRebalance}
            onVerifyAVL={handleVerifyAVL}
            onUndo={handleUndo}
            onExportJSON={handleExportJSON}
            onDeleteMinProfit={handleDeleteMinProfit}
            onCriticalDepthChange={setCriticalDepth}
            onCancelSubtree={handleCancelSubtree}
            rebalanceResult={rebalanceResult}
            avlVerifyResult={avlVerifyResult}
            minProfitResult={minProfitResult}
          />
          {canReopenComparative && (
            <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900">
              <button
                onClick={() => setComparativeOpen(true)}
                className="text-xs font-semibold text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-700"
              >
                Ver comparativo AVL vs BST
              </button>
            </div>
          )}
          <div className="flex flex-1 overflow-hidden">
            <TreeView />
            {sidePanel === "analytics" && (
              <AnalyticsPanel
                key={`analytics-tree-${analyticsRefreshKey}`}
                autoRefreshMs={5000}
              />
            )}
            {sidePanel === "versions" && (
              <VersioningPanel
                versions={versions}
                onSave={handleSaveVersion}
                onRestore={handleRestoreVersion}
                onDelete={deleteVersion}
              />
            )}
            {sidePanel === "queue" && (
              <ConcurrencyQueue
                onProcess={handleProcessQueue}
                onEnqueue={handleEnqueueFlights}
                onStartParallel={handleStartParallelSimulation}
                onGetParallelStatus={handleGetParallelStatus}
                onGetParallelEvents={handleGetParallelEvents}
                onStopParallel={handleStopParallelSimulation}
                onParallelMutation={handleParallelMutation}
              />
            )}
          </div>
        </div>
      ) : (
        /* ── List view ── */
        <div className="flex flex-col min-h-screen">
          {canReopenComparative && (
            <div className="px-4 pt-3">
              <button
                onClick={() => setComparativeOpen(true)}
                className="text-xs font-semibold text-zinc-100 bg-black border border-zinc-700 rounded-lg px-3 py-1.5 hover:bg-zinc-800"
              >
                Ver comparativo AVL vs BST
              </button>
            </div>
          )}
          <FlightsPage
            flights={flights}
            isLoading={isLoading}
            error={error}
            hasMore={hasMore}
            onCreateFlight={handleOpenCreate}
            onLoadMore={loadMore}
            onMenuToggle={logout}
            viewMode={viewMode}
            onViewChange={setViewMode}
            onOpenLoader={() => setJsonLoaderOpen(true)}
            sidePanel={sidePanel}
            onSidePanelChange={setSidePanel}
            actions={{
              onEdit: handleOpenEdit,
              onDelete: handleDelete,
              onCancel: handleCancelSubtree,
              onMoreInfo: (f) =>
                alert(`${f.codigo}: ${f.origen} → ${f.destino}`),
            }}
          />
          {/* Side panels also available in list view */}
          <div className="fixed right-0 top-[57px] bottom-0 flex z-30">
            {sidePanel === "analytics" && (
              <AnalyticsPanel key={`analytics-list-${analyticsRefreshKey}`} />
            )}
            {sidePanel === "versions" && (
              <VersioningPanel
                versions={versions}
                onSave={handleSaveVersion}
                onRestore={handleRestoreVersion}
                onDelete={deleteVersion}
              />
            )}
            {sidePanel === "queue" && (
              <ConcurrencyQueue
                onProcess={handleProcessQueue}
                onEnqueue={handleEnqueueFlights}
                onStartParallel={handleStartParallelSimulation}
                onGetParallelStatus={handleGetParallelStatus}
                onGetParallelEvents={handleGetParallelEvents}
                onStopParallel={handleStopParallelSimulation}
                onParallelMutation={handleParallelMutation}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default App;
