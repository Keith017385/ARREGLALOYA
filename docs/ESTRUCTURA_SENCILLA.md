# Estructura sencilla de ARREGLALOYA

## 1. ¿Por qué aparecen dos veces las carpetas?

Solo debes estudiar **backend/src**: aquí escribes el código TypeScript (`.ts`).
**backend/dist** contiene la versión JavaScript (`.js`) que crea el compilador cuando haces `npm run build`.

```text
backend/
├── src/                         TU CÓDIGO
│   ├── API/                     Recibe las peticiones HTTP
│   ├── SERVICE/                 Ejecuta los casos de uso
│   ├── CORE/                    Reglas y contratos independientes
│   ├── INFRASTRUCTURE/          SQL y acceso a PostgreSQL
│   │   ├── database.module.ts   Registra el servicio compartido
│   │   └── db.service.ts        Crea un solo pool de conexiones
│   ├── app.module.ts            Arma la aplicación
│   └── casos-de-uso.providers.ts Une los services con sus repositorios
└── dist/                        ARCHIVOS GENERADOS; NO EDITAR
    └── ...                      Copia compilada de las carpetas anteriores
```

**La carpeta dist NO es una segunda arquitectura.** VS Code la oculta automáticamente gracias a `.vscode/settings.json` en esta rama. Sigue existiendo cuando se compila, porque Node ejecuta el JavaScript generado.

Para borrarla temporalmente en PowerShell:

```powershell
cd backend
npm run clean
```

Para volver a crearla y verificar el proyecto:

```powershell
npm run build
npm test
```

El comando `build` ahora limpia primero la carpeta `dist` para no dejar archivos compilados antiguos.

## 2. ¿Quién abre la conexión a PostgreSQL?

**Solo `INFRASTRUCTURE/db.service.ts` crea `new Pool(...)`.**

No confundir los cuatro nombres:
- `app.module.ts` = organiza controladores, servicios y módulos. No consulta PostgreSQL.
- `database.module.ts` = registra `DbService` una vez para compartirlo; no abre otra base.
- `db.service.ts` = administra **un pool de conexiones**. El valor `max: 5` permite reutilizar *hasta cinco conexiones físicas*, según la demanda.
- `postgres-categorias.repository.ts`, `postgres-pago-final.repository.ts`, etc. = son distintos **repositorios SQL** que reciben una referencia al mismo pool. No hacen `new Pool()`.

```text
                    DbService
                (un único Pool)
                    /   |   \
                   /    |    \
          Categorías   Pagos  Opiniones
           Repository  Repo   Repository
```

**¿Por qué varios repositorios?** Porque uno busca categorías, otro guarda pagos y otro registra opiniones. Si los mezclas todos en un archivo gigante, romperías la responsabilidad única (S de SOLID). Tener consultas distintas **no equivale** a abrir conexiones nuevas.

## 3. ¿Cómo llega un dato desde Angular hasta PostgreSQL?

```text
HTML de Angular
    ↓
Angular HttpClient: GET /api/categorias
    ↓
API/categorias.controller.ts          → HTTP
    ↓
SERVICE/categorias.service.ts         → caso de uso
    ↓
CORE/categoria.ts                     → contrato del repositorio
    ↓
INFRASTRUCTURE/postgres-categorias.repository.ts → SQL
    ↓
INFRASTRUCTURE/db.service.ts          → pool compartido
    ↓
PostgreSQL
    ↓
JSON de respuesta a Angular
```

El archivo `casos-de-uso.providers.ts` solo configura la **inyección de dependencias**: le dice a NestJS qué repositorio concreto debe recibir cada servicio. No abre una conexión por cada registro.

## 4. Lo que todavía falta

El proyecto tiene casos de uso y pruebas, pero la **autenticación real** y las pruebas de integración sobre una base PostgreSQL accesible siguen pendientes. No presentes el sistema completo como funcional de extremo a extremo si todavía no has probado esos pasos.

**Frase para tu defensa:** «Tenemos cuatro capas en `src`; `dist` es código compilado. La conexión se centraliza en un solo pool de PostgreSQL mediante `DbService`, y los repositorios reutilizan ese pool para realizar consultas distintas».
