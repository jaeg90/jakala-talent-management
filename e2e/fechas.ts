/** Fecha ISO (YYYY-MM-DD) de hace `dias` días (o del futuro si `dias` es negativo).
 *  `fechaHace(5)` ≈ hace 5 días; se usa para fijar la fecha de apertura de una
 *  incidencia, que debe ser PASADA o de hoy (≤ hoy: el servidor rechaza futuras). */
export function fechaHace(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}
