# Dashboard simplificado — alinhamento de 25/10/2026

## Comercial

- Online participa apenas das semanas 1 e 2. Desde 19/10, não há nova meta, pendência ou peso de prospecção online. Seus registros e resultados históricos permanecem consultáveis.
- A meta presencial da semana 3 permanece a que já estava registrada.
- Semanas 4–11: 20 novas empresas por semana, cinco por dia de segunda a quinta; sexta, sábado e domingo sem meta de novas empresas.
- São 160 empresas entre 26/10 e 17/12. A semana 12 fica para acompanhamentos, com meta zero de novas empresas.
- O objetivo de oito clientes até o encerramento em 28/12 continua vigente. O calendário existente encerra o ciclo em 28/12 às 00h; a última semana é 21–27/12.
- Comercial: 60% novas empresas e 40% follow-ups. Quando não há tarefa prevista, follow-ups não entram no denominador e o peso é redistribuído entre os indicadores aplicáveis.
- Contam empresas distintas com evento de primeira abordagem presencial e resultado/encaminhamento registrado. Retornos e tentativas sem contato não contam novamente.

## Registro diário

- Nas semanas abertas, o comercial é preenchido manualmente: novas empresas presenciais, follow-ups necessários, follow-ups feitos e reuniões agendadas e realizadas. Os campos de qualidade por canal continuam retirados.
- A meta de follow-ups é a soma dos necessários informados por dia; o realizado é a soma dos feitos. Zero necessários exclui o indicador do score. Quantidades excedentes continuam visíveis, com contribuição limitada a 100%. Reuniões são apenas acompanhamento.
- Reuniões agendadas contam no dia em que o agendamento foi feito; realizadas contam no dia em que aconteceram. Ambas são acompanhamento, sem peso no score.
- Informe necessários incluindo os que já foram feitos. Um follow-up feito em outro dia entra no dia da realização; o necessário permanece no dia em que precisava ser feito. Não transfira nem duplique a necessidade para compensar um atraso.
- P4, revisões comerciais/semanais e compromissos cumpridos deixaram de gerar cobranças nas semanas com a nova regra. Dados antigos continuam preservados.
- Calorias e proteínas são dois campos independentes, cada um valendo 20% da Saúde e com meta de seis dias. Treinamento continua com 50% e abdômen com 10%.
- Alimentação antiga marcada como cumprida vale para ambos os componentes, salvo quando existe uma marcação específica. Não se infere cumprimento de um componente a partir do outro.
- Atualizações têm seção própria: The News, Superhuman AI e Instagram profissional. As newsletters permitem “Sem edição”, removendo essa ocorrência do denominador. X permanece uma sessão semanal separada.
- Anotações semanais são opcionais e não valem pontos.

## Histórico e disponibilidade

Cada semana mantém sua regra. A migração preserva as semanas 1 e 2, os registros brutos e uma cópia das regras substituídas das demais semanas. Recarregar ou importar um backup não duplica os novos indicadores.

A migração para preenchimento manual afeta somente semanas abertas a partir da semana 3. Semanas encerradas mantêm suas regras e resultados. As entradas anteriores ficam arquivadas em `previousCommercialEntries`. Importações já confirmadas nas semanas abertas viram valores diários editáveis uma única vez; os dados brutos da fonte são preservados.

O painel comercial mostra os cinco totais dos registros manuais no intervalo escolhido. Semanas históricas continuam com a visualização anterior. A configuração orienta o registro diário e não oferece sincronização comercial com a planilha. A sincronização de backup com Supabase permanece independente. Recarregar, editar e importar backup não soma lançamentos novamente.

O preenchimento manual dispensa acesso à planilha Google e não modifica seus dados nem seu Apps Script.

## Verificação

`npm test` verifica as regras comerciais, os históricos, o crédito independente de calorias/proteínas e as atualizações por fonte. `npm run build` verifica os tipos e a compilação de produção. O formulário diário e o planejamento semanal também foram conferidos na prévia local, com conexão ao Supabase desativada.
