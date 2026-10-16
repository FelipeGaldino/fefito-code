# fefito-code

**Editor de código para quem nunca programou.** Um fork do VS Code (Electron) onde tudo acontece em **linguagem natural**: a pessoa pede em português, a IA (Claude Code ou Codex) escreve o código, prepara o ambiente e executa — o ser humano só conversa.

> "O usuário nem vai querer ver código. Se quiser, clica no arquivo e o código abre numa subjanela."

## Como funciona (visão do usuário)

1. **Primeira vez:** o Fefito abre um assistente amigável que:
   - Pergunta onde ficam as pastas de projetos da pessoa
   - Pergunta qual IA ela quer usar (Claude / Codex / ambos)
   - Instala automaticamente o agente escolhido (Claude Code, Codex), o `uv` e o **Python 3.12** — tudo visível num terminal "Fefito", sem privilégios de administrador
   - Abre o terminal do agente **bem grande no meio da tela** para o login
2. **Dia a dia:** o chat da IA ocupa o centro; arquivos ficam na lateral (clicou → abre em subjanela); rodar o projeto é pedir "roda aí" e a IA executa no terminal.
3. **Ambiente:** venvs, pacotes e execuções são resolvidos automaticamente (via `uv`).

## Repositório

| Pasta | O quê |
|---|---|
| `vscode/` | Fork do VS Code (base do produto). Todo o código do Fefito vive em `vscode/src/vs/workbench/contrib/fefito/` |

Esta publicação contém os arquivos necessários para desenvolver e compilar o editor. Testes, configurações internas e pipelines do projeto original foram retirados da cópia publicada. Dependências instaladas e resultados de compilação são gerados localmente e ficam fora do Git.

O Fefito é um produto próprio construído sobre código aberto do VS Code. A licença MIT e os avisos de terceiros das partes reutilizadas estão em [`vscode/LICENSE.txt`](vscode/LICENSE.txt) e [`vscode/ThirdPartyNotices.txt`](vscode/ThirdPartyNotices.txt). As licenças dos temas Dracula e Material Icon Theme acompanham as extensões. Esses avisos também entram no instalador.

## Desenvolvimento

```bash
cd vscode
nvm use            # Node 24.18.0 (.nvmrc)
npm ci             # primeira vez
npm run compile    # compila ( incremental é rápido )
./scripts/code.sh  # abre o Fefito dev (Electron)
```

## Instalador Windows para teste

Abra **Actions → Instalador Windows do Fefito → Run workflow** neste repositório. Depois que a compilação terminar, baixe o artefato **Fefito-Windows-x64**, extraia o ZIP e execute `FefitoSetup.exe` no Windows. O instalador ainda não é assinado e a primeira abertura precisa de internet para preparar Python, `uv` e a IA escolhida. Veja [as instruções completas](vscode/FEFITO-WINDOWS.md).

Lint dos arquivos alterados:

```bash
npm run eslint -- src/vs/workbench/contrib/fefito/browser/arquivo.ts
```

## Estado atual (Milestone 1 — Setup Wizard ✅)

- [x] Fork compila limpo (0 erros, lint OK)
- [x] Assistente de primeira instalação em 6 passos (bem-vindo → pasta → IA → preparar → login → pronto)
- [x] Instalação automática de Claude Code / Codex + uv + Python 3.12 com progresso visível
- [x] Comando `Fefito: Conversar com a IA` — terminal do agente na área central do editor
- [x] Ao concluir o setup, abre a pasta de projetos e já mostra o chat da IA no centro
- [x] Perfil e memória locais compartilhados por Claude e Codex, com skills de Python, preferências e personalização pelo chat
- [x] Lateral simples (Arquivos e Busca), Dracula Theme e Material Icon Theme incluídos no editor
- [x] Ícone da IA ativa com acesso a conta e uso; engrenagem com pasta de projetos, troca de conta, assistente e aparência

## Roadmap

- [x] **M2 — Layout chat-first:** pastas na lateral, código abaixo delas e assistente no centro
- [ ] **M3 — "Roda aí":** execução de projetos Python (venv por projeto via `uv`, terminal lateral, detecção de script principal)
- [ ] **M4 — Empacotamento Windows/macOS:** build de teste Windows preparado; falta validar o instalador em Windows e preparar distribuição offline
- [ ] **M5 — Modo leigo:** esconder/renomear o que não importa (menus, settings), onboarding por voz/texto

Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalhes técnicos.

## Memória e skills

Ao clicar em **Começar a usar**, o Fefito cria uma memória editável em `~/.fefito/MEMORY.md`, adiciona orientações a `~/.claude/CLAUDE.md` e `~/.codex/AGENTS.md` e instala três skills pessoais para cada agente: `criar-com-python`, `lembrar-preferencias` e `personalizar-fefito`. Arquivos existentes são preservados; as orientações do Fefito ficam entre marcadores próprios. O conteúdo da memória permanece no computador da pessoa e pode ser alterado ou apagado por ela.

As orientações pedem que os agentes usem **Python para a lógica dos programas**, recorrendo a outras linguagens apenas quando a interface ou a plataforma exigir. A memória começa com poucas preferências confirmadas e cresce à medida que a pessoa conta sobre seu trabalho e seus projetos. Mais detalhes em [docs/AGENT_PROFILE.md](docs/AGENT_PROFILE.md).

O fluxo padrão começa no chat: cada pedido novo ganha uma pasta própria para scripts, cópias de planilhas e resultados. O agente executa o trabalho, mostra a saída no terminal e oferece uma página HTML apenas como melhoria opcional. Pedidos cotidianos, como "desliga isso", são interpretados pelo contexto; quando o alvo não está claro, o agente pede esclarecimento em linguagem simples.

Pedidos como "mude para um tema claro", "troque a pasta de projetos" e "use o Codex" passam pela skill `personalizar-fefito`. O agente usa `python3 ~/.fefito/control.py` para enviar a ação à janela aberta; o Fefito aplica a mudança. O ícone da IA ativa abre opções de conta e de uso. Os números disponíveis variam conforme o tipo de assinatura e o provedor: o Fefito mostra uso e limites no terminal e oferece `/cost` para a conversa atual do Claude com conta API, sem inventar um gasto total da conta.

As extensões incluídas são [Dracula Theme Official](https://github.com/dracula/visual-studio-code) 2.25.1 e [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) 5.39.0. As licenças MIT acompanham os arquivos em `vscode/extensions/`.
