-- CreateTable
CREATE TABLE "avaliados" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "sexo" TEXT,
    "idade" INTEGER,
    "cor_raca" TEXT,
    "diagnostico_medico" TEXT,
    "tipo_deficiencia" TEXT,
    "funcoes_corporais" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" SERIAL NOT NULL,
    "avaliado_id" INTEGER NOT NULL,
    "especialidade" TEXT NOT NULL,
    "nome_avaliador" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "atividade" TEXT NOT NULL,
    "pontuacao" INTEGER NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avaliacoes_avaliado_id_idx" ON "avaliacoes"("avaliado_id");

-- AddForeignKey
ALTER TABLE "avaliacoes"
ADD CONSTRAINT "avaliacoes_avaliado_id_fkey"
FOREIGN KEY ("avaliado_id") REFERENCES "avaliados"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
