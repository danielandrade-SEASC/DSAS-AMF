import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

// ─── Dados oficiais IF-BrA (41 atividades em 7 domínios) ─────────────────────

const especialidades = ['Perito Médico', 'Assistente Social']

const tiposImpedimento = [
  'Auditiva',
  'Intelectual/Cognitiva',
  'Fisica/Motora',
  'Visual',
  'Mental'
]

const dominios = [
  {
    nome: 'Sensorial', codigo: 'SEN',
    atividades: [
      'Observar',
      'Ouvir'
    ]
  },
  {
    nome: 'Comunicação', codigo: 'COM',
    atividades: [
      'Comunicar e receber mensagens',
      'Comunicar-se e produzir mensagens',
      'Conversar',
      'Discutir',
      'Utilização de dispositivos de comunicação à distância'
    ]
  },
  {
    nome: 'Mobilidade', codigo: 'MOB',
    atividades: [
      'Mudar e manter a posição do corpo',
      'Alcançar, transportar e mover objetos',
      'Movimentos finos da mão',
      'Deslocar-se dentro de casa',
      'Deslocar-se dentro de edifícios que não a própria casa',
      'Deslocar-se fora de sua casa e de outros edifícios',
      'Utilizar transporte coletivo',
      'Utilizar transporte individual como passageiro'
    ]
  },
  {
    nome: 'Cuidados Pessoais', codigo: 'CP',
    atividades: [
      'Lavar-se',
      'Cuidar de partes do corpo',
      'Regulação da micção',
      'Regulação da defecação',
      'Vestir-se',
      'Comer',
      'Beber',
      'Capacidade de identificar agravos à saúde'
    ]
  },
  {
    nome: 'Vida Doméstica', codigo: 'VD',
    atividades: [
      'Preparar refeições tipo lanches',
      'Cozinhar',
      'Realizar tarefas domésticas',
      'Manutenção e uso apropriado de objetos pessoais e utensílios da casa',
      'Cuidar dos outros'
    ]
  },
  {
    nome: 'Educação, Trabalho e Vida Econômica', codigo: 'ETVE',
    atividades: [
      'Educação',
      'Qualificação profissional',
      'Trabalho remunerado',
      'Fazer compras e contratar serviços',
      'Administração de recursos econômicos pessoais'
    ]
  },
  {
    nome: 'Socialização e Vida Comunitária', codigo: 'SVC',
    atividades: [
      'Regular o comportamento nas interações',
      'Interagir de acordo com as regras sociais',
      'Relacionamentos com estranhos',
      'Relacionamentos com familiares e com pessoas familiares',
      'Relacionamentos íntimos',
      'Socialização',
      'Fazer as próprias escolhas',
      'Vida Política e Cidadania'
    ]
  }
]

// Domínios principais por tipo de impedimento para o Modelo Fuzzy
const fuzzyDominios = {
  'Auditiva':             ['COM', 'SVC'],
  'Intelectual/Cognitiva': ['VD', 'SVC'],
  'Mental':               ['VD', 'SVC'],
  'Fisica/Motora':        ['MOB', 'CP'],
  'Visual':               ['MOB', 'VD']
}

// ─── Modelo Linguístico Fuzzy ─────────────────────────────────────────────────

function aplicarFuzzy(avaliado, avaliacoes) {
  const tipos = (avaliado.tipo_impedimento || '').split(',').map(t => t.trim()).filter(Boolean)
  let resultado = avaliacoes.map(a => ({ ...a }))

  for (const tipo of tipos) {
    const codigos = fuzzyDominios[tipo] || []

    // Verifica se pergunta emblemática está ativa para este tipo
    const emblematicoAtivo =
      (tipo === 'Auditiva' && avaliado.fuzzy_surdez_antes_6anos) ||
      ((tipo === 'Intelectual/Cognitiva' || tipo === 'Mental') && avaliado.fuzzy_nao_pode_sozinho) ||
      (tipo === 'Fisica/Motora' && avaliado.fuzzy_cadeira_rodas) ||
      (tipo === 'Visual' && avaliado.fuzzy_cego_ao_nascer)

    for (const cod of codigos) {
      const ativsNoDominio = resultado.filter(a => a.dominio === cod)
      if (ativsNoDominio.length === 0) continue

      const pontuacoes = ativsNoDominio.map(a => a.pontuacao)
      const minPontuacao = Math.min(...pontuacoes)
      const tem25ou50 = pontuacoes.some(p => p <= 50)
      const todos75 = pontuacoes.every(p => p === 75)

      // Aplica Fuzzy se: emblemático ativo OU tem 25/50 OU tudo 75
      if (emblematicoAtivo || tem25ou50 || todos75) {
        resultado = resultado.map(a =>
          a.dominio === cod ? { ...a, pontuacao: minPontuacao } : a
        )
      }
    }
  }

  return resultado
}

