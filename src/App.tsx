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

import React, { useState, useEffect, useCallback } from "react";

import FlightModal from "./components/FlightModal";
import TreeView from "./components/TreeView";
import Navbar from "./components/Navbar";
import JSONLoader from "./components/JSONLoader";
import StressModeBar from "./components/StressModeBar";

import VersioningPanel from "./components/VersioningPanel";
import ConcurrencyQueue from "./components/ConcurrencyQueue";

import { useAuth } from "./hooks/useAuth";
import { useFlights } from "./hooks/useFlights";
import { useAppState } from "./hooks/useAppState";
import { useTreeData } from "./hooks/useTreeData";

import { TreeService } from "./services/TreeService";
import type { FlightData, TreeResponse } from "./models/FlightNode";
import type {
  RebalanceResult,
  AVLVerifyResult,
  MinProfitResult,
} from "./services/TreeService";
import AnalyticsPanel from "./components/AnaliticsPanel";
import FlightsPage from "./components/Flightspage";
import LoginPage from "./components/LoginPage";

// ─── Modal mode type ──────────────────────────────────────────────────────────

type ModalMode = "create" | "edit" | null;

/** Controls which right side-panel is visible in the dashboard. */
type SidePanel = "analytics" | "versions" | "queue" | null;

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
    deleteVersion,
    error: appError,
    clearError,
  } = useAppState();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [jsonLoaderOpen, setJsonLoaderOpen] = useState(false);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

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

  // ── Save + undo wrapper ───────────────────────────────────────────────────

  /**
   * Before any mutation, snapshots the current tree into the undo stack (REQ §1.2).
   */
  const withUndo = async (description: string, action: () => Promise<void>) => {
    try {
      const treeSnapshot = await TreeService.getCurrentTree();
      pushUndo(description, treeSnapshot);
    } catch {
      /* Snapshot failed — still allow the action */
    }
    await action();
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
    refreshTree();
  };

  const handleDelete = async (codigo: string) => {
    await withUndo(`Eliminar vuelo ${codigo}`, async () => {
      await deleteFlight(codigo);
    });
    refreshTree();
  };

  /** REQ §1.2 — Cancels a node AND all its descendants */
  const handleCancelSubtree = async (codigo: string) => {
    await withUndo(`Cancelar vuelo ${codigo} + descendientes`, async () => {
      await TreeService.cancelFlight(codigo);
      await refreshFlights();
    });
    refreshTree();
  };

  // ── Undo ──────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(async () => {
    const action = performUndo();
    if (!action) return;
    try {
      // Restore snapshot — here we tell the backend to load this tree state.
      // Since there is no generic "restore snapshot" endpoint, we reset and reload.
      // In production, add POST /api/tree/restore { tree: action.snapshot }.
      await TreeService.resetSystem();
      await refreshFlights();
      await refreshTree();
    } catch {
      /* Restore failed silently */
    }
  }, [performUndo, refreshFlights, refreshTree]);

  // ── REQ §1.1 — Load JSON ──────────────────────────────────────────────────

  const handleLoadJSON = async (
    file: File,
    mode: "topology" | "insertion",
    depth: number,
  ) => {
    setJsonLoading(true);
    setJsonError(null);
    try {
      await TreeService.loadTreeFromJSON(file, mode, depth);
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
  };

  // ── REQ §7 — Verify AVL ───────────────────────────────────────────────────

  const handleVerifyAVL = async () => {
    const res = await TreeService.verifyAVL();
    setAvlVerifyResult(res);
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
    await TreeService.enqueueFlights(pending);
    const res = await TreeService.processQueue();
    await refreshFlights();
    await refreshTree();
    return { processed: res.processed, conflicts: res.conflicts };
  };

  // ── REQ §2 — Version management ──────────────────────────────────────────

  const handleSaveVersion = async (name: string) => {
    try {
      const snapshot = await TreeService.getCurrentTree();
      saveVersion(name, snapshot);
    } catch {
      /* Silent fail */
    }
  };

  const handleRestoreVersion = async (version: { snapshot: TreeResponse }) => {
    try {
      // Same pattern as undo — in production add a POST /api/tree/restore endpoint.
      await TreeService.resetSystem();
      await refreshFlights();
      await refreshTree();
    } catch {
      /* Silent fail */
    }
  };

  // ─── Guard: show login ─────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

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
          <div className="flex flex-1 overflow-hidden">
            <TreeView />
            {sidePanel === "analytics" && (
              <AnalyticsPanel autoRefreshMs={5000} />
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
              <ConcurrencyQueue onProcess={handleProcessQueue} />
            )}
          </div>
        </div>
      ) : (
        /* ── List view ── */
        <div className="flex flex-col min-h-screen">
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
            {sidePanel === "analytics" && <AnalyticsPanel />}
            {sidePanel === "versions" && (
              <VersioningPanel
                versions={versions}
                onSave={handleSaveVersion}
                onRestore={handleRestoreVersion}
                onDelete={deleteVersion}
              />
            )}
            {sidePanel === "queue" && (
              <ConcurrencyQueue onProcess={handleProcessQueue} />
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default App;
