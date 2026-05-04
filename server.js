const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { sql } = require('@vercel/postgres');
const { neon } = require('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL)

let prisma;
try {
  prisma = new PrismaClient();
  console.log('PrismaClient instanciado.');
} catch (e) {
  console.error('Falha ao instanciar PrismaClient:', e);
}

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = process.env.VERCEL === '1';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const especialidades = ['Médico', 'Psicólogo', 'Assistente Social'];

const dominios = [
  {
    nome: 'Aprendizagem e Aplicação de Conhecimento',
    codigo: 'AAC',
    atividades: [
      'Concentração e atenção', 'Pensamento', 'Memória', 'Aprendizagem prática',
      'Aprendizagem formal', 'Solução de problemas', 'Tomada de decisão',
      'Orientação temporal', 'Orientação espacial'
    ]
  },
  {
    nome: 'Comunicação',
    codigo: 'COM',
    atividades: [
      'Comunicação receptiva', 'Comunicação expressiva', 'Linguagem falada',
      'Linguagem gestual', 'Linguagem escrita', 'Leitura',
      'Uso de tecnologia assistiva', 'Conversação'
    ]
  },
  {
    nome: 'Mobilidade',
    codigo: 'MOB',
    atividades: [
      'Mudanças e manutenção da posição corporal', 'Transporte de objetos', 'Marcha',
      'Subir escadas', 'Uso de transporte', 'Dirigir',
      'Deslocamento no domicílio', 'Deslocamento fora de casa'
    ]
  },
  {
    nome: 'Cuidados Pessoais',
    codigo: 'CP',
    atividades: [
      'Higiene corporal', 'Uso de instalações sanitárias', 'Vestir-se',
      'Alimentação', 'Beber', 'Uso de medicamentos',
      'Monitoramento de condições de saúde', 'Autocuidado'
    ]
  },
  {
    nome: 'Vida Doméstica',
    codigo: 'VD',
    atividades: [
      'Aquisição de bens e serviços', 'Preparação de refeições', 'Tarefas domésticas',
      'Limpeza e manutenção', 'Jardinagem', 'Cuidado com animais',
      'Gestão da casa', 'Manutenção de equipamentos'
    ]
  },
  {
    nome: 'Educação, Trabalho e Vida Econômica',
    codigo: 'ETVE',
    atividades: [
      'Educação formal', 'Capacitação profissional', 'Emprego',
      'Trabalho remunerado', 'Gestão financeira', 'Planejamento financeiro', 'Aposentadoria'
    ]
  },
  {
    nome: 'Relações e Interações Interpessoais',
    codigo: 'RII',
    atividades: [
      'Relações familiares', 'Relações sociais', 'Relações íntimas',
      'Interação com profissionais', 'Participação comunitária', 'Vida cultural',
      'Recreação e lazer', 'Espiritualidade', 'Cidadania'
    ]
  }
];

app.get('/api/dominios', (req, res) => res.json(dominios));
app.get('/api/especialidades', (req, res) => res.json(especialidades));

// Endpoint de Diagnóstico para testar a conexão com o banco
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$connect();
    const count = await prisma.avaliado.count();
    res.json({ 
      status: 'ok', 
      message: 'Conectado ao banco com sucesso!', 
      pacientes_cadastrados: count,
      db_url_present: !!process.env.DATABASE_URL
    });
  } catch (error) {
    console.error('Erro de diagnóstico:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Falha na conexão com o banco', 
      details: error.message,
      code: error.code
    });
  }
});

app.post('/api/avaliados', async (req, res) => {
  const { nome, sexo, idade, cor_raca, diagnostico_medico, tipo_deficiencia, funcoes_corporais } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  try {
    const avaliado = await prisma.avaliado.create({
      data: {
        nome,
        sexo,
        idade: idade ? parseInt(idade) : null,
        cor_raca,
        diagnostico_medico,
        tipo_deficiencia,
        funcoes_corporais
      }
    });
    res.json({ id: avaliado.id, message: 'Avaliado criado com sucesso' });
  } catch (error) {
    console.error('Erro detalhado ao criar avaliado:', error);
    res.status(500).json({ 
      error: 'Erro ao cadastrar avaliado', 
      details: error.message,
      code: error.code 
    });
  }
});

app.get('/api/avaliados', async (req, res) => {
  try {
    const avaliados = await prisma.avaliado.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json(avaliados);
  } catch (error) {
    console.error('Erro ao buscar avaliados:', error);
    res.status(500).json({ error: 'Erro ao buscar avaliados' });
  }
});

app.get('/api/avaliados/:id', async (req, res) => {
  try {
    const avaliado = await prisma.avaliado.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    if (!avaliado) return res.status(404).json({ error: 'Avaliado não encontrado' });
    res.json(avaliado);
  } catch (error) {
    console.error('Erro ao buscar avaliado:', error);
    res.status(500).json({ error: 'Erro ao buscar avaliado' });
  }
});

