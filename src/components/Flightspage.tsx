/**
 * @file FlightsPage.tsx
 * @description Main flights dashboard page for SkyBalance Airlines.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Orchestrates layout and data-fetching state.
 *        Rendering of individual cards is delegated to FlightCard (SRP).
 *  - (O) Open/Closed: The `actions` prop object lets consumers add/remove card
 *        actions without modifying FlightsPage.
 *  - (L) Liskov Substitution: Accepts any array of `FlightData`.
 *  - (I) Interface Segregation: `FlightCardActions` groups only card-level callbacks.
 *  - (D) Dependency Inversion: Data fetching is done externally via props.
 *        FlightsPage never imports TreeService directly.
 */

import { ChevronDown, Loader2, Plus, ServerCrash } from "lucide-react";
import React, { useMemo, useState } from "react";
import type { FlightData } from "../models/FlightNode";
import FlightCard from "./Flightcard";
import Navbar from "./Navbar";

// ─── Types ────────────────────────────────────────────────────────────────────

type SidePanel = "analytics" | "versions" | "queue" | null;

// ─── Props Interfaces ─────────────────────────────────────────────────────────

/**
 * Card-level action callbacks forwarded to each FlightCard.
 * All optional — omitting one hides that button on the card.
 */
export interface FlightCardActions {
  onEdit?: (flight: FlightData) => void;
  onDelete?: (codigo: string) => void;
  /** REQ §1.2 — cancels the node AND all its descendants. */
  onCancel?: (codigo: string) => Promise<void>;
  onMoreInfo?: (flight: FlightData) => void;
}

/**
 * Props for the FlightsPage component.
 */
export interface FlightsPageProps {
  flights: FlightData[];
  isLoading?: boolean;
  error?: string | null;
  onCreateFlight: () => void;
  onLoadMore: () => void;
  hasMore?: boolean;
  actions?: FlightCardActions;

  // ── Navbar passthrough props ──────────────────────────────────────────────
  /** Called when the hamburger / logout button is clicked. */
  onMenuToggle?: () => void;
  /** Current active view — drives the Navbar toggle buttons. */
  viewMode?: "list" | "tree";
  /** Called when the user switches views in the Navbar. */
  onViewChange?: (mode: "list" | "tree") => void;
  /** Opens the JSON loader modal (REQ §1.1). */
  onOpenLoader?: () => void;
  /** Which side panel is currently open. */
  sidePanel?: SidePanel;
  /** Called when the user toggles a side panel in the Navbar. */
  onSidePanelChange?: (panel: SidePanel) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FlightsPage: React.FC<FlightsPageProps> = ({
  flights,
  isLoading = false,
  error = null,
  onCreateFlight,
  onLoadMore,
  hasMore = false,
  actions,
  // Navbar props — safe defaults so FlightsPage still works standalone
  onMenuToggle = () => {},
  viewMode = "list",
  onViewChange = () => {},
  onOpenLoader = () => {},
  sidePanel = null,
  onSidePanelChange = () => {},
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * Client-side filter — re-runs only when `flights` or `searchQuery` changes.
   * Searches across origin, destination, and flight code (case-insensitive).
   */
  const filteredFlights = useMemo(() => {
    if (!searchQuery.trim()) return flights;
    const q = searchQuery.toLowerCase();
    return flights.filter(
      (f) =>
        f.origen.toLowerCase().includes(q) ||
        f.destino.toLowerCase().includes(q) ||
        f.codigo.toLowerCase().includes(q),
    );
  }, [flights, searchQuery]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage:
          "linear-gradient(160deg, #e8e8e8 0%, #f5f5f5 50%, #dcdcdc 100%)",
      }}
    >
      {/* ── Top navigation bar ── */}
      {/*
       * All five Navbar props are forwarded here.
       * onSearch is handled locally (setSearchQuery) — the parent never needs
       * to know about the search string, keeping concerns separated (SRP).
       */}
      <Navbar
        onSearch={setSearchQuery}
        onMenuToggle={onMenuToggle}
        viewMode={viewMode}
        onViewChange={onViewChange}
        onOpenLoader={onOpenLoader}
        sidePanel={sidePanel}
        onSidePanelChange={onSidePanelChange}
      />

      {/* ── Page body ── */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8">
        {/* Header: title + create button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Vuelos:
          </h1>

          <button
            onClick={onCreateFlight}
            aria-label="Crear nuevo vuelo"
            className="
              flex flex-col items-center gap-0.5
              text-gray-900 hover:text-black
              transition-colors duration-150
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-700
              rounded
            "
          >
            <div
              className="
              w-10 h-10 rounded-xl border-2 border-gray-900
              flex items-center justify-center
              hover:bg-gray-900 hover:text-white transition-colors duration-150
            "
            >
              <Plus size={22} />
            </div>
            <span className="text-xs font-semibold">Crear</span>
          </button>
        </div>

        {/* ── Content: loading / error / empty / list ── */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
            <Loader2 size={40} className="animate-spin" />
            <p className="text-sm">Cargando vuelos…</p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center py-20 gap-3 text-red-600"
          >
            <ServerCrash size={40} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : filteredFlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400">
            <p className="text-base font-medium">No se encontraron vuelos.</p>
            {searchQuery && (
              <p className="text-sm">Intenta con otro término de búsqueda.</p>
            )}
          </div>
        ) : (
          <div
            className="flex flex-col gap-4"
            role="list"
            aria-label="Lista de vuelos"
          >
            {filteredFlights.map((flight) => (
              <div key={flight.codigo} role="listitem">
                <FlightCard
                  flight={flight}
                  onEdit={actions?.onEdit}
                  onDelete={actions?.onDelete}
                  onCancel={actions?.onCancel}
                  onMoreInfo={actions?.onMoreInfo}
                />
              </div>
            ))}
          </div>
        )}

        {/* "Ver más" */}
        {hasMore && !isLoading && (
          <div className="flex justify-center mt-8">
            <button
              onClick={onLoadMore}
              className="
                flex items-center gap-2
                bg-black text-white font-bold text-base
                px-12 py-3 rounded-full
                hover:bg-gray-800 transition-colors duration-200
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-black
              "
            >
              Ver más
              <ChevronDown size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-black text-gray-400 text-center text-xs py-4 mt-auto">
        © {new Date().getFullYear()} SkyBalance Airlines | Todos los derechos
        reservados.
      </footer>
    </div>
  );
};

export default FlightsPage;
