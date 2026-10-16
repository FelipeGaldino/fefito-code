No Windows, instale Git, Node.js 24.18.0, Python 3.12 e Visual Studio Build Tools com C++ e Windows SDK. Depois, abra o PowerShell e execute:

git clone https://github.com/FelipeGaldino/fefito-code.git
cd .\fefito-code\vscode
.\scripts\build-windows-installer.ps1

Quando terminar, o instalador estará em:

fefito-code\vscode\.build\win32-x64\user-setup\FefitoSetup.exe

Se o PowerShell bloquear o script, execute:

powershell.exe -ExecutionPolicy Bypass -File .\scripts\build-windows-installer.ps1

A compilação do Windows ainda não foi testada em uma máquina Windows. Se aparecer um erro, envie a mensagem do terminal que eu ajusto o script.