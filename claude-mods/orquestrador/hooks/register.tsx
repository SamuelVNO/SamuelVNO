import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Empresa, GitProjeto, Projeto, Sessao, StatusTarefa, Tarefa, Uso } from '../types'

import {
  SEM_EMPRESA,
  STATUS,
  TODAS,
  acharEmpresa,
  empresaDaSessao,
  expandir,
  interpretarGit,
  mesclarUso,
  mudarStatus,
  nomeEmpresa,
  normalizar,
  novoId,
  slug,
  somarTokens,
  somarUsd,
  tokensDoUso,
} from './estado'
import { desenharPainel } from './painel'
import type { Acoes, Config } from './painel'
import { PROMPT_EXECUTOR, PROMPT_REVISOR, promptOrquestracao, resumoTexto } from './texto'

const PAINEL = 'orquestrador'
const TITULO = 'Orquestrador'
const FERRAMENTA = (nome: string) => `mcp__orquestrador__${nome}`
const MODELOS = ['inherit', 'opus', 'sonnet', 'haiku']

type Args = Record<string, unknown>

const empresas = atom({ plugin: 'orquestrador', key: 'empresas' } as const, [])
const tarefas = atom({ plugin: 'orquestrador', key: 'tarefas' } as const, [])
const uso = atom({ plugin: 'orquestrador', key: 'uso' } as const, {})
const git = atom({ plugin: 'orquestrador', key: 'git' } as const, {})
const agentes = atom({ plugin: 'orquestrador', key: 'agentes' } as const, [])
const aba = atom({ plugin: 'orquestrador', key: 'aba' } as const, 'resumo')
const filtro = atom({ plugin: 'orquestrador', key: 'filtro' } as const, TODAS)
const sessao = atom({ plugin: 'orquestrador', key: 'sessao' } as const, {
  cwd: '',
  home: '',
  modelo: '',
  empresaFixada: null,
  tarefaAtiva: null,
  ultimoUsd: null,
  modelosUsados: [],
} satisfies Sessao)

function falhaDaFerramenta() {
  return { result: 'O Orquestrador não conseguiu concluir esta operação. Tente de novo ou avise o usuário.' }
}

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined

// ---------------------------------------------------------------------------
// Persistência: empresas, tarefas e uso vivem no $.store (entre sessões) e
// são espelhados no $.state (o que o painel lê). Cada escrita relê o store
// antes de aplicar a mudança, para não apagar o que outra sessão gravou.

type Persistidos = { empresas: Empresa[]; tarefas: Tarefa[]; uso: Uso }

let fila: Promise<unknown> = Promise.resolve()

function emFila<T>(trabalho: () => Promise<T>): Promise<T> {
  const vez = fila.then(trabalho, trabalho)
  fila = vez.catch(() => undefined)
  return vez
}

function valido<K extends keyof Persistidos>(chave: K, valor: unknown): valor is Persistidos[K] {
  if (chave === 'uso') return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
  return Array.isArray(valor)
}

async function alterarEmpresas($: EngineInterface, mudar: (v: Empresa[]) => Empresa[]) {
  return emFila(async () => {
    const salvo = await $.store.get('empresas')
    const novo = mudar(valido('empresas', salvo) ? salvo : await read($, empresas))
    await $.store.set('empresas', novo)
    await update($, empresas, () => novo)
    return novo
  })
}

async function alterarTarefas($: EngineInterface, mudar: (v: Tarefa[]) => Tarefa[]) {
  return emFila(async () => {
    const salvo = await $.store.get('tarefas')
    const novo = mudar(valido('tarefas', salvo) ? salvo : await read($, tarefas))
    await $.store.set('tarefas', novo)
    await update($, tarefas, () => novo)
    return novo
  })
}

async function alterarUso($: EngineInterface, mudar: (v: Uso) => Uso) {
  return emFila(async () => {
    const salvo = await $.store.get('uso')
    const novo = mudar(valido('uso', salvo) ? salvo : await read($, uso))
    await $.store.set('uso', novo)
    await update($, uso, () => novo)
    return novo
  })
}

const mudou = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)