// ─── Classificação oficial LC 142/2013 ───────────────────────────────────────

function classificar(pontuacaoTotal) {
  if (pontuacaoTotal <= 5739) return 'Grave'
  if (pontuacaoTotal <= 6354) return 'Moderada'
  if (pontuacaoTotal <= 7584) return 'Leve'
  return 'Insuficiente para Concessão do Benefício'
}

function calcularPorDominio(avaliacoes) {
  const resultado = {}
  for (const d of dominios) {
    const atvsEsp = avaliacoes.filter(a => a.dominio === d.codigo)
    resultado[d.codigo] = {
      nome: d.nome,
      pontuacao: atvsEsp.reduce((s, a) => s + a.pontuacao, 0),
      maximo: d.atividades.length * 100,
      atividades: Object.fromEntries(atvsEsp.map(a => [a.atividade, a.pontuacao]))
    }
  }
  return resultado
}

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      })
    }

    if (!path.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }

   // const adapter = new PrismaD1(env.DB)
    const adapter = new PrismaD1(env.DB.withSession("first-unconstrained"));

    const prisma = new PrismaClient({ adapter })

    try {
      // ── Metadados ────────────────────────────────────────────────────────
      if (method === 'GET' && path === '/api/dominios') return json(dominios)
      if (method === 'GET' && path === '/api/especialidades') return json(especialidades)
      if (method === 'GET' && path === '/api/tipos-impedimento') return json(tiposImpedimento)

      if (method === 'GET' && path === '/api/health') {
        const count = await prisma.avaliado.count()
        return json({ status: 'ok', pacientes_cadastrados: count })
      }

      // ── Avaliados ─────────────────────────────────────────────────────────
      if (method === 'GET' && path === '/api/avaliados') {
        const avaliados = await prisma.avaliado.findMany({ orderBy: { created_at: 'desc' } })
        return json(avaliados)
      }

      if (method === 'POST' && path === '/api/avaliados') {
        const b = await request.json()
        const nome = typeof b.nome === 'string' ? b.nome.trim() : ''
        if (!nome) return json({ error: 'Nome é obrigatório' }, 400)

        const idade = (b.idade === undefined || b.idade === null || b.idade === '')
          ? null : Number(b.idade)
        if (idade !== null && isNaN(idade)) return json({ error: 'Idade inválida' }, 400)

        const avaliado = await prisma.avaliado.create({
          data: {
            nome,
            nis_nit: b.nis_nit || null,
            sexo: b.sexo || null,
            idade,
            cor_raca: b.cor_raca || null,
            cid_causa: b.cid_causa || null,
            cid_sequela: b.cid_sequela || null,
            sem_diagnostico_etiologico: !!b.sem_diagnostico_etiologico,
            tipo_impedimento: b.tipo_impedimento || null,
            data_inicio_impedimento: b.data_inicio_impedimento || null,
            data_alteracao_impedimento: b.data_alteracao_impedimento || null,
            funcoes_corporais: b.funcoes_corporais || null,
            historia_clinica: b.historia_clinica || null,
            historia_social: b.historia_social || null,
            data_avaliacao: b.data_avaliacao || null,
            local_avaliacao: b.local_avaliacao || null,
            codigo_aps: b.codigo_aps || null,
            fuzzy_surdez_antes_6anos: !!b.fuzzy_surdez_antes_6anos,
            fuzzy_nao_pode_sozinho: !!b.fuzzy_nao_pode_sozinho,
            fuzzy_cadeira_rodas: !!b.fuzzy_cadeira_rodas,
            fuzzy_cego_ao_nascer: !!b.fuzzy_cego_ao_nascer
          }
        })
        return json({ id: avaliado.id, message: 'Avaliado criado com sucesso' })
      }

      // ── Rotas com :id ─────────────────────────────────────────────────────
      const matchId = path.match(/^\/api\/avaliados\/(\d+)(\/.*)?$/)
      if (matchId) {
        const id = parseInt(matchId[1])
        const subpath = matchId[2] || ''

        if (method === 'GET' && subpath === '') {
          const avaliado = await prisma.avaliado.findUnique({
            where: { id },
            include: { sessoes: true }
          })
          if (!avaliado) return json({ error: 'Avaliado não encontrado' }, 404)
          return json(avaliado)
        }

        if (method === 'PATCH' && subpath === '') {
          const b = await request.json()
          const avaliado = await prisma.avaliado.update({
            where: { id },
            data: {
              nis_nit: b.nis_nit ?? undefined,
              sexo: b.sexo ?? undefined,
              idade: b.idade !== undefined ? (b.idade === '' ? null : Number(b.idade)) : undefined,
              cor_raca: b.cor_raca ?? undefined,
              cid_causa: b.cid_causa ?? undefined,
              cid_sequela: b.cid_sequela ?? undefined,
              sem_diagnostico_etiologico: b.sem_diagnostico_etiologico !== undefined ? !!b.sem_diagnostico_etiologico : undefined,
              tipo_impedimento: b.tipo_impedimento ?? undefined,
              data_inicio_impedimento: b.data_inicio_impedimento ?? undefined,
              data_alteracao_impedimento: b.data_alteracao_impedimento ?? undefined,
              funcoes_corporais: b.funcoes_corporais ?? undefined,
              historia_clinica: b.historia_clinica ?? undefined,
              historia_social: b.historia_social ?? undefined,
              data_avaliacao: b.data_avaliacao ?? undefined,
              local_avaliacao: b.local_avaliacao ?? undefined,
              codigo_aps: b.codigo_aps ?? undefined,
              fuzzy_surdez_antes_6anos: b.fuzzy_surdez_antes_6anos !== undefined ? !!b.fuzzy_surdez_antes_6anos : undefined,
              fuzzy_nao_pode_sozinho: b.fuzzy_nao_pode_sozinho !== undefined ? !!b.fuzzy_nao_pode_sozinho : undefined,
              fuzzy_cadeira_rodas: b.fuzzy_cadeira_rodas !== undefined ? !!b.fuzzy_cadeira_rodas : undefined,
              fuzzy_cego_ao_nascer: b.fuzzy_cego_ao_nascer !== undefined ? !!b.fuzzy_cego_ao_nascer : undefined
            }
          })
          return json(avaliado)
        }

        if (method === 'DELETE' && subpath === '') {
          await prisma.avaliado.delete({ where: { id } })
          return json({ message: 'Avaliado removido com sucesso' })
        }

        // ── Sessões do avaliado ─────────────────────────────────────────────
        if (method === 'POST' && subpath === '/sessoes') {
          const b = await request.json()
          if (!b.especialidade || !b.nome_avaliador) {
            return json({ error: 'Especialidade e nome do avaliador são obrigatórios' }, 400)
          }
          const existing = await prisma.avaliacaoSessao.findFirst({
            where: { avaliado_id: id, especialidade: b.especialidade }
          })
          const data = {
            nome_avaliador: b.nome_avaliador,
            siape: b.siape || null,
            quem_informou: b.quem_informou || null,
            quem_informou_id: b.quem_informou_id || null
          }
          const sessao = existing
            ? await prisma.avaliacaoSessao.update({ where: { id: existing.id }, data })
            : await prisma.avaliacaoSessao.create({ data: { avaliado_id: id, especialidade: b.especialidade, ...data } })
          return json({ id: sessao.id, message: existing ? 'Sessão atualizada' : 'Sessão registrada' })
        }

        // ── Avaliações ─────────────────────────────────────────────────────
        if (method === 'GET' && subpath === '/avaliacoes') {
          const especialidade = url.searchParams.get('especialidade')
          const where = { avaliado_id: id }
          if (especialidade) where.especialidade = especialidade
          const avaliacoes = await prisma.avaliacao.findMany({
            where,
            orderBy: [{ especialidade: 'asc' }, { dominio: 'asc' }, { atividade: 'asc' }]
          })
          return json(avaliacoes)
        }

        if (method === 'POST' && subpath === '/avaliacoes') {
          const b = await request.json()
          const { especialidade, nome_avaliador, dominio, atividade, pontuacao, observacao } = b
          const barreiras = {
            barreira_pt: !!b.barreira_pt,
            barreira_amb: !!b.barreira_amb,
            barreira_ar: !!b.barreira_ar,
            barreira_at: !!b.barreira_at,
            barreira_ssp: !!b.barreira_ssp
          }

          if (!especialidade || !nome_avaliador || !dominio || !atividade || pontuacao === undefined) {
            return json({ error: 'Campos obrigatórios faltando' }, 400)
          }
          if (![25, 50, 75, 100].includes(Number(pontuacao))) {
            return json({ error: 'Pontuação deve ser 25, 50, 75 ou 100' }, 400)
          }

          const existing = await prisma.avaliacao.findFirst({
            where: { avaliado_id: id, especialidade, dominio, atividade }
          })

          if (existing) {
            const updated = await prisma.avaliacao.update({
              where: { id: existing.id },
              data: { nome_avaliador, pontuacao: Number(pontuacao), observacao: observacao || null, ...barreiras }
            })
            return json({ id: updated.id, message: 'Avaliação atualizada' })
          }

          const created = await prisma.avaliacao.create({
            data: {
              avaliado_id: id,
              especialidade,
              nome_avaliador,
              dominio,
              atividade,
              pontuacao: Number(pontuacao),
              observacao: observacao || null,
              ...barreiras
            }
          })
          return json({ id: created.id, message: 'Avaliação salva' })
        }

        // ── Resultado com Fuzzy ────────────────────────────────────────────
        if (method === 'GET' && subpath === '/resultado') {
          const avaliado = await prisma.avaliado.findUnique({
            where: { id },
            include: { avaliacoes: true, sessoes: true }
          })
          if (!avaliado) return json({ error: 'Avaliado não encontrado' }, 404)

          if (avaliado.avaliacoes.length === 0) {
            return json({
              avaliado,
              resultadoCombinado: null,
              resultadoPorEspecialidade: {},
              mensagem: 'Nenhuma avaliação encontrada'
            })
          }

          const resultadoPorEspecialidade = {}
          let pontuacaoTotalCombinada = 0

          for (const esp of especialidades) {
            const avaliacoesEsp = avaliado.avaliacoes.filter(a => a.especialidade === esp)
            if (avaliacoesEsp.length === 0) continue

            const avaliacoesCorrigidas = aplicarFuzzy(avaliado, avaliacoesEsp)
            const soma = avaliacoesCorrigidas.reduce((s, a) => s + a.pontuacao, 0)
            pontuacaoTotalCombinada += soma

            const sessao = avaliado.sessoes.find(s => s.especialidade === esp)
            resultadoPorEspecialidade[esp] = {
              pontuacaoTotal: soma,
              pontuacaoMaxima: avaliacoesEsp.length * 100,
              porDominio: calcularPorDominio(avaliacoesCorrigidas),
              nomeAvaliador: sessao?.nome_avaliador || avaliacoesEsp[0].nome_avaliador,
              totalAtividades: avaliacoesEsp.length,
              fuzzyAplicado: JSON.stringify(avaliacoesEsp) !== JSON.stringify(avaliacoesCorrigidas)
            }
          }

          const totalAtividades = 41
          const totalAplicadores = Object.keys(resultadoPorEspecialidade).length
          const pontuacaoMaximaPossivel = totalAtividades * 100 * totalAplicadores
          const pontuacaoMinimaPossivel = totalAtividades * 25 * totalAplicadores

          return json({
            avaliado,
            resultadoPorEspecialidade,
            pontuacaoTotal: pontuacaoTotalCombinada,
            pontuacaoMaxima: pontuacaoMaximaPossivel,
            pontuacaoMinima: pontuacaoMinimaPossivel,
            classificacao: classificar(pontuacaoTotalCombinada),
            totalAplicadores,
            observacao: totalAplicadores < 2
              ? 'Avaliação incompleta: faltam avaliações de um ou mais aplicadores'
              : null
          })
        }
      }

      // ── Avaliações em lote ────────────────────────────────────────────────
      if (method === 'POST' && path === '/api/avaliacoes/lote') {
        const b = await request.json()
        const { avaliado_id, especialidade, nome_avaliador, avaliacoes } = b
        if (!avaliado_id || !especialidade || !nome_avaliador || !Array.isArray(avaliacoes)) {
          return json({ error: 'Campos obrigatórios faltando' }, 400)
        }

        let salvos = 0
        for (const av of avaliacoes) {
          if (![25, 50, 75, 100].includes(Number(av.pontuacao))) continue
          const existing = await prisma.avaliacao.findFirst({
            where: { avaliado_id: parseInt(avaliado_id), especialidade, dominio: av.dominio, atividade: av.atividade }
          })
          const data = {
            avaliado_id: parseInt(avaliado_id),
            especialidade,
            nome_avaliador,
            dominio: av.dominio,
            atividade: av.atividade,
            pontuacao: Number(av.pontuacao),
            barreira_pt: !!av.barreira_pt,
            barreira_amb: !!av.barreira_amb,
            barreira_ar: !!av.barreira_ar,
            barreira_at: !!av.barreira_at,
            barreira_ssp: !!av.barreira_ssp,
            observacao: av.observacao || null
          }
          if (existing) {
            await prisma.avaliacao.update({ where: { id: existing.id }, data })
          } else {
            await prisma.avaliacao.create({ data })
          }
          salvos++
        }
        return json({ message: `${salvos} avaliações salvas`, total: salvos })
      }

      return json({ error: 'Rota não encontrada' }, 404)

    } catch (error) {
      console.error('Worker error:', error)
      return json({ error: 'Erro interno do servidor' }, 500)
    }
  }
}
