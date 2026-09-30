# Formulário de requisitos — Sistema Steriliza

Versão digital do `Formulário de requisitos.docx`, reestruturada para um **sistema multiunidade**: a Steriliza responde
um formulário só, que cobre todas as unidades (São Luís, Teresina, Maracanaú e Ananindeua). Como as unidades operam
igual, cada pergunta é respondida uma vez para a empresa; só a internet vem unidade por unidade. Quase tudo é de
clicar, e o detalhamento de cada módulo só aparece se ele for prioridade Alta. No fim, a pessoa revisa e envia as
respostas ao servidor
do projeto, que as guarda no PostgreSQL — ou, sem servidor, baixa um pacote `.zip` para mandar por e-mail. O visual
segue o site [steriliza.com.br](https://steriliza.com.br/): Montserrat, verde-água `#4ab39d`, azul-marinho `#33526b`,
botões em pílula e o logo de 2025.

## Estrutura do formulário

| Etapa | Conteúdo |
|---|---|
| Identificação | Quem responde, onde atua, **quais unidades o sistema vai atender** (todas vêm marcadas) e quem pode completar cada assunto |
| 1. Sistemas e infraestrutura | Sistemas, o que funciona e o que incomoda, substituir ou integrar e o que migrar, como sai o registro de ciclo de cada equipamento, com o que cada posto registra, integrações, tolerância a parada, hospedagem; **internet por unidade** |
| 2. Rastreabilidade e qualidade | Rastreabilidade (e sistemas dos hospitais, se chega ao paciente), identificação, indicadores, liberação de lote, não conformidades, auditorias, guarda dos registros, normas e acreditações, o que acontece quando um indicador falha |
| 3. Clientes, logística e faturamento | Tipos de cliente, coleta e entrega, pedido de coleta, base e periodicidade de cobrança, clientes públicos |
| 4. Módulos e prioridades | Matriz de prioridade dos 13 módulos — é ela que define a primeira entrega |
| Detalhes dos módulos prioritários | **Só as perguntas dos módulos em prioridade Alta** (2 a 3 por módulo); sem nenhum em Alta, a etapa fica vazia |
| 5. Acesso e segurança | Perfis, assinatura, usuários ao mesmo tempo (faixas), LGPD, correção de registros já salvos |
| 6. Operação multiunidade | O que é comum a todas × de cada unidade (cadastros e configurações), usuários em mais de uma unidade, quem vê tudo, clientes e material entre unidades, CNPJ, novas unidades |

A numeração exibida vem da posição (`numberSections` em `src/form/schema.ts`); os **ids das respostas são estáveis**
e não seguem a numeração — ex.: a pergunta exibida como 1.7 (internet) é gravada como `2.7@<unidade>`. Assim, tirar ou
incluir uma etapa não muda o significado do que já foi respondido. As etapas Operação atual, Projeto e Documentos
saíram na versão atual; o motor ainda suporta anexos (`kind: 'documents'`), só não há etapa que os peça.

## O que muda em relação ao .docx

- **Um formulário para a empresa**, com salvamento automático no navegador: dá para parar e continuar depois.
- **Por unidade, só a internet**, com o atalho "Repetir a resposta nas demais unidades". Desmarcar uma unidade na
  identificação tira a linha dela.
- **Perguntas condicionais**: o que é digitado em dobro só se "Digitação repetida" for marcada; "quais substituir",
  "o que migrar" e "quanto histórico" conforme a estratégia; sistemas dos hospitais quando a rastreabilidade chega ao
  paciente; detalhes de clientes públicos, clientes e material entre unidades e novas unidades conforme a resposta.
- **Detalhes só onde importa**: uma etapa própria mostra 2 a 3 perguntas de cada módulo marcado como prioridade Alta
  (regras, exceções, relatórios). Perguntas sem nenhum campo visível não aparecem nem contam no progresso.
- **Escolhas no lugar de texto livre** onde as respostas se repetem, para comparar e consultar no banco; texto livre
  fica para o que é realmente aberto.
- **Sugestões de resposta**: as perguntas abertas têm chips com respostas comuns — tocar preenche, tocar de novo desfaz;
  em texto de várias linhas cada chip vira uma linha.
- **Opção "Outra"**: todo campo de escolha em que a lista pode não bastar tem "Outra/Outro" com um campo "Qual?";
  o texto fica gravado junto da escolha, como `outra:<texto>`.
- **Transições**: a etapa antiga sai e a nova entra no sentido da navegação (View Transitions API, com fallback);
  marcar opções, concluir etapas e abrir linhas por unidade têm micro-animações; tudo respeita "reduzir movimento".
- **Matrizes** em controle segmentado (registro de ciclo, postos de trabalho, prioridades, comum/por unidade), com
  contagem por nível; com 5 ou mais níveis, as opções quebram em linhas embaixo do nome.
- **Revisão** com filtro das perguntas em branco e salto direto para qualquer pergunta.
- **Síntese no fim do relatório**, gerada das respostas (regras em `src/form/synthesis.ts` e `attention.ts`, sem
  serviço externo): abertura com quem respondeu e o percentual preenchido, números-chave, pontos de atenção (operação
  offline ou que não pode parar, decisões em aberto, registros ainda em papel, lacunas) e resumo por tema. Atualiza ao vivo, tem "Copiar síntese" e sai no fim do `resumo.md` e no
  campo `sintese` do `respostas.json`.
- **Envio ao servidor**: quando o formulário é servido pelo `npm run server` (ou `VITE_API_URL` aponta para ele), o
  painel da revisão ganha "Enviar respostas" e devolve um número de protocolo; cada envio vira uma linha no PostgreSQL.
- **Exportação**: pacote `.zip` com `respostas.json`, `resumo.md` e `anexos/`; também imprimir/salvar PDF e `.json` avulso.
- **Importação**: "Continuar de um arquivo" reabre um pacote em outro computador (formato v3; pacotes de versões
  anteriores, que usam os mesmos números com outro significado, são recusados com aviso).

## Como usar

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # gera dist/index.html
npm run server     # serve dist/index.html e a API que guarda as respostas (http://localhost:8787)
npm start          # build + server
```

`dist/index.html` é um arquivo único e autocontido (≈450 KB, com fonte e imagens embutidas). Ele pode ser hospedado em
qualquer servidor estático ou enviado por e-mail e aberto direto no navegador — funciona sem servidor. Nesse caso nada
é enviado pela internet automaticamente: as respostas ficam no navegador até a pessoa baixar o pacote.

### Configuração opcional

Copie `.env.example` para `.env`. `VITE_DESTINATARIO_EMAIL` faz a tela final indicar para quem enviar e mostrar o botão
"Abrir e-mail" já endereçado; `VITE_API_URL` aponta para o servidor quando o formulário é hospedado em outro lugar.
Variáveis `VITE_*` são lidas no build: rode `npm run build` de novo depois de alterar.

## Servidor e banco PostgreSQL

As respostas ficam no PostgreSQL indicado em `DATABASE_URL` (driver `pg`, puro JavaScript). A tabela `respostas` é
criada sozinha na primeira conexão, e o servidor espera até cerca de 1 minuto pelo banco ao subir — no deploy, ele pode
ficar pronto depois do app. O servidor (`server/`) reaproveita a validação e a exportação do próprio formulário: cada
envio passa pela mesma checagem da importação e é **renormalizado no servidor** (JSON, `resumo.md` e síntese
recalculados), sem confiar no que veio do navegador.

Cada linha da tabela `respostas` guarda: `recebido_em` (timestamptz), `respondente`, `cargo`, `unidades` (jsonb),
`preenchido` (%), `anexos`, `sintese` (a abertura), `dados` (o `respostas.json`, em **jsonb**), `resumo` (o `resumo.md`)
e `pacote` (o `.zip` em bytea, reimportável pelo "Continuar de um arquivo"). Como `dados` é jsonb, dá para analisar
direto em SQL — as chaves são os ids das perguntas, e as por unidade levam o sufixo `@unidade`. Os ids valem para
uma versão do formulário (`dados->>'versao'`); filtre por ela ao comparar respostas de épocas diferentes:

```sql
-- Quem respondeu, estratégia para os sistemas atuais (id 2.3) e hospedagem (id 2.8)
SELECT id, recebido_em, respondente,
       dados->'respostas'->>'2.3' AS estrategia,
       dados->'respostas'->>'2.8' AS hospedagem
FROM respostas WHERE dados->>'versao' = '3' ORDER BY id DESC;

-- Pontos de atenção da síntese, um por linha
SELECT r.id, p->>'tone' AS tipo, p->>'text' AS ponto
FROM respostas r, jsonb_array_elements(r.dados->'sintese'->'attention') AS p;
```

Também dá para consultar pela API:

| Rota | Para quê |
|---|---|
| `GET /` | o formulário compilado |
| `GET /api/saude` | `{ "ok": true }` — o app usa para descobrir o servidor |
| `POST /api/respostas` | recebe o pacote `.zip` (ou um `respostas.json`) e devolve `{ id, recebidoEm }` |
| `GET /api/respostas` | lista as respostas recebidas (exige token) |
| `GET /api/respostas/:id` | `respostas.json` normalizado (exige token) |
| `GET /api/respostas/:id/pacote.zip` | pacote reimportável (exige token) |
| `GET /api/respostas/:id/resumo.md` | relatório com a síntese (exige token) |

```bash
# no .env: DATABASE_URL=postgres://usuario:senha@localhost:5432/requisitos e API_TOKEN=<32+ caracteres>
npm run server
curl -H "Authorization: Bearer $API_TOKEN" http://localhost:8787/api/respostas
curl -H "Authorization: Bearer $API_TOKEN" -o resposta-1.zip http://localhost:8787/api/respostas/1/pacote.zip
```

Variáveis (`.env` ou ambiente): `DATABASE_URL` (obrigatória), `PORT` (8787), `HOST` (0.0.0.0), `API_TOKEN` (mínimo de
32 caracteres — gere com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`), `DIST_DIR`
(dist), `MAX_UPLOAD_MB` (60), `MAX_DB_MB` (2048, tamanho da tabela) e `TRUST_PROXY=1` quando houver um proxy reverso
na frente (o limite por IP passa a usar o último endereço de `X-Forwarded-For`, o que o proxy anotou). Sem
`API_TOKEN`, o servidor recebe respostas mas recusa consultas.

