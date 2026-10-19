# Finanças — Automatize Mais

A aba Finanças implementa o briefing recebido em 19/10/2026. Usa o mesmo estado JSON local/Supabase e o mesmo calendário `weekBounds` do restante do dashboard. Janeiro corresponde à semana 1, fevereiro à semana 2 etc. A primeira semana mantém o início real do ciclo. Não cria uma área financeira no score de execução.

## Indicadores

- Novos clientes com contrato assinado: 8.
- Faturamento realizado acumulado: R$ 25.000.
- Custos e despesas totais, incluindo remuneração paga e encargos: limite de R$ 8.000.
- Lucro gerencial acumulado: R$ 17.000.
- Caixa empresarial líquido de principal devido ao proprietário: R$ 15.000.
- Capacidade gerencial de remuneração: R$ 3.200, com marco de R$ 2.000.

Faturamento e recebimentos têm campos separados. Empréstimos e aportes não são lançados em nenhum deles. O principal devolvido ao proprietário não é despesa; o usuário atualiza o caixa real e a dívida pendente. Os custos operacionais e tributos incorridos também são separados dos desembolsos efetivos.

O resultado mensal antes da transferência ao proprietário deduz os demais custos e os encargos efetivos de remuneração. Isso evita autorizar uma retirada ignorando custos que a empresa já conhece. Depois da transferência, o lucro deduz também os pagamentos realizados ao proprietário.

## Liberação gerencial

Faixas de resultado antes da remuneração: abaixo de R$ 3.000 = R$ 0; entre R$ 3.000 e R$ 5.199,99 = R$ 2.000; a partir de R$ 5.200 = R$ 3.200.

A faixa pelo resultado é distinta do valor liberado agora. Pagamentos já registrados reduzem o saldo da faixa e não são novamente deduzidos do resultado usado para escolher a faixa. Autorizar não gera lançamento. O registro explícito de um pagamento reduz o caixa informado, aumenta o custo e reduz o saldo da faixa. Excluir um registro incorreto devolve o valor ao caixa do mês aberto.

A disponibilidade usa o menor entre:

1. Caixa real disponível menos principal ainda devido ao proprietário.
2. Caixa próprio da operação: saldo operacional inicial confirmado, mais recebimentos operacionais, menos despesas efetivamente pagas, encargos pagos e pagamentos ao proprietário.

Dessa disponibilidade são reservados as obrigações declaradas, os encargos da remuneração ainda pendentes e o capital de giro. Aportes e empréstimos não aumentam o caixa próprio da operação. Para evitar duplicidade, as obrigações a reservar excluem remuneração, encargos de remuneração e capital de giro, considerados separadamente.

O capital de giro mínimo e o alcance das obrigações não foram definidos no briefing. Permanecem sem valor presumido. A interface permite configurar ambos e confirmar o caixa próprio operacional inicial em 19/10/2026. Até completar os dados necessários, não há liberação de remuneração. O alcance das obrigações pode ser todas as lançadas e não pagas ou somente as que vencem no mês operacional; seu valor é preenchido manualmente.

## Histórico

- As metas e os valores originais ficam preservados em `goals` e na cópia de origem da área financeira.
- A meta pessoal de investimentos e as projeções financeiras saíram da interface ativa.
- Nenhuma receita, despesa, contrato ou pagamento foi inventado a partir das metas antigas.
- Clientes antigos confirmados continuam no saldo histórico; os novos contratos registrados são adicionais.
- Os totais anteriores à semana 3 podem ser editados nos saldos iniciais. Valores antigos com classificação diferente ficam visíveis como referência, sem conversão automática.
- Por solicitação do usuário, campos vazios são exibidos como zero e podem ser editados. O acumulado exibido soma os valores preenchidos, usando zero para os restantes, sem sobrescrever registros persistidos. Os avisos de ausência de registro foram removidos. A liberação gerencial continua dependendo da configuração da política.
- Os meses financeiros encerrados são somente de consulta. A política utilizada é salva no mês, evitando que configurações futuras alterem a autorização histórica.
- As semanas de execução, suas métricas, pesos e scores não são modificados por registros financeiros.

Os testes verificam fronteiras de remuneração, insuficiência de caixa, exclusão de recursos pessoais, pagamentos parciais, centavos, encargos, devolução do principal, ausência de dados e preservação de histórico e execução.
