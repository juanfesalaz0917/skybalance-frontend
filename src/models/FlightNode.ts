/**
 * DTO (Data Transfer Object) representing the flight data sent by the Python backend.
 * Matches the 'to_dict' method in 'flight.py' perfectly.
 */
export interface FlightData {
  codigo: string;
  origen: string;
  destino: string;
  horaSalida: string;
  precioBase: number;
  precioFinal: number;
  pasajeros: number;
  prioridad: number;
  promocion: boolean;
  alerta: boolean;
  altura: number;
  factorEquilibrio: number;
  profundidad: number;
  nodoCritico: boolean;
  rentabilidad: number;
}

/**
 * Represents the recursive structure of a Tree Node coming from the backend's JsonSerializer.
 */
export interface TreeNode {
  flight: FlightData;     // The actual flight data
  izquierdo: TreeNode | null; // Left child (adjust name if Python backend uses 'left')
  derecho: TreeNode | null;   // Right child (adjust name if Python backend uses 'right')
}

/**
 * Interface representing the summary properties returned by get_avl_summary() in Python.
 */
export interface TreeProperties {
  raiz: string | null;
  altura: number;
  nodos: number;
  rotaciones: {
    II: number;
    DD: number;
    ID: number;
    DI: number;
  };
}

/**
 * The complete response object structure from get_tree_response()
 */
export interface TreeResponse {
  tree: TreeNode | null;
  properties: TreeProperties;
}