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

// Converte inteiros SQLite (0/1) de volta para booleanos JS
function parseBools(row) {
  if (!row) return row
  return {
    ...row,
    sem_diagnostico_etiologico: !!row.sem_diagnostico_etiologico,
    fuzzy_surdez_antes_6anos:   !!row.fuzzy_surdez_antes_6anos,
    fuzzy_nao_pode_sozinho:     !!row.fuzzy_nao_pode_sozinho,
    fuzzy_cadeira_rodas:        !!row.fuzzy_cadeira_rodas,
    fuzzy_cego_ao_nascer:       !!row.fuzzy_cego_ao_nascer
  }
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

    const db = env.DB

    try {
      // ── Metadados ────────────────────────────────────────────────────────
      if (method === 'GET' && path === '/api/dominios') return json(dominios)
      if (method === 'GET' && path === '/api/especialidades') return json(especialidades)
      if (method === 'GET' && path === '/api/tipos-impedimento') return json(tiposImpedimento)

      if (method === 'GET' && path === '/api/health') {
        const row = await db.prepare('SELECT COUNT(*) as count FROM avaliados').first()
        return json({ status: 'ok', pacientes_cadastrados: row.count })
      }

      // ── Avaliados ─────────────────────────────────────────────────────────
      if (method === 'GET' && path === '/api/avaliados') {
        const { results } = await db.prepare('SELECT * FROM avaliados ORDER BY created_at DESC').all()
        return json(results.map(parseBools))
      }

      if (method === 'POST' && path === '/api/avaliados') {
        const b = await request.json()
        const nome = typeof b.nome === 'string' ? b.nome.trim() : ''
        if (!nome) return json({ error: 'Nome é obrigatório' }, 400)

        const idade = (b.idade === undefined || b.idade === null || b.idade === '')
          ? null : Number(b.idade)
        if (idade !== null && isNaN(idade)) return json({ error: 'Idade inválida' }, 400)

        const result = await db.prepare(`
          INSERT INTO avaliados (
            nome, nis_nit, sexo, idade, cor_raca, cid_causa, cid_sequela,
            sem_diagnostico_etiologico, tipo_impedimento, data_inicio_impedimento,
            data_alteracao_impedimento, funcoes_corporais, historia_clinica, historia_social,
            data_avaliacao, local_avaliacao, codigo_aps,
            fuzzy_surdez_antes_6anos, fuzzy_nao_pode_sozinho, fuzzy_cadeira_rodas, fuzzy_cego_ao_nascer
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          nome,
          b.nis_nit || null,
          b.sexo || null,
          idade,
          b.cor_raca || null,
          b.cid_causa || null,
          b.cid_sequela || null,
          b.sem_diagnostico_etiologico ? 1 : 0,
          b.tipo_impedimento || null,
          b.data_inicio_impedimento || null,
          b.data_alteracao_impedimento || null,
          b.funcoes_corporais || null,
          b.historia_clinica || null,
          b.historia_social || null,
          b.data_avaliacao || null,
          b.local_avaliacao || null,
          b.codigo_aps || null,
          b.fuzzy_surdez_antes_6anos ? 1 : 0,
          b.fuzzy_nao_pode_sozinho ? 1 : 0,
          b.fuzzy_cadeira_rodas ? 1 : 0,
          b.fuzzy_cego_ao_nascer ? 1 : 0
        ).run()
        return json({ id: result.meta.last_row_id, message: 'Avaliado criado com sucesso' })
      }

      // ── Rotas com :id ─────────────────────────────────────────────────────
      const matchId = path.match(/^\/api\/avaliados\/(\d+)(\/.*)?$/)
      if (matchId) {
        const id = parseInt(matchId[1])
        const subpath = matchId[2] || ''

        if (method === 'GET' && subpath === '') {
          const avaliado = await db.prepare('SELECT * FROM avaliados WHERE id = ?').bind(id).first()
          if (!avaliado) return json({ error: 'Avaliado não encontrado' }, 404)
          const { results: sessoes } = await db.prepare(
            'SELECT * FROM avaliacao_sessoes WHERE avaliado_id = ?'
          ).bind(id).all()
          return json({ ...parseBools(avaliado), sessoes })
        }

        if (method === 'PATCH' && subpath === '') {
          const b = await request.json()
          const sets = []
          const vals = []

          const textFields = [
            'nome', 'nis_nit', 'sexo', 'cor_raca', 'cid_causa', 'cid_sequela', 'tipo_impedimento',
            'data_inicio_impedimento', 'data_alteracao_impedimento', 'funcoes_corporais',
            'historia_clinica', 'historia_social', 'data_avaliacao', 'local_avaliacao', 'codigo_aps'
          ]
          for (const f of textFields) {
            if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(b[f] ?? null) }
          }

          if (b.idade !== undefined) {
            sets.push('idade = ?')
            vals.push(b.idade === '' ? null : Number(b.idade))
          }

          const boolFields = [
            'sem_diagnostico_etiologico', 'fuzzy_surdez_antes_6anos',
            'fuzzy_nao_pode_sozinho', 'fuzzy_cadeira_rodas', 'fuzzy_cego_ao_nascer'
          ]
          for (const f of boolFields) {
            if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(b[f] ? 1 : 0) }
          }

          if (sets.length === 0) return json({ error: 'Nenhum campo para atualizar' }, 400)

          vals.push(id)
          await db.prepare(`UPDATE avaliados SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()
          const avaliado = await db.prepare('SELECT * FROM avaliados WHERE id = ?').bind(id).first()
          return json(parseBools(avaliado))
        }

        if (method === 'DELETE' && subpath === '') {
          await db.prepare('DELETE FROM avaliados WHERE id = ?').bind(id).run()
          return json({ message: 'Avaliado removido com sucesso' })
        }

        // ── Sessões do avaliado ─────────────────────────────────────────────
        if (method === 'POST' && subpath === '/sessoes') {
          const b = await request.json()
          if (!b.especialidade || !b.nome_avaliador) {
            return json({ error: 'Especialidade e nome do avaliador são obrigatórios' }, 400)
          }
          const existing = await db.prepare(
            'SELECT id FROM avaliacao_sessoes WHERE avaliado_id = ? AND especialidade = ?'
          ).bind(id, b.especialidade).first()

          if (existing) {
            await db.prepare(
              'UPDATE avaliacao_sessoes SET nome_avaliador = ?, siape = ?, quem_informou = ?, quem_informou_id = ? WHERE id = ?'
            ).bind(b.nome_avaliador, b.siape || null, b.quem_informou || null, b.quem_informou_id || null, existing.id).run()
            return json({ id: existing.id, message: 'Sessão atualizada' })
          }

          const result = await db.prepare(
            'INSERT INTO avaliacao_sessoes (avaliado_id, especialidade, nome_avaliador, siape, quem_informou, quem_informou_id) VALUES (?, ?, ?, ?, ?, ?)'
          ).bind(id, b.especialidade, b.nome_avaliador, b.siape || null, b.quem_informou || null, b.quem_informou_id || null).run()
          return json({ id: result.meta.last_row_id, message: 'Sessão registrada' })
        }

        // ── Avaliações ─────────────────────────────────────────────────────
        if (method === 'GET' && subpath === '/avaliacoes') {
          const especialidade = url.searchParams.get('especialidade')
          let query = 'SELECT * FROM avaliacoes WHERE avaliado_id = ?'
          const params = [id]
          if (especialidade) { query += ' AND especialidade = ?'; params.push(especialidade) }
          query += ' ORDER BY especialidade ASC, dominio ASC, atividade ASC'
          const { results } = await db.prepare(query).bind(...params).all()
          return json(results.map(parseBools))
        }

        if (method === 'POST' && subpath === '/avaliacoes') {
          const b = await request.json()
          const { especialidade, nome_avaliador, dominio, atividade, pontuacao, observacao } = b
          const barreiras = [
            b.barreira_pt ? 1 : 0,
            b.barreira_amb ? 1 : 0,
            b.barreira_ar ? 1 : 0,
            b.barreira_at ? 1 : 0,
            b.barreira_ssp ? 1 : 0
          ]

          if (!especialidade || !nome_avaliador || !dominio || !atividade || pontuacao === undefined) {
            return json({ error: 'Campos obrigatórios faltando' }, 400)
          }
          if (![25, 50, 75, 100].includes(Number(pontuacao))) {
            return json({ error: 'Pontuação deve ser 25, 50, 75 ou 100' }, 400)
          }

          const existing = await db.prepare(
            'SELECT id FROM avaliacoes WHERE avaliado_id = ? AND especialidade = ? AND dominio = ? AND atividade = ?'
          ).bind(id, especialidade, dominio, atividade).first()

          if (existing) {
            await db.prepare(
              'UPDATE avaliacoes SET nome_avaliador = ?, pontuacao = ?, observacao = ?, barreira_pt = ?, barreira_amb = ?, barreira_ar = ?, barreira_at = ?, barreira_ssp = ? WHERE id = ?'
            ).bind(nome_avaliador, Number(pontuacao), observacao || null, ...barreiras, existing.id).run()
            return json({ id: existing.id, message: 'Avaliação atualizada' })
          }

          const result = await db.prepare(
            'INSERT INTO avaliacoes (avaliado_id, especialidade, nome_avaliador, dominio, atividade, pontuacao, observacao, barreira_pt, barreira_amb, barreira_ar, barreira_at, barreira_ssp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(id, especialidade, nome_avaliador, dominio, atividade, Number(pontuacao), observacao || null, ...barreiras).run()
          return json({ id: result.meta.last_row_id, message: 'Avaliação salva' })
        }

        // ── Resultado com Fuzzy ────────────────────────────────────────────
        if (method === 'GET' && subpath === '/resultado') {
          const avaliado = await db.prepare('SELECT * FROM avaliados WHERE id = ?').bind(id).first()
          if (!avaliado) return json({ error: 'Avaliado não encontrado' }, 404)

          const { results: avaliacoes } = await db.prepare(
            'SELECT * FROM avaliacoes WHERE avaliado_id = ?'
          ).bind(id).all()
          const { results: sessoes } = await db.prepare(
            'SELECT * FROM avaliacao_sessoes WHERE avaliado_id = ?'
          ).bind(id).all()

          const avaliadoParsed = parseBools(avaliado)
          const avaliacoesParsed = avaliacoes.map(parseBools)

          if (avaliacoesParsed.length === 0) {
            return json({
              avaliado: avaliadoParsed,
              resultadoCombinado: null,
              resultadoPorEspecialidade: {},
              mensagem: 'Nenhuma avaliação encontrada'
            })
          }

          const resultadoPorEspecialidade = {}
          let pontuacaoTotalCombinada = 0

          for (const esp of especialidades) {
            const avaliacoesEsp = avaliacoesParsed.filter(a => a.especialidade === esp)
            if (avaliacoesEsp.length === 0) continue

            const avaliacoesCorrigidas = aplicarFuzzy(avaliadoParsed, avaliacoesEsp)
            const soma = avaliacoesCorrigidas.reduce((s, a) => s + a.pontuacao, 0)
            pontuacaoTotalCombinada += soma

            const sessao = sessoes.find(s => s.especialidade === esp)
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
            avaliado: { ...avaliadoParsed, avaliacoes: avaliacoesParsed, sessoes },
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
          const aid = parseInt(avaliado_id)
          const barreiras = [
            av.barreira_pt ? 1 : 0,
            av.barreira_amb ? 1 : 0,
            av.barreira_ar ? 1 : 0,
            av.barreira_at ? 1 : 0,
            av.barreira_ssp ? 1 : 0
          ]
          const existing = await db.prepare(
            'SELECT id FROM avaliacoes WHERE avaliado_id = ? AND especialidade = ? AND dominio = ? AND atividade = ?'
          ).bind(aid, especialidade, av.dominio, av.atividade).first()

          if (existing) {
            await db.prepare(
              'UPDATE avaliacoes SET nome_avaliador = ?, pontuacao = ?, barreira_pt = ?, barreira_amb = ?, barreira_ar = ?, barreira_at = ?, barreira_ssp = ?, observacao = ? WHERE id = ?'
            ).bind(nome_avaliador, Number(av.pontuacao), ...barreiras, av.observacao || null, existing.id).run()
          } else {
            await db.prepare(
              'INSERT INTO avaliacoes (avaliado_id, especialidade, nome_avaliador, dominio, atividade, pontuacao, barreira_pt, barreira_amb, barreira_ar, barreira_at, barreira_ssp, observacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(aid, especialidade, nome_avaliador, av.dominio, av.atividade, Number(av.pontuacao), ...barreiras, av.observacao || null).run()
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
