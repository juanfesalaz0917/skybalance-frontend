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
 * All endpoints assumed in the Python backend (Flask Blueprint "tree" and "flights").
 */

import axios from 'axios';
import type { FlightData, TreeNode, TreeResponse } from '../models/FlightNode';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

const http = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ─── Response shape interfaces ────────────────────────────────────────────────

interface FlightListResponse   { flights: FlightData[]; total: number; }
interface FlightSingleResponse { flight: FlightData; [key: string]: unknown; }

/** REQ §1.1 — result of loading a JSON file */
export interface LoadTreeResponse {
  mode: 'topology' | 'insertion';
  avl:  TreeResponse;
  bst?: TreeNode | null; // only present in insertion mode
}

/** REQ §4 — real-time analytics */
export interface TreeMetrics {
  altura:        number;
  nodos:         number;
  hojas:         number;
  cancelaciones: number;
  rotaciones:    { II: number; DD: number; ID: number; DI: number };
  recorridoBFS:  string[];
  recorridoDFS:  string[];
}

/** REQ §5 — stress mode toggle response */
export interface StressModeResponse { stressMode: boolean; message: string; }

/** REQ §5 — rebalance after stress */
export interface RebalanceResult {
  rotaciones: { II: number; DD: number; ID: number; DI: number };
  nodesFixed: number;
  tree:       TreeResponse;
}

/** REQ §7 — AVL property verification */
export interface AVLVerifyResult {
  valid:  boolean;
  issues: {
    codigo:          string;
    factorEsperado:  number;
    factorActual:    number;
    alturaEsperada:  number;
    alturaActual:    number;
  }[];
}

/** REQ §3 — queue process result */
export interface QueueProcessResult {
  processed:  number;
  conflicts:  string[];
  tree:       TreeResponse;
}

/** REQ §8 — min-profit deletion */
export interface MinProfitResult {
  deleted:  FlightData;
  subtree:  string[];
  tree:     TreeResponse;
}

/** Fields the user edits — backend computes the rest */
export type FlightPayload = Omit<
  FlightData,
  'altura' | 'factorEquilibrio' | 'profundidad' | 'nodoCritico' | 'rentabilidad'
>;

// ─── Service ──────────────────────────────────────────────────────────────────

export const TreeService = {

  // ── FLIGHT CRUD ────────────────────────────────────────────────────────────

  async listFlights(): Promise<FlightData[]> {
    const res = await http.get<FlightListResponse>('/flights');
    return res.data.flights;
  },

  async createFlight(payload: FlightPayload): Promise<FlightData> {
    const res = await http.post<FlightSingleResponse>('/flights', payload);
    return res.data.flight;
  },

  async updateFlight(code: string, changes: Partial<FlightPayload>): Promise<FlightData> {
    const res = await http.put<FlightSingleResponse>(`/flights/${code}`, changes);
    return res.data.flight;
  },

  /** REQ §1.2 — removes ONE node only, no descendants */
  async deleteFlight(code: string): Promise<void> {
    await http.delete(`/flights/${code}`);
  },

  /** REQ §1.2 — removes node AND all its descendants (subtree cancellation) */
  async cancelFlight(code: string): Promise<void> {
    await http.delete(`/flights/${code}/cancel`);
  },

  // ── TREE ───────────────────────────────────────────────────────────────────

  async getCurrentTree(): Promise<TreeResponse> {
    const res = await http.get<TreeResponse>('/tree/current');
    return res.data;
  },

  /**
   * REQ §1.1 — Loads a user-selected JSON file and rebuilds the tree.
   * mode='topology' → respects parent/child layout from JSON.
   * mode='insertion' → inserts one by one with AVL auto-balance; also builds BST.
   */
  async loadTreeFromJSON(
    file: File,
    mode: 'topology' | 'insertion',
    criticalDepth: number,
  ): Promise<LoadTreeResponse> {
    const form = new FormData();
    form.append('file',          file);
    form.append('mode',          mode);
    form.append('criticalDepth', String(criticalDepth));
    const res = await http.post<LoadTreeResponse>('/tree/load', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /** REQ §1.3 — exports the full hierarchical tree as a JSON string */
  async exportTreeJSON(): Promise<string> {
    const res = await http.get('/tree/export', { responseType: 'text' });
    return res.data as string;
  },

  /** REQ §1.1 — fetches the BST built in parallel during insertion-mode load */
  async getBST(): Promise<TreeNode | null> {
    const res = await http.get<{ bst: TreeNode | null }>('/tree/bst');
    return res.data.bst;
  },

  async resetSystem(): Promise<void> {
    await http.post('/tree/reset');
  },

  // ── STRESS MODE (REQ §5) ────────────────────────────────────────────────────

  async setStressMode(enabled: boolean): Promise<StressModeResponse> {
    const res = await http.post<StressModeResponse>('/tree/stress', { enabled });
    return res.data;
  },

  async triggerRebalance(): Promise<RebalanceResult> {
    const res = await http.post<RebalanceResult>('/tree/rebalance');
    return res.data;
  },

  // ── AVL AUDIT (REQ §7) ──────────────────────────────────────────────────────

  async verifyAVL(): Promise<AVLVerifyResult> {
    const res = await http.get<AVLVerifyResult>('/tree/verify');
    return res.data;
  },

  // ── METRICS (REQ §4) ────────────────────────────────────────────────────────

  async getMetrics(): Promise<TreeMetrics> {
    const res = await http.get<TreeMetrics>('/tree/metrics');
    return res.data;
  },

  // ── CONCURRENCY QUEUE (REQ §3) ─────────────────────────────────────────────

  async enqueueFlights(flights: FlightPayload[]): Promise<void> {
    await http.post('/tree/queue', { flights });
  },

  async processQueue(): Promise<QueueProcessResult> {
    const res = await http.post<QueueProcessResult>('/tree/queue/process');
    return res.data;
  },

  // ── CRITICAL DEPTH (REQ §6) ────────────────────────────────────────────────

  async setCriticalDepth(depth: number): Promise<TreeResponse> {
    const res = await http.post<TreeResponse>('/tree/critical-depth', { depth });
    return res.data;
  },

  // ── MIN-PROFIT DELETE (REQ §8) ─────────────────────────────────────────────

  async deleteMinProfit(): Promise<MinProfitResult> {
    const res = await http.delete<MinProfitResult>('/tree/min-profit');
    return res.data;
  },
};