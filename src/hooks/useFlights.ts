/**
 * @file useFlights.ts
 * @description Manages the flight list, pagination, and CRUD mutations
 *              wired to the SkyBalance Airlines Python backend.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Flight-domain state and API orchestration only.
 *  - (O) Open/Closed: New mutations can be appended without touching existing ones.
 *  - (D) Dependency Inversion: TreeService is the only external dependency.
 *
 * ─── Mutation strategy ────────────────────────────────────────────────────────
 *
 *  Optimistic-then-refresh (best of both worlds):
 *
 *   1. Apply change locally  → instant UI feedback, no spinner needed.
 *   2. Call backend API      → persists the change.
 *   3a. Success → call refresh() to pull the authoritative list from the server.
 *       This ensures computed fields (rentabilidad, factorEquilibrio, etc.)
 *       that the backend recalculates are always up to date in the UI.
 *   3b. Failure → restore the pre-mutation snapshot and surface the error.
 *
 *  Why refresh instead of manually merging the backend response?
 *   - The AVL tree may rebalance on insert/delete, changing other nodes.
 *   - The backend may change the flight's `codigo` or compute new fields.
 *   - A single GET /api/flights is cheap and keeps the UI 100% consistent.
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { TreeService } from '../services/TreeService';
import type { FlightPayload } from '../services/TreeService';
import type { FlightData } from '../models/FlightNode';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts a human-readable message from any thrown value.
 * Prioritises the backend's own error string from the JSON body.
 */
const extractErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    // Backend returns { error: "..." } on failure
    const msg: string | undefined = err.response?.data?.error;
    if (msg) return msg;
    if (!err.response) {
      return 'No se pudo conectar con el servidor. Verifica que el backend esté en localhost:5000.';
    }
    return `Error ${err.response.status}: ${err.response.statusText}`;
  }
  if (err instanceof Error) return err.message;
  return fallback;
};

/**
 * Strips backend-computed fields before sending to the API.
 * The backend calculates these from the AVL tree — sending them causes confusion.
 */
const toPayload = (flight: FlightData): FlightPayload => {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    altura, factorEquilibrio, profundidad, nodoCritico, rentabilidad,
    ...payload
  } = flight;
  return payload;
};

// ─── Return Interface ─────────────────────────────────────────────────────────

export interface UseFlightsReturn {
  flights: FlightData[];
  isLoading: boolean;
  /** Error from the last failed operation. Cleared when the next operation starts. */
  error: string | null;
  hasMore: boolean;
  editTarget: FlightData | null;
  loadMore: () => void;
  addFlight: (flight: FlightData) => Promise<void>;
  updateFlight: (flight: FlightData) => Promise<void>;
  deleteFlight: (codigo: string) => Promise<void>;
  openEditModal: (flight: FlightData) => void;
  closeEditModal: () => void;
  newDraft: () => void;
  /** Forces a fresh GET /api/flights. Call after external changes. */
  refresh: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useFlights = (): UseFlightsReturn => {

  // ── State ──────────────────────────────────────────────────────────────────

  const [allFlights, setAllFlights]     = useState<FlightData[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editTarget, setEditTarget]     = useState<FlightData | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /**
   * Pulls the full flight list from GET /api/flights.
   * Exposed as `refresh` so App.tsx can trigger it after resets or imports.
   */
  const fetchFlights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await TreeService.listFlights();
      setAllFlights(list);
    } catch (err) {
      setError(extractErrorMessage(err, 'Error al cargar los vuelos.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlights(); }, [fetchFlights]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const flights = allFlights.slice(0, visibleCount);
  const hasMore = visibleCount < allFlights.length;
  const loadMore = () => setVisibleCount(c => c + PAGE_SIZE);

  // ── Optimistic-then-refresh wrapper ───────────────────────────────────────

  /**
   * @param localUpdate   - Applied immediately for instant feedback.
   * @param apiCall       - The backend request.
   * @param errorFallback - Shown if apiCall throws.
   */
  const mutate = async (
    localUpdate: (prev: FlightData[]) => FlightData[],
    apiCall:     () => Promise<unknown>,
    errorFallback: string,
  ): Promise<void> => {
    const snapshot = allFlights;       // save for rollback
    setError(null);
    setAllFlights(localUpdate(snapshot)); // instant local change

    try {
      await apiCall();                 // hit the backend
      await fetchFlights();            // re-sync with authoritative server state
    } catch (err) {
      setAllFlights(snapshot);         // rollback
      setError(extractErrorMessage(err, errorFallback));
    }
  };

  // ── CRUD mutations ─────────────────────────────────────────────────────────

  /**
   * addFlight — POST /api/flights
   *
   * Sends only the user-editable fields (toPayload strips computed ones).
   * After the backend inserts and rebalances the AVL tree, refresh() pulls
   * the updated list so all nodes reflect their new computed values.
   */
  const addFlight = async (flight: FlightData): Promise<void> => {
    await mutate(
      prev  => [flight, ...prev],
      ()    => TreeService.createFlight(toPayload(flight)),
      'Error al crear el vuelo.',
    );
  };

  /**
   * updateFlight — PUT /api/flights/<code>
   *
   * Partial payload: only user-editable fields are sent.
   */
  const updateFlight = async (flight: FlightData): Promise<void> => {
    await mutate(
      prev  => prev.map(f => f.codigo === flight.codigo ? flight : f),
      ()    => TreeService.updateFlight(flight.codigo, toPayload(flight)),
      'Error al actualizar el vuelo.',
    );
  };

  /**
   * deleteFlight — DELETE /api/flights/<code>
   */
  const deleteFlight = async (codigo: string): Promise<void> => {
    await mutate(
      prev  => prev.filter(f => f.codigo !== codigo),
      ()    => TreeService.deleteFlight(codigo),
      'Error al eliminar el vuelo.',
    );
  };

  // ── Edit target ────────────────────────────────────────────────────────────

  const openEditModal  = (flight: FlightData) => setEditTarget(flight);
  const closeEditModal = () => setEditTarget(null);

  /**
   * Blank draft for create mode.
   * Computed fields default to 0/false — the backend overwrites them on insert.
   */
  const newDraft = () => setEditTarget({
    codigo:           '',
    origen:           '',
    destino:          '',
    horaSalida:       '',
    precioBase:       0,
    precioFinal:      0,
    pasajeros:        0,
    prioridad:        1,
    promocion:        false,
    alerta:           false,
    // Computed by backend — not editable
    altura:           0,
    factorEquilibrio: 0,
    profundidad:      0,
    nodoCritico:      false,
    rentabilidad:     0,
  });

  return {
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
    refresh: fetchFlights,
  };
};