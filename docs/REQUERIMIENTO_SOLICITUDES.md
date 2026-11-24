# Revisión del requisito de acceso a solicitudes

Complemento a Definición de Requerimientos V2.2.

- El catálogo se puede explorar como visitante.
- Solo un cliente con sesión válida debe poder crear o consultar sus solicitudes.
- Al pulsar Solicitar cotización sin sesión, la pantalla pide iniciar sesión.
- NestJS debe validar la sesión en el servidor antes de leer o escribir solicitudes: 401 sin sesión, 403 cuando el usuario autenticado no tenga permiso. El identificador del cliente debe obtenerse de la sesión, no de un campo arbitrario del navegador.
- Se mantiene la secuencia solicitud, visita y cotización del trabajador. El cliente acepta la cotización antes de continuar con la reserva.

## Estado después de integrar casos de uso

El catálogo público está conectado a la API. Se integraron rutas, servicios, repositorios e interfaces de los CU-06, CU-07, CU-08, CU-09, CU-10, CU-11, CU-18, CU-19, CU-20, CU-21 y CU-25.

**Pendiente:** inicio de sesión real, middleware/guard que adjunte `request.user.usuarioId`, rutas privadas de creación/consulta de solicitudes y validación extremo a extremo sobre una base de prueba. Las operaciones protegidas retornan 401 sin autenticación. Que un caso compile no garantiza que esté disponible al visitante.

## Criterios de aceptación pendientes

1. Un visitante anónimo puede buscar una categoría.
2. Las acciones de solicitud exigen iniciar sesión.
3. API protegida rechaza sesiones ausentes o inválidas.
4. Las solicitudes ajenas responden 403 o 404, según reglas de privacidad.
5. Un cliente autenticado puede completar el flujo solicitud, visita, cotización y reserva.
6. Los CU posteriores funcionan con el mismo usuario real, estados y registros de PostgreSQL.

Referencia: https://docs.nestjs.com/security/authentication
