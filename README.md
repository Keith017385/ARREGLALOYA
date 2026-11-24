# ARREGLALOYA

Plataforma web de servicios para el hogar. Estructura: Angular 9 (frontend), NestJS 11 + TypeScript (backend) y PostgreSQL (base de datos).

## Clonar el proyecto

```bash
git clone https://github.com/Keith017385/ARREGLALOYA.git
cd ARREGLALOYA
```

La rama predeterminada es `main`. Todas las funciones CU-06, CU-07, CU-08, CU-09, CU-10, CU-11, CU-18, CU-19, CU-20, CU-21 y CU-25 están reunidas en el mismo árbol de código.

## Ejecutar el backend

Requiere Node.js 22 y acceso a la base PostgreSQL del equipo.

```bash
cd backend
cp .env.example .env
# Editar .env con credenciales propias y conexión PostgreSQL válida.
npm ci
npm test
npm start
```

API local: `http://127.0.0.1:3000/api/`.

**Nunca subir `.env` ni contraseñas al repositorio.** El acceso a una base compartida puede requerir conexión privada/VPN. Los archivos `database/*.sql` son comprobaciones y migraciones incrementales, **no un esquema completo desde cero**; revise las dependencias antes de aplicarlos a una base real.

## Ejecutar el frontend

Angular 9 requiere un Node.js compatible; la CI utiliza Node 14 para compilarlo.

```bash
cd frontend
npm ci
npm start
```

Abrir `http://127.0.0.1:4200/`. El proxy `frontend/proxy.conf.json` reenvía las solicitudes `/api` al backend local. Ejecutar frontend y backend en dos terminales.

## Casos de uso incorporados

| CU | Funcionalidad |
| --- | --- |
| 06 | Modificación de precio y decisión del cliente |
| 07 | Emisión de código y confirmación de finalización |
| 08 | Pago final y solicitud de revisión |
| 09 | Calificación y opinión |
| 10 | Reclamo formal |
| 11 | Declaración/revisión de asistencia |
| 18 | Resolución de discrepancias de pago |
| 19 | Incidentes y sanciones |
| 20 | Escalamiento de revisiones de asistencia |
| 21 | Cancelación del cliente y avisos |
| 25 | Respuesta del trabajador a una opinión |

Para verificar la interfaz de cada caso de uso se aceptan parámetros de URL:
- `?modificarReserva=5` (CU-06)
- `?finalizarReserva=5&rol=trabajador` o `?finalizarReserva=5&rol=cliente` (CU-07)
- `?reserva=5` (CU-08)
- `?calificarReserva=5` (CU-09)
- `?reclamoReserva=5` (CU-10)
- `?asistenciaReserva=5` (CU-11)
- `?revisionPagos=1` (CU-18)
- `?incidentes=1` (CU-19)
- `?revisionesAsistencia=1` o `?candidatosAsistencia=1` (CU-20)
- `?cancelarReserva=5` o `?avisosCancelacion=1` (CU-21)
- `?opinionCalificacion=5` (CU-25)

Los ID anteriores son **ejemplos de navegación**, no registros existentes. Los roles en parámetros solo controlan la presentación; las operaciones deben autorizarse en el servidor.

## Validación automática

GitHub Actions ejecuta `npm test` en `backend` (compilación TypeScript y pruebas Node) y `npm run build` en `frontend`. Ver pestaña *Actions* para resultados actualizados.

## Limitaciones conocidas

- **Autenticación todavía pendiente:** los controladores privados esperan `request.user.usuarioId`, pero el backend no dispone de una estrategia o middleware integrado que lo establezca. Sin sesión auténtica devuelven 401. No se debe simular la identidad del usuario en producción.
- **Alta, inicio de sesión y creación de solicitudes** aún no están implementados como flujo completo; el catálogo es público.
- **PostgreSQL no se valida con la CI actual:** los tests son unitarios y requieren pruebas de integración posteriores contra una base de pruebas controlada. Hay dependencias de tablas y vistas que no se crean con los scripts aquí incluidos.
- Los accesos directos a las pantallas de los CU sirven para revisión técnica mientras se desarrolla navegación basada en sesiones, reservas y roles.
- La fusión de ramas resuelve conflictos de archivos, pero **no equivale** a certificar un funcionamiento extremo a extremo con usuarios y base real.

## Arquitectura

Consultar [docs/architecture.md](docs/architecture.md), [docs/REQUERIMIENTO_SOLICITUDES.md](docs/REQUERIMIENTO_SOLICITUDES.md) y `specs/`.

Existe una rama de respaldo de `main` anterior a esta integración: `backup/main-pre-integracion-2026-11-23`.
