/**
 * @file FlightsPage.tsx
 * @description Main flights dashboard page for SkyBalance Airlines.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Orchestrates layout and data-fetching state.
 *        Rendering of individual cards is delegated to FlightCard (SRP on sub-components).
 *  - (O) Open/Closed: The `actions` prop object lets consumers add/remove card
 *        actions without modifying FlightsPage.
 *  - (L) Liskov Substitution: Accepts any array of `FlightData` — conforms to the
 *        interface from FlightNode.ts.
 *  - (I) Interface Segregation: `FlightCardActions` groups only card-level callbacks;
 *        page-level callbacks are in `FlightsPageProps` directly.
 *  - (D) Dependency Inversion: Data fetching is done externally and passed in via props.
 *        FlightsPage never imports TreeService — the parent does.
 */

import React, { useState, useMemo } from 'react';
import { Plus, ChevronDown, Loader2, ServerCrash } from 'lucide-react';
import Navbar from './Navbar';
import FlightCard from './Flightcard';
import type { FlightData } from '../models/FlightNode';

// ─── Props Interfaces ─────────────────────────────────────────────────────────

/**
 * Groups the optional action callbacks forwarded to each FlightCard.
 * Keeping them in a separate interface avoids bloating FlightsPageProps (ISP).
 */
export interface FlightCardActions {
  onEdit?: (flight: FlightData) => void;
  onDelete?: (codigo: string) => void;
  onMoreInfo?: (flight: FlightData) => void;
}

/**
 * Props for the FlightsPage component.
 */
export interface FlightsPageProps {
  /** All flight records to display. Passed in by the parent (DIP). */
  flights: FlightData[];
  /** Whether the parent is currently loading data. Shows a spinner when true. */
  isLoading?: boolean;
  /** Error message to display when the fetch fails. */
  error?: string | null;
  /** Called when the user clicks "Crear" to add a new flight. */
  onCreateFlight: () => void;
  /** Called when the user clicks "Ver más" to load additional flights. */
  onLoadMore: () => void;
  /** Whether there are more flights to load (controls "Ver más" visibility). */
  hasMore?: boolean;
  /** Card-level action callbacks. If omitted, action buttons are hidden. */
  actions?: FlightCardActions;
  /** Called when the hamburger menu is toggled. */
  onMenuToggle?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of flights shown per page before "Ver más" is needed. */
const PAGE_SIZE = 5;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * FlightsPage — Full-page flight list dashboard.
 *
 * Layout (matches mockup exactly):
 *  ┌──────────────────────────────────────────┐
 *  │ Navbar (logo | search)                   │
 *  ├──────────────────────────────────────────┤
 *  │                  Vuelos:           [+Crear]│
 *  │  ┌─ FlightCard ─────────────────────────┐│
 *  │  │ Bogotá → Cartagena   🕐 1:30  ✏ 🗑 …││
 *  │  └──────────────────────────────────────┘│
 *  │  … more cards …                          │
 *  │        [ Ver más ]                       │
 *  ├──────────────────────────────────────────┤
 *  │ Footer                                   │
 *  └──────────────────────────────────────────┘
 *
 * Search filters the `flights` array client-side by origin, destination, or code.
 *
 * @example
 * <FlightsPage
 *   flights={treeResponse.flights}
 *   isLoading={loading}
 *   onCreateFlight={() => navigate('/flights/new')}
 *   onLoadMore={fetchNextPage}
 *   hasMore={currentPage < totalPages}
 *   actions={{
 *     onEdit: (f) => navigate(`/flights/${f.codigo}/edit`),
 *     onDelete: (code) => TreeService.deleteFlight(code),
 *     onMoreInfo: (f) => openModal(f),
 *   }}
 * />
 */
const FlightsPage: React.FC<FlightsPageProps> = ({
  flights,
  isLoading = false,
  error = null,
  onCreateFlight,
  onLoadMore,
  hasMore = false,
  actions,
  onMenuToggle = () => {},
}) => {
  // ── Local state ──
  const [searchQuery, setSearchQuery] = useState('');

  // ── Derived data ──

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage:
          'linear-gradient(160deg, #e8e8e8 0%, #f5f5f5 50%, #dcdcdc 100%)',
      }}
    >
      {/* ── Top navigation bar ── */}
      <Navbar onSearch={setSearchQuery} onMenuToggle={onMenuToggle} />

      {/* ── Page body ── */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8">

        {/* Page header: title + create button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Vuelos:
          </h1>

          {/* Create button — top-right, matching the "+" icon in the mockup */}
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
            <div className="w-10 h-10 rounded-xl border-2 border-gray-900 flex items-center justify-center
                            hover:bg-gray-900 hover:text-white transition-colors duration-150">
              <Plus size={22} />
            </div>
            <span className="text-xs font-semibold">Crear</span>
          </button>
        </div>

        {/* ── Content area: loading / error / list ── */}
        {isLoading ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
            <Loader2 size={40} className="animate-spin" />
            <p className="text-sm">Cargando vuelos…</p>
          </div>
        ) : error ? (
          /* Error state */
          <div
            role="alert"
            className="flex flex-col items-center justify-center py-20 gap-3 text-red-600"
          >
            <ServerCrash size={40} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : filteredFlights.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-400">
            <p className="text-base font-medium">No se encontraron vuelos.</p>
            {searchQuery && (
              <p className="text-sm">
                Intenta con otro término de búsqueda.
              </p>
            )}
          </div>
        ) : (
          /* Flight list */
          <div className="flex flex-col gap-4" role="list" aria-label="Lista de vuelos">
            {filteredFlights.map((flight) => (
              <div key={flight.codigo} role="listitem">
                <FlightCard
                  flight={flight}
                  onEdit={actions?.onEdit}
                  onDelete={actions?.onDelete}
                  onMoreInfo={actions?.onMoreInfo}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── "Ver más" button — hidden if no more pages or actively loading ── */}
        {hasMore && !isLoading && (
          <div className="flex justify-center mt-8">
            <button
              onClick={onLoadMore}
              className="
                flex items-center gap-2
                bg-black text-white
                font-bold text-base
                px-12 py-3 rounded-full
                hover:bg-gray-800
                transition-colors duration-200
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
        © {new Date().getFullYear()} SkyBalance Airlines | Todos los derechos reservados.
      </footer>
    </div>
  );
};

export default FlightsPage;