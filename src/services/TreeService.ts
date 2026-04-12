/**
 * @file TreeService.ts
 * @description Complete HTTP client layer for SkyBalance Airlines.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Only HTTP communication. No state, no UI.
 *  - (O) Open/Closed: New endpoints are appended without touching existing ones.
 *  - (I) Interface Segregation: Each response interface is scoped to its endpoint.
 *  - (D) Dependency Inversion: Hooks/components depend on this service's interfaces.
 *
 * Routes are mapped to the real Flask backend (skybalance_backend).
 */

import axios from "axios";
import type {
  FlightData,
  TreeNode,
  TreeProperties,
  TreeResponse,
} from "../models/FlightNode";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ─── Backend → Frontend normalisation helpers ─────────────────────────────────

type RawNode = Record<string, unknown> | null;

/**
 * Converts a flat backend node (all flight fields + izquierdo/derecho at root level)
 * into the frontend TreeNode shape { flight: FlightData, izquierdo, derecho }.
 */
function rawToTreeNode(raw: RawNode): TreeNode | null {
  if (!raw) return null;
  const { izquierdo, derecho, ...flightFields } = raw;
  return {
    flight: flightFields as unknown as FlightData,
    izquierdo: rawToTreeNode((izquierdo as RawNode) ?? null),
    derecho: rawToTreeNode((derecho as RawNode) ?? null),
  };
}

type RotacionesBackend = { LL?: number; RR?: number; LR?: number; RL?: number };
type RotacionesFrontend = { II: number; DD: number; ID: number; DI: number };

/** Maps backend rotation keys (LL/RR/LR/RL) to frontend keys (II/DD/ID/DI). */
function toRotaciones(
  r: RotacionesBackend | RotacionesFrontend | undefined,
): RotacionesFrontend {
  if (!r) return { II: 0, DD: 0, ID: 0, DI: 0 };
  const b = r as RotacionesBackend & RotacionesFrontend;
  return {
    II: b.II ?? b.LL ?? 0,
    DD: b.DD ?? b.RR ?? 0,
    ID: b.ID ?? b.LR ?? 0,
    DI: b.DI ?? b.RL ?? 0,
  };
}

/**
 * Converts backend avl summary to frontend TreeProperties.
 * Backend uses: profundidad / totalNodos / rotaciones (or height/totalNodes/rotations).
 */
function rawToTreeProperties(p: Record<string, unknown>): TreeProperties {
  return {
    raiz: (p.raiz as string | null) ?? null,
    altura: ((p.profundidad ?? p.height) as number) ?? 0,
    nodos: ((p.totalNodos ?? p.totalNodes) as number) ?? 0,
    rotaciones: toRotaciones(
      (p.rotaciones ?? p.rotations) as RotacionesBackend | undefined,
    ),
  };
}

/** Builds a TreeResponse from a raw backend mutation response { tree, properties }. */
function rawToTreeResponse(data: Record<string, unknown>): TreeResponse {
  return {
    tree: rawToTreeNode((data.tree as RawNode) ?? null),
    properties: rawToTreeProperties(
      (data.properties as Record<string, unknown>) ?? {},
    ),
  };
}

function rawToComparativeStats(raw: unknown): ComparativeTreeStats | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const rot = (data.rotaciones ?? null) as Record<string, unknown> | null;
  return {
    raiz: (data.raiz as string | null) ?? null,
    profundidad: (data.profundidad as number) ?? 0,
    cantidadHojas: (data.cantidadHojas as number) ?? 0,
    totalNodos: (data.totalNodos as number) ?? 0,
    rotaciones: rot
      ? {
          LL: (rot.LL as number) ?? 0,
          RR: (rot.RR as number) ?? 0,
          LR: (rot.LR as number) ?? 0,
          RL: (rot.RL as number) ?? 0,
        }
      : null,
  };
}

// ─── Response shape interfaces ────────────────────────────────────────────────

interface FlightListResponse {
  flights: FlightData[];
  total: number;
}
interface FlightSingleResponse {
  flight: FlightData;
  [key: string]: unknown;
}
interface VersionListResponse {
  versions: string[];
}

/** REQ §1.1 — result of loading a JSON file */
export interface ComparativeTreeStats {
  raiz: string | null;
  profundidad: number;
  cantidadHojas: number;
  totalNodos: number;
  rotaciones?: {
    LL: number;
    RR: number;
    LR: number;
    RL: number;
  } | null;
}

