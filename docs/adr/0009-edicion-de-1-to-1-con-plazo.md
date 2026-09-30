# 0009: Los 1-to-1 son editables durante 7 días por quien los registró

Un 1-to-1 registrado deja de ser inmutable. Se identifica por **id**, no por fecha (puede haber varios el mismo día), y guarda quién lo registró y cuándo (`registradoPor`, `registradoEn`). Puede **editarse** —notas y acuerdos pendientes: reescribir, añadir, quitar— solo por el manager que lo registró y durante **7 días naturales** desde el momento del registro. La fecha y los acuerdos ya cumplidos no se tocan; marcar un acuerdo cumplido sigue disponible siempre y no cuenta como edición. Cada edición deja constancia en «Cambios» (autor, fecha y diff antes/después) y genera un evento «1-to-1 editado» en el Historial.

## Opciones consideradas

- **Registro inmutable** (coherente con traspasos y objetivos cerrados): simple y honesto con el pasado, pero obliga a re-registrar un 1-to-1 entero por un typo, y el registro duplicado contamina la cronología.
- **Edición libre** (sin plazo ni restricción de autor): máximo confort, pero permite reescribir la historia tarde y sin rastro, rompe la fiabilidad del historial como registro de conversación y complica el traspaso (el nuevo manager podría alterar lo que registró el anterior).
- **Edición acotada por plazo y autor** (elegida): corrige errores de transcripción reciente sin permitir reescribir el pasado; el diff hace visible toda intervención.

## Consecuencias

- El servidor valida plazo y autor: rechaza ediciones fuera de ventana o de otro manager (la UI lo comunica con el botón deshabilitado y su motivo; el envío tardío conserva lo escrito para poder copiarlo).
- Nueva entidad `EdiciónDe1to1 {1-to-1, autor, fecha, cambios tipados (nota de tema | acuerdo) × (reescrito | añadido | quitado), antes, después}`.
- La URL del detalle pasa de `:fecha` a `:unoAUnoId` (`/mentees/:id/1-to-1s/:unoAUnoId`); el modo edición vive en la misma URL.
- El Historial (ADR-0007) amplía la agregación con «1-to-1 del {fecha} editado» dentro del filtro «1-to-1s».
- Las reglas de dominio de 1-to-1s ganan validación de ventana: `registradoEn` + 7 días naturales, calculado sobre el registro original (las ediciones no renuevan el plazo).
