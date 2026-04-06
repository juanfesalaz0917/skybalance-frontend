# Pruebas de aceptacion frontend-backend

Fecha: 2026-04-06
Scope: Cierre obligatorio paso 3 (versionado + simulacion)
Entorno:
- Frontend: Vite en http://localhost:5173
- Backend esperado: http://localhost:5000/api

## Estado actual de ejecucion
- Frontend: OK (servidor Vite inicia y expone la app).
- Backend: BLOQUEADO (sin respuesta en localhost:5000).
- Resultado global: No concluyente hasta habilitar backend.

## Evidencia tecnica capturada en esta sesion
- Comando: npm run dev
- Observado: VITE v8.0.3 ready, Local http://localhost:5173/
- Comando: GET http://localhost:5000/api/flights
- Observado: Unable to connect to the remote server

## Caso 1: Versionado (crear, recargar, restaurar, eliminar)

### Checklist de pasos
- [ ] Abrir app y autenticar en UI.
- [ ] Abrir panel Versiones.
- [ ] Crear version con nombre: QA-Version-001.
- [ ] Confirmar que aparece en la lista de versiones.
- [ ] Recargar app (F5).
- [ ] Confirmar persistencia de QA-Version-001 despues de recargar.
- [ ] Restaurar QA-Version-001.
- [ ] Verificar que arbol/lista vuelven al estado de la version.
- [ ] Eliminar QA-Version-001.
- [ ] Confirmar que desaparece de la lista.

### Esperado vs observado
| Paso | Esperado | Observado | Estado |
|---|---|---|---|
| Crear version | POST /api/versions/{name} exitoso, version visible en panel | No ejecutado: backend no disponible | Bloqueado |
| Recargar app | GET /api/versions mantiene la version creada | No ejecutado: backend no disponible | Bloqueado |
| Restaurar version | PUT /api/versions/{name} aplica snapshot y refresca vuelos/arbol | No ejecutado: backend no disponible | Bloqueado |
| Eliminar version | DELETE /api/versions/{name} remueve version de lista | No ejecutado: backend no disponible | Bloqueado |

## Caso 2: Simulacion (encolar, iniciar, monitorear, detener/completar, verificar arbol)

### Checklist de pasos
- [ ] Abrir panel Cola de insercion.
- [ ] Agregar al menos 3 vuelos a la cola desde el formulario.
- [ ] Iniciar simulacion paralela (Start) con workers=2.
- [ ] Monitorear estado (running/completed) y progreso (%).
- [ ] Monitorear eventos (worker, resultado, conflictos).
- [ ] Detener simulacion con Stop o esperar completion.
- [ ] Verificar actualizacion final de arbol y lista de vuelos.

### Esperado vs observado
| Paso | Esperado | Observado | Estado |
|---|---|---|---|
| Encolar datos | POST /api/queue por cada vuelo en cola | No ejecutado: backend no disponible | Bloqueado |
| Iniciar simulacion | POST /api/queue/simulations/start retorna jobId y estado running | No ejecutado: backend no disponible | Bloqueado |
| Monitorear estado/eventos | GET status y GET events muestran progreso y resultados | No ejecutado: backend no disponible | Bloqueado |
| Detener/completar | POST /stop o estado completed | No ejecutado: backend no disponible | Bloqueado |
| Verificar arbol final | TreeView y lista reflejan inserciones/conflictos procesados | No ejecutado: backend no disponible | Bloqueado |

## Criterio de cierre (obligatorio)
Para cerrar este paso, todos los items de ambos checklists deben quedar marcados y los resultados de las tablas deben pasar de Bloqueado a Exitoso/Fallido con evidencia (captura o log) por fila.

## Recomendacion de re-ejecucion inmediata
1. Levantar backend en puerto 5000 con prefijo /api.
2. Repetir ambos casos en una sola corrida de QA.
3. Actualizar esta misma acta en la columna Observado y Estado con evidencia real.
