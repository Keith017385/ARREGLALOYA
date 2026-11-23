BEGIN;

CREATE TABLE arreglalo.gestion_revision_asistencia (
    respuesta_asistencia_id bigint PRIMARY KEY
        REFERENCES arreglalo.respuesta_asistencia (respuesta_asistencia_id)
        ON DELETE RESTRICT,
    escalada_en timestamptz,
    resuelta_en timestamptz,
    responsable_id bigint
        REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT,
    resolucion text,

    CONSTRAINT gestion_revision_asistencia_resolucion_ck
        CHECK (
            (resuelta_en IS NULL AND responsable_id IS NULL AND resolucion IS NULL)
            OR
            (resuelta_en IS NOT NULL AND responsable_id IS NOT NULL
             AND resolucion IS NOT NULL
             AND char_length(btrim(resolucion)) BETWEEN 1 AND 2000)
        ),

    CONSTRAINT gestion_revision_asistencia_orden_ck
        CHECK (
            escalada_en IS NULL
            OR resuelta_en IS NULL
            OR resuelta_en >= escalada_en
        )
);

COMMIT;
