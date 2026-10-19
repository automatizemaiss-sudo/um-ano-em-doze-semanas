# Atualização a partir da semana 3 — 19/10/2026

O calendário de `weekBounds` continua sendo a fonte única dos períodos. A primeira semana é parcial, pois o ciclo começa em 06/10. As seguintes começam segunda 00h e terminam imediatamente antes da segunda seguinte, em São Paulo. O ciclo e suas datas persistidas não foram recriados.

O relógio virtual agora mapeia semana 1 a janeiro, semana 2 a fevereiro, etc. A mudança de mês acontece na fronteira semanal.

## Histórico e persistência

- Cada semana possui métricas, pesos e versão de estratégia próprios.
- A migração mantém cópias exatas das semanas 1 e 2 e não altera métricas de Disciplina.
- Novos indicadores entram nas semanas 3–12 do ciclo iniciado em 06/10/2026. Outros ciclos não recebem a estratégia automaticamente.
- Edições de semanas encerradas são protegidas no fluxo de alteração de estado. As sincronizações comerciais também não substituem suas fontes semanais.
- Sessões, atualizações, materiais, competências, avaliações e revisões utilizam o mesmo JSON do estado, salvo localmente e pelo repositório Supabase existente. Fotografias otimizadas não são publicadas em URLs externas.
- Minutos já existentes no registro diário permanecem válidos. Novas sessões são adicionais: o mesmo tempo não deve ser lançado nos dois formulários.

## Estudos

Exatamente cinco seções: Visão geral, Horas de estudo, Atualizações, Cronograma e Competências. A fila de aprofundamento está em Atualizações.

Meta oficial: 300min/semana, 3.600min/ciclo. Recuperação: planejamento de 330min para semanas 3–12. O diagnóstico de 325min não é injetado nos dados; a projeção usa os registros reais.

Score semanal: horas limitadas a 100% × 70% + atualizações × 30%. Atualizações: diárias × 70% + X × 30%. Newsletters sem edição saem do denominador; Instagram mantém a previsão diária. As competências têm confirmação manual de demonstração e não participam do score.

## Saúde

Alimentação 40%, treinamento conjunto 50%, abdômen 10%. Treinamento: base de 3 musculações (22,5 pontos), 1 cardio (15 pontos) e complemento de 4ª musculação ou 2º cardio (12,5 pontos). Limite de 50 pontos. Alimentação: 6 dias; abdômen: 2 sessões. Abdômen dentro de treino conta para ambos sem criar outro treino.

Futsal é cardio; Futlagoa não é. Sono e qualidade subjetiva não participam da nova Saúde. Medidas, fotos e alimentação de referência são independentes do score.

## Comercial

Adaptador para os cabeçalhos verificados em Resultados!N:AG. Pode receber CSV da aba completa (ignora A:M) ou somente a base N:AG. Há tentativa de leitura por endpoint do Google; se exigir autenticação, a interface orienta importação CSV e preserva a leitura anterior.

A identidade não usa linha: origem + nome + tipo + número para tarefas/reuniões; eventos usam atividade e data efetiva. Duplicados e reuniões/tarefas sem número geram alerta e impedem score definitivo. Eventos sem data efetiva permanecem sem período. A integração não infere execuções pela etapa atual.

O planejamento de follow-ups usa a previsão original, preservada entre importações. Cancelamentos e reagendamentos não retiram tarefas do denominador. As reuniões são contadas pelo tipo Reunião, sem somar seus eventos. Horas e revisões têm armazenamento independente da fonte externa.

Pesos comerciais: 3/3/3/1/1/1; metas de 40 online e 12 presencial nas semanas 3 e 4. Fonte ausente ou ambígua deixa o Comercial e o score geral incompletos. Eficiência usa horas por canal e conversões do mesmo grupo de primeira abordagem. Valores financeiros continuam fora da execução.

### Limitações verificadas

A planilha estava configurada em America/Los_Angeles durante a inspeção. O adaptador aceita datas de calendário sem horário e rejeita horários ambíguos, sem alterar o fuso da fonte.

O script e o guia de uso mencionados no briefing não foram fornecidos. A presença do bloco não comprova que o script esteja sendo executado; a interface sinaliza essa limitação. A leitura autenticada contínua depende de integração Google no ambiente de execução; o conector disponível nesta conversa não fornece credenciais ao aplicativo. O CSV é a alternativa sem mudar o compartilhamento da planilha.

As dez competências e o planejamento alimentar são editáveis no estado atual do ciclo; os scores históricos só usam os snapshots das semanas, e não esses conteúdos.