O envio é anônimo por natureza (é um formulário público, e qualquer site pode fazer o `POST`), então as proteções são
por volume: 60 MB por pacote, 30 envios por IP a cada 15 min e 300 por hora no total, 2 envios processados por vez,
recusa quando a tabela passa de `MAX_DB_MB`, 10 tentativas de leitura com token errado por IP a cada 15 min, tudo
decidido antes de ler o corpo da requisição; cabeçalhos `nosniff`/`no-referrer`/`DENY`. Em produção, ponha HTTPS na
frente (nginx, Caddy…) — as respostas trazem nomes e telefones. Cópia de segurança: `pg_dump` do banco (no Easypanel,
os backups do serviço PostgreSQL).

## Deploy com Docker (Easypanel)

O `Dockerfile` da raiz gera uma imagem só com o formulário e o servidor. O estágio de build roda `npm ci` e
`npm run build` (tipos + `dist/index.html`); a imagem final leva só as dependências de produção e roda como usuário
`node` na porta **8787**. O container não guarda estado: as respostas ficam no PostgreSQL.

No Easypanel (serviço do tipo App, fonte GitHub, build **Dockerfile**), com um serviço PostgreSQL no mesmo projeto:

1. **Ambiente** → `DATABASE_URL` com a *Internal Connection URL* do serviço PostgreSQL (aba do banco no Easypanel) e
   `API_TOKEN=<32+ caracteres>` para poder consultar as respostas (opcionais: `MAX_UPLOAD_MB`, `MAX_DB_MB`).
