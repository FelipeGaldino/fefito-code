# Perfil de agentes do Fefito

O Fefito instala orientações pessoais quando o assistente de configuração termina. O código que gera os arquivos está em `vscode/src/vs/workbench/contrib/fefito/common/fefitoAgentProfile.ts`.

| Arquivo no computador da pessoa | Função |
|---|---|
| `~/.fefito/MEMORY.md` | Memória Markdown compartilhada e editável |
| `~/.claude/CLAUDE.md` | Orientações globais do Claude Code |
| `~/.codex/AGENTS.md` | Orientações globais do Codex |
| `~/.claude/skills/{criar-com-python,lembrar-preferencias}/SKILL.md` | Skills pessoais do Claude |
| `~/.agents/skills/{criar-com-python,lembrar-preferencias}/SKILL.md` | Skills pessoais do Codex |
| `~/.claude/skills/personalizar-fefito/SKILL.md` e `~/.agents/skills/personalizar-fefito/SKILL.md` | Pedidos para mudar o editor pelo chat |
| `~/.fefito/control.py` | Controle Python que envia pedidos à janela aberta do Fefito |

As orientações globais dizem para conversar em português simples com uma pessoa leiga, interpretar pedidos cotidianos pelo contexto, entregar projetos executáveis, fazer a lógica em Python e consultar a memória no início das tarefas. Para um pedido novo, o agente cria uma pasta própria na pasta de projetos, coloca nela scripts, cópias de planilhas e outros arquivos de entrada e os resultados, executa a solução e mostra a saída no terminal. Depois oferece uma interface HTML como melhoria opcional de visualização. O chat do Fefito continua sendo o lugar dos pedidos. Para pedidos como "desliga isso", ele identifica o programa ou recurso pelo contexto e pede esclarecimento quando houver ambiguidade relevante. A skill de criação detalha o fluxo de projeto e o uso de `uv`; a skill de memória cobre registro, correção e esquecimento de preferências.

O instalador cria a memória e as skills somente se faltarem. Uma versão anterior da skill de Python é atualizada apenas quando seu conteúdo ainda é exatamente o padrão que o Fefito havia instalado; edições pessoais são preservadas. Em `CLAUDE.md` e `AGENTS.md`, ele adiciona ou atualiza apenas o bloco entre `<!-- FEFITO:START -->` e `<!-- FEFITO:END -->`, preservando as demais instruções. O assistente só marca a configuração como concluída após instalar os arquivos; se uma escrita falhar, apresenta o erro e permite tentar de novo.

Para instalações antigas já configuradas, a versão do perfil aciona uma migração na próxima abertura do editor. Se falhar, mostra uma notificação e tenta novamente na próxima abertura.

A memória é local, sem sincronização própria do Fefito. Os agentes atualizam o Markdown seguindo as orientações; esse aprendizado depende da execução dessas instruções pela CLI. A pessoa pode abrir o arquivo, corrigir fatos ou excluir informações. Senhas, tokens, dados sensíveis e transcrições integrais não devem ser gravados nele.

O controle Python aceita comandos de tema, ícones, pasta de projetos, Claude/Codex, conta e uso. O editor processa somente essas ações conhecidas e responde localmente. Para uso e detalhes da conta, ele abre os comandos da CLI no terminal; valores de cobrança não são inferidos de limites de assinatura.
