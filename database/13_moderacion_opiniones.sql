
BEGIN;
CREATE TABLE IF NOT EXISTS arreglalo.reporte_opinion (
 reporte_id bigserial PRIMARY KEY,
 calificacion_id bigint NOT NULL REFERENCES arreglalo.calificacion(calificacion_id),
 reportante_id bigint NOT NULL REFERENCES arreglalo.usuario(usuario_id),
 motivo text NOT NULL CHECK (length(trim(motivo)) BETWEEN 1 AND 2000),
 estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_revision','resuelto')),
 creado_en timestamptz NOT NULL DEFAULT now(),
 responsable_id bigint REFERENCES arreglalo.usuario(usuario_id),
 decision text CHECK (decision IN ('conservar','invalidar')),
 fundamento text,
 resuelto_en timestamptz,
 UNIQUE(calificacion_id, reportante_id),
 CHECK ((estado = 'resuelto') = (decision IS NOT NULL AND fundamento IS NOT NULL AND resuelto_en IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS arreglalo.opinion_invalidada (
 calificacion_id bigint PRIMARY KEY REFERENCES arreglalo.calificacion(calificacion_id),
 reporte_id bigint NOT NULL REFERENCES arreglalo.reporte_opinion(reporte_id)
);
-- La vista deriva siempre la reputación de la última versión válida.
CREATE OR REPLACE VIEW arreglalo.v_reputacion_moderada AS
SELECT vc.trabajador_id, count(*)::integer AS cantidad, avg(v.puntuacion) AS promedio
FROM arreglalo.calificacion c
JOIN arreglalo.v_contratacion vc USING (reserva_id)
JOIN LATERAL (SELECT puntuacion FROM arreglalo.version_calificacion
 WHERE calificacion_id=c.calificacion_id ORDER BY version DESC LIMIT 1) v ON true
WHERE NOT EXISTS (SELECT 1 FROM arreglalo.opinion_invalidada i WHERE i.calificacion_id=c.calificacion_id)
GROUP BY vc.trabajador_id;
COMMIT;
