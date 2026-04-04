/**
 * @file App.tsx
 * @description Root application component for SkyBalance Airlines.
 */

import React, { useState } from 'react';
import FlightModal           from './components/FlightModal';
import { useAuth }           from './hooks/useAuth';
import { useFlights }        from './hooks/useFlights';
import type { FlightData }   from './models/FlightNode';
import LoginPage from './components/LoginPage';
import FlightsPage from './components/Flightspage';

// ─── Modal Mode ───────────────────────────────────────────────────────────────

/**
 * Describes which mode the FlightModal is currently in.
 *  - 'create' : an empty form for adding a new flight.
 *  - 'edit'   : a pre-populated form for modifying an existing flight.
 *  - null     : modal is closed.
 */
type ModalMode = 'create' | 'edit' | null;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * App — Top-level orchestrator for SkyBalance Airlines.
 *
 * Screen flow:
 *   LoginPage  →(login success)→  FlightsPage
 *   FlightsPage  →(logout)→       LoginPage
 *
 * Modal flow:
 *   FlightsPage "Crear" button   → FlightModal (create mode)
 *   FlightCard  "Editar" button  → FlightModal (edit   mode)
 *   FlightModal "Save / Cancel"  → FlightsPage (modal closes)
 */
const App: React.FC = () => {
  // ── Auth ──
  const { isAuthenticated, login, logout } = useAuth();

  // ── Flight data & mutations ──
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
    refresh,
  } = useFlights();

  // ── Modal state ──

  /**
   * Controls which mode FlightModal renders in.
   * Kept in App (not in useFlights) because modal visibility is a UI concern,
   * not a data concern (SRP split between UI state and domain state).
   */
  const [modalMode, setModalMode] = useState<ModalMode>(null);

  // ── Derived ──

  /** True when the modal should be visible (either mode). */
  const isModalOpen = modalMode !== null;

  /**
   * The flight to pre-populate in the modal.
   * undefined in create mode (FlightModal uses emptyForm() internally).
   */
  const modalInitialFlight: FlightData | undefined =
    modalMode === 'edit' && editTarget ? editTarget : undefined;

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Opens the modal in create mode with a blank draft. */
  const handleOpenCreate = () => {
    newDraft();         // ensures a fresh codigo is generated
    setModalMode('create');
  };

  /**
   * Opens the modal in edit mode.
   * Delegates storing the target flight to useFlights (SRP).
   */
  const handleOpenEdit = (flight: FlightData) => {
    openEditModal(flight);
    setModalMode('edit');
  };

  /** Closes the modal and resets edit target. */
  const handleCloseModal = () => {
    setModalMode(null);
    closeEditModal();
  };

  /**
   * Dispatches the correct mutation depending on modal mode.
   * Awaits the API call — the modal stays open until the backend confirms.
   * On backend error, useFlights sets the error state and rolls back; the
   * modal closes regardless so the user sees the error in FlightsPage.
   */
  const handleSave = async (flight: FlightData) => {
    if (modalMode === 'create') {
      await addFlight(flight);
    } else {
      await updateFlight(flight);
    }
    handleCloseModal();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    /**
     * Authentication wall — render only the login screen.
     * No flight data is fetched or mounted until the user is authenticated.
     */
    return <LoginPage onLogin={login} />;
  }

  return (
    <>
      {/* ── Main dashboard ── */}
      <FlightsPage
        flights={flights}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore}
        onCreateFlight={handleOpenCreate}
        onLoadMore={loadMore}
        onMenuToggle={logout} // Hamburger acts as logout; call refresh() here if you add a sidebar
        actions={{
          onEdit:     handleOpenEdit,
          onDelete:   (codigo) => deleteFlight(codigo),
          onMoreInfo: (flight) => alert(`More info: ${flight.codigo} — ${flight.origen} → ${flight.destino}`),
        }}
      />

      {/* ── Create / Edit modal (portal-style, rendered above everything) ── */}
      <FlightModal
        isOpen={isModalOpen}
        initialFlight={modalInitialFlight}
        onSave={handleSave}
        onClose={handleCloseModal}
      />
    </>
  );
};

export default App;