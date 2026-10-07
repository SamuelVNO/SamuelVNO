import type { Empresa, GitProjeto, Sessao, StatusTarefa, Tarefa, Uso } from '../types'

import {
  SEM_EMPRESA,
  TODAS,
  expandir,
  nomeEmpresa,
  resumoUso,
  totalTokens,
} from './estado'

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')} mil`
  return String(n)
}

export function fmtUsd(n: number): string {
  return `US$ ${n.toFixed(2).replace('.', ',')}`
}

export function haQuanto(quando: number, agora: number): string {
  const s = Math.max(0, Math.round((agora - quando) / 1000))
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  if (s < 86_400) return `há ${Math.round(s / 3600)} h`
  return `há ${Math.round(s / 86_400)} d`
}

export function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}min ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`
}

export const ICONE: Record<StatusTarefa, string> = {
  backlog: '○',
  andamento: '●',
  revisao: '◐',
  entregue: '✓',
}

export const ROTULO_STATUS: Record<StatusTarefa, string> = {
  backlog: 'a fazer',
  andamento: 'em andamento',
  revisao: 'em revisão',
  entregue: 'entregue',
}

export function modeloCurto(modelo: string): string {
  return modelo.replace(/^claude-/, '').replace(/-\d{8}$/, '')
}

export function linhaTarefa(t: Tarefa): string {
  const partes = [`${ICONE[t.status]} #${t.id} ${t.titulo}`]
  if (t.epico) partes.push(`[${t.epico}]`)
  if (t.branch) partes.push(`⎇ ${t.branch}`)
  return partes.join(' ')
}

/** Empresas a mostrar: as cadastradas, mais "Sem empresa" quando tem algo. */
export function empresasVisiveis(lista: Empresa[], ts: Tarefa[], u: Uso, filtro: string): string[] {
  const ids = lista.map(e => e.id)
  const temSem = ts.some(t => t.empresaId === SEM_EMPRESA) || u[SEM_EMPRESA] !== undefined
  if (temSem) ids.push(SEM_EMPRESA)
  return ids.filter(id => filtro === TODAS || filtro === id)
}

/** O resumo em texto: o que a ferramenta devolve ao modelo e o /orq resumo mostra. */
export function resumoTexto(args: {
  empresas: Empresa[]
  tarefas: Tarefa[]
  uso: Uso
  git: Record<string, GitProjeto>
  sessao: Sessao
  filtro: string
  agora: number
}): string {
  const { empresas: lista, tarefas: ts, uso: u, git: g, sessao: s, filtro, agora } = args
  const ids = empresasVisiveis(lista, ts, u, filtro)
  if (ids.length === 0) {
    return 'Nenhuma empresa cadastrada ainda. Cadastre com mcp__orquestrador__empresa_salvar.'
  }
  const linhas: string[] = []
  for (const id of ids) {
    const total = resumoUso(u[id])
    linhas.push(
      `## ${nomeEmpresa(lista, id)} (${id}) — ${fmtTokens(totalTokens(total))} tokens · ${fmtUsd(u[id]?.usd ?? 0)}`,
    )
    const daEmpresa = ts.filter(t => t.empresaId === id)
    const abertas = daEmpresa.filter(t => t.status !== 'entregue')
    const entregues = daEmpresa
      .filter(t => t.status === 'entregue')
      .sort((a, b) => (b.entregueEm ?? 0) - (a.entregueEm ?? 0))
    linhas.push(`Em aberto (${abertas.length}):`)
    for (const t of abertas) {
      const gasto = t.tokens > 0 ? ` · ${fmtTokens(t.tokens)} tokens` : ''
      linhas.push(`- ${linhaTarefa(t)} — ${ROTULO_STATUS[t.status]}${gasto}${t.resumo ? ` — ${t.resumo}` : ''}`)
    }
    linhas.push(`Entregues (${entregues.length}):`)
    for (const t of entregues.slice(0, 10)) {
      const quando = t.entregueEm ? ` (${haQuanto(t.entregueEm, agora)})` : ''
      linhas.push(`- ${linhaTarefa(t)}${quando}${t.resumo ? ` — ${t.resumo}` : ''}`)
    }
    const empresa = lista.find(e => e.id === id)
    for (const p of empresa?.projetos ?? []) {
      const info = g[expandir(p.caminho, s.home)]
      const branch = info?.atual ? `⎇ ${info.atual}` : (info?.erro ?? 'git ainda não lido')
      const alt = info && info.alteracoes > 0 ? `, ${info.alteracoes} alterações` : ''
      linhas.push(`Projeto ${p.nome} (${p.caminho}): ${branch}${alt}`)
    }
    linhas.push('')
  }
  return linhas.join('\n').trim()
}