/** Traz para o $.state o que o store tem (o que outras sessões gravaram). */
async function sincronizar($: EngineInterface): Promise<void> {
  await emFila(async () => {
    const salvoEmpresas = await $.store.get('empresas')
    if (valido('empresas', salvoEmpresas) && mudou(salvoEmpresas, await read($, empresas))) {
      await update($, empresas, () => salvoEmpresas)
    }
    const salvoTarefas = await $.store.get('tarefas')
    if (valido('tarefas', salvoTarefas) && mudou(salvoTarefas, await read($, tarefas))) {
      await update($, tarefas, () => salvoTarefas)
    }
    const salvoUso = await $.store.get('uso')
    if (valido('uso', salvoUso) && mudou(salvoUso, await read($, uso))) {
      await update($, uso, () => salvoUso)
    }
  })
}

// ---------------------------------------------------------------------------
// Git

async function lerGit($: EngineInterface, caminho: string): Promise<GitProjeto> {
  const lidoEm = await $.clock.now()
  const opcoes = { timeoutMs: 10_000 }
  try {
    const head = await $.process.run(['git', '-C', caminho, 'rev-parse', '--abbrev-ref', 'HEAD'], opcoes)
    if (head.exitCode !== 0) return interpretarGit(head, null, null, lidoEm)
    const refs = await $.process.run(
      [
        'git',
        '-C',
        caminho,
        'for-each-ref',
        '--sort=-committerdate',
        '--count=8',
        '--format=%(refname:short)%09%(committerdate:unix)',
        'refs/heads',
      ],
      opcoes,
    )
    const status = await $.process.run(['git', '-C', caminho, 'status', '--porcelain'], opcoes)
    return interpretarGit(head, refs, status, lidoEm)
  } catch (erro) {
    return {
      atual: null,
      branches: [],
      alteracoes: 0,
      erro: erro instanceof Error ? erro.message : String(erro),
      lidoEm,
    }
  }
}

/** Lê o git dos projetos cadastrados e do repositório da sessão. */
async function atualizarGit($: EngineInterface): Promise<void> {
  const s = await read($, sessao)
  const caminhos = new Set<string>()
  for (const empresa of await read($, empresas)) {
    for (const projeto of empresa.projetos) caminhos.add(expandir(projeto.caminho, s.home))
  }
  const repo = await $.session.repo().catch(() => null)
  if (repo !== null) caminhos.add(normalizar(repo.root))
  const lidos: [string, GitProjeto][] = []
  for (const caminho of caminhos) lidos.push([caminho, await lerGit($, caminho)])
  await update($, git, () => Object.fromEntries(lidos))
}

// ---------------------------------------------------------------------------
// Operações (usadas pelas ferramentas do modelo, pelo /orq e pelos botões)

async function atualizarStatus($: EngineInterface): Promise<void> {
  const s = await read($, sessao)
  const lista = await read($, empresas)
  const ts = await read($, tarefas)
  const id = empresaDaSessao(lista, s)
  const andamento = ts.filter(t => t.empresaId === id && t.status === 'andamento').length
  const ativa = ts.find(t => t.id === s.tarefaAtiva)
  $.ui.status(
    `🏢 ${nomeEmpresa(lista, id)} · ${andamento} em andamento${ativa ? ` · ▶ #${ativa.id}` : ''}`,
  )
}

async function salvarEmpresa($: EngineInterface, a: Args): Promise<string> {
  const nome = texto(a.nome)
  if (nome === undefined) return 'Informe o nome da empresa.'
  const novoNome = texto(a.novoNome)
  const projetos: Projeto[] = Array.isArray(a.projetos)
    ? a.projetos.flatMap((p: unknown) => {
        const item = (p ?? {}) as Args
        const caminho = texto(item.caminho)
        if (caminho === undefined) return []
        return [{ nome: texto(item.nome) ?? normalizar(caminho).split('/').pop() ?? caminho, caminho }]
      })
    : []
  const remover = Array.isArray(a.removerProjetos)
    ? a.removerProjetos.flatMap((r: unknown) => (typeof r === 'string' ? [normalizar(r).toLowerCase()] : []))
    : []
  let salva: Empresa | undefined
  let criada = false
  await alterarEmpresas($, lista => {
    const existente = acharEmpresa(lista, nome)
    criada = existente === undefined
    const base: Empresa = existente ?? {
      id: (() => {
        let id = slug(nome)
        for (let n = 2; lista.some(e => e.id === id); n++) id = `${slug(nome)}-${n}`
        return id
      })(),
      nome,
      projetos: [],
    }
    const mantidos = base.projetos.filter(
      p =>
        !remover.includes(p.nome.toLowerCase()) &&
        !remover.includes(normalizar(p.caminho).toLowerCase()) &&
        !projetos.some(n => normalizar(n.caminho) === normalizar(p.caminho)),
    )
    salva = { ...base, nome: novoNome ?? base.nome, projetos: [...mantidos, ...projetos] }
    return existente === undefined ? [...lista, salva] : lista.map(e => (e.id === base.id ? salva! : e))
  })
  void atualizarGit($)
  await atualizarStatus($)
  const final = salva!
  const listaProjetos = final.projetos.map(p => `${p.nome} (${p.caminho})`).join(', ') || 'nenhum'
  return `Empresa ${final.nome} (id ${final.id}) ${criada ? 'cadastrada' : 'atualizada'}. Projetos: ${listaProjetos}.`
}

