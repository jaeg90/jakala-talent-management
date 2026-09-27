# 0001: TypeScript en todo el stack, con Express como esqueleto del backend

El máster exige Stryker (mutation testing), Playwright (E2E) y SonarQube, herramientas que viven nativamente en el ecosistema JavaScript/TypeScript; además el autor del TFM ya conoce JavaScript. Se decide: **TypeScript en todo el stack**.

Para el backend se elige **Express con estructura hexagonal explícita** (carpetas de dominio, aplicación e infraestructura visibles y sin "magia") frente a NestJS, porque hace cada línea explicable en la memoria del TFM y evita ocultar conceptos (decorators, inyección de dependencias opaca) a un lector no desarrollador.

## Opciones consideradas

- **NestJS**: encaja bien con la arquitectura hexagonal por su inyección de dependencias, pero añade una capa de conceptos ocultos difícil de explicar línea a línea. Descartado.
- **Python/FastAPI**: Stryker no vive en su ecosistema; habría que sustituir la herramienta de mutation testing exigida. Descartado.

## Resto del combo

React + Vite en el frontend, SQLite como base de datos (un archivo, sin servidores que instalar), Vitest como framework de tests.