app.post('/api/avaliacoes', async (req, res) => {
  const { avaliado_id, especialidade, nome_avaliador, dominio, atividade, pontuacao, observacao } = req.body;

  if (!avaliado_id || !especialidade || !nome_avaliador || !dominio || !atividade || pontuacao === undefined) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  try {
    const avaliacao = await prisma.avaliacao.upsert({
      where: {
        // Como não temos uma constraint unique composta no schema ainda para simplificar,
        // vamos buscar primeiro. Para usar upsert real precisaríamos de @@unique no schema.
        id: -1 // Valor impossível para forçar a busca manual abaixo ou usar update/create
      },
      create: {
        avaliado_id: parseInt(avaliado_id),
        especialidade,
        nome_avaliador,
        dominio,
        atividade,
        pontuacao: parseInt(pontuacao),
        observacao
      },
      update: {
        nome_avaliador,
        pontuacao: parseInt(pontuacao),
        observacao
      }
    });
    // Nota: O upsert acima precisa de um campo unique. Vamos ajustar a lógica para find/update/create
    // para ser mais resiliente sem mudar o schema drasticamente agora.
  } catch (error) {
    // Lógica manual de Upsert já que não definimos @@unique no schema para esses campos
    try {
      const existing = await prisma.avaliacao.findFirst({
        where: {
          avaliado_id: parseInt(avaliado_id),
          especialidade,
          dominio,
          atividade
        }
      });

      if (existing) {
        const updated = await prisma.avaliacao.update({
          where: { id: existing.id },
          data: {
            nome_avaliador,
            pontuacao: parseInt(pontuacao),
            observacao
          }
        });
        res.json({ id: updated.id, message: 'Avaliação atualizada com sucesso' });
      } else {
        const created = await prisma.avaliacao.create({
          data: {
            avaliado_id: parseInt(avaliado_id),
            especialidade,
            nome_avaliador,
            dominio,
            atividade,
            pontuacao: parseInt(pontuacao),
            observacao
          }
        });
        res.json({ id: created.id, message: 'Avaliação salva com sucesso' });
      }
    } catch (innerError) {
      console.error('Erro ao salvar avaliação:', innerError);
      res.status(500).json({ error: 'Erro ao salvar avaliação' });
    }
  }
});

app.get('/api/avaliados/:id/avaliacoes', async (req, res) => {
  const { especialidade } = req.query;
  try {
    const where = { avaliado_id: parseInt(req.params.id) };
    if (especialidade) where.especialidade = especialidade;

    const avaliacoes = await prisma.avaliacao.findMany({
      where,
      orderBy: [
        { especialidade: 'asc' },
        { dominio: 'asc' },
        { created_at: 'asc' }
      ]
    });
    res.json(avaliacoes);
  } catch (error) {
    console.error('Erro ao buscar avaliações:', error);
    res.status(500).json({ error: 'Erro ao buscar avaliações' });
  }
});

app.get('/api/avaliados/:id/resultado', async (req, res) => {
  try {
    const avaliado = await prisma.avaliado.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { avaliacoes: true }
    });

    if (!avaliado) return res.status(404).json({ error: 'Avaliado não encontrado' });

    if (avaliado.avaliacoes.length === 0) {
      return res.json({
        avaliado,
        resultadoCombinado: null,
        resultadoPorEspecialidade: {},
        mensagem: 'Nenhuma avaliação encontrada para este avaliado'
      });
    }

    const calcularResultadoPorEspecialidade = (avaliacoesEsp) => {
      const porDominio = {};
      let totalPontos = 0;
      let totalMaximo = 0;

      dominios.forEach(d => {
        porDominio[d.codigo] = { nome: d.nome, pontuacao: 0, maximo: d.atividades.length * 4, atividades: {} };
      });

      avaliacoesEsp.forEach(a => {
        if (porDominio[a.dominio]) {
          porDominio[a.dominio].pontuacao += a.pontuacao;
          porDominio[a.dominio].atividades[a.atividade] = a.pontuacao;
          totalPontos += a.pontuacao;
        }
      });

      dominios.forEach(d => totalMaximo += d.atividades.length * 4);

      const percentagem = totalMaximo > 0 ? (totalPontos / totalMaximo) * 100 : 0;
      let classificacao = percentagem >= 70 ? 'Leve' : percentagem >= 40 ? 'Moderada' : 'Grave';

      return { pontuacaoTotal: totalPontos, pontuacaoMaxima: totalMaximo, percentagem: percentagem.toFixed(2), classificacao, porDominio };
    };

    const resultadoPorEspecialidade = {};
    let todasAvaliacoes = avaliado.avaliacoes;

    especialidades.forEach(esp => {
      const avaliacoesEsp = avaliado.avaliacoes.filter(a => a.especialidade === esp);
      if (avaliacoesEsp.length > 0) {
        resultadoPorEspecialidade[esp] = {
          ...calcularResultadoPorEspecialidade(avaliacoesEsp),
          nomeAvaliador: avaliacoesEsp[0].nome_avaliador || 'Não informado'
        };
      }
    });

    res.json({
      avaliado,
      resultadoCombinado: calcularResultadoPorEspecialidade(todasAvaliacoes),
      resultadoPorEspecialidade
    });
  } catch (error) {
    console.error('Erro ao gerar resultado:', error);
    res.status(500).json({ error: 'Erro ao gerar resultado' });
  }
});

app.delete('/api/avaliados/:id', async (req, res) => {
  try {
    await prisma.avaliado.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ message: 'Avaliado removido com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir avaliado:', error);
    res.status(500).json({ error: 'Erro ao excluir avaliado' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Servidor IFBR rodando na porta ${PORT}`);
  });
}

module.exports = app;