async function removerEmpresa($: EngineInterface, a: Args): Promise<string> {
  const nome = texto(a.nome)
  if (nome === undefined) return 'Informe o nome da empresa.'
  const alvo = acharEmpresa(await read($, empresas), nome)
  if (alvo === undefined) return `Empresa "${nome}" não encontrada.`
  await alterarEmpresas($, lista => lista.filter(e => e.id !== alvo.id))
  await alterarTarefas($, lista => lista.map(t => (t.empresaId === alvo.id ? { ...t, empresaId: SEM_EMPRESA } : t)))
  await alterarUso($, atual => mesclarUso(atual, alvo.id, SEM_EMPRESA))
  await atualizarStatus($)
  return `Empresa ${alvo.nome} removida. Suas tarefas e seu uso passaram para "Sem empresa".`
}

async function salvarTarefa($: EngineInterface, a: Args): Promise<string> {
  const agora = await $.clock.now()
  const lista = await read($, empresas)
  const s = await read($, sessao)
  const id = texto(a.id)?.replace(/^#/, '')
  const status = STATUS.find(x => x === a.status) as StatusTarefa | undefined
  if (a.status !== undefined && status === undefined) {
    return `Status inválido: ${String(a.status)}. Use um de: ${STATUS.join(', ')}.`
  }
  let empresaId: string | undefined
  const nomeDaEmpresa = texto(a.empresa)
  if (nomeDaEmpresa !== undefined) {
    const achada = acharEmpresa(lista, nomeDaEmpresa)
    if (achada === undefined) {
      const nomes = lista.map(e => e.nome).join(', ') || 'nenhuma'
      return `Empresa "${nomeDaEmpresa}" não encontrada (cadastradas: ${nomes}). Cadastre antes com ${FERRAMENTA('empresa_salvar')}.`
    }
    empresaId = achada.id
  }
  const campos = (t: Tarefa): Tarefa => {
    let novo: Tarefa = { ...t, atualizadaEm: agora }
    for (const campo of ['titulo', 'epico', 'projeto', 'branch', 'resumo'] as const) {
      if (typeof a[campo] === 'string') {
        const valor = (a[campo] as string).trim()
        if (campo === 'titulo') {
          if (valor !== '') novo.titulo = valor
        } else {
          novo = { ...novo, [campo]: valor === '' ? undefined : valor }
        }
      }
    }
    if (empresaId !== undefined) novo.empresaId = empresaId
    if (status !== undefined) novo = mudarStatus(novo, status, agora)
    return novo
  }

  let salva: Tarefa | undefined
  let erro: string | undefined
  await alterarTarefas($, ts => {
    if (id !== undefined) {
      const existente = ts.find(t => t.id === id)
      if (existente === undefined) {
        erro = `Tarefa #${id} não encontrada.`
        return ts
      }
      salva = campos(existente)
      return ts.map(t => (t.id === id ? salva! : t))
    }
    const titulo = texto(a.titulo)
    if (titulo === undefined) {
      erro = 'Informe o título para criar uma tarefa (ou o id para atualizar uma existente).'
      return ts
    }
    salva = campos({
      id: novoId(ts.map(t => t.id)),
      empresaId: empresaId ?? empresaDaSessao(lista, s),
      titulo,
      status: 'backlog',
      criadaEm: agora,
      atualizadaEm: agora,
      tokens: 0,
      usd: 0,
    })
    return [...ts, salva]
  })
  if (erro !== undefined) return erro
  const final = salva!
  if (final.status === 'andamento' && status === 'andamento') {
    await update($, sessao, x => ({ ...x, tarefaAtiva: final.id }))
  } else if (final.status === 'entregue' && s.tarefaAtiva === final.id) {
    await update($, sessao, x => ({ ...x, tarefaAtiva: null }))
  }
  await atualizarStatus($)
  return `Tarefa #${final.id} salva: "${final.titulo}" · ${nomeEmpresa(lista, final.empresaId)} · ${final.status}${final.epico ? ` · épico ${final.epico}` : ''}${final.branch ? ` · branch ${final.branch}` : ''}.`
}

async function removerTarefa($: EngineInterface, a: Args): Promise<string> {
  const id = texto(a.id)?.replace(/^#/, '')
  if (id === undefined) return 'Informe o id da tarefa.'
  let achou = false
  await alterarTarefas($, ts => {
    achou = ts.some(t => t.id === id)
    return ts.filter(t => t.id !== id)
  })
  await update($, sessao, x => (x.tarefaAtiva === id ? { ...x, tarefaAtiva: null } : x))
  await atualizarStatus($)
  return achou ? `Tarefa #${id} removida.` : `Tarefa #${id} não encontrada.`
}

async function resumo($: EngineInterface, empresa?: string): Promise<string> {
  const lista = await read($, empresas)
  let alvo = TODAS
  if (empresa !== undefined) {
    const achada = acharEmpresa(lista, empresa)
    if (achada === undefined && empresa.toLowerCase() !== 'sem empresa') {
      return `Empresa "${empresa}" não encontrada.`
    }
    alvo = achada?.id ?? SEM_EMPRESA
  }
  return resumoTexto({
    empresas: lista,
    tarefas: await read($, tarefas),
    uso: await read($, uso),
    git: await read($, git),
    sessao: await read($, sessao),
    filtro: alvo,
    agora: await $.clock.now(),
  })
}

async function ativar($: EngineInterface, id: string): Promise<Tarefa | undefined> {
  const agora = await $.clock.now()
  let ativada: Tarefa | undefined
  await alterarTarefas($, ts =>
    ts.map(t => {
      if (t.id !== id) return t
      ativada = t.status === 'andamento' ? t : mudarStatus(t, 'andamento', agora)
      return ativada
    }),
  )
  if (ativada !== undefined) await update($, sessao, x => ({ ...x, tarefaAtiva: id }))
  await atualizarStatus($)
  return ativada
}

async function executarComAgentes($: EngineInterface, id: string): Promise<string> {
  const t = await ativar($, id)
  if (t === undefined) return `Tarefa #${id} não encontrada.`
  const nome = nomeEmpresa(await read($, empresas), t.empresaId)
  void $.prompt
    .submit({ text: promptOrquestracao(t, nome), asUser: true })
    .catch(erro => $.ui.toast(`Não consegui enviar a tarefa: ${erro instanceof Error ? erro.message : String(erro)}`))
  return `Tarefa #${t.id} enviada para execução com agentes.`
}

function acoesDoPainel($: EngineInterface): Acoes {
  return {
    mostrarAba: qual => update($, aba, () => qual),
    filtrar: empresaId => update($, filtro, () => empresaId),
    iniciar: async id => {
      await ativar($, id)
    },
    entregar: async id => {
      await salvarTarefa($, { id, status: 'entregue' })
    },
    executar: async id => {
      $.ui.toast(await executarComAgentes($, id))
    },
    criar: async (entrada, empresaId) => {
      const epico = entrada.match(/#(\S+)/)?.[1]
      const titulo = entrada.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim()
      if (titulo === '') return
      const lista = await read($, empresas)
      const empresa = empresaId === SEM_EMPRESA ? undefined : lista.find(e => e.id === empresaId)?.nome
      $.ui.toast(await salvarTarefa($, { titulo, epico, empresa }))
    },
    fixarEmpresa: async id => {
      await update($, sessao, x => ({ ...x, empresaFixada: id }))
      await atualizarStatus($)
    },
    atualizarGit: () => atualizarGit($),
  }
}

// ---------------------------------------------------------------------------

const FERRAMENTAS = [
  {
    name: 'empresa_salvar',
    description:
      'Orquestrador: cadastra ou atualiza uma empresa para a qual o usuário trabalha e os projetos (pastas locais) dela. Sessões abertas dentro dessas pastas contam tokens e tarefas para a empresa. Projetos com o mesmo caminho são substituídos.',
    inputSchema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome da empresa (ou o atual, para atualizar).' },
        novoNome: { type: 'string', description: 'Novo nome, para renomear.' },
        projetos: {
          type: 'array',
          description: 'Projetos a adicionar ou atualizar.',
          items: {
            type: 'object',
            properties: {
              nome: { type: 'string', description: 'Nome curto do projeto.' },
              caminho: { type: 'string', description: 'Pasta do projeto, absoluta ou com ~.' },
            },
            required: ['caminho'],
          },
        },
        removerProjetos: {
          type: 'array',
          items: { type: 'string' },
          description: 'Nomes ou caminhos de projetos a remover.',
        },
      },
      required: ['nome'],
    },
  },
  {
    name: 'empresa_remover',
    description:
      'Orquestrador: remove uma empresa. As tarefas e o uso de tokens dela passam para "Sem empresa". Só use quando o usuário pedir.',
    inputSchema: {
      type: 'object',
      properties: { nome: { type: 'string', description: 'Nome ou id da empresa.' } },
      required: ['nome'],
    },
  },
  {
    name: 'tarefa_salvar',
    description:
      'Orquestrador: cria uma tarefa (sem id) ou atualiza uma existente (com id). Use para manter o quadro do usuário em dia: ao começar um trabalho (status "andamento"), ao entregar ("entregue", com um resumo do que foi feito) ou ao registrar algo a fazer ("backlog"). Sem empresa, usa a empresa da sessão.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id da tarefa, para atualizar.' },
        titulo: { type: 'string' },
        empresa: { type: 'string', description: 'Nome ou id da empresa.' },
        epico: { type: 'string', description: 'Épico ao qual a tarefa pertence.' },
        projeto: { type: 'string', description: 'Nome do projeto.' },
        branch: { type: 'string', description: 'Branch git da tarefa.' },
        status: { type: 'string', enum: [...STATUS] },
        resumo: {
          type: 'string',
          description: 'Contexto da tarefa ou, ao entregar, o que foi feito e como validar.',
        },
      },
    },
  },
  {
    name: 'tarefa_remover',
    description: 'Orquestrador: apaga uma tarefa pelo id. Só use quando o usuário pedir.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'resumo',
    description:
      'Orquestrador: devolve o quadro do usuário por empresa: tokens gastos, tarefas em aberto e entregues, épicos e a branch atual de cada projeto. Use quando ele perguntar o que está em andamento, o que foi entregue ou quanto gastou.',
    inputSchema: {
      type: 'object',
      properties: { empresa: { type: 'string', description: 'Só esta empresa (nome ou id).' } },
    },
  },
] as const