// ---------------------------------------------------------------------------
// Orquestração com agentes

export function promptOrquestracao(t: Tarefa, empresa: string): string {
  const contexto = [
    `empresa ${empresa}`,
    t.projeto ? `projeto ${t.projeto}` : null,
    t.epico ? `épico ${t.epico}` : null,
    t.branch ? `branch ${t.branch}` : null,
  ]
    .filter(Boolean)
    .join(', ')
  return [
    `Execute a tarefa #${t.id} "${t.titulo}" (${contexto}) usando agentes em paralelo, sem perder qualidade.`,
    t.resumo ? `Contexto da tarefa: ${t.resumo}` : '',
    '',
    'Siga estas etapas, nesta ordem:',
    `1. Chame mcp__orquestrador__tarefa_salvar com {"id": "${t.id}", "status": "andamento"}.`,
    t.branch
      ? `2. Garanta que o trabalho acontece na branch ${t.branch}. Leia o código relevante e escreva um plano curto que divida o trabalho em subtarefas INDEPENDENTES, que não editem os mesmos arquivos. Se a tarefa for pequena, uma subtarefa basta.`
      : '2. Leia o código relevante e escreva um plano curto que divida o trabalho em subtarefas INDEPENDENTES, que não editem os mesmos arquivos. Se a tarefa for pequena, uma subtarefa basta.',
    '3. Dispare, numa única mensagem, um agente `orquestrador:executor` por subtarefa, para que rodem em paralelo. Dê a cada um o objetivo, os arquivos em que pode mexer e o critério de pronto.',
    '4. Quando todos terminarem, dispare um agente `orquestrador:revisor` com o objetivo da tarefa e o que cada executor relatou. Ele roda testes, lint e typecheck e revisa o diff.',
    '5. Corrija tudo o que o revisor apontar, você mesmo ou com novos executores, e peça nova revisão até não sobrar nada.',
    `6. Finalize chamando mcp__orquestrador__tarefa_salvar com {"id": "${t.id}", "status": "entregue", "resumo": "<o que foi feito, arquivos principais e como validar>"}. Se algo bloquear a entrega, use "status": "revisao" e explique o bloqueio no resumo.`,
  ]
    .filter(l => l !== '')
    .join('\n')
}

export const PROMPT_EXECUTOR = `Você é um executor do Orquestrador: recebe UMA subtarefa bem delimitada de uma tarefa maior e a entrega pronta.

Regras:
- Fique no escopo que recebeu. Não edite arquivos fora dele, porque outros executores trabalham em paralelo nos demais.
- Leia o código ao redor antes de mudar e siga o estilo, os nomes e os padrões do projeto.
- Rode os testes, o lint e o typecheck que cobrem o que você mudou, e corrija o que falhar.
- Não faça commit nem push, a não ser que a subtarefa peça.
- Se algo impedir a entrega (falta de informação, conflito com outro escopo), pare e explique em vez de adivinhar.

Ao terminar, responda com:
1. O que foi feito, em poucas linhas.
2. Os arquivos alterados.
3. Os comandos de validação que rodou e o resultado de cada um.
4. Riscos ou pendências que o revisor deve olhar.`

export const PROMPT_REVISOR = `Você é o revisor do Orquestrador: valida o resultado de uma tarefa antes da entrega. Você não edita arquivos.

Faça, nesta ordem:
1. Veja o que mudou (git status, git diff) e compare com o objetivo da tarefa.
2. Rode os testes, o lint e o typecheck do projeto, ou os mais próximos do que mudou.
3. Leia o diff procurando bugs reais: lógica errada, casos de borda, erros não tratados, testes faltando para o comportamento novo, quebra de contrato com quem chama o código.

Responda com:
- VEREDITO: "aprovado" ou "precisa de ajustes".
- Os problemas encontrados, cada um com arquivo:linha, o porquê e a correção sugerida, do mais grave para o menos grave.
- A saída resumida dos comandos de validação.
Não aponte questões de gosto: só o que quebra, arrisca ou falta.`
