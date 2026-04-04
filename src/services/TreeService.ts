/**
 * @file TreeService.ts
 * @description HTTP client layer for the SkyBalance Airlines Python backend.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Only handles HTTP communication and response parsing.
 *  - (O) Open/Closed: Add new endpoints by appending methods — existing ones untouched.
 *  - (I) Interface Segregation: Each response interface is minimal and purpose-specific.
 *  - (D) Dependency Inversion: Hooks and components depend on this service's interfaces,
 *        never on Axios directly.
 *
 * ─── ACTUAL BACKEND RESPONSE SHAPES (confirmed from network tab) ─────────────
 *
 *  GET  /api/flights          → { flights: FlightData[], total: number }
 *  GET  /api/flights/<code>   → { flight: FlightData }
 *  POST /api/flights          → { flight: FlightData, ... }
 *  PUT  /api/flights/<code>   → { flight: FlightData, ... }
 *  DELETE /api/flights/<code> → { message: string, code: string }
 */

import axios from 'axios';
import type { FlightData, TreeResponse } from '../models/FlightNode';

// ─── Base URL ─────────────────────────────────────────────────────────────────

/**
 * Single source of truth for the API base URL.
 * To point to a remote server, change this one line or use an env variable:
 *   const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
 */
const API_URL = 'http://localhost:5000/api';

// ─── Axios instance ───────────────────────────────────────────────────────────

/**
 * Pre-configured Axios instance.
 * Centralises base URL, default headers, and timeout so no method repeats them.
 * Interceptors for auth tokens or logging can be added here without touching methods.
 */
const http = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

// ─── Response shape interfaces ────────────────────────────────────────────────
// These match the ACTUAL JSON the Python backend returns — not assumed wrappers.

/** GET /api/flights */
interface FlightListResponse {
  flights: FlightData[];
  total: number;
}

/** GET /api/flights/<code> · POST /api/flights · PUT /api/flights/<code> */
interface FlightSingleResponse {
  flight: FlightData;
  [key: string]: unknown; // backend may include extra fields (tree_properties, etc.)
}

/** DELETE /api/flights/<code> */
interface FlightDeleteResponse {
  message: string;
  code: string;
}

// ─── Editable flight fields ───────────────────────────────────────────────────

/**
 * The subset of FlightData that the frontend sends to the backend.
 * Computed fields (altura, factorEquilibrio, profundidad, nodoCritico, rentabilidad)
 * are EXCLUDED — the backend AVL tree calculates them automatically on insert/update.
 *
 * Using Omit<> keeps this in sync with FlightData automatically:
 * if a field is renamed in FlightNode.ts, TypeScript will catch the mismatch here.
 */
export type FlightPayload = Omit<
  FlightData,
  'altura' | 'factorEquilibrio' | 'profundidad' | 'nodoCritico' | 'rentabilidad'
>;

// ─── Service ──────────────────────────────────────────────────────────────────

export const TreeService = {

  // ── READ ──────────────────────────────────────────────────────────────────

  /**
   * Returns all flights in breadth-first order.
   * This is the primary data source for FlightsPage.
   *
   * GET /api/flights
   * Response: { flights: FlightData[], total: number }
   */
  async listFlights(): Promise<FlightData[]> {
    const res = await http.get<FlightListResponse>('/flights');
    // The backend returns { flights: [...] } at the top level — no data wrapper
    return res.data.flights;
  },

  /**
   * Returns one flight by code.
   *
   * GET /api/flights/<code>
   * Response: { flight: FlightData }
   */
  async getFlight(code: string): Promise<FlightData> {
    const res = await http.get<FlightSingleResponse>(`/flights/${code}`);
    return res.data.flight;
  },

  /**
   * Returns the full AVL tree structure with tree properties.
   * Used for tree visualisation views.
   *
   * GET /api/tree/current
   */
  async getCurrentTree(): Promise<TreeResponse> {
    const res = await http.get<TreeResponse>('/tree/current');
    return res.data;
  },

  // ── CREATE ────────────────────────────────────────────────────────────────

  /**
   * Inserts a new flight into the AVL tree.
   *
   * POST /api/flights
   * Body:     FlightPayload (no computed fields — backend calculates them)
   * Response: { flight: FlightData, ... }
   *
   * @returns The server-confirmed FlightData with all computed fields populated.
   * @throws  AxiosError 400 if the backend validation rejects the payload.
   */
  async createFlight(payload: FlightPayload): Promise<FlightData> {
    const res = await http.post<FlightSingleResponse>('/flights', payload);
    return res.data.flight;
  },

  // ── UPDATE ────────────────────────────────────────────────────────────────

  /**
   * Updates an existing flight (partial update supported by the backend).
   *
   * PUT /api/flights/<code>
   * Body:     Partial<FlightPayload> — only send changed fields
   * Response: { flight: FlightData, ... }
   *
   * @throws AxiosError 404 if no flight with that code exists.
   */
  async updateFlight(code: string, changes: Partial<FlightPayload>): Promise<FlightData> {
    const res = await http.put<FlightSingleResponse>(`/flights/${code}`, changes);
    return res.data.flight;
  },

  // ── DELETE ────────────────────────────────────────────────────────────────

  /**
   * Deletes a single flight node from the AVL tree.
   *
   * DELETE /api/flights/<code>
   * Response: { message: string, code: string }
   *
   * @throws AxiosError 404 if no flight with that code exists.
   */
  async deleteFlight(code: string): Promise<void> {
    await http.delete<FlightDeleteResponse>(`/flights/${code}`);
  },

  // ── SYSTEM ────────────────────────────────────────────────────────────────

  /**
   * Wipes and rebuilds the AVL tree on the backend.
   *
   * POST /api/tree/reset
   */
  async resetSystem(): Promise<void> {
    await http.post('/tree/reset');
  },
};