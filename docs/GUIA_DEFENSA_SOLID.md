# Guía de defensa — SOLID y conexión compartida PostgreSQL

> Alcance: rama `refactor/solid-db-unica`. **main y feature/cu01 a feature/cu05 no fueron modificadas.**
> Esta versión conserva los endpoints y casos de uso existentes, pero la autenticación real y las pruebas con datos PostgreSQL siguen pendientes.

## Idea principal para explicar (30 segundos)

«ARREGLALOYA tiene un frontend Angular 9 y un backend NestJS 11. El usuario interactúa con los componentes HTML. Angular llama a la API mediante HTTP. Un Controller de NestJS valida datos de entrada y delega al Service. El Service aplica la lógica o coordina un caso de uso mediante contratos definidos en CORE. Un Repository en INFRASTRUCTURE ejecuta SQL sobre PostgreSQL. Todos los repositorios reutilizan el mismo Pool de conexiones proporcionado por DbService mediante inyección de dependencias».

## Árbol de carpetas útil (los demás CU siguen en sus carpetas por funcionalidad)

```text
ARREGLALOYA/
├─ frontend/src/
│  ├─ index.html                          ← HTML que inicia Angular
│  └─ app/
│     ├─ app.component.html              ← pantalla principal
│     ├─ app.component.ts                ← lógica de interacción
│     ├─ catalogo/catalogo.service.ts    ← cliente HTTP
│     ├─ modificacion-precio/            ← CU-06 real, sin la demo duplicada
│     └─ ...                             ← otros componentes de casos de uso
├─ backend/src/
│  ├─ main.ts                            ← arranque de NestJS
│  ├─ app.module.ts                      ← agrupa módulos y controladores
│  ├─ casos-de-uso.providers.ts          ← inyección de repositorios/servicios
│  ├─ API/                               ← controllers HTTP
│  ├─ SERVICE/                           ← casos de uso y reglas de negocio
│  ├─ CORE/                              ← contratos y reglas independientes de PostgreSQL
│  └─ INFRASTRUCTURE/
│     ├─ database.module.ts              ← registra DbService una sola vez
│     ├─ db.service.ts                   ← único Pool para la aplicación
│     └─ ...                             ← repositorios que ejecutan SQL
├─ database/                             ← scripts incrementales, NO base completa
├─ docs/
└─ specs/
```

## ¿Se abre una conexión por cada clase Repository?

No. **DbService crea una instancia de `Pool`** para toda la aplicación. Los repositorios reciben una referencia a ese mismo Pool. `max: 5` significa *hasta cinco conexiones físicas disponibles para reutilizar*, no cinco bases ni cinco conexiones permanentes distintas. Un pool puede abrir conexiones cuando sean necesarias y liberar/reutilizarlas.

- `DatabaseModule` registra y exporta DbService, y es global.
- `AppModule` lo importa una sola vez.
- `casos-de-uso.providers.ts` configura qué implementación concreta se inyecta en cada servicio.
- Los repositories pueden llamar `pool.query(...)`; si necesitan varias operaciones en una transacción usan `pool.connect()`, `BEGIN`, `COMMIT` o `ROLLBACK` y liberan el cliente.
- **Nunca** se crea un nuevo `Pool` en cada Controller o Repository.

La base de datos necesita configuración `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` en `backend/.env`; ese archivo privado jamás se sube a GitHub.

## Ruta de una consulta real: catálogo

1. `frontend/src/app/app.component.html` muestra la búsqueda.
2. `frontend/src/app/catalogo/catalogo.service.ts` hace `GET /api/categorias?q=plom`.
3. `backend/src/API/categorias.controller.ts` recibe y valida el parámetro `q`.
4. `backend/src/SERVICE/categorias.service.ts` usa el contrato `CategoriasRepository` del CORE.
5. `backend/src/INFRASTRUCTURE/postgres-categorias.repository.ts` hace el `SELECT` mediante `DbService.pool`.
6. NestJS responde JSON y Angular pinta el resultado.

## SOLID aplicado, sin exagerar

| Principio | Cómo lo mostramos en este proyecto |
| --- | --- |
| **S** — Responsabilidad única | Controller atiende HTTP, Service coordina negocio, Repository guarda y consulta, DbService administra el pool |
| **O** — Abierto/cerrado | Se añade un caso de uso en archivos independientes y se registra su dependencia sin reescribir el catálogo |
| **L** — Sustitución de Liskov | Un repositorio de prueba puede sustituir la implementación PostgreSQL **si respeta el contrato de CORE** |
| **I** — Segregación de interfaces | CORE define contratos concretos como `CategoriasRepository` y `ConsultaComplementoAnticipoRepository`, en lugar de una interfaz gigante |
| **D** — Inversión de dependencias | `CategoriasService` y `ComplementoAnticipoService` reciben contratos; la unión con PostgreSQL se configura en `casos-de-uso.providers.ts` |

**Importante:** aplicar SOLID no significa multiplicar carpetas; tampoco supone que todo el proyecto esté perfecto. Algunas validaciones HTTP están duplicadas y podrían transformarse más adelante en Pipes/Guards cuando exista autenticación real. No las cambiamos ahora para no romper los flujos existentes antes de la defensa.

## ¿Qué eliminamos y qué conservamos?

- Se eliminó la pantalla de **demostración local** de modificación de precio (dos archivos), porque existía una implementación **conectada a la API** y se confundían.
- Se quitó la declaración sobrante de `CandidatosAsistenciaController` en `app.module.ts`.
- Se movió la configuración repetida de dependencias a un archivo dedicado.
- Se añadieron dos servicios/contratos CORE para impedir que los Controllers de anticipo y de candidatos administrativos dependan directamente de PostgreSQL.
- Se conservaron los SQL y las transacciones financieras: no son innecesarios. También se conservaron los trabajadores de demostración de Angular, porque aún alimentan la interfaz.

## Pruebas y ejecución desde PowerShell

```powershell
git fetch origin
git switch --track origin/refactor/solid-db-unica
cd backend
npm ci
npm test
```

Si ya estás en la rama, usa `git pull` en lugar de `git switch --track`.

Para iniciar el backend, configura antes `backend/.env` con credenciales válidas y ejecuta `npm start`. Para el frontend, desde otra terminal en `frontend`, ejecuta `npm ci` y `npm start`. El frontend usa el proxy de Angular de `/api` hacia `127.0.0.1:3000`.

**Versiones Node:** las pruebas automáticas usan Node 22 para NestJS y Node 14 para Angular 9. No asumas que ambos proyectos funcionan con una sola versión de Node instalada. Puedes usar versiones por terminal con un gestor compatible o ejecutar la CI de GitHub.

Las pruebas automatizadas validan TypeScript, lógica y registro de dependencias; **no prueban la base PostgreSQL real ni crean las tablas del proyecto**.

## Tres preguntas probables

**¿Por qué no ponemos SQL en el Controller?** Porque el Controller debería preocuparse de HTTP, no del motor de base de datos. Si el motor cambia, solo sustituimos el adaptador de infraestructura.

**¿Cómo se usa la inyección de dependencias?** NestJS crea e inyecta las clases registradas en sus módulos. En `casos-de-uso.providers.ts` se decide qué repositorio concreto recibirá cada Service; por eso los Services pueden trabajar contra contratos de CORE.

**¿Por qué hay JSON en Angular?** Los `*.json` como `angular.json`, `package.json` y `tsconfig.json` son configuraciones, no bases de datos. JSON también es el formato que intercambian Angular y NestJS por HTTP.
