/**
 * Puentes temporales (ADR-0011): secciones de la ficha cuyo diseño real llega en
 * su propio ticket. La lista de 1-to-1s ya migró a `Lista1to1s` (#30); aquí solo
 * queda el stub del detalle, que muere en #31 (§11).
 */
export function PuenteDetalle1to1() {
  return (
    <section className="puente" aria-label="1-to-1s">
      <header className="ficha__cabecera">
        <div className="ficha__titulos">
          <h1>1-to-1s</h1>
        </div>
      </header>
    </section>
  );
}