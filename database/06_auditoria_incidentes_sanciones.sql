BEGIN;

ALTER TABLE arreglalo.incidente
    ADD COLUMN registrado_por_id bigint
        REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT,
    ADD COLUMN confirmado_por_id bigint
        REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT,
    ADD CONSTRAINT incidente_confirmacion_responsable_ck
        CHECK (confirmado_por_id IS NULL OR confirmado_en IS NOT NULL);

ALTER TABLE arreglalo.sancion
    ADD COLUMN aplicada_por_id bigint
        REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT;

COMMIT;
