#!/usr/bin/env bash
set -euo pipefail

CSV="/import/ktb_pcdata.csv"

echo ">> seed: start import-script"
echo "DB=${POSTGRES_DB} USER=${POSTGRES_USER}"

# (optioneel) sneller importeren binnen deze sessie
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SET synchronous_commit = OFF;"

if [[ -f "$CSV" ]]; then
  echo ">> seed: CSV gevonden: $CSV"
  # COPY FROM client (binnen container) => pad moet binnen container bestaan
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
    "\copy public.ktb_pcdata FROM '$CSV' WITH (FORMAT csv, HEADER, DELIMITER ',', QUOTE '\"', ESCAPE '\"', NULL '')"
else
  echo ">> seed: GEEN CSV gevonden op $CSV — sla import over"
fi

echo ">> seed: indexen aanmaken"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE INDEX IF NOT EXISTS idx_pcdata_nummeraand ON public.ktb_pcdata(bag_nummeraanduidingid);
CREATE INDEX IF NOT EXISTS idx_pcdata_abo         ON public.ktb_pcdata(bag_adresseerbaarobjectid);
CREATE INDEX IF NOT EXISTS idx_pcdata_postcode    ON public.ktb_pcdata(wijkcode, lettercombinatie, huisnr);
CREATE INDEX IF NOT EXISTS idx_pcdata_straatnaam  ON public.ktb_pcdata(straatnaam);
CREATE INDEX IF NOT EXISTS idx_pcdata_plaatsnaam  ON public.ktb_pcdata(plaatsnaam);
ANALYZE public.ktb_pcdata;
SQL

echo ">> seed: klaar"

