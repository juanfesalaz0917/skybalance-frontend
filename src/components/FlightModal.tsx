/**
 * @file FlightModal.tsx
 * @description Modal dialog for creating or editing a flight.
 *
 * SOLID principles applied:
 *  - (S) Single Responsibility: Manages only the flight form, validation,
 *        and saving state. No API calls, no list management.
 *  - (O) Open/Closed: New fields are added by appending to FORM_FIELDS only.
 *  - (I) Interface Segregation: FlightModalProps is minimal.
 *  - (D) Dependency Inversion: onSave is async and injected — this component
 *        never knows about TreeService or useFlights.
 *
 * Key fixes vs previous version:
 *  - onSave is now async — the "Guardar" button shows a spinner while the
 *    API call is in flight and is disabled to prevent double-submits.
 *  - Computed fields (altura, factorEquilibrio, profundidad, nodoCritico,
 *    rentabilidad) are completely removed from the form — the backend
 *    calculates them automatically on every insert/update.
 *  - The modal disables all inputs while saving, not just the button.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import type { FlightData } from '../models/FlightNode';

// ─── Props Interface ──────────────────────────────────────────────────────────

export interface FlightModalProps {
  isOpen: boolean;
  /**
   * Pre-populates the form in edit mode.
   * Pass undefined (or a draft with empty strings) for create mode.
   */
  initialFlight?: FlightData;
  /**
   * Async callback — receives the complete FlightData when the user clicks
   * "Guardar". The modal shows a spinner until this promise resolves/rejects.
   */
  onSave: (flight: FlightData) => Promise<void>;
  onClose: () => void;
}

// ─── Form field descriptor ────────────────────────────────────────────────────

interface FormField {
  key: keyof FlightData;
  label: string;
  type: 'text' | 'number' | 'time' | 'checkbox';
  required?: boolean;
  /** Shown inside the input as a hint */
  placeholder?: string;
}

/**
 * ONLY user-editable fields.
 * The following are intentionally EXCLUDED because the backend computes them:
 *   altura, factorEquilibrio, profundidad, nodoCritico, rentabilidad
 */
const FORM_FIELDS: FormField[] = [
  {
    key: 'codigo',
    label: 'Código de vuelo',
    type: 'text',
    required: true,
    placeholder: 'Ej: SKB-001',
  },
  {
    key: 'origen',
    label: 'Ciudad de origen',
    type: 'text',
    required: true,
    placeholder: 'Ej: Bogotá',
  },
  {
    key: 'destino',
    label: 'Ciudad de destino',
    type: 'text',
    required: true,
    placeholder: 'Ej: Cartagena',
  },
  {
    key: 'horaSalida',
    label: 'Hora de salida',
    type: 'time',
    required: true,
  },
  {
    key: 'precioBase',
    label: 'Precio base ($)',
    type: 'number',
    required: true,
    placeholder: '0',
  },
  {
    key: 'precioFinal',
    label: 'Precio final ($)',
    type: 'number',
    required: true,
    placeholder: '0',
  },
  {
    key: 'pasajeros',
    label: 'Número de pasajeros',
    type: 'number',
    required: true,
    placeholder: '0',
  },
  {
    key: 'prioridad',
    label: 'Prioridad (1 = alta)',
    type: 'number',
    required: true,
    placeholder: '1',
  },
  { key: 'promocion', label: 'Vuelo en promoción', type: 'checkbox' },
  { key: 'alerta',    label: 'Activar alerta',     type: 'checkbox' },
];

// ─── Empty form factory ───────────────────────────────────────────────────────

const emptyForm = (): FlightData => ({
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
  // Computed by backend — zeroed here, overwritten on fetch
  altura:           0,
  factorEquilibrio: 0,
  profundidad:      0,
  nodoCritico:      false,
  rentabilidad:     0,
});

// ─── Validation (pure function — unit-testable in isolation) ──────────────────

const validate = (data: FlightData): Partial<Record<keyof FlightData, string>> => {
  const errors: Partial<Record<keyof FlightData, string>> = {};

  FORM_FIELDS.forEach(({ key, required }) => {
    if (!required) return;
    const val = data[key];
    const empty =
      val === '' || val === null || val === undefined ||
      (typeof val === 'number' && (isNaN(val) || val === 0));
    if (empty) errors[key] = 'Este campo es obligatorio.';
  });

  if (data.precioBase > 0 && data.precioFinal > 0 && data.precioFinal < data.precioBase) {
    errors.precioFinal = 'El precio final no puede ser menor al precio base.';
  }
  if (data.pasajeros < 0) {
    errors.pasajeros = 'No puede ser negativo.';
  }

  return errors;
};

// ─── Component ────────────────────────────────────────────────────────────────

