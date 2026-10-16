# Fefito Code — Arquitetura

Documento vivo. Última atualização: perfil e memória dos agentes.

## 1. Visão geral

O Fefito é um **fork do VS Code** (Electron) transformado em produto para leigos:

```
┌──────────────────────────────────────────────────────────────┐
│  FEFITO (Electron, fork do VS Code)                          │
│                                                              │
│   ┌────────────┐   ┌──────────────────────┐   ┌───────────┐  │
│   │ Explorador │   │  CHAT DA IA (CENTRO) │   │ Terminal  │  │
│   │ de arquivos│   │  claude / codex      │   │ (execução)│  │
│   │ (lateral)  │   │  terminal no editor  │   │ (lateral) │  │
│   └────────────┘   └──────────────────────┘   └───────────┘  │
│        │                   │                      │          │
│        └──── código só se a pessoa QUISER ver ─────┘          │
├──────────────────────────────────────────────────────────────┤
│  CAMADA FEFITO (src/vs/workbench/contrib/fefito/)            │
│   • Setup Wizard (primeira instalação)                       │
│   • Setup Terminal (instala CLIs, uv, Python 3.12)           │
│   • Agent Chat launcher (terminal central do agente)         │
├──────────────────────────────────────────────────────────────┤
│  FERRAMENTAS EXTERNAS NA MÁQUINA DO USUÁRIO                  │
│   • Claude Code CLI (~/.local/bin/claude)                    │
│   • Codex CLI (npm -g @openai/codex)                         │
│   • uv (~/.local/bin/uv) + Python 3.12 standalone            │
└──────────────────────────────────────────────────────────────┘
```

**Princípios:**

1. **Linguagem natural é a interface.** O terminal do agente é o cidadão de primeira classe (área central do editor).
2. **Transparência sem terror.** Instalações rodam num terminal visível ("Terminal Fefito"), mas a pessoa não precisa digitar nada.
3. **Sem privilégio de administrador.** Tudo vive em `~/.local` (uv, Claude Code, Python standalone).
4. **O código é opt-in.** Arquivos abrem em subjanela somente quando a pessoa clica.
5. **Estilo do upstream.** Código novo segue as convenções do VS Code (tabs, nls, DI, contribuições) para facilitar merges futuros do upstream.

## 2. Estrutura do código

```
vscode/src/vs/workbench/contrib/fefito/
├── common/
│   └── fefito.ts               # chaves de storage, agentes, comandos por plataforma
└── browser/
    ├── fefito.contribution.ts  # registro do pane/resolver/comandos/contribuições
    ├── fefitoSetupWizard.ts    # o assistente (EditorPane DOM, 6 passos, PT-BR)
    ├── fefitoSetupInput.ts     # EditorInput (scheme 'fefito-setup')
    ├── fefitoSetupTerminal.ts  # executa comandos no "Terminal Fefito" com marcadores
    └── media/fefitoWizard.css  # estilos (tokens --vscode-*)
```

Registro: `vscode/src/vs/workbench/workbench.common.main.ts` (seção `// Fefito`).

## 3. Fluxo do Setup Wizard (M1)

```
Bem-vindo ──▶ Pasta dos projetos ──▶ Escolher IA ──▶ Preparar ──▶ Login ──▶ Pronto
 (cards)      (IFileDialogService)   (claude/codex)  (auto)      (terminal   (abre pasta +
                                                                   no editor)  chat central)
```

**Passo "Preparar" — sequência de tarefas no Terminal Fefito:**

| Tarefa | Detecção | Instalação |
|---|---|---|
| Node.js (se Codex) | `node --version` | — (erro com orientação) |
| Claude Code | `command -v claude` / `Get-Command claude` | `curl … install.sh \| bash` / `irm …/install.ps1 \| iex` |
| Codex | idem | `npm install -g @openai/codex` |
| uv | `~/.local/bin/uv --version` | `curl … astral.sh/uv/install.sh \| sh` |
| Python 3.12 | — (idempotente) | `~/.local/bin/uv python install 3.12` |

Cada comando é executado com **marcadores** (`wrapWithMarkers`) no terminal: o wizard observa `onData`, encontra `FEFITO_END:<id>:<código>` e atualiza o status da tarefa. Benefícios: progresso visível, usuário pode intervir, zero IPC nativo novo.

**Decisões de plataforma:**

