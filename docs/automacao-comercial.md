# Automação comercial v2

Arquivo completo: `scripts/comercial.gs`. Substitui o script colado na conversa de 24/10/2026. A versão foi preparada e testada localmente; não foi instalada na planilha.

## O que o script anterior fazia com a data

O script anterior já usava a data do dia quando `Data da atividade` estava vazia. Salvava a execução no JSON de `Histórico comercial (automático)` e depois limpava a célula. Portanto, célula vazia não prova ausência de registro.

Havia outras limitações verificáveis no código:

- A semana começava na terça (`getUTCDay() + 5`), não na segunda.
- A exportação ignorava linhas sem histórico JSON.
- Uma data genérica de próxima ação podia criar follow-up, mesmo sendo visita ou reunião.
- `Feito` sem tarefa anterior podia ser rejeitado e limpo.
- Atualizar Resultados não reprocessava edições perdidas pelo gatilho.
- Horários UTC completos em `Data do registro` eram incompatíveis com o leitor de datas do dashboard.

A nova versão corrige esses pontos. A causa de um gatilho não ter executado em uma conta específica ainda depende de conferir **Execuções** no Apps Script.

## Instalação

1. Na planilha, abra **Extensões → Apps Script**.
2. Guarde uma cópia do código anterior e substitua seu conteúdo pelo arquivo `scripts/comercial.gs`. Não mantenha as duas versões em arquivos diferentes do mesmo projeto: elas possuem funções com os mesmos nomes.
3. Salve e execute **`instalarAutomacaoComercial`** uma vez. Autorize o acesso solicitado pelo Google à planilha e aos gatilhos.
4. Reabra a planilha. No menu **Comercial → Verificar automação**, confirme que o gatilho de edição está instalado.
5. Confira uma atividade real: a data deve aparecer em `Data da atividade`, o registro em **Comercial → Ver histórico de atividades** e a exportação em **Comercial → Mostrar Resultados**.

Não execute `comercialAoEditar` pelo botão Executar: ela precisa do evento enviado pelo Google ao editar uma célula. Não crie outro gatilho adicional para a mesma função. A instalação elimina duplicatas desses dois handlers que sejam visíveis para a conta instaladora e pertençam à mesma planilha; gatilhos de outra conta não podem ser auditados por esse procedimento.

A instalação adiciona quatro campos: `Registrar atividade`, `Resultado / encaminhamento`, `Data retroativa` e um ID automático oculto. Insere-os antes das listas de opções existentes, para que a ordenação das empresas não mova os itens dos menus suspensos. O filtro inclui ID e histórico junto com cada empresa.

A instalação preserva etapas, datas e marcações visíveis antigas. Não altera o fuso global da planilha. As novas execuções usam o dia de **America/Sao_Paulo**; datas já armazenadas são lidas respeitando o calendário da planilha.

## Uso diário

| Situação | O que preencher | O que é registrado |
| --- | --- | --- |
| Primeira abordagem com contato efetivo | Escreva o resultado ou próximo passo; selecione **Abordagem com contato** em `Registrar atividade` | Data automática, primeira abordagem e resultado |
| Retorno à mesma empresa | Escreva o resultado; selecione **Abordagem com contato** | Acompanhamento presencial; preserva a primeira abordagem |
| Ninguém atendeu / não houve contato | Selecione **Tentativa sem contato** | Tentativa datada, sem nova empresa abordada |
| Planejar follow-up | Selecione **A fazer** em `Follow-up`, depois preencha a data prevista | Tarefa numerada com previsão original |
| Concluir follow-up | Marque **Feito** ou selecione **Follow-up realizado** | Data automática de conclusão; a previsão fica preservada |
| Planejar o próximo follow-up | Depois do Feito, selecione **A fazer** e informe a nova data | Outra tarefa, preservando a concluída; a data antiga não é reutilizada automaticamente |
| Reagendar follow-up pendente | Altere a data prevista enquanto está **A fazer** | Nova previsão e histórico de reagendamento; mantém a original |
| Agendar reunião | Informe `Data prevista da reunião` e a etapa de reunião marcada | Compromisso próprio, separado do follow-up |
| Reunião realizada | Selecione **Reunião realizada** ou altere a etapa para reunião realizada | Data efetiva vinculada à reunião pendente, quando houver |
| Resposta, contato com decisor, proposta ou cliente fechado | Selecione a atividade correspondente | Evento datado e os respectivos marcos automáticos |
| Atividade de um dia anterior | Primeiro preencha `Data retroativa`; depois registre a atividade | Usa a data informada uma vez e limpa o campo retroativo |