2. **Domínios** → porta do proxy **8787**.

`TRUST_PROXY=1` já vem na imagem, porque o Easypanel sempre põe o Traefik na frente; rodando o container exposto
direto, sem proxy, defina `TRUST_PROXY=0`.

O formulário descobre a API sozinho no mesmo domínio; `VITE_API_URL` só é necessário se ele for hospedado em outro lugar.

## Estrutura do código

```text
src/
├── form/          # o formulário como dados
│   ├── schema.ts      perguntas, opções e condições (edite aqui para mudar o formulário)
│   ├── options.ts     unidades, unitKey/selectedUnits, módulos, documentos
│   ├── progress.ts    visibilidade condicional, progresso e poda de respostas
│   ├── format.ts      textos da revisão e do resumo.md
│   └── sanitize.ts    validação do rascunho e dos arquivos importados
├── draft/         # persistência: localStorage, IndexedDB (anexos), pacote .zip
├── lib/           # utilidades: rotas, transições, arquivos, área de transferência, cliente da API
├── components/    # cabeçalho, trilha de etapas, pergunta e campos (PerUnitField, MatrixField…)
├── screens/       # boas-vindas, formulário, revisão
└── styles/        # tokens da marca, layout, campos, matriz, por unidade, telas e impressão
server/
├── main.ts        # entrada do `npm run server` (variáveis de ambiente)
├── http.ts        # node:http → Request/Response (corpo em fluxo)
├── app.ts         # rotas, token, CORS, cotas
├── guard.ts       # limitador por chave/janela e leitura do corpo com teto
├── intake.ts      # pacote recebido → resposta normalizada (reusa readPackage/buildPackageFiles)
└── store.ts       # tabela `respostas` no PostgreSQL (testada contra PGlite, o Postgres em WASM)
```

Para mudar uma pergunta, altere `src/form/schema.ts`: a tela, o progresso, a revisão, a exportação e a validação da
importação são derivados dele. Para pedir uma resposta por unidade, marque o campo com `perUnit: true` — ela fica
gravada em `<id>@<unidade>` (ex.: `2.7@teresina`). Para oferecer "Outra", use `other: { label, prompt }`; para chips
de sugestão, `suggestions: [...]`. Ao mudar ids ou opções já usados, aumente `FORM_VERSION` em `sanitize.ts` e a versão
do rascunho em `storage.ts` — um id reaproveitado com outro significado leria respostas antigas no lugar errado.

## Testes

```bash
npm test           # testes de lógica, armazenamento, pacote .zip, fluxos de interface e do servidor
npm run coverage   # cobertura (mínimo configurado: 80%)
npm run typecheck
```