- **macOS:** terminais do VS Code são *login shells* → o PATH atualizado pelos instaladores é visto em terminais novos.
- **Windows:** o PATH do usuário muda no registro, mas o pty host só vê depois de reiniciar. Por isso o wizard lança o Claude pelo caminho absoluto (`& "$HOME\.local\bin\claude.exe"`). (M4 melhora isso empacotando os binários.)
- **PowerShell:** marcadores usam `$?` (sucesso do último comando); nunca usamos `exit` (fecharia o terminal).

## 4. Estado persistente (StorageScope.APPLICATION)

| Chave | Conteúdo |
|---|---|
| `fefito.setupComplete` | `true` quando o wizard terminou (controla exibir de novo) |
| `fefito.projectsFolder` | URI da pasta de projetos escolhida |
| `fefito.agents` | JSON `["claude","codex"]` |
| `fefito.openChatOnStart` | flag "abrir chat central ao abrir o workspace" (consumida 1x) |
| `fefito.agentProfileInstalled` | `true` após instalar instruções, memória e skills; permite migração única para instalações existentes |
| `fefito.agentProfileVersion` | versão do perfil instalado; aciona a atualização das orientações após uma mudança |

O perfil dos agentes é instalado em arquivos do usuário ao finalizar o wizard, antes de gravar `fefito.setupComplete`. Ao abrir uma instalação já configurada, o `FefitoSetupRunnerContribution` instala o perfil uma vez caso a nova chave ainda não exista. Veja [AGENT_PROFILE.md](AGENT_PROFILE.md).

## 5. Comandos registrados

| ID | O que faz |
|---|---|
| `fefito.openSetupWizard` | Abre o assistente (palette: "Fefito: Configurar…") |
| `fefito.openAgentChat` | Cria/revela terminal do agente na área do editor (centro) |

## 6. Referências que inspiram os próximos passos

| Problema | Fonte | Arquivo |
|---|---|---|
| PATH em app GUI (mac) | goose | `references/goose/ui/desktop/src/loginShellPath.ts` |
| Sidecar/daemon em Electron | goose/opencode | `gooseServe.ts`, `desktop-cli.ts` |
| PTY persistente + replay | opencode | `packages/core/src/persistent-pty/` |
| Agent ↔ editor via ACP | goose / opencode | `crates/goose/src/acp/provider.rs` |
| Python subprocesso seguro | code-guide | `backend/tracer/` |

## 7. Próximos marcos (design resumido)

- **M2 Layout chat-first:** padrões de layout iniciais customizados (chat central persistente — provavelmente `IWorkbenchLayoutService` + defaults de `workbench.*`), explorer fino, renomear UI para leigos.
- **Lateral simples já implementada:** na primeira abertura, o Fefito oculta Outline e Timeline e fixa apenas Arquivos e Busca na barra lateral. Depuração, Git e Extensões continuam disponíveis internamente, mas sem atalhos principais. `Dracula Theme` e `Material Icon Theme` são extensões incluídas no fork e defaults de configuração; preferências explícitas do usuário continuam tendo prioridade. O tema Galaxy anterior permanece disponível como alternativa.
- **Conta e configurações:** a barra inferior mostra a IA ativa no lugar do avatar genérico. O menu da conta abre detalhes, uso e login no terminal da CLI correspondente. A engrenagem concentra pasta de projetos, troca de IA e aparência. O Fefito não calcula valores de cobrança sem uma fonte confiável do provedor.
- **Personalização pelo chat:** a skill `personalizar-fefito` chama o controle Python em `~/.fefito/control.py`. Ele grava um pedido local com ID em `~/.fefito/command.json`; a contribuição do editor verifica esse arquivo e executa apenas ações permitidas de tema, ícones, pasta, agente, conta e uso. A resposta aparece em `~/.fefito/response.json`. A troca de tema usa configuração de usuário; a troca de pasta atualiza a pasta padrão e reutiliza a janela.
- **M3 Execução:** comando `fefito.run` — detecta script principal (ou pergunta ao agente), garante venv do projeto (`uv venv` + `uv pip install -r requirements.txt` se existir), roda num terminal lateral com foco automático.
- **M4 Empacotamento:** build Windows (NSIS do VS Code) bundling `uv` + Python 3.12 standalone + CLIs, eliminação do passo de download no primeiro uso.
- **M5 Modo leigo:** esconder menus avançados, PT-BR como idioma base do produto.