export interface LoadTreeResponse {
  mode: "topology" | "insertion";
  avl: TreeResponse;
  bst?: TreeNode | null; // only present in insertion mode
  avlStats?: ComparativeTreeStats;
  bstStats?: ComparativeTreeStats | null;
}

/** REQ §4 — real-time analytics */
export interface TreeMetrics {
  altura: number;
  nodos: number;
  hojas: number;
  cancelaciones: number;
  rotaciones: { II: number; DD: number; ID: number; DI: number };
  recorridoBFS: string[];
  recorridoDFS: string[];
}

/** REQ §5 — stress mode toggle response */
export interface StressModeResponse {
  stressMode: boolean;
  message: string;
}

/** REQ §5 — rebalance after stress */
export interface RebalanceResult {
  rotaciones: { II: number; DD: number; ID: number; DI: number };
  nodesFixed: number;
  tree: TreeResponse;
}

/** REQ §7 — AVL property verification */
export interface AVLVerifyResult {
  valid: boolean;
  issues: {
    code: string;
    balanceFactor: number;
    height: number;
    missingStoredHeight?: boolean;
    missingStoredBalanceFactor?: boolean;
    storedHeight?: number;
    storedBalanceFactor?: number;
  }[];
}

interface RawAVLVerifyResponse {
  valid?: boolean;
  inconsistentNodes?: AVLVerifyResult["issues"];
  issues?: AVLVerifyResult["issues"];
}

/** REQ §3 — queue process result */
export interface QueueProcessResult {
  processed: number;
  conflicts: string[];
  tree: TreeResponse;
}

/** REQ §3 — parallel queue simulation event */
export interface ParallelSimulationEvent {
  timestamp: string;
  workerId: number;
  codigo: string | null;
  result: "inserted" | "error";
  message: string | null;
  conflict?: {
    hasConflict: boolean;
    types: string[];
    rotationDelta: { LL: number; RR: number; LR: number; RL: number };
    criticalDepth: boolean;
    rotationTriggered: boolean;
  } | null;
}

/** REQ §3 — simulation status snapshot */
export interface ParallelSimulationStatus {
  jobId: string;
  status: "running" | "completed" | "stopped";
  workers: number;
  delayMs: number;
  maxItems: number | null;
  queueSizeAtStart: number;
  total: number;
  claimed: number;
  processed: number;
  inserted: number;
  failed: number;
  warnings: number;
  stopRequested: boolean;
  startedAt: string;
  endedAt: string | null;
  progressPercent: number;
  lastEvents: ParallelSimulationEvent[];
}

/** REQ §3 — simulation events page */
export interface ParallelSimulationEventsPage {
  jobId: string;
  status: ParallelSimulationStatus["status"];
  offset: number;
  limit: number;
  totalEvents: number;
  events: ParallelSimulationEvent[];
}

/** REQ §3 — start simulation response */
export interface ParallelSimulationStartResult {
  jobId: string;
  status: "running";
  workers: number;
  total: number;
  queueSizeAtStart: number;
  startedAt: string;
}

/** REQ §8 — min-profit deletion */
export interface MinProfitResult {
  deleted: FlightData;
  subtree: string[];
  tree: TreeResponse;
}

/** Fields the user edits — backend computes the rest */
export type FlightPayload = Omit<
  FlightData,
  "altura" | "factorEquilibrio" | "profundidad" | "nodoCritico" | "rentabilidad"
>;

// ─── Service ──────────────────────────────────────────────────────────────────

