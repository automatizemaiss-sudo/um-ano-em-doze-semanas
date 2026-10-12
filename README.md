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
2. Copie `.env.example` para `.env.local` e informe URL e chave pública anon do projeto. Nunca use service_role no cliente.
3. Habilite e-mail/senha em Authentication; configure as URLs permitidas para localhost e domínio Vercel.
4. Reinicie a aplicação. Abra o avatar → Criar conta/Entrar.

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
