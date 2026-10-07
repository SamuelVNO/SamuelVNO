import type { Elements, RenderElement, RenderSurface } from 'claude-code'

import type { Aba, Agente, Empresa, GitProjeto, Sessao, Tarefa, Uso } from '../types'

import { SEM_EMPRESA, TODAS, expandir, nomeEmpresa, resumoUso, totalTokens } from './estado'
import {
  ROTULO_STATUS,
  duracao,
  empresasVisiveis,
  fmtTokens,
  fmtUsd,
  haQuanto,
  linhaTarefa,
  modeloCurto,
} from './texto'

/** O que os botões do painel fazem; quem as monta (com o $) é o register. */
export type Acoes = {
  mostrarAba: (aba: Aba) => Promise<unknown>
  filtrar: (empresaId: string) => Promise<unknown>
  iniciar: (id: string) => Promise<void>
  entregar: (id: string) => Promise<void>
  executar: (id: string) => Promise<void>
  criar: (texto: string, empresaId: string) => Promise<void>
  fixarEmpresa: (id: string | null) => Promise<void>
  atualizarGit: () => Promise<void>
}

export type Config = { modeloExecutores: string; modeloRevisor: string }

const ABAS: readonly { id: Aba; rotulo: string }[] = [
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'tarefas', rotulo: 'Tarefas' },
  { id: 'projetos', rotulo: 'Projetos' },
  { id: 'tokens', rotulo: 'Tokens' },
  { id: 'agentes', rotulo: 'Agentes' },
]

/** Tudo o que o painel desenha, já lido do estado pelo register. */
export type Dados = {
  empresas: Empresa[]
  tarefas: Tarefa[]
  uso: Uso
  git: Record<string, GitProjeto>
  agentes: Agente[]
  sessao: Sessao
  filtro: string
  aba: Aba
  agora: number
  largura: number
  empresaSessao: string
}

