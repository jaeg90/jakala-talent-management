import { useState } from 'react';
import { cambiarTema, preferenciaGuardada, type PreferenciaTema } from './lib/tema';

const OPCIONES: { valor: PreferenciaTema; nombre: string; detalle: string }[] = [
  { valor: 'claro', nombre: 'Claro', detalle: 'Lino' },
  { valor: 'oscuro', nombre: 'Oscuro', detalle: 'Tueste' },
  { valor: 'sistema', nombre: 'Según el sistema', detalle: 'Sigue a tu ordenador' },
];

/** Preferencia local: la pantalla maneja el mecanismo de #14, sin peticiones al servidor. */
export function AjustesApariencia() {
  const [preferencia, setPreferencia] = useState(preferenciaGuardada);

  function elegirTema(valor: PreferenciaTema) {
    cambiarTema(valor);
    setPreferencia(valor);
  }

  return (
    <section className="tarjeta apariencia" aria-labelledby="titulo-apariencia">
      <div className="apariencia__cabecera">
        <h2 id="titulo-apariencia">Apariencia</h2>
        <p>Solo cambia cómo ves JTM en este navegador.</p>
      </div>
      <fieldset className="apariencia__temas">
        <legend className="sr-only">Tema</legend>
        <div className="apariencia__opciones">
          {OPCIONES.map(({ valor, nombre, detalle }) => (
            <label className="opcion-tema" key={valor}>
              <span className={`opcion-tema__miniatura opcion-tema__miniatura--${valor}`} aria-hidden="true">
                {(valor === 'sistema' ? ['claro', 'oscuro'] : [valor]).map((tono) => (
                  <span className={`opcion-tema__muestra opcion-tema__muestra--${tono}`} key={tono}>
                    <span className="opcion-tema__barra" />
                    <span className="opcion-tema__tarjeta" />
                    <span className="opcion-tema__acento" />
                  </span>
                ))}
              </span>
              <span className="opcion-tema__etiqueta">
                <input
                  type="radio"
                  name="tema"
                  value={valor}
                  checked={preferencia === valor}
                  onChange={() => elegirTema(valor)}
                />
                <span className="opcion-tema__textos">
                  <span className="opcion-tema__nombre">{nombre}</span>
                  <span className="opcion-tema__detalle">{detalle}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