export const TreeService = {
  // ── FLIGHT CRUD ────────────────────────────────────────────────────────────

  async listFlights(): Promise<FlightData[]> {
    const res = await http.get<FlightListResponse>("/flights");
    return res.data.flights;
  },

  async createFlight(payload: FlightPayload): Promise<FlightData> {
    const res = await http.post<FlightSingleResponse>("/flights", payload);
    return res.data.flight;
  },

  async updateFlight(
    code: string,
    changes: Partial<FlightPayload>,
  ): Promise<FlightData> {
    const res = await http.put<FlightSingleResponse>(
      `/flights/${code}`,
      changes,
    );
    return res.data.flight;
  },

  /** REQ §1.2 — removes ONE node only, no descendants */
  async deleteFlight(code: string): Promise<void> {
    await http.delete(`/flights/${code}`);
  },

  /** REQ §1.2 — removes node AND all its descendants (subtree cancellation) */
  async cancelFlight(code: string): Promise<void> {
    await http.delete(`/trees/cancel/${code}`);
  },

  // ── TREE ───────────────────────────────────────────────────────────────────

  async getCurrentTree(): Promise<TreeResponse> {
    const [exportRes, metricsRes] = await Promise.all([
      http.get<{ tree: RawNode }>("/export"),
      http.get<Record<string, unknown>>("/metrics"),
    ]);
    const m = metricsRes.data;
    const bfs = (m.bfs as Record<string, unknown>[]) ?? [];
    return {
      tree: rawToTreeNode(exportRes.data.tree),
      properties: rawToTreeProperties({
        raiz: bfs.length ? bfs[0].codigo : null,
        profundidad: m.height,
        totalNodos: m.totalNodes,
        rotaciones: m.rotations,
      }),
    };
  },

  /**
   * REQ §1.1 — Loads a user-selected JSON file and rebuilds the tree.
   * mode='topology' → respects parent/child layout from JSON.
   * mode='insertion' → inserts one by one with AVL auto-balance; also builds BST.
   */
  async loadTreeFromJSON(
    file: File,
    _mode: "topology" | "insertion",
    criticalDepth: number,
  ): Promise<LoadTreeResponse> {
    const form = new FormData();
    form.append("file", file);
    const res = await http.post<Record<string, unknown>>(
      `/upload?critical_depth=${criticalDepth}`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    const d = res.data;
    const backendMode = String(d.mode ?? "").toUpperCase();
    return {
      mode: backendMode === "TOPOLOGIA" ? "topology" : "insertion",
      avl: {
        tree: rawToTreeNode((d.avlTree as RawNode) ?? null),
        properties: rawToTreeProperties(
          (d.avl as Record<string, unknown>) ?? {},
        ),
      },
      bst: rawToTreeNode((d.bstTree as RawNode) ?? null),
      avlStats: rawToComparativeStats(d.avl) ?? undefined,
      bstStats: rawToComparativeStats(d.bst),
    };
  },

  /** REQ §1.3 — exports the full hierarchical tree as a JSON string */
  async exportTreeJSON(): Promise<string> {
    const res = await http.get<{ tree: unknown }>("/export");
    return JSON.stringify(res.data.tree, null, 2);
  },

  /** REQ §1.1 — BST is built server-side during insertion-mode load; no standalone endpoint. */
  async getBST(): Promise<TreeNode | null> {
    return null;
  },

  async resetSystem(): Promise<void> {
    try {
      await http.post("/undo");
    } catch {
      /* no-op if nothing to undo */
    }
  },

  // ── STRESS MODE (REQ §5) ────────────────────────────────────────────────────

  async setStressMode(enabled: boolean): Promise<StressModeResponse> {
    const res = await http.post<{ stressMode: boolean }>("/trees/stress", {
      enable: enabled,
    });
    return {
      stressMode: res.data.stressMode,
      message: enabled ? "Modo estrés activado." : "Modo estrés desactivado.",
    };
  },

  async triggerRebalance(): Promise<RebalanceResult> {
    const res = await http.post<Record<string, unknown>>("/trees/rebalance");
    const d = res.data;
    return {
      rotaciones: (d.rotationsApplied as RebalanceResult["rotaciones"]) ?? {
        II: 0,
        DD: 0,
        ID: 0,
        DI: 0,
      },
      nodesFixed: (d.nodesFixed as number) ?? 0,
      tree: rawToTreeResponse(d),
    };
  },

  // ── AVL AUDIT (REQ §7) ──────────────────────────────────────────────────────

  async verifyAVL(): Promise<AVLVerifyResult> {
    const res = await http.get<RawAVLVerifyResponse>("/trees/audit");
    return {
      valid: Boolean(res.data.valid),
      issues: res.data.issues ?? res.data.inconsistentNodes ?? [],
    };
  },

  // ── METRICS (REQ §4) ────────────────────────────────────────────────────────

  async getMetrics(): Promise<TreeMetrics> {
    const res = await http.get<Record<string, unknown>>("/metrics");
    const d = res.data;
    const bfs = (d.bfs as Record<string, unknown>[]) ?? [];
    const dfs = (d.dfs as Record<string, unknown>[]) ?? [];
    return {
      altura: (d.height as number) ?? 0,
      nodos: (d.totalNodes as number) ?? 0,
      hojas: (d.leafCount as number) ?? 0,
      cancelaciones: (d.massCancellations as number) ?? 0,
      rotaciones: toRotaciones(d.rotations as RotacionesBackend | undefined),
      recorridoBFS: bfs.map((f) => f.codigo as string),
      recorridoDFS: dfs.map((f) => f.codigo as string),
    };
  },

  // ── CONCURRENCY QUEUE (REQ §3) ─────────────────────────────────────────────

  async enqueueFlights(flights: FlightPayload[]): Promise<void> {
    for (const f of flights) {
      await http.post("/queue", f);
    }
  },

  async processQueue(): Promise<QueueProcessResult> {
    const res = await http.post<Record<string, unknown>>("/queue/process-all");
    const d = res.data;
    return {
      processed: (d.insertedCodes as string[] | undefined)?.length ?? 1,
      conflicts: ((d.conflicts as { codigo: string }[] | undefined) ?? []).map(
        (c) => c.codigo,
      ),
      tree: rawToTreeResponse(d),
    };
  },

  async startParallelSimulation(options: {
    workers: number;
    maxItems?: number;
    delayMs?: number;
  }): Promise<ParallelSimulationStartResult> {
    const payload: { workers: number; maxItems?: number; delayMs?: number } = {
      workers: options.workers,
      delayMs: options.delayMs ?? 0,
    };
    if (typeof options.maxItems === "number" && options.maxItems > 0) {
      payload.maxItems = options.maxItems;
    }
    const res = await http.post<ParallelSimulationStartResult>(
      "/queue/simulations/start",
      payload,
    );
    return res.data;
  },

  async getParallelSimulationStatus(
    jobId: string,
  ): Promise<ParallelSimulationStatus> {
    const safeJobId = encodeURIComponent(jobId);
    const res = await http.get<ParallelSimulationStatus>(
      `/queue/simulations/${safeJobId}`,
    );
    return res.data;
  },

  async getParallelSimulationEvents(
    jobId: string,
    offset = 0,
    limit = 100,
  ): Promise<ParallelSimulationEventsPage> {
    const safeJobId = encodeURIComponent(jobId);
    const res = await http.get<ParallelSimulationEventsPage>(
      `/queue/simulations/${safeJobId}/events`,
      { params: { offset, limit } },
    );
    return res.data;
  },

  async stopParallelSimulation(jobId: string): Promise<void> {
    const safeJobId = encodeURIComponent(jobId);
    await http.post(`/queue/simulations/${safeJobId}/stop`);
  },

  // ── CRITICAL DEPTH (REQ §6) ────────────────────────────────────────────────

  async setCriticalDepth(depth: number): Promise<TreeResponse> {
    const res = await http.put<Record<string, unknown>>("/critical-depth", {
      depth,
    });
    return rawToTreeResponse(res.data);
  },

  // ── MIN-PROFIT DELETE (REQ §8) ─────────────────────────────────────────────

  async deleteMinProfit(): Promise<MinProfitResult> {
    const res = await http.delete<Record<string, unknown>>(
      "/eliminate-least-profitable",
    );
    const d = res.data;
    return {
      deleted: { codigo: (d.cancelledCode as string) ?? "" } as FlightData,
      subtree: (d.nodesRemoved as string[]) ?? [],
      tree: rawToTreeResponse(d),
    };
  },

  // ── NAMED VERSIONS (REQ §2) ──────────────────────────────────────────────

  async listVersions(): Promise<string[]> {
    const res = await http.get<VersionListResponse>("/versions");
    return res.data.versions;
  },

  async saveVersion(name: string): Promise<string[]> {
    const safeName = encodeURIComponent(name);
    const res = await http.post<VersionListResponse>(`/versions/${safeName}`);
    return res.data.versions;
  },

  async restoreVersion(name: string): Promise<TreeResponse> {
    const safeName = encodeURIComponent(name);
    const res = await http.put<Record<string, unknown>>(
      `/versions/${safeName}`,
    );
    return rawToTreeResponse(res.data);
  },

  async deleteVersion(name: string): Promise<string[]> {
    const safeName = encodeURIComponent(name);
    const res = await http.delete<VersionListResponse>(`/versions/${safeName}`);
    return res.data.versions;
  },
};
