/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isWindows } from '../../../../base/common/platform.js';

/**
 * Fefito: storage keys used across the setup wizard and the agent chat contributions.
 */
export const FEFITO_SETUP_COMPLETE_KEY = 'fefito.setupComplete';
export const FEFITO_PROJECTS_FOLDER_KEY = 'fefito.projectsFolder';
export const FEFITO_AGENTS_KEY = 'fefito.agents';
export const FEFITO_ACTIVE_AGENT_KEY = 'fefito.activeAgent';
export const FEFITO_AGENT_PROFILE_KEY = 'fefito.agentProfileInstalled';
export const FEFITO_AGENT_PROFILE_VERSION_KEY = 'fefito.agentProfileVersion';
export const FEFITO_AGENT_PROFILE_VERSION = '4';

/**
 * Prefix of the central agent chat terminal name. Used both to create the
 * terminal and to detect an existing one on startup. The product language is
 * pt-BR, so a literal prefix is fine for now.
 */
export const FEFITO_CHAT_TERMINAL_PREFIX = 'Assistente';

/**
 * Identifier of an AI coding agent that Fefito can drive for the user.
 */
export type FefitoAgentId = 'claude' | 'codex';

export interface FefitoAgentInfo {
	id: FefitoAgentId;
	label: string;
	vendor: string;
	/** The command that launches the agent in a terminal. */
	binary: string;
}

export const FEFITO_AGENTS: FefitoAgentInfo[] = [
	{ id: 'claude', label: 'Claude', vendor: 'Anthropic', binary: 'claude' },
	{ id: 'codex', label: 'Codex (ChatGPT)', vendor: 'OpenAI', binary: 'codex' },
];

export function getFefitoAgent(id: FefitoAgentId): FefitoAgentInfo {
	const agent = FEFITO_AGENTS.find(a => a.id === id);
	if (!agent) {
		throw new Error(`Unknown fefito agent: ${id}`);
	}
	return agent;
}

export interface FefitoCommandSpec {
	/** Command used to detect whether the tool is already installed. Exits non-zero when missing. */
	detectCommand: string;
	/** Command that installs the tool when missing. */
	installCommand: string;
}

/**
 * Wraps a command with fefito markers so the wizard can follow its progress by
 * observing the terminal output stream. The end marker carries the exit status:
 * 0 for success, anything else for failure.
 */
export function wrapWithMarkers(id: string, command: string): string {
	if (isWindows) {
		return `${command}; Write-Output "FEFITO_END:${id}:$(if ($?) { 0 } else { 1 })"`;
	}
	return `{ ${command}; } 2>&1; echo "FEFITO_END:${id}:$?"`;
}

function psDetect(command: string): string {
	return `if (${command}) { } else { Write-Error "fefito: not installed" }`;
}

export function getAgentCommands(agent: FefitoAgentId): FefitoCommandSpec {
	switch (agent) {
		case 'claude':
			return {
				detectCommand: isWindows
					? psDetect('Get-Command claude -ErrorAction SilentlyContinue')
					: 'command -v claude >/dev/null && claude --version',
				installCommand: isWindows
					? 'irm https://claude.ai/install.ps1 | iex'
					: 'curl -fsSL https://claude.ai/install.sh | bash'
			};
		case 'codex':
			return {
				detectCommand: isWindows
					? psDetect('Get-Command codex -ErrorAction SilentlyContinue')
					: 'command -v codex >/dev/null && codex --version',
				installCommand: 'npm install -g @openai/codex'
			};
	}
}

export function getUvCommands(): FefitoCommandSpec {
	return {
		detectCommand: isWindows
			? psDetect('Test-Path "$HOME\\.local\\bin\\uv.exe"')
			: '[ -x "$HOME/.local/bin/uv" ] && "$HOME/.local/bin/uv" --version',
		installCommand: isWindows
			? 'irm https://astral.sh/uv/install.ps1 | iex'
			: 'curl -LsSf https://astral.sh/uv/install.sh | sh'
	};
}

export function getPythonInstallCommand(): string {
	// `uv` is invoked through its absolute location because the terminal session that
	// installed it may not have the updated PATH yet.
	return isWindows
		? '& "$env:USERPROFILE\\.local\\bin\\uv.exe" python install 3.12'
		: '"$HOME/.local/bin/uv" python install 3.12';
}

/**
 * Local directory where modern CLI tools (claude, uv) are installed on both
 * Windows and macOS. It is prepended to the integrated terminal PATH so that
 * terminals started by the app find the tools without a full restart.
 */
export const FEFITO_LOCAL_BIN_DIR = '.local/bin';
