BEGIN;

CREATE TABLE IF NOT EXISTS arreglalo.apelacion_sancion (
    apelacion_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sancion_id bigint NOT NULL
        REFERENCES arreglalo.sancion (sancion_id) ON DELETE RESTRICT,
    solicitada_por_id bigint NOT NULL
        REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT,
    justificacion text NOT NULL
        CHECK (char_length(btrim(justificacion)) BETWEEN 20 AND 3000),
    estado text NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    solicitada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX IF NOT EXISTS apelacion_sancion_pendiente_uk
    ON arreglalo.apelacion_sancion (sancion_id)
    WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS apelacion_sancion_pendientes_idx
    ON arreglalo.apelacion_sancion (solicitada_en DESC, apelacion_id DESC)
    WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS apelacion_sancion_por_solicitante_idx
    ON arreglalo.apelacion_sancion (solicitada_por_id, solicitada_en DESC, apelacion_id DESC);

CREATE TABLE IF NOT EXISTS arreglalo.evidencia_apelacion (
    evidencia_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    apelacion_id bigint NOT NULL
        REFERENCES arreglalo.apelacion_sancion (apelacion_id) ON DELETE RESTRICT,
    nombre_archivo text NOT NULL
        CHECK (char_length(btrim(nombre_archivo)) BETWEEN 1 AND 180),
    contenido bytea NOT NULL
        CHECK (octet_length(contenido) BETWEEN 5 AND 5242880),
    cargada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS evidencia_apelacion_por_solicitud_idx
    ON arreglalo.evidencia_apelacion (apelacion_id, evidencia_id);

CREATE TABLE IF NOT EXISTS arreglalo.historial_decision_apelacion (
    decision_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    apelacion_id bigint NOT NULL
        REFERENCES arreglalo.apelacion_sancion (apelacion_id) ON DELETE RESTRICT,
    decision text NOT NULL
        CHECK (decision IN ('aprobada', 'rechazada')),
    fundamento text NOT NULL
        CHECK (char_length(btrim(fundamento)) BETWEEN 10 AND 2000),
    decidida_por_id bigint NOT NULL
        REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT,
    decidida_en timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS historial_decision_apelacion_idx
    ON arreglalo.historial_decision_apelacion (apelacion_id, decidida_en DESC, decision_id DESC);

COMMIT;