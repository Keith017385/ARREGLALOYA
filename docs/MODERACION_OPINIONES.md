
# Moderación de opiniones

Implementación del enunciado de examen en feature/rebeca-martinez.

## Preparación
Aplicar database/13_moderacion_opiniones.sql en una base de pruebas con el esquema del proyecto antes de iniciar la versión nueva del backend. La migración agrega reportes, invalidaciones y una vista de reputación. Conserva calificaciones y versiones originales.

## Demostración
1. Iniciar sesión como cliente o trabajador participante de una reserva calificada.
2. Abrir /?opinionCalificacion=ID y enviar el motivo del reporte.
3. Iniciar sesión como administrador activo y abrir Opiniones en el panel administrativo, o /?vista=moderacion-opiniones.
4. Iniciar la revisión y registrar conservar o invalidar con su fundamento.
5. Verificar el promedio y la cantidad de calificaciones válidas en el reporte. Una opinión invalidada deja de estar disponible en la consulta ordinaria y no admite nuevas respuestas.

## Reglas adoptadas
El enunciado amplía el documento de requerimientos. Se permite reportar a participantes activos, una vez por usuario y calificación. La resolución requiere rol administrador, revisión previa y fundamento de hasta 2000 caracteres. El promedio usa la última versión de cada calificación válida. Si no hay calificaciones válidas devuelve null y cantidad cero. No se aplican sanciones automáticas.

Los reportes se consultan con su estado, autor administrativo, decisión y fechas. Las resoluciones se guardan en una transacción con bloqueo de reporte y calificación. La invalidación es definitiva dentro de este flujo. Otros reportes de la misma opinión conservan su historial y no pueden restaurarla mediante una decisión de conservar.

## API
- POST /api/calificaciones/:id/reportes con motivo.
- GET /api/administracion/reportes-opiniones devuelve los últimos 200 reportes.
- POST /api/administracion/reportes-opiniones/:id/revision.
- POST /api/administracion/reportes-opiniones/:id/resolucion con decision y fundamento.
- GET /api/trabajadores/:id/reputacion devuelve trabajadorId, cantidad y promedio.

## Verificación
npm test en backend. npm run build en frontend con Node compatible con Angular 9.
Las pruebas unitarias verifican validación, permisos, transiciones, conservación, invalidación y rollback. La prueba contra PostgreSQL real requiere una base de pruebas configurada con el esquema previo del equipo.
