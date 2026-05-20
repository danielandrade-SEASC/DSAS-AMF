-- Reset e criação do schema IF-BrA completo para Cloudflare D1
DROP TABLE IF EXISTS "avaliacoes";
DROP TABLE IF EXISTS "avaliacao_sessoes";
DROP TABLE IF EXISTS "avaliados";

CREATE TABLE "avaliados" (
    "id"                           INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome"                         TEXT NOT NULL,
    "nis_nit"                      TEXT,
    "sexo"                         TEXT,
    "idade"                        INTEGER,
    "cor_raca"                     TEXT,
    "cid_causa"                    TEXT,
    "cid_sequela"                  TEXT,
    "sem_diagnostico_etiologico"   INTEGER NOT NULL DEFAULT 0,
    "tipo_impedimento"             TEXT,
    "data_inicio_impedimento"      TEXT,
    "data_alteracao_impedimento"   TEXT,
    "funcoes_corporais"            TEXT,
    "historia_clinica"             TEXT,
    "historia_social"              TEXT,
    "data_avaliacao"               TEXT,
    "local_avaliacao"              TEXT,
    "codigo_aps"                   TEXT,
    "fuzzy_surdez_antes_6anos"     INTEGER NOT NULL DEFAULT 0,
    "fuzzy_nao_pode_sozinho"       INTEGER NOT NULL DEFAULT 0,
    "fuzzy_cadeira_rodas"          INTEGER NOT NULL DEFAULT 0,
    "fuzzy_cego_ao_nascer"         INTEGER NOT NULL DEFAULT 0,
    "created_at"                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "avaliacao_sessoes" (
    "id"               INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "avaliado_id"      INTEGER NOT NULL,
    "especialidade"    TEXT NOT NULL,
    "nome_avaliador"   TEXT NOT NULL,
    "siape"            TEXT,
    "quem_informou"    TEXT,
    "quem_informou_id" TEXT,
    "created_at"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("avaliado_id") REFERENCES "avaliados"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "avaliacoes" (
    "id"             INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "avaliado_id"    INTEGER NOT NULL,
    "especialidade"  TEXT NOT NULL,
    "nome_avaliador" TEXT NOT NULL,
    "dominio"        TEXT NOT NULL,
    "atividade"      TEXT NOT NULL,
    "pontuacao"      INTEGER NOT NULL,
    "barreira_pt"    INTEGER NOT NULL DEFAULT 0,
    "barreira_amb"   INTEGER NOT NULL DEFAULT 0,
    "barreira_ar"    INTEGER NOT NULL DEFAULT 0,
    "barreira_at"    INTEGER NOT NULL DEFAULT 0,
    "barreira_ssp"   INTEGER NOT NULL DEFAULT 0,
    "observacao"     TEXT,
    "created_at"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("avaliado_id") REFERENCES "avaliados"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "avaliacoes_avaliado_id_idx" ON "avaliacoes"("avaliado_id");
CREATE INDEX IF NOT EXISTS "sessoes_avaliado_id_idx" ON "avaliacao_sessoes"("avaliado_id");
