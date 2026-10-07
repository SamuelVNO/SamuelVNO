# Orquestrador: mod para o Claude Code

Um painel dentro do Claude Code que junta, separado por empresa:

- **Projetos e branches**: a branch atual de cada projeto, as alterações não commitadas e as branches mais recentes.
- **Épicos e tarefas**: o que está a fazer, em andamento, em revisão e entregue, com o progresso de cada épico.
- **Tokens e custo**: quanto cada empresa gastou, separado por modelo (entrada, saída e cache), mais o valor em US$.
- **Modelos e agentes**: o modelo da sessão, os modelos usados e os agentes rodando ou já concluídos.
- **Execução com agentes**: um botão ⚡ que divide a tarefa em subtarefas independentes, roda executores em paralelo, passa o resultado por um revisor (testes, lint, diff), corrige o que ele apontar e só então marca a tarefa como entregue.

Os dados ficam salvos entre sessões. Os tokens de cada sessão contam para a empresa dona da pasta em que você abriu o Claude Code.

## Instalação

No terminal, dentro do Claude Code:

```
/plugin install orquestrador --marketplace SamuelVNO/SamuelVNO
```

Responda `y` para adicionar o marketplace e escolha o escopo (o de usuário vale para todas as sessões).

Para testar a partir de uma cópia local, sem instalar:

```
claude --plugin-dir caminho/para/claude-mods/orquestrador
```

## Primeiros passos

1. Cadastre suas empresas e projetos pedindo ao Claude em linguagem natural:
   > cadastre a empresa Acme com os projetos ~/code/acme-api e ~/code/acme-web, e a empresa Beta com ~/code/beta-app
2. Crie tarefas pelo painel (aba Tarefas, campo "Nova tarefa", com `#Épico` para o épico), pelo `/orq tarefa <título #épico>` ou pedindo ao Claude:
   > crie as tarefas "Login social" e "Recuperar senha" no épico Auth da Acme, branch feat/auth
3. Abra o painel com `/orq`.

O Claude também usa as ferramentas do mod para manter o quadro em dia: ele marca uma tarefa como em andamento ao começar e como entregue ao terminar, com um resumo do que fez.

## Painel

| Aba | O que mostra |
| --- | --- |
| Resumo | Por empresa: tokens, US$, tarefas em aberto, últimas entregas e a branch de cada projeto |
| Tarefas | Tarefas por épico, com ▶ (ativar), ⚡ (executar com agentes) e ✓ (entregar) |
| Projetos | Branch atual, alterações e branches recentes de cada projeto (↻ para reler) |
| Tokens | Gasto por empresa e por modelo, com barras |
| Agentes | Modelos em uso, agentes rodando e concluídos, e para qual empresa a sessão conta |

Os botões de empresa no topo filtram todas as abas.

## Comandos

```
/orq                         abre o painel
/orq resumo [empresa]        resumo de tarefas, tokens e branches no chat
/orq tarefa <título #épico>  cria uma tarefa na empresa da sessão
/orq executar <id>           executa a tarefa com agentes em paralelo + revisor
/orq empresa <nome|auto>     fixa a empresa desta sessão (auto volta a usar a pasta)
```

## Ferramentas que o Claude ganha

- `mcp__orquestrador__empresa_salvar`: cadastra ou atualiza uma empresa e seus projetos.
- `mcp__orquestrador__empresa_remover`: remove uma empresa (as tarefas e o uso passam para "Sem empresa").
- `mcp__orquestrador__tarefa_salvar`: cria ou atualiza uma tarefa (status, épico, branch, resumo).
- `mcp__orquestrador__tarefa_remover`: apaga uma tarefa.
- `mcp__orquestrador__resumo`: devolve o quadro por empresa.

E dois tipos de agente: `orquestrador:executor` (uma subtarefa por agente, em paralelo) e `orquestrador:revisor` (valida antes da entrega, sem editar arquivos).

## Configuração (`/config`)

- **Abrir o painel ao iniciar**: liga ou desliga a abertura automática do painel.
- **Modelo dos executores** e **Modelo do revisor**: `inherit` (o da sessão), `opus`, `sonnet` ou `haiku`. Executores em `sonnet` com o revisor em `opus` costuma ser um bom equilíbrio entre velocidade e qualidade.

## Como os números são contados

- **Tokens**: a soma de entrada, saída, cache lido e cache gravado de cada turno, incluindo os turnos dos subagentes. Eles contam para a empresa da sessão e, se houver uma tarefa ativa (▶), também para ela.
- **US$**: o aumento do custo que o Claude Code registra para a sessão. Só aparece onde o Claude Code mantém esse registro.
- A empresa da sessão vem do projeto cadastrado cujo caminho contém a pasta da sessão. Para outra pasta, fixe a empresa na aba Agentes ou com `/orq empresa`.

## Desenvolvimento

```
claude plugin validate claude-mods/orquestrador
claude plugin test claude-mods/orquestrador
```
