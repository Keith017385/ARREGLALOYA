-- Ejecutar conectado a ARREGLALOYA con tu cuenta personal.
-- Confirma servidor, base y usuario que usa esta sesión.
SELECT current_database() AS base, session_user AS usuario_conectado,
       current_user AS rol_actual, inet_server_port() AS puerto;
-- Confirma si puedes consultar el catálogo.
SELECT has_table_privilege(current_user, 'arreglalo.categoria', 'SELECT') AS puede_consultar;
-- Consulta de solo lectura: no cambia estructura ni datos.
SELECT categoria_id::text AS id, codigo, nombre
FROM arreglalo.categoria ORDER BY nombre, categoria_id LIMIT 100;
