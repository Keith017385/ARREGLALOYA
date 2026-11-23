BEGIN;

CREATE TABLE arreglalo.resolucion_discrepancia_pago (
    resolucion_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pago_directo_id bigint NOT NULL
        REFERENCES arreglalo.pago_directo (pago_directo_id) ON DELETE RESTRICT,
    responsable_id bigint NOT NULL
        REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT,
    resultado text NOT NULL,
    motivo text NOT NULL,
    resuelta_en timestamptz NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT resolucion_discrepancia_pago_pago_uk
        UNIQUE (pago_directo_id),

    CONSTRAINT resolucion_discrepancia_pago_resultado_ck
        CHECK (resultado IN ('pago_acreditado', 'pago_no_acreditado')),

    CONSTRAINT resolucion_discrepancia_pago_motivo_ck
        CHECK (char_length(btrim(motivo)) BETWEEN 1 AND 2000)
);

CREATE TRIGGER validar_responsable_resolucion_pago
BEFORE INSERT ON arreglalo.resolucion_discrepancia_pago
FOR EACH ROW
EXECUTE FUNCTION arreglalo.validar_actor_administrativo();

CREATE TRIGGER historico_inmutable
BEFORE UPDATE OR DELETE ON arreglalo.resolucion_discrepancia_pago
FOR EACH ROW
EXECUTE FUNCTION arreglalo.impedir_cambio_historico();

COMMIT;
