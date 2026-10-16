# Instalar e testar o Fefito no Windows

O instalador de teste é gerado em Windows x64. Ele instala o editor para a pessoa atual sem pedir acesso de administrador. Na primeira abertura, o Fefito pede a pasta de projetos e instala pela internet o agente escolhido, `uv` e Python 3.12. Cada trabalho com bibliotecas usa seu próprio `.venv`.

## Baixar o instalador pelo GitHub

Depois que o repositório do Fefito com a pasta `vscode/` estiver publicado no GitHub:

1. Abra **Actions → Instalador Windows do Fefito → Run workflow**.
2. Espere a execução terminar e abra a execução concluída.
3. Em **Artifacts**, baixe **Fefito-Windows-x64** e extraia o ZIP.
4. Execute `FefitoSetup.exe` na máquina Windows de teste.

Esse instalador ainda não é assinado digitalmente. O Windows pode pedir confirmação antes da instalação. É um build para testes, sem atualização automática e que precisa de internet no primeiro uso.

## Compilar diretamente em um computador Windows

Instale Git, Node.js na versão de `.nvmrc`, Python 3.12 e as ferramentas C++ e Windows SDK necessárias para compilar o VS Code. No PowerShell, dentro deste repositório, rode:

```powershell
./scripts/build-windows-installer.ps1
```

O arquivo final fica em `.build\win32-x64\user-setup\FefitoSetup.exe`. O script confirma que ele existe e mostra seu SHA-256. Para repetir o build com as dependências já instaladas, use `./scripts/build-windows-installer.ps1 -SkipInstall`.

Os comandos de empacotamento seguem as tarefas Windows do próprio fork do VS Code. A [documentação oficial de compilação do VS Code](https://github.com/microsoft/vscode/wiki/How-to-Contribute#packaging) explica os requisitos do ambiente Windows.

## Organização do Git

Os diretórios `node_modules/`, `out/`, `.build/`, ambientes virtuais e segredos locais ficam fora do Git. Os arquivos prontos do Material Icon Theme em `extensions/material-icon-theme/dist/` precisam entrar no Git; sem eles, o tema não funciona após uma instalação limpa.

No repositório publicado, o código do editor fica em `vscode/` e a ação de compilação fica em `.github/workflows/fefito-windows-installer.yml` na raiz. A instalação local pode manter um Git separado em `vscode/` para acompanhar o projeto original do VS Code.
