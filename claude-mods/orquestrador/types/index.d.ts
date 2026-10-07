export type Projeto = { nome: string; caminho: string }

export type Empresa = { id: string; nome: string; projetos: Projeto[] }

export type StatusTarefa = 'backlog' | 'andamento' | 'revisao' | 'entregue'

export type Tarefa = {
  id: string
  empresaId: string
  titulo: string
  epico?: string
  projeto?: string
  branch?: string
  status: StatusTarefa
  resumo?: string
  criadaEm: number
  atualizadaEm: number
  entregueEm?: number
  tokens: number
  usd: number
}

export type UsoModelo = {
  entrada: number
  saida: number
  cacheLeitura: number
  cacheEscrita: number
  turnos: number
}

export type UsoEmpresa = { usd: number; porModelo: Record<string, UsoModelo> }

/** Por id de empresa; '_sem' guarda o que não pertence a nenhuma. */
export type Uso = Record<string, UsoEmpresa>

export type BranchGit = { nome: string; em: number }

export type GitProjeto = {
  atual: string | null
  branches: BranchGit[]
  alteracoes: number
  erro?: string
  lidoEm: number
}

export type Agente = {
  id: string
  tipo: string
  modelo: string
  descricao: string
  tarefaId: string | null
  empresaId: string
  status: 'rodando' | 'concluido' | 'interrompido'
  inicio: number
  fim?: number
  tokens: number
}

export type Aba = 'resumo' | 'tarefas' | 'projetos' | 'tokens' | 'agentes'

export type Sessao = {
  cwd: string
  home: string
  modelo: string
  empresaFixada: string | null
  tarefaAtiva: string | null
  ultimoUsd: number | null
  modelosUsados: string[]
}

declare module 'claude-code' {
  interface PluginState {
    orquestrador: {
      empresas: Empresa[]
      tarefas: Tarefa[]
      uso: Uso
      git: Record<string, GitProjeto>
      agentes: Agente[]
      aba: Aba
      filtro: string
      sessao: Sessao
    }
  }
}