export const register: Register = (on, options) => {
  const opcoes = options as Record<string, unknown>
  const config: Config = {
    modeloExecutores: MODELOS.includes(String(opcoes.modeloExecutores)) ? String(opcoes.modeloExecutores) : 'inherit',
    modeloRevisor: MODELOS.includes(String(opcoes.modeloRevisor)) ? String(opcoes.modeloRevisor) : 'inherit',
  }
  const abrirAoIniciar = opcoes.abrirAoIniciar !== false

  on('session.start', async ($, e, next) => {
    const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? ''
    const modelo = await $.session.model().catch(() => '')
    await sincronizar($)
    await update($, sessao, s => ({ ...s, cwd: normalizar(e.cwd), home: normalizar(home), modelo }))

    for (const ferramenta of FERRAMENTAS) await $.tool.register(ferramenta)
    await $.command.register({
      name: 'orq',
      description: 'Orquestrador: empresas, projetos, branches, tarefas, tokens e agentes',
      argumentHint: '[resumo | tarefa <título #épico> | executar <id> | empresa <nome|auto>]',
    })
    try {
      await $.agent.register({
        name: 'executor',
        description:
          'Executa UMA subtarefa bem delimitada de uma tarefa do Orquestrador (implementa, valida e relata o que mudou). Dispare vários em paralelo, um por subtarefa independente.',
        prompt: PROMPT_EXECUTOR,
        model: config.modeloExecutores,
      })
      await $.agent.register({
        name: 'revisor',
        description:
          'Revisa o resultado de uma tarefa do Orquestrador antes da entrega: roda testes, lint e typecheck, lê o diff e aponta problemas concretos. Não edita arquivos.',
        prompt: PROMPT_REVISOR,
        model: config.modeloRevisor,
        disallowedTools: ['Edit', 'Write', 'NotebookEdit'],
      })
    } catch (erro) {
      $.ui.log(`orquestrador: não registrei os agentes: ${erro instanceof Error ? erro.message : String(erro)}`, {
        to: 'debug',
      })
    }

    void atualizarGit($)
    $.clock.every(120_000, () => void atualizarGit($))
    $.clock.every(15_000, () => {
      void (async () => {
        await sincronizar($)
        await atualizarStatus($)
        if ((await read($, agentes)).some(a => a.status === 'rodando')) $.ui.invalidate('ui.render')
      })()
    })
    await atualizarStatus($)
    if (abrirAoIniciar && e.isInteractive) void $.ui.open({ id: PAINEL, title: TITULO })

    return next(e)
  })

  // -- ferramentas do modelo ------------------------------------------------
  on('tool.call', { tool: 'mcp__orquestrador__empresa_salvar' }, async ($, e) => ({
    result: await salvarEmpresa($, e as unknown as Args),
  })).catch(falhaDaFerramenta)
  on('tool.call', { tool: 'mcp__orquestrador__empresa_remover' }, async ($, e) => ({
    result: await removerEmpresa($, e as unknown as Args),
  })).catch(falhaDaFerramenta)
  on('tool.call', { tool: 'mcp__orquestrador__tarefa_salvar' }, async ($, e) => ({
    result: await salvarTarefa($, e as unknown as Args),
  })).catch(falhaDaFerramenta)
  on('tool.call', { tool: 'mcp__orquestrador__tarefa_remover' }, async ($, e) => ({
    result: await removerTarefa($, e as unknown as Args),
  })).catch(falhaDaFerramenta)
  on('tool.call', { tool: 'mcp__orquestrador__resumo' }, async ($, e) => ({
    result: await resumo($, texto((e as unknown as Args).empresa)),
  })).catch(falhaDaFerramenta)

  // -- /orq -----------------------------------------------------------------
  on('command.run', { command: 'orq' }, async ($, e) => {
    const [sub = '', ...resto] = e.args.trim().split(/\s+/)
    const arg = resto.join(' ').trim()
    switch (sub.toLowerCase()) {
      case '':
      case 'painel': {
        const aberto = await $.ui.open({ id: PAINEL, title: TITULO })
        return { text: aberto.isPlaced ? 'Painel do Orquestrador aberto.' : 'Painel do Orquestrador aberto (aparece quando houver espaço).' }
      }
      case 'resumo':
        return { text: await resumo($, arg === '' ? undefined : arg) }
      case 'tarefa': {
        const epico = arg.match(/#(\S+)/)?.[1]
        const titulo = arg.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim()
        return { text: await salvarTarefa($, { titulo, epico }) }
      }
      case 'executar':
        return { text: await executarComAgentes($, arg.replace(/^#/, '')) }
      case 'empresa': {
        if (arg === '' || arg.toLowerCase() === 'auto') {
          await update($, sessao, x => ({ ...x, empresaFixada: null }))
          await atualizarStatus($)
          return { text: 'A empresa desta sessão volta a ser decidida pelo caminho do projeto.' }
        }
        const achada = acharEmpresa(await read($, empresas), arg)
        if (achada === undefined) return { text: `Empresa "${arg}" não encontrada.` }
        await update($, sessao, x => ({ ...x, empresaFixada: achada.id }))
        await update($, filtro, () => achada.id)
        await atualizarStatus($)
        return { text: `Esta sessão agora conta para ${achada.nome}.` }
      }
      default:
        return {
          text: [
            'Uso do /orq:',
            '  /orq                      abre o painel',
            '  /orq resumo [empresa]     resumo de tarefas, tokens e branches',
            '  /orq tarefa <título #épico>  cria uma tarefa na empresa da sessão',
            '  /orq executar <id>        executa a tarefa com agentes em paralelo + revisor',
            '  /orq empresa <nome|auto>  fixa a empresa desta sessão',
            'Para cadastrar empresas e projetos, peça ao Claude em linguagem natural.',
          ].join('\n'),
        }
    }
  })

  // -- tokens, custo e modelos ------------------------------------------------
  on('turn.complete', async ($, e, next) => {
    const resultado = await next(e)
    const agora = await $.clock.now()
    const s = await read($, sessao)
    let empresaId = empresaDaSessao(await read($, empresas), s)
    let tarefaId = s.tarefaAtiva
    const u = e.usage
    if (e.agentId !== undefined) {
      const agente = (await read($, agentes)).find(a => a.id === e.agentId)
      if (agente !== undefined) {
        empresaId = agente.empresaId
        tarefaId = agente.tarefaId
        await update($, agentes, lista =>
          lista.map(a =>
            a.id === e.agentId
              ? {
                  ...a,
                  status: e.isAborted ? 'interrompido' : 'concluido',
                  fim: agora,
                  tokens: a.tokens + (u ? tokensDoUso(u) : 0),
                }
              : a,
          ),
        )
      }
    } else {
      const modelo = await $.session.model().catch(() => s.modelo)
      if (modelo !== s.modelo) await update($, sessao, x => ({ ...x, modelo }))
    }
    if (u !== undefined) {
      await alterarUso($, atual => somarTokens(atual, empresaId, u.model, u))
      if (tarefaId !== null) {
        await alterarTarefas($, ts =>
          ts.map(t => (t.id === tarefaId ? { ...t, tokens: t.tokens + tokensDoUso(u) } : t)),
        )
      }
      if (!s.modelosUsados.includes(u.model)) {
        await update($, sessao, x => ({ ...x, modelosUsados: [...new Set([...x.modelosUsados, u.model])] }))
      }
    }
    return resultado
  })

  on('session.measure', async ($, e, next) => {
    const custo = e.cost?.usd
    if (custo !== undefined && e.changed.includes('cost')) {
      const s = await read($, sessao)
      const anterior = s.ultimoUsd ?? 0
      const delta = custo >= anterior ? custo - anterior : custo
      await update($, sessao, x => ({ ...x, ultimoUsd: custo }))
      if (delta > 0) {
        const empresaId = empresaDaSessao(await read($, empresas), s)
        await alterarUso($, atual => somarUsd(atual, empresaId, delta))
        if (s.tarefaAtiva !== null) {
          await alterarTarefas($, ts =>
            ts.map(t => (t.id === s.tarefaAtiva ? { ...t, usd: t.usd + delta } : t)),
          )
        }
      }
    }
    return next(e)
  })

  // -- agentes em execução ------------------------------------------------------
  on('agent.spawn', async ($, e, next) => {
    const iniciado = await next(e)
    if (iniciado.agentId !== undefined) {
      const s = await read($, sessao)
      const empresaId = empresaDaSessao(await read($, empresas), s)
      const agora = await $.clock.now()
      const id = iniciado.agentId
      await update($, agentes, lista =>
        [
          ...lista.filter(a => a.id !== id),
          {
            id,
            tipo: e.subagentType,
            modelo: iniciado.model,
            descricao: e.description,
            tarefaId: s.tarefaAtiva,
            empresaId,
            status: 'rodando' as const,
            inicio: agora,
            tokens: 0,
          },
        ].slice(-50),
      )
    }
    return iniciado
  }).catch(($, e, next) => next(e))

  // -- painel -------------------------------------------------------------------
  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const s = await read($, sessao)
    const lista = await read($, empresas)
    const dados = {
      empresas: lista,
      tarefas: await read($, tarefas),
      uso: await read($, uso),
      git: await read($, git),
      agentes: await read($, agentes),
      sessao: s,
      filtro: await read($, filtro),
      aba: await read($, aba),
      agora: await $.clock.now(),
      largura: e.props.bodyColumns,
      empresaSessao: empresaDaSessao(lista, s),
    }
    return desenharPainel($.ui.resolve(e), dados, acoesDoPainel($), config)
  })
}
