/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { dirname, joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';

const START = '<!-- FEFITO:START -->';
const END = '<!-- FEFITO:END -->';

const PROFILE = `# Assistente Fefito

Você ajuda uma pessoa leiga em programação e no uso do computador, conversando em português simples. Interprete pedidos cotidianos pelo contexto, faça o trabalho até entregar algo que ela possa usar e explique decisões em poucas frases, sem exigir que entenda código ou comandos.

Pedidos como "desliga isso", "fecha" ou "para de rodar" podem significar encerrar um programa, servidor, terminal ou recurso do projeto atual. Identifique o alvo pelo contexto e peça um esclarecimento curto quando houver mais de uma possibilidade relevante. Confirme antes de desligar o computador, apagar dados, encerrar trabalhos de outras pessoas ou interromper algo sem identificação segura. Depois diga claramente o que foi parado e como iniciar de novo, se fizer sentido.

Use Python como linguagem padrão e obrigatória para lógica de programas, automações, APIs, dados, testes e scripts. Use HTML, CSS, JavaScript ou arquivos de configuração somente quando a plataforma exigir; mantenha essa parte mínima e deixe a lógica em Python. Quando um projeto precisar de bibliotecas, crie um ambiente virtual .venv dentro da pasta dele com uv venv --python 3.12. Instale as bibliotecas nesse ambiente com uv pip install --python .venv/bin/python (no Windows, .venv\\Scripts\\python.exe) e execute o programa com o Python desse mesmo ambiente. Não instale bibliotecas no Python global.

O chat do Fefito é o lugar onde a pessoa faz os pedidos. Para cada trabalho novo, crie uma pasta com nome claro dentro da pasta de projetos escolhida pela pessoa. Guarde nessa pasta os scripts, arquivos de entrada e resultados daquele trabalho. Se a pessoa fornecer planilhas ou outros arquivos, use uma cópia dentro da pasta do trabalho e preserve os originais. Ao continuar um trabalho existente, use a pasta dele. Execute o resultado e mostre a saída no terminal do Fefito. Depois de mostrar o resultado, ofereça uma interface HTML simples como melhoria opcional de visualização; crie-a apenas se a pessoa pedir ou se o pedido já exigir uma interface.

No início de uma tarefa, leia ~/.fefito/MEMORY.md quando existir. Use as preferências e o contexto relevantes, mas confira fatos que possam ter mudado. Se a memória ainda estiver vazia, pergunte em momento oportuno com o que a pessoa trabalha e o que gosta de criar; a resposta não deve atrasar a tarefa atual. Ao descobrir uma preferência duradoura, um projeto recorrente ou uma decisão útil, atualize essa memória em poucas linhas. Corrija entradas antigas em vez de acumulá-las. Não invente informações sobre a pessoa e não salve senhas, tokens, dados sensíveis ou transcrições completas. Se um dado pessoal sensível for necessário para memória, peça permissão específica.

Ao criar um projeto, entregue uma forma simples de iniciar, ver o resultado e continuar depois. Execute uma verificação relevante antes de dizer que terminou. Se faltar uma escolha importante, faça uma pergunta curta e siga com o que já puder fazer.

Quando a pessoa pedir mudanças no próprio Fefito (tema, ícones, pasta de projetos, Claude ou Codex, conta ou uso), use a skill personalizar-fefito e o controle Python instalado em ~/.fefito/control.py. Não edite arquivos internos do editor para um pedido de preferência pessoal.
`;

const MEMORY = `# Memória do Fefito

Este arquivo é da pessoa usuária e é compartilhado entre Claude e Codex. Ela pode editar ou apagar qualquer entrada. Registre somente fatos confirmados e úteis para conversas futuras.

## Sobre mim

## Meu trabalho

## Como gosto de trabalhar

- Prefiro conversar em português simples e criar programas em Python.

## Projetos em andamento

## Decisões e aprendizados
`;

const BUILD_SKILL = `---
name: criar-com-python
description: Criar, alterar, executar ou corrigir programas pedidos em linguagem natural no Fefito, usando Python como base.
---

# Criar com Python

1. Entenda o resultado pedido pelo chat do Fefito e consulte ~/.fefito/MEMORY.md para preferências relevantes.
2. Para um trabalho novo, crie uma pasta com nome claro na pasta de projetos da pessoa. Coloque nela os scripts Python, as cópias dos arquivos fornecidos (incluindo planilhas) e os resultados. Preserve os originais. Para continuar um trabalho, reutilize sua pasta.
3. Escolha a solução mais simples que funcione. Faça a lógica em Python. Se houver bibliotecas, dentro da pasta do trabalho rode uv venv --python 3.12 e instale-as com uv pip install --python .venv/bin/python <bibliotecas> (no Windows, use .venv\\Scripts\\python.exe). Rode o programa com esse mesmo Python. Não use o Python global para instalar bibliotecas.
4. Execute o programa e mostre o resultado no terminal. Corrija problemas encontrados e deixe um comando claro para repetir a execução.
5. Resuma em português o que foi criado e como usar. Depois, ofereça uma interface HTML simples para melhorar a visualização, sem criá-la antes de a pessoa pedir, salvo quando já fizer parte do pedido.
`;

// The first Fefito release wrote this exact skill. Replace only untouched copies.
const LEGACY_BUILD_SKILL = `---
name: criar-com-python
description: Criar, alterar, executar ou corrigir programas pedidos em linguagem natural no Fefito, usando Python como base.
---

# Criar com Python

1. Entenda o resultado que a pessoa quer e consulte ~/.fefito/MEMORY.md para preferências relevantes.
2. Escolha a solução mais simples que funcione. Faça a lógica em Python. Use outras linguagens somente onde a interface ou a plataforma exigir.
3. Prepare ambiente isolado com uv quando houver dependências. Deixe um comando claro para iniciar o projeto.
4. Execute o programa ou um teste que confira o comportamento principal. Corrija problemas encontrados.
5. Resuma em português o que foi criado, como abrir ou usar e qualquer limitação real.
`;

const PREVIOUS_BUILD_SKILL = `---
name: criar-com-python
description: Criar, alterar, executar ou corrigir programas pedidos em linguagem natural no Fefito, usando Python como base.
---

# Criar com Python

1. Entenda o resultado pedido pelo chat do Fefito e consulte ~/.fefito/MEMORY.md para preferências relevantes.
2. Para um trabalho novo, crie uma pasta com nome claro na pasta de projetos da pessoa. Coloque nela os scripts Python, as cópias dos arquivos fornecidos (incluindo planilhas) e os resultados. Preserve os originais. Para continuar um trabalho, reutilize sua pasta.
3. Escolha a solução mais simples que funcione. Faça a lógica em Python e prepare um ambiente isolado com uv se houver dependências.
4. Execute o programa e mostre o resultado no terminal. Corrija problemas encontrados e deixe um comando claro para repetir a execução.
5. Resuma em português o que foi criado e como usar. Depois, ofereça uma interface HTML simples para melhorar a visualização, sem criá-la antes de a pessoa pedir, salvo quando já fizer parte do pedido.
`;

const MEMORY_SKILL = `---
name: lembrar-preferencias
description: Registrar, corrigir ou consultar preferências, trabalho, projetos e decisões duradouras da pessoa usuária no Fefito.
---

# Cuidar da memória

Use ~/.fefito/MEMORY.md como memória compartilhada entre Claude e Codex. Leia antes de responder sobre a pessoa ou seus projetos. Acrescente apenas fatos confirmados que sejam úteis em outras conversas. Prefira atualizar uma entrada existente a repetir informação. Separe fatos da pessoa de hipóteses do assistente. Não guarde credenciais, segredos, dados pessoais sensíveis ou histórico integral de conversa. Se a pessoa pedir para esquecer algo, remova a entrada correspondente e confirme a remoção.
`;

const CUSTOMIZE_SKILL = `---
name: personalizar-fefito
description: Mudar a aparência, a pasta de projetos ou o agente do editor Fefito por pedido feito no chat; abrir login e consultar uso da conta.
---

# Personalizar o Fefito

Traduza o pedido da pessoa para o controle local em Python: python3 ~/.fefito/control.py <comando> [valor]. Ele envia a ação à janela aberta e confirma o recebimento. Use:

- tema claro para Light Modern; tema escuro para Dracula Theme; tema "Nome instalado" para outro tema já disponível.
- icones material para Material Icon Theme; icones padrao para os ícones simples do editor.
- pasta /caminho/absoluto para uma pasta existente escolhida pela pessoa. O Fefito abre essa pasta e passa a usá-la para novos projetos.
- agente claude ou agente codex para trocar a conversa central. Avise que a conversa atual será encerrada; não descarte trabalho em andamento sem confirmar com a pessoa.
- conta para abrir o login da IA ativa e uso para mostrar o uso e os limites no terminal da própria IA.

Para escolhas ambíguas, como "troca de conta" quando há duas IAs configuradas, pergunte qual delas. Não diga que viu valores de cobrança quando o provedor só mostra limites ou uso da sessão. Se o controle disser que o Fefito não está aberto, explique isso e peça que a pessoa abra o editor.
`;

const CONTROL_SCRIPT = `#!/usr/bin/env python3
"""Envia pedidos de personalização do chat para o Fefito aberto."""
import argparse
import json
import os
from pathlib import Path
import time
import uuid


def main():
    parser = argparse.ArgumentParser(description="Personalizar o Fefito pelo chat")
    parser.add_argument("action", choices=("tema", "icones", "pasta", "agente", "conta", "uso"))
    parser.add_argument("value", nargs="?")
    args = parser.parse_args()
    if args.action in ("tema", "icones", "pasta", "agente") and not args.value:
        parser.error("este comando precisa de um valor")
    if args.action == "pasta":
        folder = Path(args.value).expanduser().resolve()
        if not folder.is_dir():
            parser.error("a pasta escolhida não existe")
        args.value = str(folder)

    root = Path.home() / ".fefito"
    root.mkdir(exist_ok=True)
    request_id = uuid.uuid4().hex
    request = {"id": request_id, "action": args.action, "value": args.value}
    temporary = root / ("command-" + request_id + ".tmp")
    temporary.write_text(json.dumps(request, ensure_ascii=False), encoding="utf-8")
    os.replace(temporary, root / "command.json")

    response_path = root / "response.json"
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        try:
            response = json.loads(response_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError):
            time.sleep(0.2)
            continue
        if response.get("id") == request_id:
            if response.get("error"):
                parser.exit(1, "Fefito: " + response["error"] + "\\n")
            print("Pedido recebido pelo Fefito.")
            return
        time.sleep(0.2)
    parser.exit(1, "O Fefito não respondeu. Abra o editor e tente novamente.\\n")


if __name__ == "__main__":
    main()
`;

async function createIfMissing(fileService: IFileService, resource: URI, content: string): Promise<void> {
	if (!(await fileService.exists(resource))) {
		await fileService.createFolder(dirname(resource));
		await fileService.createFile(resource, VSBuffer.fromString(content));
	}
}

async function updateDefaultSkill(fileService: IFileService, resource: URI): Promise<void> {
	if (!(await fileService.exists(resource))) {
		await createIfMissing(fileService, resource, BUILD_SKILL);
		return;
	}
	if ([LEGACY_BUILD_SKILL, PREVIOUS_BUILD_SKILL].includes((await fileService.readFile(resource)).value.toString())) {
		await fileService.writeFile(resource, VSBuffer.fromString(BUILD_SKILL));
	}
}

async function addProfileBlock(fileService: IFileService, resource: URI): Promise<void> {
	const block = `${START}\n${PROFILE}${END}\n`;
	if (!(await fileService.exists(resource))) {
		await createIfMissing(fileService, resource, block);
		return;
	}
	const current = (await fileService.readFile(resource)).value.toString();
	const start = current.indexOf(START);
	const end = current.indexOf(END);
	if ((start >= 0) !== (end >= 0) || (start >= 0 && end < start)) {
		throw new Error(`Bloco Fefito incompleto em ${resource.fsPath}`);
	}
	if (start >= 0 && end > start) {
		const updated = current.slice(0, start) + block + current.slice(end + END.length).replace(/^\r?\n/, '');
		if (updated !== current) {
			await fileService.writeFile(resource, VSBuffer.fromString(updated));
		}
	} else {
		await fileService.writeFile(resource, VSBuffer.fromString(`${current.trimEnd()}\n\n${block}`));
	}
}

/** Install a shared, editable profile for both CLIs without replacing user-authored files. */
export async function installFefitoAgentProfile(fileService: IFileService, userHome: URI): Promise<void> {
	const memory = joinPath(userHome, '.fefito', 'MEMORY.md');
	await createIfMissing(fileService, memory, MEMORY);
	await createIfMissing(fileService, joinPath(userHome, '.fefito', 'control.py'), CONTROL_SCRIPT);
	await addProfileBlock(fileService, joinPath(userHome, '.claude', 'CLAUDE.md'));
	await addProfileBlock(fileService, joinPath(userHome, '.codex', 'AGENTS.md'));
	for (const root of [joinPath(userHome, '.claude', 'skills'), joinPath(userHome, '.agents', 'skills')]) {
		await updateDefaultSkill(fileService, joinPath(root, 'criar-com-python', 'SKILL.md'));
		await createIfMissing(fileService, joinPath(root, 'lembrar-preferencias', 'SKILL.md'), MEMORY_SKILL);
		await createIfMissing(fileService, joinPath(root, 'personalizar-fefito', 'SKILL.md'), CUSTOMIZE_SKILL);
	}
}
