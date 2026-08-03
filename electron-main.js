const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');

let mainWindow;
let server;
let db;
let SQL;

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

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    require('fs').writeFileSync(path.join(app.getPath('userData'), 'ifbr.db'), buffer);
  }
}

function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS avaliados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      nis_nit TEXT,
      sexo TEXT,
      idade INTEGER,
      cor_raca TEXT,
      cid_causa TEXT,
      cid_sequela TEXT,
      sem_diagnostico_etiologico INTEGER DEFAULT 0,
      tipo_impedimento TEXT,
      data_inicio_impedimento TEXT,
      data_alteracao_impedimento TEXT,
      funcoes_corporais TEXT,
      historia_clinica TEXT,
      historia_social TEXT,
      data_avaliacao TEXT,
      local_avaliacao TEXT,
      codigo_aps TEXT,
      fuzzy_surdez_antes_6anos INTEGER DEFAULT 0,
      fuzzy_nao_pode_sozinho INTEGER DEFAULT 0,
      fuzzy_cadeira_rodas INTEGER DEFAULT 0,
      fuzzy_cego_ao_nascer INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    db.run('ALTER TABLE avaliados ADD COLUMN nis_nit TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN cid_causa TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN cid_sequela TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN sem_diagnostico_etiologico INTEGER DEFAULT 0');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN tipo_impedimento TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN data_inicio_impedimento TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN data_alteracao_impedimento TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN historia_clinica TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN historia_social TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN data_avaliacao TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN local_avaliacao TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN codigo_aps TEXT');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN fuzzy_surdez_antes_6anos INTEGER DEFAULT 0');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN fuzzy_nao_pode_sozinho INTEGER DEFAULT 0');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN fuzzy_cadeira_rodas INTEGER DEFAULT 0');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliados ADD COLUMN fuzzy_cego_ao_nascer INTEGER DEFAULT 0');
  } catch(e) {}
  try {
    db.run("ALTER TABLE avaliados RENAME COLUMN diagnostico_medico TO _old_diagnostico_medico");
  } catch(e) {}
  try {
    db.run("ALTER TABLE avaliados RENAME COLUMN tipo_deficiencia TO _old_tipo_deficiencia");
  } catch(e) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS avaliacao_sessoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avaliado_id INTEGER NOT NULL,
      especialidade TEXT NOT NULL,
      nome_avaliador TEXT NOT NULL,
      siape TEXT,
      quem_informou TEXT,
      quem_informou_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (avaliado_id) REFERENCES avaliados(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avaliado_id INTEGER NOT NULL,
      especialidade TEXT NOT NULL,
      nome_avaliador TEXT NOT NULL,
      dominio TEXT NOT NULL,
      atividade TEXT NOT NULL,
      pontuacao INTEGER NOT NULL,
      observacao TEXT,
      barreira_pt INTEGER DEFAULT 0,
      barreira_amb INTEGER DEFAULT 0,
      barreira_ar INTEGER DEFAULT 0,
      barreira_at INTEGER DEFAULT 0,
      barreira_ssp INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (avaliado_id) REFERENCES avaliados(id)
    )
  `);

  try {
    db.run('ALTER TABLE avaliacoes ADD COLUMN barreira_pt INTEGER DEFAULT 0');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliacoes ADD COLUMN barreira_amb INTEGER DEFAULT 0');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliacoes ADD COLUMN barreira_ar INTEGER DEFAULT 0');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliacoes ADD COLUMN barreira_at INTEGER DEFAULT 0');
  } catch(e) {}
  try {
    db.run('ALTER TABLE avaliacoes ADD COLUMN barreira_ssp INTEGER DEFAULT 0');
  } catch(e) {}

  saveDatabase();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'IFBR - Índice de Funcionalidade Brasileiro',
    show: false
  });

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startServer() {
  const expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(express.static(path.join(__dirname, 'public')));

  // Configuração robusta para sql.js
  const wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  SQL = await initSqlJs({
    locateFile: file => wasmPath
  });
  const dbPath = path.join(app.getPath('userData'), 'ifbr.db');

  try {
    const fileBuffer = require('fs').readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } catch (e) {
    db = new SQL.Database();
  }

  initDatabase();

  setInterval(saveDatabase, 5000);

  expressApp.get('/api/dominios', (req, res) => res.json(dominios));

  expressApp.get('/api/especialidades', (req, res) => res.json(especialidades));

  expressApp.post('/api/avaliados', (req, res) => {
    const b = req.body || {};
    const nome = typeof b.nome === 'string' ? b.nome.trim() : '';
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const idade = (b.idade === undefined || b.idade === null || b.idade === '')
      ? null : Number(b.idade);
    if (idade !== null && isNaN(idade)) return res.status(400).json({ error: 'Idade inválida' });

    const toBool = v => v ? 1 : 0;

    db.run(`INSERT INTO avaliados (
      nome, nis_nit, sexo, idade, cor_raca, cid_causa, cid_sequela,
      sem_diagnostico_etiologico, tipo_impedimento, data_inicio_impedimento,
      data_alteracao_impedimento, funcoes_corporais, historia_clinica, historia_social,
      data_avaliacao, local_avaliacao, codigo_aps,
      fuzzy_surdez_antes_6anos, fuzzy_nao_pode_sozinho, fuzzy_cadeira_rodas, fuzzy_cego_ao_nascer
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nome,
        b.nis_nit || null,
        b.sexo || null,
        idade,
        b.cor_raca || null,
        b.cid_causa || null,
        b.cid_sequela || null,
        toBool(b.sem_diagnostico_etiologico),
        b.tipo_impedimento || null,
        b.data_inicio_impedimento || null,
        b.data_alteracao_impedimento || null,
        b.funcoes_corporais || null,
        b.historia_clinica || null,
        b.historia_social || null,
        b.data_avaliacao || null,
        b.local_avaliacao || null,
        b.codigo_aps || null,
        toBool(b.fuzzy_surdez_antes_6anos),
        toBool(b.fuzzy_nao_pode_sozinho),
        toBool(b.fuzzy_cadeira_rodas),
        toBool(b.fuzzy_cego_ao_nascer)
      ]);

    const result = db.exec("SELECT last_insert_rowid() as id");
    saveDatabase();
    res.json({ id: result[0].values[0][0], message: 'Avaliado criado com sucesso' });
  });

  expressApp.get('/api/avaliados', (req, res) => {
    const result = db.exec("SELECT * FROM avaliados ORDER BY created_at DESC");
    const columns = result.length > 0 ? result[0].columns : [];
    const values = result.length > 0 ? result[0].values : [];
    const avaliados = values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(avaliados);
  });

  expressApp.get('/api/avaliados/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const result = db.exec(`SELECT * FROM avaliados WHERE id = ${id}`);
    if (result.length === 0) return res.status(404).json({ error: 'Avaliado não encontrado' });
    const columns = result[0].columns;
    const values = result[0].values[0];
    const avaliado = {};
    columns.forEach((col, i) => avaliado[col] = values[i]);

    const sessoesResult = db.exec(`SELECT * FROM avaliacao_sessoes WHERE avaliado_id = ${id}`);
    let sessoes = [];
    if (sessoesResult.length > 0) {
      const sc = sessoesResult[0].columns;
      sessoes = sessoesResult[0].values.map(row => {
        const o = {};
        sc.forEach((c, i) => o[c] = row[i]);
        return o;
      });
    }
    avaliado.sessoes = sessoes;
    res.json(avaliado);
  });

  expressApp.patch('/api/avaliados/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const b = req.body || {};
    const sets = [];
    const vals = [];

    const textFields = [
      'nome', 'nis_nit', 'sexo', 'cor_raca', 'cid_causa', 'cid_sequela', 'tipo_impedimento',
      'data_inicio_impedimento', 'data_alteracao_impedimento', 'funcoes_corporais',
      'historia_clinica', 'historia_social', 'data_avaliacao', 'local_avaliacao', 'codigo_aps'
    ];
    for (const f of textFields) {
      if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(b[f] ?? null); }
    }

    if (b.idade !== undefined) {
      sets.push('idade = ?');
      vals.push(b.idade === '' ? null : Number(b.idade));
    }

    const boolFields = [
      'sem_diagnostico_etiologico', 'fuzzy_surdez_antes_6anos',
      'fuzzy_nao_pode_sozinho', 'fuzzy_cadeira_rodas', 'fuzzy_cego_ao_nascer'
    ];
    for (const f of boolFields) {
      if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(b[f] ? 1 : 0); }
    }

    if (sets.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

    vals.push(id);
    const placeholders = sets.join(', ');
    db.run(`UPDATE avaliados SET ${placeholders} WHERE id = ?`, vals);
    saveDatabase();

    const result = db.exec(`SELECT * FROM avaliados WHERE id = ${id}`);
    if (result.length === 0) return res.status(404).json({ error: 'Avaliado não encontrado' });
    const columns = result[0].columns;
    const values = result[0].values[0];
    const avaliado = {};
    columns.forEach((col, i) => avaliado[col] = values[i]);
    res.json(avaliado);
  });

  expressApp.post('/api/avaliados/:id/sessoes', (req, res) => {
    const id = parseInt(req.params.id);
    const b = req.body || {};
    if (!b.especialidade || !b.nome_avaliador) {
      return res.status(400).json({ error: 'Especialidade e nome do avaliador são obrigatórios' });
    }

    const existing = db.exec(
      `SELECT id FROM avaliacao_sessoes WHERE avaliado_id = ${id} AND especialidade = '${String(b.especialidade).replace(/'/g, "''")}'`
    );

    if (existing.length > 0 && existing[0].values.length > 0) {
      const sessId = existing[0].values[0][0];
      db.run(`UPDATE avaliacao_sessoes SET nome_avaliador = ?, siape = ?, quem_informou = ?, quem_informou_id = ? WHERE id = ?`,
        [b.nome_avaliador || null, b.siape || null, b.quem_informou || null, b.quem_informou_id || null, sessId]);
      saveDatabase();
      return res.json({ id: sessId, message: 'Sessão atualizada' });
    }

    db.run(`INSERT INTO avaliacao_sessoes (avaliado_id, especialidade, nome_avaliador, siape, quem_informou, quem_informou_id)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [id, b.especialidade, b.nome_avaliador, b.siape || null, b.quem_informou || null, b.quem_informou_id || null]);
    const result = db.exec("SELECT last_insert_rowid() as id");
    saveDatabase();
    res.json({ id: result[0].values[0][0], message: 'Sessão registrada' });
  });

  expressApp.post('/api/avaliacoes', (req, res) => {
    const b = req.body || {};
    const { avaliado_id, especialidade, nome_avaliador, dominio, atividade, pontuacao, observacao } = b;
    const barreira_pt = b.barreira_pt ? 1 : 0;
    const barreira_amb = b.barreira_amb ? 1 : 0;
    const barreira_ar = b.barreira_ar ? 1 : 0;
    const barreira_at = b.barreira_at ? 1 : 0;
    const barreira_ssp = b.barreira_ssp ? 1 : 0;

    if (!avaliado_id || !especialidade || !nome_avaliador || !dominio || !atividade || pontuacao === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }
    if (![25, 50, 75, 100].includes(Number(pontuacao))) {
      return res.status(400).json({ error: 'Pontuação deve ser 25, 50, 75 ou 100' });
    }

    const espEsc = String(especialidade).replace(/'/g, "''");
    const domEsc = String(dominio).replace(/'/g, "''");
    const atvEsc = String(atividade).replace(/'/g, "''");

    const existing = db.exec(
      `SELECT id FROM avaliacoes WHERE avaliado_id = ${parseInt(avaliado_id)} AND especialidade = '${espEsc}' AND dominio = '${domEsc}' AND atividade = '${atvEsc}'`
    );

    if (existing.length > 0 && existing[0].values.length > 0) {
      const id = existing[0].values[0][0];
      db.run(`UPDATE avaliacoes SET nome_avaliador = ?, pontuacao = ?, observacao = ?,
        barreira_pt = ?, barreira_amb = ?, barreira_ar = ?, barreira_at = ?, barreira_ssp = ? WHERE id = ?`,
        [nome_avaliador, Number(pontuacao), observacao || null,
         barreira_pt, barreira_amb, barreira_ar, barreira_at, barreira_ssp, id]);
      saveDatabase();
      return res.json({ id, message: 'Avaliação atualizada' });
    }

    db.run(`INSERT INTO avaliacoes (avaliado_id, especialidade, nome_avaliador, dominio, atividade, pontuacao, observacao,
      barreira_pt, barreira_amb, barreira_ar, barreira_at, barreira_ssp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [parseInt(avaliado_id), especialidade, nome_avaliador, dominio, atividade, Number(pontuacao), observacao || null,
       barreira_pt, barreira_amb, barreira_ar, barreira_at, barreira_ssp]);
    const result = db.exec("SELECT last_insert_rowid() as id");
    saveDatabase();
    res.json({ id: result[0].values[0][0], message: 'Avaliação salva' });
  });

  expressApp.post('/api/avaliacoes/lote', (req, res) => {
    const b = req.body || {};
    const avaliado_id = parseInt(b.avaliado_id);
    const especialidade = b.especialidade;
    const nome_avaliador = b.nome_avaliador;
    const avaliacoes = Array.isArray(b.avaliacoes) ? b.avaliacoes : [];

    if (!avaliado_id || !especialidade || !nome_avaliador) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }
    if (avaliacoes.length === 0) {
      return res.status(400).json({ error: 'Nenhuma avaliação para salvar' });
    }

    let total = 0;
    for (const a of avaliacoes) {
      if (!a.dominio || !a.atividade || a.pontuacao == null) continue;
      if (![25, 50, 75, 100].includes(Number(a.pontuacao))) continue;

      const barreira_pt = a.barreira_pt ? 1 : 0;
      const barreira_amb = a.barreira_amb ? 1 : 0;
      const barreira_ar = a.barreira_ar ? 1 : 0;
      const barreira_at = a.barreira_at ? 1 : 0;
      const barreira_ssp = a.barreira_ssp ? 1 : 0;

      const domEsc = String(a.dominio).replace(/'/g, "''");
      const atvEsc = String(a.atividade).replace(/'/g, "''");
      const espEsc = String(especialidade).replace(/'/g, "''");

      const existing = db.exec(
        `SELECT id FROM avaliacoes WHERE avaliado_id = ${avaliado_id} AND especialidade = '${espEsc}' AND dominio = '${domEsc}' AND atividade = '${atvEsc}'`
      );

      if (existing.length > 0 && existing[0].values.length > 0) {
        const id = existing[0].values[0][0];
        db.run(`UPDATE avaliacoes SET nome_avaliador = ?, pontuacao = ?, observacao = ?,
          barreira_pt = ?, barreira_amb = ?, barreira_ar = ?, barreira_at = ?, barreira_ssp = ? WHERE id = ?`,
          [nome_avaliador, Number(a.pontuacao), a.observacao || null,
           barreira_pt, barreira_amb, barreira_ar, barreira_at, barreira_ssp, id]);
      } else {
        db.run(`INSERT INTO avaliacoes (avaliado_id, especialidade, nome_avaliador, dominio, atividade, pontuacao, observacao,
          barreira_pt, barreira_amb, barreira_ar, barreira_at, barreira_ssp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [avaliado_id, especialidade, nome_avaliador, a.dominio, a.atividade, Number(a.pontuacao), a.observacao || null,
           barreira_pt, barreira_amb, barreira_ar, barreira_at, barreira_ssp]);
      }
      total++;
    }
    saveDatabase();
    res.json({ total, message: `${total} avaliações salvas` });
  });

  expressApp.get('/api/avaliados/:id/avaliacoes', (req, res) => {
    const id = parseInt(req.params.id);
    const { especialidade } = req.query;
    let query = `SELECT * FROM avaliacoes WHERE avaliado_id = ${id}`;
    if (especialidade) {
      const espEsc = String(especialidade).replace(/'/g, "''");
      query += ` AND especialidade = '${espEsc}'`;
    }
    query += ' ORDER BY especialidade ASC, dominio ASC, atividade ASC';

    const result = db.exec(query);
    if (result.length === 0) return res.json([]);

    const columns = result[0].columns;
    const avaliacoes = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(avaliacoes);
  });

  expressApp.get('/api/avaliados/:id/resultado', (req, res) => {
    const result = db.exec(`SELECT * FROM avaliados WHERE id = ${req.params.id}`);
    if (result.length === 0) return res.status(404).json({ error: 'Avaliado não encontrado' });

    const columns = result[0].columns;
    const values = result[0].values[0];
    const avaliado = {};
    columns.forEach((col, i) => avaliado[col] = values[i]);

    const avaliacoesResult = db.exec(`SELECT * FROM avaliacoes WHERE avaliado_id = ${req.params.id}`);
    if (avaliacoesResult.length === 0) {
      return res.json({
        avaliado,
        resultadoCombinado: null,
        resultadoPorEspecialidade: {},
        mensagem: 'Nenhuma avaliação encontrada para este avaliado'
      });
    }

    const avalcColumns = avaliacoesResult[0].columns;
    const avaliacoes = avaliacoesResult[0].values.map(row => {
      const obj = {};
      avalcColumns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });

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
    let todasAvaliacoes = [];

    especialidades.forEach(esp => {
      const avaliacoesEsp = avaliacoes.filter(a => a.especialidade === esp);
      if (avaliacoesEsp.length > 0) {
        resultadoPorEspecialidade[esp] = {
          ...calcularResultadoPorEspecialidade(avaliacoesEsp),
          nomeAvaliador: avaliacoesEsp[0].nome_avaliador || 'Não informado'
        };
        todasAvaliacoes = todasAvaliacoes.concat(avaliacoesEsp);
      }
    });

    res.json({
      avaliado,
      resultadoCombinado: calcularResultadoPorEspecialidade(todasAvaliacoes),
      resultadoPorEspecialidade
    });
  });

  expressApp.delete('/api/avaliados/:id', (req, res) => {
    db.run(`DELETE FROM avaliacoes WHERE avaliado_id = ${req.params.id}`);
    db.run(`DELETE FROM avaliados WHERE id = ${req.params.id}`);
    saveDatabase();
    res.json({ message: 'Avaliado removido com sucesso' });
  });

  expressApp.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  server = expressApp.listen(3000, () => {
    console.log('Servidor IFBR rodando na porta 3000');
  });
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  saveDatabase();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});