export function desenharPainel(
  tabela: Elements[RenderSurface],
  dados: Dados,
  acoes: Acoes,
  config: Config,
): RenderElement {
  const { Box, Text, Button } = tabela
  const Input = 'Input' in tabela ? tabela.Input : undefined
  const d: Dados = {
    ...dados,
    largura: Math.max(20, dados.largura),
    filtro:
      dados.filtro === TODAS || dados.filtro === SEM_EMPRESA || dados.empresas.some(x => x.id === dados.filtro)
        ? dados.filtro
        : TODAS,
  }

  const linha = (texto: string, props: Record<string, unknown> = {}) => (
    <Text wrap="truncate-end" {...props}>
      {texto}
    </Text>
  )
  const separador = () => <Text dimColor>{'─'.repeat(Math.min(d.largura, 80))}</Text>
  const botao = (key: string, label: string, onPress: () => unknown, ativo = false) => (
    <Button key={key} label={label} {...(ativo ? { variant: 'primary' as const } : {})} onPress={() => void onPress()} />
  )

  // -- cabeçalho ------------------------------------------------------------
  const ativa = d.tarefas.find(t => t.id === d.sessao.tarefaAtiva)
  const cabecalho = (
    <Box flexDirection="column">
      <Text wrap="truncate-end">
        <Text bold color="claude">
          Orquestrador
        </Text>
        <Text dimColor>
          {' '}
          · sessão: {nomeEmpresa(d.empresas, d.empresaSessao)}
          {d.sessao.empresaFixada !== null ? ' (fixada)' : ''} · {modeloCurto(d.sessao.modelo || '?')}
        </Text>
      </Text>
      {ativa !== undefined && linha(`▶ tarefa ativa: #${ativa.id} ${ativa.titulo}`, { color: 'success' })}
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {ABAS.map(a => botao(`aba-${a.id}`, a.rotulo, () => acoes.mostrarAba(a.id), a.id === d.aba))}
      </Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {botao('filtro-todas', 'Todas', () => acoes.filtrar(TODAS), d.filtro === TODAS)}
        {d.empresas.map(x =>
          botao(`filtro-${x.id}`, x.nome, () => acoes.filtrar(x.id), d.filtro === x.id),
        )}
      </Box>
      {separador()}
    </Box>
  )

  const visiveis = empresasVisiveis(d.empresas, d.tarefas, d.uso, d.filtro)

  // -- abas -----------------------------------------------------------------
  const vazio =
    d.empresas.length === 0 ? (
      <Box flexDirection="column">
        <Text>Nenhuma empresa cadastrada ainda.</Text>
        <Text dimColor wrap="wrap">
          Peça ao Claude, por exemplo: "cadastre a empresa Acme com os projetos ~/code/acme-api e
          ~/code/acme-web". As sessões abertas dentro desses caminhos passam a contar para a Acme.
        </Text>
      </Box>
    ) : null

  const abaResumo = () => (
    <Box flexDirection="column">
      {vazio}
      {visiveis.map(id => {
        const daEmpresa = d.tarefas.filter(t => t.empresaId === id)
        const abertas = daEmpresa.filter(t => t.status !== 'entregue')
        const entregues = daEmpresa
          .filter(t => t.status === 'entregue')
          .sort((a, b) => (b.entregueEm ?? 0) - (a.entregueEm ?? 0))
        const total = resumoUso(d.uso[id])
        const empresa = d.empresas.find(x => x.id === id)
        return (
          <Box key={`resumo-${id}`} flexDirection="column" marginBottom={1}>
            <Text wrap="truncate-end">
              <Text bold color="suggestion">
                ▌{nomeEmpresa(d.empresas, id)}
              </Text>
              <Text dimColor>
                {' '}
                {fmtTokens(totalTokens(total))} tokens · {fmtUsd(d.uso[id]?.usd ?? 0)}
              </Text>
            </Text>
            {linha(`  Em aberto (${abertas.length})`, { bold: true })}
            {abertas.length === 0 && linha('    nada em aberto', { dimColor: true })}
            {abertas.slice(0, 8).map(t =>
              linha(`    ${linhaTarefa(t)} · ${ROTULO_STATUS[t.status]}`, t.status === 'andamento' ? {} : { dimColor: true }),
            )}
            {linha(`  Entregues (${entregues.length})`, { bold: true })}
            {entregues.slice(0, 5).map(t =>
              linha(`    ${linhaTarefa(t)} · ${t.entregueEm ? haQuanto(t.entregueEm, d.agora) : ''}`, { color: 'success' }),
            )}
            {(empresa?.projetos ?? []).map(p => {
              const info = d.git[expandir(p.caminho, d.sessao.home)]
              const branch = info?.atual ? `⎇ ${info.atual}` : (info?.erro ?? '…')
              const alt = info && info.alteracoes > 0 ? ` · ${info.alteracoes} alterações` : ''
              return linha(`  ◇ ${p.nome}: ${branch}${alt}`, { dimColor: true })
            })}
          </Box>
        )
      })}
    </Box>
  )

  const abaTarefas = () => {
    const destino = d.filtro !== TODAS ? d.filtro : d.empresaSessao
    return (
      <Box flexDirection="column">
        {vazio}
        {Input !== undefined && (
          <Input
            key="nova-tarefa"
            label={`Nova tarefa em ${nomeEmpresa(d.empresas, destino)}`}
            placeholder="título #épico"
            submitLabel="Criar"
            onSubmit={valor => void acoes.criar(valor, destino)}
          />
        )}
        {visiveis.map(id => {
          const daEmpresa = d.tarefas.filter(t => t.empresaId === id)
          const epicos = [...new Set(daEmpresa.map(t => t.epico ?? ''))].sort((a, b) =>
            a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
          )
          return (
            <Box key={`tarefas-${id}`} flexDirection="column" marginTop={1}>
              {linha(`▌${nomeEmpresa(d.empresas, id)}`, { bold: true, color: 'suggestion' })}
              {daEmpresa.length === 0 && linha('  nenhuma tarefa', { dimColor: true })}
              {epicos.map(epico => {
                const doEpico = daEmpresa.filter(t => (t.epico ?? '') === epico)
                const feitas = doEpico.filter(t => t.status === 'entregue').length
                const abertas = doEpico.filter(t => t.status !== 'entregue')
                return (
                  <Box key={`epico-${id}-${epico}`} flexDirection="column">
                    {linha(`  ◆ ${epico === '' ? 'Sem épico' : epico} · ${feitas}/${doEpico.length} entregues`, {
                      bold: true,
                    })}
                    {abertas.map(t => (
                      <Box key={`tarefa-${t.id}`} flexDirection="row" columnGap={1}>
                        <Box flexGrow={1} flexShrink={1}>
                          {linha(
                            `    ${linhaTarefa(t)}${t.tokens > 0 ? ` · ${fmtTokens(t.tokens)}` : ''}`,
                            t.id === d.sessao.tarefaAtiva ? { color: 'success' } : {},
                          )}
                        </Box>
                        {t.status !== 'andamento' && botao(`iniciar-${t.id}`, '▶', () => acoes.iniciar(t.id))}
                        {botao(`agentes-${t.id}`, '⚡', () => acoes.executar(t.id))}
                        {botao(`entregar-${t.id}`, '✓', () => acoes.entregar(t.id))}
                      </Box>
                    ))}
                    {doEpico.length > abertas.length &&
                      linha(`    ✓ ${doEpico.length - abertas.length} entregue(s)`, { dimColor: true })}
                  </Box>
                )
              })}
            </Box>
          )
        })}
        <Box marginTop={1}>
          <Text dimColor wrap="wrap">
            ▶ ativa a tarefa (os tokens passam a contar para ela) · ⚡ executa com agentes em paralelo + revisor · ✓
            entrega
          </Text>
        </Box>
      </Box>
    )
  }

  const blocoGit = (chave: string, titulo: string, caminho: string) => {
    const info = d.git[caminho]
    return (
      <Box key={chave} flexDirection="column">
        {linha(`  ◇ ${titulo}`, { bold: true })}
        {linha(`    ${caminho}`, { dimColor: true })}
        {info === undefined && linha('    lendo o git…', { dimColor: true })}
        {info?.erro !== undefined && linha(`    ${info.erro}`, { color: 'warning' })}
        {info?.atual &&
          linha(
            `    ⎇ ${info.atual}${info.alteracoes > 0 ? ` · ${info.alteracoes} alterações não commitadas` : ' · limpo'}`,
          )}
        {info !== undefined &&
          info.branches
            .filter(b => b.nome !== info.atual)
            .slice(0, 5)
            .map(b => linha(`      ${b.nome} · ${haQuanto(b.em, d.agora)}`, { dimColor: true }))}
      </Box>
    )
  }

  const abaProjetos = () => {
    const cadastrados = new Set(
      d.empresas.flatMap(x => x.projetos.map(p => expandir(p.caminho, d.sessao.home))),
    )
    const avulsos = Object.keys(d.git).filter(c => !cadastrados.has(c))
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">{botao('atualizar-git', '↻ Atualizar branches', () => acoes.atualizarGit())}</Box>
        {vazio}
        {visiveis
          .filter(id => id !== SEM_EMPRESA)
          .map(id => {
            const empresa = d.empresas.find(x => x.id === id)
            return (
              <Box key={`projetos-${id}`} flexDirection="column" marginTop={1}>
                {linha(`▌${nomeEmpresa(d.empresas, id)}`, { bold: true, color: 'suggestion' })}
                {(empresa?.projetos.length ?? 0) === 0 && linha('  nenhum projeto', { dimColor: true })}
                {(empresa?.projetos ?? []).map(p =>
                  blocoGit(`git-${id}-${p.caminho}`, p.nome, expandir(p.caminho, d.sessao.home)),
                )}
              </Box>
            )
          })}
        {d.filtro === TODAS && avulsos.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {linha('▌Repositório desta sessão (sem empresa)', { bold: true, color: 'suggestion' })}
            {avulsos.map(c => blocoGit(`git-avulso-${c}`, c.split('/').pop() ?? c, c))}
          </Box>
        )}
      </Box>
    )
  }

  const abaTokens = () => {
    let maior = 1
    for (const id of visiveis) {
      for (const m of Object.values(d.uso[id]?.porModelo ?? {})) maior = Math.max(maior, totalTokens(m))
    }
    const larguraBarra = Math.max(4, Math.min(20, d.largura - 50))
    const barra = (n: number) => {
      const cheio = Math.round((n / maior) * larguraBarra)
      return '█'.repeat(cheio) + '░'.repeat(larguraBarra - cheio)
    }
    let geral = 0
    let geralUsd = 0
    for (const id of visiveis) {
      geral += totalTokens(resumoUso(d.uso[id]))
      geralUsd += d.uso[id]?.usd ?? 0
    }
    return (
      <Box flexDirection="column">
        {linha(`Total: ${fmtTokens(geral)} tokens · ${fmtUsd(geralUsd)}`, { bold: true })}
        {visiveis.map(id => {
          const daEmpresa = d.uso[id]
          const total = resumoUso(daEmpresa)
          const modelos = Object.entries(daEmpresa?.porModelo ?? {}).sort(
            ([, a], [, b]) => totalTokens(b) - totalTokens(a),
          )
          return (
            <Box key={`tokens-${id}`} flexDirection="column" marginTop={1}>
              {linha(
                `▌${nomeEmpresa(d.empresas, id)} · ${fmtTokens(totalTokens(total))} tokens · ${fmtUsd(daEmpresa?.usd ?? 0)}`,
                { bold: true, color: 'suggestion' },
              )}
              {modelos.length === 0 && linha('  sem uso registrado', { dimColor: true })}
              {modelos.map(([modelo, m]) => (
                <Box key={`modelo-${id}-${modelo}`} flexDirection="column">
                  {linha(`  ${barra(totalTokens(m))} ${modeloCurto(modelo)} · ${fmtTokens(totalTokens(m))} · ${m.turnos} turnos`)}
                  {linha(
                    `    entrada ${fmtTokens(m.entrada)} · saída ${fmtTokens(m.saida)} · cache lido ${fmtTokens(m.cacheLeitura)} · cache gravado ${fmtTokens(m.cacheEscrita)}`,
                    { dimColor: true },
                  )}
                </Box>
              ))}
            </Box>
          )
        })}
        <Box marginTop={1}>
          <Text dimColor wrap="wrap">
            Os tokens contam para a empresa da sessão (pelo caminho do projeto, ou a que você fixar na aba Agentes). O
            valor em US$ vem do custo que o Claude Code registra para a sessão.
          </Text>
        </Box>
      </Box>
    )
  }

  const abaAgentes = () => {
    const rodando = d.agentes.filter(a => a.status === 'rodando')
    const recentes = d.agentes.filter(a => a.status !== 'rodando').slice(-8).reverse()
    const abertas = d.tarefas.filter(
      t => t.status !== 'entregue' && (d.filtro === TODAS || t.empresaId === d.filtro),
    )
    const rotuloAgente = (a: Agente) =>
      `${a.tipo} · ${modeloCurto(a.modelo)} · ${a.descricao}${a.tarefaId ? ` · #${a.tarefaId}` : ''} · ${duracao((a.fim ?? d.agora) - a.inicio)}${a.tokens > 0 ? ` · ${fmtTokens(a.tokens)}` : ''}`
    return (
      <Box flexDirection="column">
        {linha(`Modelo da sessão: ${d.sessao.modelo || '?'}`)}
        {linha(
          `Modelos usados nesta sessão: ${d.sessao.modelosUsados.length === 0 ? 'nenhum ainda' : d.sessao.modelosUsados.map(modeloCurto).join(', ')}`,
        )}
        {linha(
          `Executores: ${config.modeloExecutores} · Revisor: ${config.modeloRevisor} (mude em /config)`,
          { dimColor: true },
        )}
        <Box flexDirection="row" flexWrap="wrap" columnGap={1} marginTop={1}>
          <Text>Esta sessão conta para:</Text>
          {botao('fixar-auto', 'Automático', () => acoes.fixarEmpresa(null), d.sessao.empresaFixada === null)}
          {d.empresas.map(x =>
            botao(`fixar-${x.id}`, x.nome, () => acoes.fixarEmpresa(x.id), d.sessao.empresaFixada === x.id),
          )}
        </Box>
        <Box flexDirection="column" marginTop={1}>
          {linha(`Rodando (${rodando.length})`, { bold: true })}
          {rodando.length === 0 && linha('  nenhum agente rodando', { dimColor: true })}
          {rodando.map(a => linha(`  ● ${rotuloAgente(a)}`, { color: 'warning' }))}
          {recentes.length > 0 && linha('Recentes', { bold: true })}
          {recentes.map(a =>
            linha(`  ${a.status === 'concluido' ? '✓' : '✗'} ${rotuloAgente(a)}`, { dimColor: true }),
          )}
        </Box>
        <Box flexDirection="column" marginTop={1}>
          {linha('Executar uma tarefa com agentes', { bold: true })}
          <Text dimColor wrap="wrap">
            Planeja, divide em subtarefas independentes, roda executores em paralelo, passa tudo por um revisor (testes,
            lint, diff), corrige o que ele apontar e só então marca como entregue.
          </Text>
          {abertas.length === 0 && linha('  nenhuma tarefa em aberto', { dimColor: true })}
          {abertas.slice(0, 10).map(t => (
            <Box key={`exec-${t.id}`} flexDirection="row" columnGap={1}>
              <Box flexGrow={1} flexShrink={1}>
                {linha(`  ${linhaTarefa(t)} · ${nomeEmpresa(d.empresas, t.empresaId)}`)}
              </Box>
              {botao(`executar-${t.id}`, '⚡ Executar', () => acoes.executar(t.id))}
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  const conteudo = {
    resumo: abaResumo,
    tarefas: abaTarefas,
    projetos: abaProjetos,
    tokens: abaTokens,
    agentes: abaAgentes,
  }[d.aba]()

  return (
    <Box flexDirection="column">
      {cabecalho}
      {conteudo}
    </Box>
  )
}
