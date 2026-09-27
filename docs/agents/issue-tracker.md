# Issue tracker: GitHub

Las tareas y especificaciones de este repo viven como issues de GitHub. Usa la CLI `gh` para todas las operaciones.

## Convenciones

- **Crear un issue**: `gh issue create --title "..." --body "..."`. Usa un heredoc para cuerpos multilínea.
- **Leer un issue**: `gh issue view <number> --comments`, filtrando los comentarios con `jq` y obteniendo también las etiquetas.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` con los filtros `--label` y `--state` adecuados.
- **Comentar un issue**: `gh issue comment <number> --body "..."`
- **Añadir / quitar etiquetas**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Cerrar**: `gh issue close <number> --comment "..."`

Infiere el repo a partir de `git remote -v`; `gh` lo hace automáticamente dentro de un clon.

## Pull requests como superficie de triage

**PRs as a request surface: no.** _(Ponlo a `yes` si este repo trata los PRs externos como feature requests; `/triage` lee este flag.)_

Si se pone a `yes`, los PRs pasan por las mismas etiquetas y estados que los issues, usando los equivalentes de `gh pr`:

- **Leer un PR**: `gh pr view <number> --comments` y `gh pr diff <number>` para el diff.
- **Listar PRs externos para triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` y conserva solo los de `authorAssociation` `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` o `NONE` (descarta `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comentar / etiquetar / cerrar**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub comparte un único espacio de números entre issues y PRs: un `#42` puede ser cualquiera de los dos; resuélvelo con `gh pr view 42` y, si falla, `gh issue view 42`.

## Cuando una skill diga "publicar en el issue tracker"

Crea un issue de GitHub.

## Cuando una skill diga "obtener el ticket relevante"

Ejecuta `gh issue view <number> --comments`.
