# Arréglalo Ya
Proyecto Angular 9 y NestJS organizado por responsabilidades. Abrir esta carpeta completa en Visual Studio Code.

## Ubicación del código
- frontend/src/app/catalogo contiene la consulta HTTP y el modelo del catálogo.
- frontend/src/app/trabajadores contiene los perfiles de demostración.
- backend/src/API recibe peticiones y valida entradas.
- backend/src/CORE define el modelo de categoría y el contrato del repositorio.
- backend/src/SERVICE ejecuta el caso de uso mediante el contrato.
- backend/src/INFRASTRUCTURE implementa PostgreSQL, SQL parametrizado y conexión.
- database contiene los SQL de comprobación y datos opcionales de pruebas.
- docs explica la arquitectura. specs documenta requisitos, diseño y tareas.

## Ejecutar
En backend usar Node 24. Configurar las variables que figuran en .env.example con tu cuenta personal. Para la titular PGUSER=ay_titular. Si usas un archivo de entorno privado fuera de OneDrive, indicar su ruta con DOTENV_CONFIG_PATH. Ejecutar npm.cmd test y después npm.cmd start. En una copia nueva, ejecutar npm.cmd ci primero.
En otra terminal, usar Node 12.22.12 portátil para Angular 9. Dentro de frontend ejecutar npm.cmd start. En una copia nueva, ejecutar npm.cmd ci primero. Abrir http://127.0.0.1:4200 . La API usa http://127.0.0.1:3000/api/categorias.
La base existente es ARREGLALOYA, esquema arreglalo. El catálogo consume sus categorías reales. Los perfiles son ejemplos visuales. Solicitar una cotización o abrir solicitudes requiere iniciar sesión. Autenticación, contacto y reservas reales requieren sus casos de uso.

La imagen de referencia nueva define el diseño de la aplicación en morado y tipografía sans serif. La guía documental anterior conserva su formato propio.

## Recorrido para estudiar el código
1. Buscar plomer en Inicio. app.component.html recoge la entrada y app.component.ts abre Servicios.
2. El servicio del frontend y el cliente HTTP piden las coincidencias a /api/categorias.
3. El controlador de API valida el texto y llama al servicio de NestJS.
4. El servicio invoca el repositorio definido en CORE. INFRASTRUCTURE ejecuta el SELECT en PostgreSQL.
5. La respuesta JSON vuelve a Angular y se muestra la tarjeta Plomería.
6. Abrir una tarjeta para ver perfiles de ejemplo. Solicitar cotización muestra el requisito de iniciar sesión.

Consulta docs/architecture.md para la relación entre carpetas y specs/catalogo/tasks.md para las pruebas realizadas.