`Data da atividade` passa a ser somente a saída automática da última execução registrada. Não é uma data a preencher diariamente. Seleções em `Registrar atividade` são consumidas depois do registro, permitindo usar a mesma opção no próximo contato.

Não preencha simultaneamente duas execuções diferentes na mesma edição, por exemplo uma visita e a conclusão de um follow-up. Registre-as separadamente para deixar a auditoria legível. Campos de planejamento podem ser alterados juntos.

Um follow-up realizado sem planejamento anterior é salvo **sem previsão inventada**. Ele aparece como executado sem previsão; não cria retroativamente uma obrigação para melhorar ou piorar o score. Para medir cumprimento da semana, planeje antes com `A fazer` e data.

A mera etapa `Visitado` não conta como abordagem presencial efetiva: use a atividade específica e informe o resultado. Uma resposta ou um contato com decisor deve ser registrado quando de fato ocorreu; não é deduzido de uma etapa posterior.

## Onde fica salvo

- **Na linha da empresa:** JSON completo em `Histórico comercial (automático)`, identificado por ID estável; esta é a fonte da exportação.
- **Na aba Histórico comercial:** auditoria com empresa, operação, atividade, data e resultado. Duas colunas ocultas conservam os estados anterior e seguinte. A cópia é gravada antes da projeção na linha, permitindo investigar falhas parciais; em caso de erro, conferir se o estado foi efetivamente aplicado.
- **Em Resultados!N:AG:** os mesmos 20 cabeçalhos aceitos pelo dashboard atual. Agora inclui também cadastros sem JSON. A:M permanece preservado.

Os eventos individuais continuam no histórico. Para compatibilidade com a identidade usada atualmente pelo dashboard, eventos do mesmo tipo e dia são agrupados apenas na exportação, com quantidade e observações; follow-ups e reuniões mantêm sua numeração individual. O ID da empresa é exportado no campo Número dos registros Cadastro, disponível para uma futura atualização do adaptador.

## Histórico antigo e sincronização

A migração não atribui hoje a atividades antigas sem data, não fecha leads e não altera metas. Quando a etapa, a previsão ou o status visível divergem do JSON antigo, conserva esse histórico e sinaliza a divergência. A conferência desses casos requer os fatos e as datas reais; não há recuperação automática confiável de execuções nunca registradas.

**Importante para o dashboard:** a exportação continua compatível com o leitor atual, mas a interface ainda precisa tratar alertas de cobertura histórica e IDs estáveis. Um histórico incompleto não deve ser apresentado como zero confirmado. As mudanças de score, P4, nutrição e metas do dashboard pertencem ao ajuste seguinte e não estão neste arquivo.

O Google não dispara gatilhos de edição para mudanças feitas por outro script ou pela API. Isso inclui alterações realizadas por integrações. O fluxo automático acima é para edições feitas na interface do Google Sheets. Uma integração que escreva atividades deve chamar explicitamente a lógica de registro; apenas escrever células ou clicar em Atualizar Resultados não recupera a data da edição perdida.

Referência: [gatilhos instaláveis do Google Apps Script](https://developers.google.com/apps-script/guides/triggers/installable#restrictions).

A atualização de Resultados também não instala autenticação do dashboard no Google. A leitura contínua de uma planilha privada continua dependendo de acesso autenticado no aplicativo; o CSV existente permanece utilizável.

## Verificação local

Execute:

```sh
node --experimental-strip-types --test scripts/comercial.test.mjs
```

Os testes cobrem negócio, migração, datas, exportação pelo parser real do dashboard e uma simulação das operações de planilha, instalação e gatilho. Eles não substituem a verificação de permissões e da execução na conta Google após instalar.
