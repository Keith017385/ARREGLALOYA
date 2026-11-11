# Arquitectura
La consulta recorre Angular → API HTTP Nest → SERVICE → contrato CORE → repositorio INFRASTRUCTURE → PostgreSQL.
API conoce el servicio. SERVICE conoce el contrato del repositorio. INFRASTRUCTURE implementa ese contrato. app.module.ts conecta las implementaciones usando la inyección de dependencias de Nest.
Las carpetas se escriben API, CORE, INFRASTRUCTURE y SERVICE. CORE agrupa modelos y contratos. SERVICE implementa casos de uso. API adapta HTTP. INFRASTRUCTURE adapta el almacenamiento.

## Separación entre frontend y backend
Angular se organiza por funcionalidad. catalogo contiene el modelo y la consulta HTTP. trabajadores contiene los perfiles de demostración. Las cuatro capas API, CORE, INFRASTRUCTURE y SERVICE están en el backend de NestJS.

La guía de Angular recomienda agrupar por funcionalidad. Microsoft eShopOnWeb ilustra un núcleo de aplicación separado de la infraestructura y eShop muestra un catálogo con su propia API. Adaptamos esos principios a Angular 9 y NestJS.

- https://angular.dev/style-guide
- https://github.com/dotnet-architecture/eShopOnWeb/wiki/Architecture
- https://github.com/dotnet/eShop

## Aplicación de los documentos de clase
Paradigmas y Principios de Programación, páginas 10 a 19, presenta SOLID, responsabilidad única, inversión de dependencias, KISS y YAGNI. Se aplican mediante clases pequeñas y el contrato CategoriasRepository.
Programación Orientada a IA destaca revisión del código, contexto de proyecto y validación. El código generado se compila y se comprueba contra el catálogo existente.
SDD + MCP propone requirements.md, design.md y tasks.md por funcionalidad. Se documentan en specs/catalogo. MCP se refiere a herramientas de desarrollo y se considera una integración opcional del entorno, sin añadir un servidor MCP al flujo HTTP del catálogo.
Los ejemplos en C++, Python y otros frameworks de los documentos sirven de referencia conceptual. Este proyecto conserva Angular 9, NestJS, TypeScript y PostgreSQL solicitados.
