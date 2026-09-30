# 0007: El historial de la mentee es una vista agregada en consulta

Con el rediseño «Lino» cada mentee gana un **Historial**: un feed cronológico que reúne sus 1-to-1s, incidencias (abiertas y resueltas), objetivos cerrados, cambios de proyecto y traspasos. Decidimos computarlo **en consulta**, agregando las tablas que ya pertenecen a cada feature (ordenadas por fecha descendente), y **no** introducir una tabla de eventos que se escriba junto a cada operación.

## Opciones consideradas

- **Event store** (`eventos_historial` escrita transaccionalmente por cada servicio): filtrado y paginación triviales, pero duplica datos que ya existen, añade doble escritura a cinco rutas (y el historial puede mentir silenciosamente si una evoluciona y olvida su evento) y es difícil de revertir una vez acumula eventos. Su ventaja real (extensibilidad para exportaciones o notificaciones) está fuera del alcance actual.
- **Vista agregada en consulta** (elegida): una sola fuente de verdad, cero doble escritura y todo el código añadido se usa. Es reversible: si algún día hiciera falta un event store, se puede migrar sin haber corrompido nada.

## Consecuencias

- Nuevas funcionalidades amplían el historial **añadiendo una fuente a la agregación** (más su marcador y copy en el timeline), sin tocar rutas de escritura existentes.
- El filtro por tipo (`?tipo=`) y el orden de eventos del mismo día se resuelven en la agregación con un criterio estable declarado por tipo.
- El coste de la consulta (varias lecturas + mezcla + ordenación) es trivial en SQLite local con fichas de pocas decenas de eventos.
