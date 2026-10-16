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
| `../references/` | Repos de referência para estudo (opencode, goose, aider, pi, mini-swe-agent, code-guide) |

## Desenvolvimento

```bash
cd vscode
nvm use            # Node 24.18.0 (.nvmrc)
npm install        # primeira vez
npm run compile    # compila ( incremental é rápido )
./scripts/code.sh  # abre o Fefito dev (Electron)
```

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

## Roadmap

- [ ] **M2 — Layout chat-first:** explorer lateral fino, chat central persistente, código em subjanela
- [ ] **M3 — "Roda aí":** execução de projetos Python (venv por projeto via `uv`, terminal lateral, detecção de script principal)
- [ ] **M4 — Empacotamento Windows/macOS:** instalador que já traz Python 3.12 + agentes CLI (instalação offline)
- [ ] **M5 — Modo leigo:** esconder/renomear o que não importa (menus, settings), onboarding por voz/texto

Veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalhes técnicos.
