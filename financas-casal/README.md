# Finanças do Casal

Sistema completo de controle financeiro pessoal, feito para ser usado no celular e no
computador por duas pessoas ao mesmo tempo. Funciona offline, pode ser instalado como
aplicativo e sincroniza os dados entre os aparelhos quando você quiser.

Interface em português do Brasil, valores em real.

## O que dá para fazer

**Lançamentos**
- Despesas, receitas e transferências entre contas
- Marcar como pago ou pendente, com aviso de contas vencidas
- Busca por texto e filtros por tipo, conta, categoria, pessoa e situação
- Categorias com cor própria, editáveis, já vindo com 20 categorias prontas
- Marcar quem gastou: você, sua esposa ou o casal

**Parcelas** (a tela principal do dia a dia)
- Cadastre a compra pelo valor total ou pelo valor de cada parcela
- O app gera todas as parcelas nos meses seguintes, sem perder centavos no arredondamento
- Cada compra mostra **quantas parcelas ainda faltam**, o valor restante e a próxima data
- Informe quantas parcelas já foram pagas ao cadastrar uma compra antiga
- Pague uma parcela por vez, quite tudo de uma vez, ou marque parcelas avulsas
- Gráfico do quanto está comprometido nos próximos meses

**Contas e cartões**
- Contas corrente, poupança, dinheiro em espécie e investimentos, com saldo calculado
- Cartões de crédito com limite, dia de fechamento, dia de vencimento e fatura por mês
- Barra de limite usado

**Contas fixas**
- Aluguel, assinaturas, salário: qualquer coisa que se repete
- Frequência semanal, mensal, bimestral, trimestral, semestral ou anual
- Os próximos 12 meses são lançados automaticamente e renovados com o tempo
- Dá para pausar e retomar

**Orçamentos**
- Teto de gasto por categoria, valendo todo mês ou só em um mês específico
- Barra de progresso que fica amarela perto do limite e vermelha ao estourar

**Metas**
- Valor alvo, data alvo e sugestão de quanto guardar por mês
- Histórico de aportes

**Relatórios**
- Receitas contra despesas em 1, 3, 6 ou 12 meses
- Sobra mensal, ranking de categorias, gastos por pessoa e maiores despesas
- Taxa de poupança do mês

**Outros**
- Tema claro, escuro ou automático
- Botão para esconder os valores na tela
- Exportar e restaurar backup em arquivo JSON
- Instalável como aplicativo no celular e no computador (PWA), abre sem internet

## Rodando na sua máquina

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Onde os dados ficam

Por padrão tudo é salvo no próprio navegador, no aparelho onde você usa. Nada sai dali,
e o app funciona sem internet.

Para você e sua esposa verem os mesmos dados nos dois aparelhos, ative a sincronização
com o Supabase, que é gratuita.

### Ativando a sincronização

1. Crie um projeto em https://supabase.com (plano gratuito serve).
2. No painel do projeto, abra **SQL Editor** e rode o conteúdo de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Ele cria as tabelas, as regras de acesso e a sincronização em tempo real.
3. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.
4. Defina as variáveis de ambiente (na Vercel em **Settings → Environment Variables**,
   ou em um arquivo `.env.local` para rodar localmente):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
   ```

5. Faça o deploy de novo (ou reinicie o `npm run dev`).
6. No app, vá em **Configurações → Sincronizar** e crie sua conta.
7. Toque em **Criar nosso lar**. Vai aparecer um código de convite de 8 letras.
8. Sua esposa abre o mesmo endereço, cria a conta dela e usa esse código em
   **Já tem um código de convite?**. Pronto: os dois passam a ver os mesmos dados,
   e as alterações aparecem na hora no outro aparelho.

Se preferir manter o app só no aparelho, é só não configurar nada. Tudo continua
funcionando, e o backup em JSON serve para levar os dados de um lugar para outro.

### Segurança dos dados

O acesso é protegido por Row Level Security no banco: cada pessoa só consegue ler e
escrever no lar de que faz parte. A chave `anon` é pública por natureza e pode ficar no
código do site; quem manda são as regras do banco.

## Instalando no celular

**Android (Chrome):** abra o site, toque no menu de três pontos e escolha
*Instalar aplicativo* ou *Adicionar à tela inicial*.

**iPhone (Safari):** abra o site, toque no botão de compartilhar e escolha
*Adicionar à Tela de Início*.

Depois disso o app abre em tela cheia, com ícone próprio, e funciona mesmo sem internet.

## Como foi feito

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 15 (App Router) e React 19 |
| Linguagem | TypeScript em modo estrito |
| Estilo | Tailwind CSS 4 com variáveis de tema |
| Gráficos | Recharts |
| Ícones | Lucide |
| Sincronização | Supabase (Postgres, Auth e Realtime), opcional |
| Hospedagem | Vercel |

Estrutura das pastas:

```
src/
  app/             telas (início, lançamentos, parcelas, contas, orçamentos, metas, ...)
  components/      interface reutilizável (formulários, listas, gráficos, navegação)
  lib/
    types.ts       modelo de dados
    finance.ts     todos os cálculos financeiros
    store.tsx      estado do app e operações
    storage.ts     gravação local, backup e mesclagem de versões
    supabase.ts    autenticação e sincronização
supabase/
  migrations/      SQL para criar o banco da sincronização
```

Os cálculos ficam separados da interface em `src/lib/finance.ts`, então saldo, fatura,
progresso de parcelas e orçamento podem ser lidos e conferidos em um lugar só.

### Detalhe do arredondamento das parcelas

Dividir R$ 1.000,00 em 3 vezes dá R$ 333,3333. O app arredonda cada parcela para baixo e
joga a diferença na primeira: R$ 333,34 + R$ 333,33 + R$ 333,33. A soma das parcelas é
sempre exatamente o valor da compra.

### Conflito entre os dois aparelhos

Os dados viajam como um documento único, mas a mesclagem é feita item a item: vence
sempre o registro editado por último, e exclusões viram marcadores para não voltarem do
nada quando o outro aparelho sincronizar. Na prática, os dois podem lançar ao mesmo
tempo sem perder nada.
