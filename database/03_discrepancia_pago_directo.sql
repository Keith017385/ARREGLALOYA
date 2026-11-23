BEGIN;

CREATE TABLE arreglalo.discrepancia_pago_directo (
    discrepancia_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pago_directo_id bigint NOT NULL
        REFERENCES arreglalo.pago_directo (pago_directo_id) ON DELETE RESTRICT,
    solicitante_id bigint NOT NULL
        REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT,
    importe_reportado numeric(18, 2),
    declaracion text NOT NULL,
    solicitada_en timestamptz NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT discrepancia_pago_directo_solicitante_uk
        UNIQUE (pago_directo_id, solicitante_id),

    CONSTRAINT discrepancia_pago_directo_importe_ck
        CHECK (importe_reportado >= 0),

    CONSTRAINT discrepancia_pago_directo_declaracion_ck
        CHECK (char_length(btrim(declaracion)) BETWEEN 1 AND 2000)
);

COMMIT;