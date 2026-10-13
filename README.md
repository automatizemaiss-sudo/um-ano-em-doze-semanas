# 12 semanas
Dashboard pessoal em Next.js, React e Supabase. Interface em português, timezone America/Sao_Paulo.

## Executar
```sh
npm install
npm run dev
```
Abra http://localhost:3000. O Período 1 começa em 06/10/2026 às 00:00 (São Paulo), conforme informado. O início fica em `config/initial-period.json` e pode ser ajustado em Configurações antes dos primeiros registros. Execução começa vazia; resultados não informados aparecem como travessão, sem projeção. Registros locais permanecem no navegador; exporte backups em Configurações.

## Supabase
1. Crie um projeto Supabase e execute `supabase/schema.sql` no SQL Editor.
2. Copie `.env.example` para `.env.local` e informe NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. O nome legado NEXT_PUBLIC_SUPABASE_ANON_KEY também é aceito. Nunca use service_role no cliente.
3. Em Authentication, habilite **Anonymous Sign-Ins**. Não é necessário e-mail/senha.
4. Reinicie a aplicação. Uma sessão anônima é criada automaticamente e os registros locais são enviados à nuvem quando não existe um documento remoto.

A sessão pertence ao navegador. Limpar os dados do navegador ou usar outro dispositivo gera uma identidade diferente, sem acesso automático ao documento anterior. Exporte backups. `.env.example` é somente um modelo; os valores precisam estar em `.env.local` ou nas variáveis de ambiente da hospedagem.

A versão atual sincroniza o documento completo em `dashboard_states` por usuário. As tabelas normalizadas estão preparadas para a próxima etapa; não são preenchidas automaticamente nesta versão. Edições simultâneas em vários dispositivos usam a última gravação.

## Deploy Vercel
Importe este repositório, selecione Next.js, configure as duas variáveis de ambiente e faça deploy. Não foi realizado deploy nem criada infraestrutura Supabase automaticamente.

## Validação
```sh
npm test
npm run build
```
Veja `docs/ARQUITETURA.md` para cálculo, modelagem e decisões.

## Limites atuais
O antigo período demonstrativo é substituído pelo período real, preservando um backup local em `12weeks-demo-archive` e mantendo períodos reais existentes. Resultados e notas finais são valores atuais, sem trilha temporal de alterações no documento. Não há upload de fotos, integrações externas nem comparação de radar entre períodos. Metas diárias booleanas usam quantidade prevista de dias; não restringem dias específicos da semana. Novos tipos e definições de métrica precisam ser adicionados ao modelo antes de aparecerem na interface. Encerrar um período preserva a consulta, mas ainda permite corrigir registros históricos.

## Metas por semana
Configurações inclui a tabela de planejamento comercial com as 12 semanas editáveis. Metas, pesos e ativação editados afetam apenas a semana escolhida. O Período 1 recebe o plano comercial fornecido pelo usuário em `config/commercial-plan.json`; na migração, semanas com registros ou metas personalizadas são preservadas. O botão Aplicar metas do PDF reaplica leads e empresas apenas nas semanas vazias. Calls esperadas são estimativas, sem importação como metas. Semanas continuam sendo blocos de sete dias desde 06/10, conforme escolhido pelo usuário.

## Classificação dos indicadores comerciais
`config/metric-roles.json` define calls agendadas e realizadas como acompanhamento. Apenas prospecções online, presenciais e revisões de call compõem o score Comercial. A meta de revisões continua derivada das calls realizadas. A classificação aplica-se também a documentos existentes; valores e metas de calls são preservados sem contribuição ao score.

## Placar acumulado, qualidade e importação
Placar abre no período completo até a semana atual. O filtro permite consultar cada semana na mesma tela; não há aba Semana atual. O acumulado soma realizados e metas de semanas incluídas, usando médias dos pesos dos snapshots; apenas as metas dos dias até hoje entram no score. A composição explica esta regra. Qualidade comercial separa Online e Presencial: respostas/prospecções, agendamentos/prospecções e vendas/calls realizadas de cada canal. Registros antigos sem canal permanecem sem atribuição. Respostas e vendas ausentes aparecem como não informadas.

Configurações → Importar backup restaura JSON válido. Períodos do backup substituem os de mesmo ID; outros períodos são mantidos. Um documento anterior é preservado localmente em `12weeks-preimport-backup`. Importação tenta salvar no Supabase; se indisponível, salva localmente e informa a pendência. Conexão e backup → Sincronizar com Supabase grava e verifica a leitura. O schema mínimo está em `supabase/dashboard-state.sql`. Perspectiva permite editar texto geral, nome, descrição e notas de cada categoria.

## Calendário e metas até hoje
Calendário exibe os sete dias de cada semana. Ao selecionar um dia, suas metas são editáveis; salvar atualiza o snapshot diário e a soma semanal. O score do período e da semana em andamento considera apenas os dias até hoje, incluindo hoje. O filtro Hoje usa somente o dia atual. Metas futuras não participam. Um indicador pode ficar Previsto hoje ou Em atraso (saldo de metas anteriores ainda não realizado). Não há prazos intradiários nesta versão.

Distribuições iniciais são sugestões editáveis. Comercial usa padrões em `config/daily-patterns.json`: normalmente online seg/qua/sex e presencial ter/qui; na Semana 2 do período inicial, online ter/sex e presencial qua/qui. Outras métricas recebem uma distribuição sugerida, que o usuário deve ajustar no calendário. Revisões de call permanecem derivadas das calls realizadas. Alterar a meta semanal redimensiona a distribuição existente proporcionalmente; editar o dia atualiza a meta semanal. Os scores de semanas anteriores permanecem baseados em seus snapshots.
