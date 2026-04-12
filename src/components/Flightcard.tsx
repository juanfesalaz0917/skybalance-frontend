/**
 * @file FlightCard.tsx
 * @description Displays a single flight entry as a card row.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Renders exactly one flight's data and
 *        exposes action buttons. Contains zero business logic.
 *  - (O) Open/Closed: Action visibility is controlled by optional boolean props
 *        so the card can be reused in read-only contexts (e.g., a tree visualizer)
 *        without modification.
 *  - (L) Liskov Substitution: `FlightCardProps` is typed against the `FlightData`
 *        interface from FlightNode.ts, so any conforming object can be passed in.
 *  - (I) Interface Segregation: Callback props are optional and individually typed —
 *        consumers only provide what they handle.
 *  - (D) Dependency Inversion: No service or router imported; actions are pure callbacks.
 */

import {
  AlertTriangle,
  Clock,
  Globe,
  MoreHorizontal,
  Pencil,
  Plane,
  Tag,
  Trash2,
} from "lucide-react";
import React from "react";
import type { FlightData } from "../models/FlightNode";

// ─── Props Interface ──────────────────────────────────────────────────────────

/**
 * Props for FlightCard.
 */
export interface FlightCardProps {
  /** The flight data object to display (shape defined in FlightNode.ts). */
  flight: FlightData;
  /** Called when the user clicks "Editar". Optional — hides button if omitted. */
  onEdit?: (flight: FlightData) => void;
  /** Called when the user clicks "Eliminar". Optional — hides button if omitted. */
  onDelete?: (codigo: string) => void;
  /** Called when the user clicks "Cancelar subárbol". Optional — hides button if omitted. */
  onCancel?: (codigo: string) => Promise<void>;
  /** Called when the user clicks "Más información". Optional — hides button if omitted. */
  onMoreInfo?: (flight: FlightData) => void;
}

// ─── Helper: Flight icon ──────────────────────────────────────────────────────

/**
 * Chooses between a domestic plane icon and an international globe icon
 * based on whether the flight has an international destination.
 *
 * This logic is extracted into a pure helper so FlightCard stays lean (SRP).
 */
const INTERNATIONAL_KEYWORDS = [
  "Madrid",
  "Miami",
  "New York",
  "Paris",
  "London",
  "Ciudad de México",
];

const isInternational = (destino: string): boolean =>
  INTERNATIONAL_KEYWORDS.some((city) =>
    destino.toLowerCase().includes(city.toLowerCase()),
  );

// ─── Helper: format departure time ───────────────────────────────────────────

/**
 * Formats the `horaSalida` string (ISO or "HH:MM") for display.
 * Falls back to the raw value if parsing fails.
 */
const formatTime = (horaSalida: string): string => {
  try {
    // Support both "HH:MM" and full ISO strings
    if (horaSalida.length <= 5) return horaSalida;
    const date = new Date(horaSalida);
    return date.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return horaSalida;
  }
};

// ─── Sub-component: ActionButton ─────────────────────────────────────────────

/**
 * Minimal labelled icon button used for card actions.
 * Extracted as its own component to honour SRP and avoid repetition.
 */
interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger" | "warning";
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  onClick,
  variant = "default",
}) => (
  <button
    onClick={onClick}
    aria-label={label}
    className={`
      flex flex-col items-center gap-0.5
      text-[10px] font-medium leading-tight
      transition-colors duration-150
      focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-700
      rounded px-1
      ${
        variant === "danger"
          ? "text-gray-600 hover:text-red-600"
          : variant === "warning"
            ? "text-gray-600 hover:text-amber-600"
            : "text-gray-600 hover:text-gray-900"
      }
    `}
  >
    {icon}
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * FlightCard — A single row card showing origin → destination, departure time,
 * and optional action buttons (Edit, Delete, More Info).
 *
 * Badge indicators:
 *  - Orange "PROMO" badge when `flight.promocion` is true.
 *  - Red "ALERTA" badge when `flight.alerta` is true.
 *
 * @example
 * <FlightCard
 *   flight={flightData}
 *   onEdit={(f) => openEditModal(f)}
 *   onDelete={(code) => deleteService.remove(code)}
 *   onMoreInfo={(f) => navigate(`/flights/${f.codigo}`)}
 * />
 */
const FlightCard: React.FC<FlightCardProps> = ({
  flight,
  onEdit,
  onDelete,
  onCancel,
  onMoreInfo,
}) => {
  const international = isInternational(flight.destino);

  const handleCancel = async () => {
    if (!onCancel) return;
    const confirmed = window.confirm(
      "Esta acción cancelará el vuelo y eliminará también todos sus nodos descendientes. ¿Deseas continuar?",
    );
    if (!confirmed) return;
    await onCancel(flight.codigo);
  };

  return (
    <article
      className="
        w-full bg-white/80 backdrop-blur-sm
        border border-gray-200
        rounded-2xl
        px-5 py-4
        flex items-center justify-between gap-4
        shadow-sm hover:shadow-md
        transition-shadow duration-200
      "
      aria-label={`Vuelo ${flight.codigo}: ${flight.origen} a ${flight.destino}`}
    >
      {/* ── Left: icon + route ── */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Flight type icon */}
        <div className="flex-shrink-0 text-gray-800" aria-hidden="true">
          {international ? (
            <Globe size={28} />
          ) : (
            <Plane size={28} className="-rotate-45" />
          )}
        </div>

        {/* Route label */}
        <div className="min-w-0">
          <p className="text-gray-900 font-semibold text-base truncate">
            {flight.origen}
            <span className="mx-2 text-gray-500" aria-hidden="true">
              →
            </span>
            {flight.destino}
          </p>

          {/* Status badges — only rendered when relevant */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {flight.promocion && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold
                               bg-amber-100 text-amber-700 rounded px-1.5 py-0.5"
              >
                <Tag size={10} aria-hidden="true" />
                PROMO
              </span>
            )}
            {flight.alerta && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold
                               bg-red-100 text-red-700 rounded px-1.5 py-0.5"
              >
                <AlertTriangle size={10} aria-hidden="true" />
                ALERTA
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Centre: departure time ── */}
      <div className="flex items-center gap-2 flex-shrink-0 text-gray-700">
        <Clock size={18} aria-hidden="true" />
        <span className="text-base font-semibold tabular-nums">
          {formatTime(flight.horaSalida)}
        </span>
      </div>

      {/* ── Right: action buttons (rendered only when callbacks are provided) ── */}
      {(onEdit || onDelete || onCancel || onMoreInfo) && (
        <div
          className="flex items-center gap-3 flex-shrink-0"
          role="group"
          aria-label={`Acciones para vuelo ${flight.codigo}`}
        >
          {onEdit && (
            <ActionButton
              label="Editar"
              icon={<Pencil size={16} />}
              onClick={() => onEdit(flight)}
            />
          )}
          {onDelete && (
            <ActionButton
              label="Eliminar"
              icon={<Trash2 size={16} />}
              onClick={() => onDelete(flight.codigo)}
              variant="danger"
            />
          )}
          {onCancel && (
            <ActionButton
              label="Cancelar subárbol"
              icon={<AlertTriangle size={16} />}
              onClick={handleCancel}
              variant="warning"
            />
          )}
          {onMoreInfo && (
            <ActionButton
              label="Más información"
              icon={<MoreHorizontal size={16} />}
              onClick={() => onMoreInfo(flight)}
            />
          )}
        </div>
      )}
    </article>
  );
};

export default FlightCard;
