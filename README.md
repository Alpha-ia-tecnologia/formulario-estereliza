# Formulário de requisitos — Sistema Steriliza

Versão digital do `Formulário de requisitos.docx`, reestruturada para um **sistema multiunidade**: a Steriliza responde
um formulário só, que cobre todas as unidades (São Luís, Teresina, Maracanaú e Ananindeua). Onde a operação muda de
uma unidade para outra, a pergunta vem unidade por unidade. No fim, a pessoa revisa e baixa um pacote `.zip` para enviar
ao responsável pelo projeto. O visual segue o site [steriliza.com.br](https://steriliza.com.br/): Montserrat,
verde-água `#4ab39d`, azul-marinho `#33526b`, botões em pílula e o logo de 2025.

## Estrutura do formulário

| Etapa | Conteúdo |
|---|---|
| Identificação | Quem responde, onde atua e **quais unidades o sistema vai atender** (todas vêm marcadas) |
| 1. Operação atual | Métodos, volume, horário, equipe e limpeza — **uma linha por unidade** |
| 2. Sistemas e infraestrutura | Sistemas em uso, esterilizadores, equipamentos e internet por unidade; o resto vale para a empresa |
| 3. Rastreabilidade e qualidade | Igual ao documento original |
| 4. Clientes, logística e faturamento | Igual ao documento original, com opções de toque na 4.3 e 4.5 |
| 5. Módulos e prioridades | Matriz de prioridade dos 13 módulos |
| 6. Acesso e segurança | Perfis, assinatura, usuários simultâneos, LGPD |
| 7. Operação multiunidade | **Nova**: o que é comum a todas × de cada unidade, quem vê tudo, clientes e material entre unidades, CNPJ, configuração por unidade, novas unidades |
| 8. Projeto | Antiga seção 7 |
| 9. Documentos para anexar | Antiga seção 8 |

## O que muda em relação ao .docx

- **Um formulário para a empresa**, com salvamento automático no navegador: dá para parar e continuar depois.
- **Perguntas por unidade** só onde a operação muda, com o atalho "Repetir a resposta nas demais unidades" e uma tabela
  com totais por unidade e da empresa para volume e equipe. Desmarcar uma unidade na identificação tira as linhas dela.
- **Perguntas condicionais**: "Substituir alguns (quais?)" só aparece quando marcado e lista os sistemas usados em
  alguma unidade; "Outra" na 4.4, "Quais?" na 4.6, detalhes na 7.3, 7.4 e 7.7, data e motivo na 8.3.
- **Sugestões de resposta**: as perguntas abertas têm chips com respostas comuns — tocar preenche, tocar de novo desfaz;
  em texto de várias linhas cada chip vira uma linha, e na lista de problemas (8.1) ocupa a próxima posição vazia.
- **Opção "Outra"**: todo campo de escolha em que a lista pode não bastar tem "Outra/Outro" com um campo "Qual?";
  o texto fica gravado junto da escolha, como `outra:<texto>`.
- **Transições**: a etapa antiga sai e a nova entra no sentido da navegação (View Transitions API, com fallback);
  marcar opções, concluir etapas e abrir linhas por unidade têm micro-animações; tudo respeita "reduzir movimento".
- **Atalhos**: a 8.2 sugere os módulos marcados como prioridade alta; a 8.5 tem "Sou eu"; o telefone ganha máscara.
- **Matrizes** em controle segmentado (prioridades na seção 5, comum/por unidade na 7.1), com contagem por nível.
- **Anexos (seção 9)** direto no formulário (arrastar e soltar), ou "Envio depois" / "Não temos".
- **Revisão** com filtro das perguntas em branco e salto direto para qualquer pergunta.
- **Exportação**: pacote `.zip` com `respostas.json`, `resumo.md` e `anexos/`; também imprimir/salvar PDF e `.json` avulso.
- **Importação**: "Continuar de um arquivo" reabre um pacote em outro computador (formato v2; pacotes da versão por
  unidade são recusados com aviso).

## Como usar

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # gera dist/index.html
```

`dist/index.html` é um arquivo único e autocontido (≈450 KB, com fonte e imagens embutidas). Ele pode ser hospedado em
qualquer servidor estático ou enviado por e-mail e aberto direto no navegador — funciona sem servidor.

Nada é enviado pela internet automaticamente: as respostas ficam no navegador até a pessoa baixar o pacote.

### Configuração opcional

Copie `.env.example` para `.env` e informe `VITE_DESTINATARIO_EMAIL`. A tela final passa a indicar para quem enviar
e mostra o botão "Abrir e-mail" já endereçado. Rode o build de novo depois de alterar.

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
├── components/    # cabeçalho, trilha de etapas, pergunta e campos (PerUnitField, MatrixField…)
├── screens/       # boas-vindas, formulário, revisão
└── styles/        # tokens da marca, layout, campos, matriz, por unidade, telas e impressão
```

Para mudar uma pergunta, altere `src/form/schema.ts`: a tela, o progresso, a revisão, a exportação e a validação da
importação são derivados dele. Para pedir uma resposta por unidade, marque o campo com `perUnit: true` — ela fica
gravada em `<id>@<unidade>` (ex.: `1.3@teresina`). Para oferecer "Outra", use `other: { label, prompt }`; para chips
de sugestão, `suggestions: [...]`. Ao mudar ids ou opções já usados, aumente `FORM_VERSION` em `sanitize.ts`.

## Testes

```bash
npm test           # testes de lógica, armazenamento, pacote .zip e fluxos de interface
npm run coverage   # cobertura (mínimo configurado: 80%)
npm run typecheck
```
