# ARREGLALOYA

Plataforma web de servicios para el hogar. Estructura: Angular 9 (frontend), NestJS 11 + TypeScript (backend) y PostgreSQL (base de datos).

## Clonar el proyecto

```bash
git clone https://github.com/Keith017385/ARREGLALOYA.git
cd ARREGLALOYA
```

La rama de integración es `integracion/requerimientos-v23`. Las ramas `feature/cu*` contienen los cambios de cada caso sobre sus dependencias.

## Preparar PostgreSQL

En una base de desarrollo vacía, instala primero `01_esquema.sql` y `02_reglas_y_operaciones.sql` del proyecto de base de datos Arréglalo Ya. Luego ejecuta las migraciones del repositorio en el siguiente orden:

- `03_discrepancia_pago_directo.sql`
- `05_resolucion_discrepancia_pago.sql`
- `06_auditoria_incidentes_sanciones.sql`
- `07_gestion_revision_asistencia.sql`
- `08_seleccion_trabajador.sql`
- `09_documento_desembolso.sql`
- `10_historial_perfil.sql`
- `11_historial_solicitud.sql`
- `12_sesion_http.sql`

En desarrollo local, las sesiones se guardan en memoria y se reinician al detener el backend. En producción, aplica `12_sesion_http.sql` antes de iniciar el servicio y otorga al usuario del backend permisos sobre esa tabla; configura un `SESSION_SECRET` aleatorio de al menos 32 caracteres. En una base compartida, el propietario debe aplicar solo las migraciones pendientes y otorgar los permisos de acceso correspondientes. Las zonas se cargan por entorno y deben existir para publicar solicitudes. Las cuentas nuevas reciben el rol cliente; la administración de la base debe asignar los demás roles.

## Ejecutar el backend

Requiere Node.js 22 y acceso a la base PostgreSQL del equipo.

```bash
cd backend
cp .env.example .env
# Editar .env con credenciales propias y conexión PostgreSQL válida.
npm ci
npm run build
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
npm run build
npm start
```

Abrir `http://127.0.0.1:4200/`. El proxy `frontend/proxy.conf.json` reenvía las solicitudes `/api` al backend local. Ejecutar frontend y backend en dos terminales.

Las credenciales ficticias para probar los cuatro roles y el comando de carga local están en [docs/CUENTAS_DEMO.md](docs/CUENTAS_DEMO.md). El seed solo permite una base PostgreSQL local y requiere habilitarse explícitamente.

## Casos de uso incorporados

- CU-01 a CU-05: cuenta y perfil, solicitud, selección directa, decisión sobre cotizaciones y registro del anticipo pendiente.
- CU-06 a CU-11: cambio de precio, inicio y finalización, pago final, calificación, reclamo y asistencia.
- CU-12 a CU-17: perfil y documentos del trabajador, ofertas y visitas, cancelación del trabajador, revisión de documentos y reclamos.
- CU-18 a CU-25: discrepancias, sanciones, escalamiento de asistencia, cancelación del cliente, solicitud y aprobación de desembolso, suspensión y respuesta a opiniones.

El menú **Mi cuenta** muestra las opciones según los roles de la sesión. Los perfiles seleccionables en CU-03 requieren coincidencia con la zona y todas las categorías de la solicitud y aprobación vigente de carnet y certificado.

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

- **Cobro del anticipo (CU-05).** El sistema calcula los importes y registra la reserva pendiente. La integración con un medio de cobro queda pendiente de su elección. PostgreSQL cambia el estado al conciliar una acreditación.
- **Casos escalados (CU-20).** La implementación cubre revisiones de asistencia. Los demás tipos de escalamiento y sus reglas administrativas quedan pendientes.
- **Documentación.** CU-13 registra una referencia al documento y CU-16 registra la decisión. Los criterios definitivos de aprobación y subsanación quedan sujetos a la definición del equipo.
- **Integración.** La suite de CI comprueba compilación y pruebas unitarias. Las operaciones con datos requieren un entorno PostgreSQL con el esquema y las migraciones anteriores.

## Arquitectura

**¿Por qué aparecen `src` y `dist` y cómo se comparte PostgreSQL?** Consulta [Estructura sencilla para la defensa](docs/ESTRUCTURA_SENCILLA.md).

Para revisar la propuesta de refactorización SOLID sin afectar `main`, abrir la rama [refactor/solid-db-unica](https://github.com/Keith017385/ARREGLALOYA/tree/refactor/solid-db-unica) y leer [la guía para la defensa](docs/GUIA_DEFENSA_SOLID.md) en dicha rama.


Consultar [docs/architecture.md](docs/architecture.md), [docs/REQUERIMIENTO_SOLICITUDES.md](docs/REQUERIMIENTO_SOLICITUDES.md) y `specs/`.

Existe una rama de respaldo de `main` anterior a esta integración: `backup/main-pre-integracion-2026-11-23`.
