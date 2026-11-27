BEGIN;

CREATE TABLE IF NOT EXISTS arreglalo.declaracion_anticipo (
  declaracion_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_financiera_id bigint NOT NULL
    REFERENCES arreglalo.solicitud_financiera (solicitud_financiera_id) ON DELETE RESTRICT,
  movimiento_id bigint NOT NULL UNIQUE
    REFERENCES arreglalo.movimiento_financiero (movimiento_id) ON DELETE RESTRICT,
  cliente_id bigint NOT NULL
    REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT,
  referencia text NOT NULL
    CHECK (char_length(btrim(referencia)) BETWEEN 1 AND 160),
  fecha_transferencia timestamptz NOT NULL,
  comprobante_nombre text,
  comprobante_mime text,
  comprobante bytea,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'acreditada', 'rechazada')),
  motivo_revision text,
  revisada_por_id bigint
    REFERENCES arreglalo.usuario (usuario_id) ON DELETE RESTRICT,
  solicitada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  resuelta_en timestamptz,
  CHECK (
    (comprobante IS NULL AND comprobante_nombre IS NULL AND comprobante_mime IS NULL)
    OR (
      comprobante IS NOT NULL
      AND comprobante_nombre IS NOT NULL
      AND comprobante_mime IS NOT NULL
      AND comprobante_mime IN ('application/pdf', 'image/png', 'image/jpeg')
      AND octet_length(comprobante) BETWEEN 5 AND 5242880
    )
  ),
  CHECK (
    (estado = 'pendiente' AND revisada_por_id IS NULL AND resuelta_en IS NULL AND motivo_revision IS NULL)
    OR (estado = 'acreditada' AND revisada_por_id IS NOT NULL AND resuelta_en IS NOT NULL)
    OR (estado = 'rechazada' AND revisada_por_id IS NOT NULL AND resuelta_en IS NOT NULL
      AND motivo_revision IS NOT NULL
      AND char_length(btrim(motivo_revision)) BETWEEN 10 AND 1000)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS declaracion_anticipo_pendiente_uk
  ON arreglalo.declaracion_anticipo (solicitud_financiera_id)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS declaracion_anticipo_bandeja_idx
  ON arreglalo.declaracion_anticipo (solicitada_en, declaracion_id)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS declaracion_anticipo_cliente_idx
  ON arreglalo.declaracion_anticipo (cliente_id, solicitada_en DESC, declaracion_id DESC);

COMMIT;
