import type { ModelUsage } from 'claude-code'

import type { Empresa, GitProjeto, Sessao, StatusTarefa, Tarefa, Uso, UsoEmpresa, UsoModelo } from '../types'

export const SEM_EMPRESA = '_sem'
export const TODAS = '_todas'

// ---------------------------------------------------------------------------
// Caminhos e empresa da sessão

export function normalizar(caminho: string): string {
  const limpo = caminho.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  return limpo === '' ? '/' : limpo
}

export function expandir(caminho: string, home: string): string {
  const c = caminho.trim()
  if (c === '~') return normalizar(home)
  if (c.startsWith('~/') || c.startsWith('~\\')) return normalizar(home + c.slice(1))
  return normalizar(c)
}

export function contem(raiz: string, alvo: string): boolean {
  return alvo === raiz || alvo.startsWith(raiz === '/' ? '/' : `${raiz}/`)
}

export function empresaDoCaminho(lista: Empresa[], cwd: string, home: string): Empresa | undefined {
  let melhor: Empresa | undefined
  let tamanho = -1
  for (const empresa of lista) {
    for (const projeto of empresa.projetos) {
      const raiz = expandir(projeto.caminho, home)
      if (contem(raiz, cwd) && raiz.length > tamanho) {
        melhor = empresa
        tamanho = raiz.length
      }
    }
  }
  return melhor
}

export function empresaDaSessao(lista: Empresa[], s: Sessao): string {
  if (s.empresaFixada !== null && lista.some(e => e.id === s.empresaFixada)) {
    return s.empresaFixada
  }
  return empresaDoCaminho(lista, s.cwd, s.home)?.id ?? SEM_EMPRESA
}

export function acharEmpresa(lista: Empresa[], nomeOuId: string): Empresa | undefined {
  const alvo = nomeOuId.trim().toLowerCase()
  return lista.find(e => e.id === nomeOuId || e.nome.toLowerCase() === alvo)
}

export function nomeEmpresa(lista: Empresa[], id: string): string {
  if (id === SEM_EMPRESA) return 'Sem empresa'
  return lista.find(e => e.id === id)?.nome ?? id
}

// ---------------------------------------------------------------------------
// Ids, tarefas, uso

export function novoId(existentes: Iterable<string>): string {
  const usados = new Set(existentes)
  for (;;) {
    const bytes = new Uint8Array(2)
    crypto.getRandomValues(bytes)
    const id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    if (!usados.has(id)) return id
  }
}

export function slug(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base === '' ? 'empresa' : base.slice(0, 40)
}

export const STATUS: readonly StatusTarefa[] = ['backlog', 'andamento', 'revisao', 'entregue']

export function mudarStatus(tarefa: Tarefa, status: StatusTarefa, agora: number): Tarefa {
  return {
    ...tarefa,
    status,
    atualizadaEm: agora,
    entregueEm: status === 'entregue' ? (tarefa.entregueEm ?? agora) : undefined,
  }
}

const USO_VAZIO: UsoModelo = { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0, turnos: 0 }

export function totalTokens(u: UsoModelo): number {
  return u.entrada + u.saida + u.cacheLeitura + u.cacheEscrita
}

export function tokensDoUso(u: ModelUsage): number {
  return u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
}

export function somarTokens(atual: Uso, empresaId: string, modelo: string, u: ModelUsage): Uso {
  const daEmpresa: UsoEmpresa = atual[empresaId] ?? { usd: 0, porModelo: {} }
  const doModelo = daEmpresa.porModelo[modelo] ?? USO_VAZIO
  return {
    ...atual,
    [empresaId]: {
      ...daEmpresa,
      porModelo: {
        ...daEmpresa.porModelo,
        [modelo]: {
          entrada: doModelo.entrada + u.input_tokens,
          saida: doModelo.saida + u.output_tokens,
          cacheLeitura: doModelo.cacheLeitura + u.cache_read_input_tokens,
          cacheEscrita: doModelo.cacheEscrita + u.cache_creation_input_tokens,
          turnos: doModelo.turnos + 1,
        },
      },
    },
  }
}

export function somarUsd(atual: Uso, empresaId: string, usd: number): Uso {
  const daEmpresa: UsoEmpresa = atual[empresaId] ?? { usd: 0, porModelo: {} }
  return { ...atual, [empresaId]: { ...daEmpresa, usd: daEmpresa.usd + usd } }
}

/** Move o uso de uma empresa para outra, somando com o que a outra já tem. */
export function mesclarUso(atual: Uso, de: string, para: string): Uso {
  const origem = atual[de]
  if (origem === undefined || de === para) return atual
  const destino: UsoEmpresa = atual[para] ?? { usd: 0, porModelo: {} }
  const porModelo = { ...destino.porModelo }
  for (const [modelo, m] of Object.entries(origem.porModelo)) {
    const d = porModelo[modelo] ?? USO_VAZIO
    porModelo[modelo] = {
      entrada: d.entrada + m.entrada,
      saida: d.saida + m.saida,
      cacheLeitura: d.cacheLeitura + m.cacheLeitura,
      cacheEscrita: d.cacheEscrita + m.cacheEscrita,
      turnos: d.turnos + m.turnos,
    }
  }
  const novo: Uso = { ...atual, [para]: { usd: destino.usd + origem.usd, porModelo } }
  delete novo[de]
  return novo
}

export function resumoUso(u: UsoEmpresa | undefined): UsoModelo {
  const total = { ...USO_VAZIO }
  for (const m of Object.values(u?.porModelo ?? {})) {
    total.entrada += m.entrada
    total.saida += m.saida
    total.cacheLeitura += m.cacheLeitura
    total.cacheEscrita += m.cacheEscrita
    total.turnos += m.turnos
  }
  return total
}

// ---------------------------------------------------------------------------
// Git (só a interpretação da saída; quem roda o git é o register)

export type SaidaGit = { exitCode: number; stdout: string; stderr: string }

function primeiraLinha(texto: string): string {
  return texto.split('\n').find(l => l.trim() !== '')?.trim() ?? ''
}

export function interpretarGit(head: SaidaGit, refs: SaidaGit | null, status: SaidaGit | null, lidoEm: number): GitProjeto {
  if (head.exitCode !== 0 || refs === null || status === null) {
    return { atual: null, branches: [], alteracoes: 0, erro: primeiraLinha(head.stderr) || 'não é um repositório git', lidoEm }
  }
  const branches = refs.stdout
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => {
      const [nome = '', segundos = '0'] = l.split('\t')
      return { nome, em: Number(segundos) * 1000 }
    })
  const alteracoes = status.stdout.split('\n').filter(l => l.trim() !== '').length
  return { atual: head.stdout.trim() || null, branches, alteracoes, lidoEm }
}
