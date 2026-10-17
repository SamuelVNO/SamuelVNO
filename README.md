<p align="center">
  <img src="./assets/terminal.svg" alt="Samuel Vitor — Engenheiro de Software Full Stack" width="100%">
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/samuelvno"><img src="https://img.shields.io/badge/LinkedIn-samuelvno-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
  <a href="mailto:samvitor53@gmail.com"><img src="https://img.shields.io/badge/E--mail-samvitor53%40gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white" alt="E-mail"></a>
  <img src="https://img.shields.io/badge/Status-aberto%20a%20vagas%20remotas-2ea44f?style=for-the-badge" alt="Aberto a vagas remotas">
</p>

## ⏱️ Para recrutadores: o resumo em 30 segundos

| | |
|---|---|
| **Cargo** | Engenheiro de Software Full Stack |
| **Stack principal** | TypeScript · NestJS · Angular · React/Next.js · Go · PHP · Java/Spring Boot |
| **Dados e infra** | PostgreSQL · MySQL · Kafka · AWS (ECS, S3) · Docker · GitHub Actions |
| **Hoje** | Lead técnico do ecossistema de almoxarifado e estoque na **Orion** (antiga Salte Tecnologia) |
| **Também** | Freelancer na **Etech**: plataformas SaaS e produtos com IA (LLM) para clientes |
| **Modelo** | Remoto · CLT ou PJ · híbrido em Taubaté ou São José dos Campos/SP |

## 🔒 O que este perfil não mostra

A maior parte do meu código está em repositórios privados das empresas. Em números:

| Pull requests integrados | Na Orion | Em clientes da Etech | Contribuições no último ano |
|:---:|:---:|:---:|:---:|
| **350+** | **170+** | **179** | **1.500+** |

## 🏗️ Projeto em destaque: [Payment Reconciliation API](https://github.com/SamuelVNO/payment-reconciliation-api)

Concilia os pedidos de uma loja com o que o adquirente (Cielo, Stone, Getnet...) realmente pagou e aponta cada centavo fora do lugar.
**Java 21 · Spring Boot 3 · PostgreSQL 17 · Kafka · Testcontainers · React 19**

```mermaid
flowchart LR
    CSV["CSV de repasses<br/>Idempotency-Key"] --> API["API Spring Boot"]
    API --> PG[("PostgreSQL")]
    JOB["Job noturno<br/>ShedLock"] --> ENG["Motor de conciliação<br/>lotes com keyset"]
    ENG --> PG
    ENG -- "mesma transação" --> OUT[("Outbox")]
    OUT -- "relay com SKIP LOCKED" --> K{{"Kafka"}}
    K --> CON["Consumidor idempotente<br/>retry + DLQ"]
    CON --> WEB["Painel React 19"]
```

**Decisões que eu defendo numa entrevista**

| Problema | Decisão | Prova |
|---|---|---|
| Dinheiro com precisão | `BigDecimal` + `NUMERIC(19,2)`, arredondamento bancário | Teste que mostra por que `equals` falha e `compareTo` não |
| Repasse importado duas vezes | Idempotência em 3 camadas | `Idempotency-Key`, `payout_id` e `UNIQUE NULLS NOT DISTINCT` |
| Consulta lenta com volume | Paginação keyset + índice composto | **29,4 ms → 0,56 ms** com 300 mil pedidos (EXPLAIN ANALYZE) |
| Dual write entre banco e fila | Transactional Outbox | Relay com `FOR UPDATE SKIP LOCKED`, várias instâncias em paralelo |
| Confiança para mudar | 43 testes, 18 com Postgres e Kafka reais | CI no GitHub Actions publicando imagens Docker |

## 💼 O que já entreguei em produção

- **Estoque e almoxarifado (Orion):** módulos de reposição com motor de mínimo/máximo, inspeção e negociação de compras e o ciclo completo de inventário. Redesenhei o motor de custeio atrás de feature flag e corrigi em produção um defeito de ponto flutuante que corrompia saldos de lotes, validando com dados reais antes de ativar.
- **Eventos esportivos (Etech):** plataforma de entrega de kits com API, painel e worker assíncrono na AWS (ECS + S3), importação de inscrições por planilha, numeração em lote e gestão multi-organização.
- **IA aplicada (Etech):** gerador de site de evento com LLM, com briefing conversacional, page builder e preview ao vivo.
- **CASACOR (via Etech):** único desenvolvedor do sistema de credenciamento usado em 5 franquias, incluindo suporte integrado ao WhatsApp.

## 🧰 Stack

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![NestJS](https://img.shields.io/badge/-NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Angular](https://img.shields.io/badge/-Angular-DD0031?style=flat-square&logo=angular&logoColor=white)
![React](https://img.shields.io/badge/-React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/-Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![Go](https://img.shields.io/badge/-Go-00ADD8?style=flat-square&logo=go&logoColor=white)
![PHP](https://img.shields.io/badge/-PHP-777BB4?style=flat-square&logo=php&logoColor=white)
![Java](https://img.shields.io/badge/-Java-ED8B00?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/-Spring%20Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![GraphQL](https://img.shields.io/badge/-GraphQL-E10098?style=flat-square&logo=graphql&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/-PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![MySQL](https://img.shields.io/badge/-MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Apache Kafka](https://img.shields.io/badge/-Kafka-231F20?style=flat-square&logo=apachekafka&logoColor=white)
![AWS](https://img.shields.io/badge/-AWS-232F3E?style=flat-square&logo=amazonaws&logoColor=white)
![Docker](https://img.shields.io/badge/-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/-GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)

## 📂 Outros projetos públicos

- **[integracoes-apis-publicas](https://github.com/SamuelVNO/integracoes-apis-publicas)** — quatro integrações com APIs públicas em Next.js 15, com cache, timeout e tratamento de erro
- **[products-api](https://github.com/SamuelVNO/products-api)** — API REST de produtos com NestJS, PostgreSQL e TypeORM
- **[products-front](https://github.com/SamuelVNO/products-front)** — front-end de e-commerce em Angular 19 integrado ao Supabase

---

<p align="center">🎓 Engenharia de Software na Estácio (em andamento) · 📍 Taubaté, Vale do Paraíba/SP</p>
