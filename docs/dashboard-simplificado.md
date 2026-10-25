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

- Retirados os campos de qualidade por canal e as marcações manuais de follow-up; os resultados comerciais usam a fonte da planilha.
- P4, revisões comerciais/semanais e compromissos cumpridos deixaram de gerar cobranças nas semanas com a nova regra. Dados antigos continuam preservados.
- Calorias e proteínas são dois campos independentes, cada um valendo 20% da Saúde e com meta de seis dias. Treinamento continua com 50% e abdômen com 10%.
- Alimentação antiga marcada como cumprida vale para ambos os componentes, salvo quando existe uma marcação específica. Não se infere cumprimento de um componente a partir do outro.
- Atualizações têm seção própria: The News, Superhuman AI e Instagram profissional. As newsletters permitem “Sem edição”, removendo essa ocorrência do denominador. X permanece uma sessão semanal separada.
- Anotações semanais são opcionais e não valem pontos.

## Histórico e disponibilidade

Cada semana mantém sua regra. A migração preserva as semanas 1 e 2, os registros brutos e uma cópia das regras substituídas das demais semanas. Recarregar ou importar um backup não duplica os novos indicadores.

O painel de resultados e eficiência permanece informativo, fora do score. Ausência de fonte confirmada aparece como “Sem dados”. A configuração permite atualizar a planilha ou importar o CSV de Resultados, preservando as semanas encerradas.

Estas mudanças não editam a planilha Google nem instalam o Apps Script. A leitura autenticada contínua da planilha privada depende da configuração de acesso do aplicativo.

## Verificação

`npm test` verifica as regras comerciais, os históricos, o crédito independente de calorias/proteínas e as atualizações por fonte. `npm run build` verifica os tipos e a compilação de produção. O formulário diário e o planejamento semanal também foram conferidos na prévia local, com conexão ao Supabase desativada.
