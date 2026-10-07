import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const CWD = '/home/sam/code/acme-api'

/** O mundo abaixo do plugin: o que o engine responderia numa sessão. */
function mundo(on: On) {
  mock.clock(on, { now: 1_700_000_000_000 })
  mock.store(on)
  mock.env(on, { HOME: '/home/sam' })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.repo', () => ({ value: null }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__orquestrador__${e.name}` } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('agent.register', ($, e) => ({ value: { agent: `orquestrador:${e.name}` } }))
  on('process.run', () => ({
    value: {
      exitCode: 0,
      stdout: 'main\n',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
}

const PANE_PROPS = {
  title: 'Orquestrador',
  isFocused: true,
  bodyColumns: 100,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
} as const

test('cadastra empresa, cria tarefa na empresa da sessão e resume', async ($, on) => {
  mundo(on)
  await $.session.start({ cwd: CWD, surface: null, isInteractive: false })

  const empresa = await $.tool.call({
    tool: 'mcp__orquestrador__empresa_salvar',
    nome: 'Acme',
    projetos: [{ nome: 'api', caminho: '~/code/acme-api' }],
  })
  expect(String(empresa.result)).toContain('Empresa Acme (id acme) cadastrada')

  const criada = await $.tool.call({
    tool: 'mcp__orquestrador__tarefa_salvar',
    titulo: 'Login social',
    epico: 'Auth',
    branch: 'feat/login',
  })
  expect(String(criada.result)).toContain('"Login social" · Acme · backlog · épico Auth · branch feat/login')

  const id = String(criada.result).match(/#([0-9a-f]{4})/)?.[1] ?? ''
  const entregue = await $.tool.call({
    tool: 'mcp__orquestrador__tarefa_salvar',
    id,
    status: 'entregue',
    resumo: 'OAuth com Google',
  })
  expect(String(entregue.result)).toContain('entregue')

  const resumo = await $.tool.call({ tool: 'mcp__orquestrador__resumo' })
  expect(String(resumo.result)).toContain('## Acme (acme)')
  expect(String(resumo.result)).toContain('Entregues (1):')
  expect(String(resumo.result)).toContain('OAuth com Google')
  expect(String(resumo.result)).toContain('Projeto api (~/code/acme-api): ⎇ main')
})

test('tokens de um turno contam para a empresa e para a tarefa ativa', async ($, on) => {
  mundo(on)
  await $.session.start({ cwd: CWD, surface: null, isInteractive: false })
  await $.tool.call({
    tool: 'mcp__orquestrador__empresa_salvar',
    nome: 'Acme',
    projetos: [{ caminho: '/home/sam/code/acme-api' }],
  })
  const criada = await $.tool.call({
    tool: 'mcp__orquestrador__tarefa_salvar',
    titulo: 'Ajustar CI',
    status: 'andamento',
  })
  const id = String(criada.result).match(/#([0-9a-f]{4})/)?.[1] ?? ''

  await $.turn.complete({
    answer: 'pronto',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      model: 'claude-opus-5-5',
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 20_000,
      cache_creation_input_tokens: 0,
    },
  })

  const resumo = String((await $.tool.call({ tool: 'mcp__orquestrador__resumo', empresa: 'acme' })).result)
  expect(resumo).toContain('## Acme (acme) — 21,5 mil tokens')

  expect(resumo).toContain(`● #${id} Ajustar CI — em andamento · 21,5 mil tokens`)
})

test('o painel desenha as abas e entrega uma tarefa pelo botão', async ($, on) => {
  mundo(on)
  await $.session.start({ cwd: CWD, surface: null, isInteractive: false })
  await $.tool.call({
    tool: 'mcp__orquestrador__empresa_salvar',
    nome: 'Acme',
    projetos: [{ nome: 'api', caminho: '~/code/acme-api' }],
  })
  const criada = await $.tool.call({ tool: 'mcp__orquestrador__tarefa_salvar', titulo: 'Login social', epico: 'Auth' })
  const id = String(criada.result).match(/#([0-9a-f]{4})/)?.[1] ?? ''

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({
      plugin: 'orquestrador',
      surface,
      component: 'Pane',
      requestId: 'orquestrador',
      props: PANE_PROPS,
    })
    expect(await ui.find({ text: /Orquestrador/ })).toBeDefined()
    expect(await ui.find({ text: /Login social/ })).toBeDefined()

    await ui.press({ key: 'aba-tarefas' })
    expect(await ui.find({ text: /◆ Auth · 0\/1 entregues/ })).toBeDefined()

    await ui.press({ key: 'aba-projetos' })
    expect(await ui.find({ text: /⎇ main/ })).toBeDefined()

    await ui.press({ key: 'aba-tokens' })
    expect(await ui.find({ text: /Total: 0 tokens/ })).toBeDefined()

    await ui.press({ key: 'aba-agentes' })
    expect(await ui.find({ key: `executar-${id}` })).toBeDefined()

    await ui.press({ key: 'aba-resumo' })
    await ui.unmount()
  }

  const ui = await $.ui.mount({
    plugin: 'orquestrador',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'orquestrador',
    props: PANE_PROPS,
  })
  await ui.press({ key: 'aba-tarefas' })
  await ui.press({ key: `entregar-${id}` })
  expect(await ui.find({ text: /◆ Auth · 1\/1 entregues/ })).toBeDefined()
  await ui.unmount()
})

test('⚡ envia a tarefa para os agentes e o painel acompanha o executor', async ($, on) => {
  mundo(on)
  const enviados: string[] = []
  on('prompt.submit', ($, e) => {
    enviados.push(e.text)
    return { text: e.text }
  })
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'ag1' }))
  await $.session.start({ cwd: CWD, surface: null, isInteractive: false })
  await $.tool.call({
    tool: 'mcp__orquestrador__empresa_salvar',
    nome: 'Acme',
    projetos: [{ nome: 'api', caminho: '~/code/acme-api' }],
  })
  const criada = await $.tool.call({ tool: 'mcp__orquestrador__tarefa_salvar', titulo: 'Exportar CSV', branch: 'feat/csv' })
  const id = String(criada.result).match(/#([0-9a-f]{4})/)?.[1] ?? ''

  const ui = await $.ui.mount({
    plugin: 'orquestrador',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'orquestrador',
    props: PANE_PROPS,
  })
  await ui.press({ key: 'aba-agentes' })
  await ui.press({ key: `executar-${id}` })

  expect(enviados.length).toBe(1)
  expect(enviados[0]).toContain(`Execute a tarefa #${id} "Exportar CSV" (empresa Acme, branch feat/csv)`)
  expect(enviados[0]).toContain('orquestrador:executor')
  expect(enviados[0]).toContain('orquestrador:revisor')
  expect(await ui.find({ text: new RegExp(`▶ tarefa ativa: #${id} Exportar CSV`) })).toBeDefined()

  await $.agent.spawn({
    tool_use_id: 'toolu_1',
    prompt: 'parte 1',
    subagentType: 'orquestrador:executor',
    description: 'Gerar CSV',
    provider: { plugin: 'orquestrador', tier: 'user' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })
  expect(await ui.find({ text: /● orquestrador:executor · sonnet-5-5 · Gerar CSV/ })).toBeDefined()

  await $.turn.complete({
    answer: 'feito',
    durationMs: 5000,
    isAborted: false,
    turnId: 't2',
    reason: 'answer',
    agentId: 'ag1',
    usage: {
      model: 'claude-sonnet-5-5',
      input_tokens: 3000,
      output_tokens: 1000,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  })
  expect(await ui.find({ text: /✓ orquestrador:executor · sonnet-5-5 · Gerar CSV · #[0-9a-f]{4} · .* · 4,0 mil/ })).toBeDefined()
  expect(await ui.find({ text: /sonnet-5-5/ })).toBeDefined()
  await ui.unmount()

  const resumo = String((await $.tool.call({ tool: 'mcp__orquestrador__resumo' })).result)
  expect(resumo).toContain(`● #${id} Exportar CSV ⎇ feat/csv — em andamento · 4,0 mil tokens`)
})
