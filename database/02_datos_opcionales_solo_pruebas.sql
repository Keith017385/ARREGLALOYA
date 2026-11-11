-- OPCIONAL: ejecutar solo en una COPIA de pruebas con permiso INSERT.
-- No hace falta para conectar. No ejecutar automáticamente en la base compartida.
BEGIN;
INSERT INTO arreglalo.categoria(codigo,nombre)
VALUES ('CU01_DEMO_PLOMERIA','Plomería de demostración'),
       ('CU01_DEMO_ELECTRICIDAD','Electricidad de demostración')
ON CONFLICT (codigo) DO NOTHING;
COMMIT;
-- El SELECT del ejemplo es válido aunque esta tabla esté vacía.
