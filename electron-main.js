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
      sexo TEXT,
      idade INTEGER,
      cor_raca TEXT,
      diagnostico_medico TEXT,
      tipo_deficiencia TEXT,
      funcoes_corporais TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (avaliado_id) REFERENCES avaliados(id)
    )
  `);

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
    const { nome, sexo, idade, cor_raca, diagnostico_medico, tipo_deficiencia, funcoes_corporais } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    db.run(`INSERT INTO avaliados (nome, sexo, idade, cor_raca, diagnostico_medico, tipo_deficiencia, funcoes_corporais)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nome, sexo, idade, cor_raca, diagnostico_medico, tipo_deficiencia, funcoes_corporais]);

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
    const result = db.exec(`SELECT * FROM avaliados WHERE id = ${req.params.id}`);
    if (result.length === 0) return res.status(404).json({ error: 'Avaliado não encontrado' });
    const columns = result[0].columns;
    const values = result[0].values[0];
    const avaliado = {};
    columns.forEach((col, i) => avaliado[col] = values[i]);
    res.json(avaliado);
  });

  expressApp.post('/api/avaliacoes', (req, res) => {
    const { avaliado_id, especialidade, nome_avaliador, dominio, atividade, pontuacao, observacao } = req.body;

    if (!avaliado_id || !especialidade || !nome_avaliador || !dominio || !atividade || pontuacao === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    const existing = db.exec(`SELECT id FROM avaliacoes WHERE avaliado_id = ${avaliado_id} AND especialidade = '${especialidade}' AND dominio = '${dominio}' AND atividade = '${atividade}'`);

    if (existing.length > 0 && existing[0].values.length > 0) {
      db.run(`UPDATE avaliacoes SET pontuacao = ${pontuacao}, observacao = '${observacao || ''}', nome_avaliador = '${nome_avaliador}' WHERE id = ${existing[0].values[0][0]}`);
      saveDatabase();
      res.json({ id: existing[0].values[0][0], message: 'Avaliação atualizada com sucesso' });
    } else {
      db.run(`INSERT INTO avaliacoes (avaliado_id, especialidade, nome_avaliador, dominio, atividade, pontuacao, observacao)
        VALUES (${avaliado_id}, '${especialidade}', '${nome_avaliador}', '${dominio}', '${atividade}', ${pontuacao}, '${observacao || ''}')`);
      const result = db.exec("SELECT last_insert_rowid() as id");
      saveDatabase();
      res.json({ id: result[0].values[0][0], message: 'Avaliação salva com sucesso' });
    }
  });

  expressApp.get('/api/avaliados/:id/avaliacoes', (req, res) => {
    const { especialidade } = req.query;
    let query = `SELECT * FROM avaliacoes WHERE avaliado_id = ${req.params.id}`;
    if (especialidade) query += ` AND especialidade = '${especialidade}'`;
    query += ' ORDER BY especialidade, dominio, created_at';

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