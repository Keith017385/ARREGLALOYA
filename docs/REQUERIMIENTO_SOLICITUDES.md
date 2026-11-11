# Revisión del requisito de acceso a solicitudes

Complemento a Definición de Requerimientos V2.2.

- El catálogo se puede explorar como visitante.
- Solo un cliente con sesión válida puede crear o consultar sus solicitudes. La cuenta de PostgreSQL del equipo se usa para desarrollo.
- Al pulsar Solicitar cotización sin sesión, la pantalla pide iniciar sesión y conserva al visitante en su vista. Mi solicitud también pide iniciar sesión.
- Cuando se implemente la operación real, NestJS debe validar la sesión en el servidor antes de leer o escribir solicitudes. Sin sesión válida responde 401. Para una cuenta autenticada sin permiso responde 403. El identificador del cliente se obtiene de la sesión y se verifica la propiedad de cada solicitud.
- Se mantiene la secuencia solicitud, visita y cotización del trabajador. El cliente acepta la cotización antes de continuar con la reserva.

## Estado de implementación
La interfaz ya bloquea las acciones de solicitud del visitante. El backend actual solo publica la consulta de categorías. El inicio de sesión real y las rutas privadas de solicitudes quedan pendientes de implementación conjunta.

## Criterios de aceptación
1. Una visita anónima puede buscar una categoría.
2. El botón Solicitar cotización y la acción desde Ver perfil muestran el aviso de sesión.
3. Mi solicitud muestra el requisito de autenticación.
4. Al incorporar la API de solicitudes, probar acceso anónimo, sesión inválida y acceso a solicitudes de otro cliente antes de habilitar la función.

Referencia de implementación: https://docs.nestjs.com/security/authentication