const FlightModal: React.FC<FlightModalProps> = ({
  isOpen,
  initialFlight,
  onSave,
  onClose,
}) => {
  const [formData, setFormData]   = useState<FlightData>(emptyForm);
  const [errors, setErrors]       = useState<Partial<Record<keyof FlightData, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  /**
   * isSaving — true while the async onSave promise is pending.
   * Disables all inputs and shows a spinner on "Guardar" to prevent double-submits.
   */
  const [isSaving, setIsSaving]   = useState(false);

  // ── Reset form when modal opens ──
  useEffect(() => {
    if (isOpen) {
      setFormData(initialFlight ?? emptyForm());
      setErrors({});
      setSubmitted(false);
      setIsSaving(false);
    }
  }, [isOpen, initialFlight]);

  // ── Close on Escape (disabled while saving) ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    },
    [onClose, isSaving],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // ── Field change ──

  const handleChange = (key: keyof FlightData, rawValue: string | boolean) => {
    setFormData(prev => {
      const field = FORM_FIELDS.find(f => f.key === key);
      let value: FlightData[typeof key];

      if (field?.type === 'checkbox') {
        value = rawValue as boolean;
      } else if (field?.type === 'number') {
        // parseFloat so "1.5" works; fall back to 0 only for truly empty input
        const parsed = parseFloat(rawValue as string);
        value = isNaN(parsed) ? 0 : parsed;
      } else {
        value = rawValue as string;
      }

      const updated = { ...prev, [key]: value };
      if (submitted) setErrors(validate(updated));
      return updated;
    });
  };

  // ── Submit ──

  /**
   * Async submit handler.
   * Awaits onSave so the spinner stays visible until the API responds.
   * Errors thrown by onSave (e.g. 400 from backend) are caught in useFlights;
   * the modal closes regardless so the error appears in FlightsPage instead.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    const validationErrors = validate(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
      // onSave calls handleCloseModal in App.tsx on success — no need to close here
    } finally {
      setIsSaving(false);
    }
  };

  const isEditMode = !!initialFlight?.codigo && initialFlight.codigo.trim() !== '';
  const title = isEditMode
    ? `Editar vuelo — ${initialFlight?.codigo}`
    : 'Crear nuevo vuelo';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="
          relative w-full max-w-lg bg-white rounded-2xl shadow-2xl
          flex flex-col max-h-[90vh] overflow-hidden
        "
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-black">
          <h2 id="modal-title" className="text-white font-bold text-lg tracking-wide">
            {title}
          </h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            aria-label="Cerrar modal"
            className="text-gray-300 hover:text-white transition-colors duration-150
                       disabled:opacity-40 disabled:cursor-not-allowed rounded"
          >
            <X size={22} />
          </button>
        </div>

        {/* ── Form body ── */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4"
        >
          {FORM_FIELDS.map(({ key, label, type, placeholder }) => {
            const fieldError = errors[key];
            const value = formData[key];

            if (type === 'checkbox') {
              return (
                <label key={key} className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={value as boolean}
                    disabled={isSaving}
                    onChange={e => handleChange(key, e.target.checked)}
                    className="w-4 h-4 accent-black rounded disabled:opacity-50"
                  />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </label>
              );
            }

            return (
              <div key={key} className="flex flex-col gap-1">
                <label
                  htmlFor={key}
                  className="text-xs font-semibold text-gray-600 uppercase tracking-wide"
                >
                  {label}
                </label>
                <input
                  id={key}
                  type={type}
                  value={value as string | number}
                  placeholder={placeholder}
                  disabled={isSaving}
                  onChange={e => handleChange(key, e.target.value)}
                  className={`
                    w-full rounded-lg border px-3 py-2 text-sm text-gray-900
                    outline-none transition-colors duration-150
                    focus:ring-2 focus:ring-black/20
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${fieldError
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                    }
                  `}
                  aria-invalid={!!fieldError}
                  aria-describedby={fieldError ? `${key}-error` : undefined}
                />
                {fieldError && (
                  <p id={`${key}-error`} role="alert" className="text-xs text-red-500 mt-0.5">
                    {fieldError}
                  </p>
                )}
              </div>
            );
          })}

          {/* ── Footer actions ── */}
          <div className="flex justify-end gap-3 pt-2 pb-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="
                px-5 py-2 rounded-full text-sm font-semibold
                border border-gray-300 text-gray-700
                hover:bg-gray-100 transition-colors duration-150
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="
                flex items-center gap-2
                px-5 py-2 rounded-full text-sm font-semibold
                bg-black text-white
                hover:bg-gray-800 transition-colors duration-150
                disabled:opacity-60 disabled:cursor-not-allowed
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-black
              "
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  Guardando…
                </>
              ) : (
                <>
                  <Save size={15} aria-hidden="true" />
                  Guardar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlightModal;