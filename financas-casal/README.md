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

## Colocando no ar (Vercel)

O código está em `financas-casal/` dentro do repositório `SamuelVNO/SamuelVNO`,
no branch `claude/finance-control-app-j5kjpe`.

Para publicar, a Vercel precisa enxergar este repositório. Hoje o app do GitHub
da Vercel está instalado na sua conta, mas sem acesso a `SamuelVNO/SamuelVNO`.
São dois passos:

1. Abra https://github.com/apps/vercel e, em **Configure**, adicione
   `SamuelVNO/SamuelVNO` à lista de repositórios permitidos.
2. Na Vercel, clique em **Add New → Project**, escolha o repositório e, em
   **Root Directory**, selecione a pasta `financas-casal`. O framework Next.js
   é detectado sozinho.

A partir daí cada push publica uma nova versão automaticamente.

Se preferir um repositório só para este projeto, crie um `financas-casal` vazio
no GitHub e mova a pasta para lá:

```bash
cd financas-casal
git init && git add . && git commit -m "Primeira versao"
git remote add origin https://github.com/SamuelVNO/financas-casal.git
git push -u origin main
```

Nesse caso o Root Directory na Vercel fica na raiz.

## Onde os dados ficam

Por padrão tudo é salvo no próprio navegador, no aparelho onde você usa. Nada sai dali,
e o app funciona sem internet.

Para você e sua esposa verem os mesmos dados nos dois aparelhos, ative a sincronização
com o Firebase, que é gratuita.

### Ativando a sincronização

1. Crie um projeto em https://console.firebase.google.com (o plano gratuito Spark serve
   de sobra: são 1 GB de dados e 20 mil gravações por dia).
2. Em **Criação → Authentication → Sign-in method**, ative **E-mail/senha**.
3. Em **Criação → Firestore Database**, clique em **Criar banco de dados** e escolha a
   região `southamerica-east1`. Pode começar em modo de produção; as regras vêm no
   passo seguinte.
4. Ainda no Firestore, abra a aba **Regras**, cole o conteúdo de
   [`firebase/firestore.rules`](firebase/firestore.rules) e publique.
5. Em **Configurações do projeto → Seus aplicativos**, crie um aplicativo da Web
   (ícone `</>`) e copie os valores do objeto `firebaseConfig`.
6. Defina as variáveis de ambiente (na Vercel em **Settings → Environment Variables**,
   ou em um arquivo `.env.local` para rodar localmente):

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123...:web:abc...
   ```

7. Em **Authentication → Settings → Domínios autorizados**, adicione o endereço do app
   na Vercel.
8. Faça o deploy de novo (ou reinicie o `npm run dev`).
9. No app, vá em **Configurações → Sincronizar** e crie sua conta.
10. Toque em **Criar nosso lar**. Vai aparecer um código de convite de 8 letras.
11. Sua esposa abre o mesmo endereço, cria a conta dela e usa esse código em
    **Já tem um código de convite?**. Pronto: os dois passam a ver os mesmos dados,
    e as alterações aparecem na hora no outro aparelho.

Se preferir manter o app só no aparelho, é só não configurar nada. Tudo continua
funcionando, e o backup em JSON serve para levar os dados de um lugar para outro.

### Segurança dos dados

O acesso é protegido pelas regras do Firestore: cada pessoa só consegue ler e escrever
no lar de que faz parte, e a única alteração permitida a quem está de fora é adicionar
o próprio usuário à lista de membros usando o código de convite. As chaves
`NEXT_PUBLIC_FIREBASE_*` são públicas por natureza e podem ficar no código do site;
quem manda são as regras.

Os dados do casal ficam em um único documento por lar, gravado como JSON. O limite do
Firestore é 1 MB por documento, o que dá dezenas de milhares de lançamentos.

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
| Sincronização | Firebase (Auth e Firestore em tempo real), opcional |
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
    sync.ts        autenticação e sincronização
firebase/
  firestore.rules  regras de acesso do banco de sincronização
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
