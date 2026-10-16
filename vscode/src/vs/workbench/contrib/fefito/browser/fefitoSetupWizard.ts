/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/fefitoWizard.css';
import { localize } from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { isWindows } from '../../../../base/common/platform.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { Dimension, $, append, clearNode } from '../../../../base/browser/dom.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { FefitoSetupInput } from './fefitoSetupInput.js';
import { FefitoSetupTerminal } from './fefitoSetupTerminal.js';
import { installFefitoAgentProfile } from '../common/fefitoAgentProfile.js';
import {
	FEFITO_SETUP_COMPLETE_KEY,
	FEFITO_PROJECTS_FOLDER_KEY,
	FEFITO_AGENTS_KEY,
	FEFITO_ACTIVE_AGENT_KEY,
	FEFITO_AGENT_PROFILE_KEY,
	FEFITO_AGENT_PROFILE_VERSION_KEY,
	FEFITO_AGENT_PROFILE_VERSION,
	FefitoAgentId,
	FEFITO_AGENTS,
	getFefitoAgent,
	getAgentCommands,
	getUvCommands,
	getPythonInstallCommand,
	wrapWithMarkers
} from '../common/fefito.js';

type FefitoWizardStep = 'folder' | 'agent' | 'prepare' | 'login' | 'done';

const STEPS: { id: FefitoWizardStep; label: string }[] = [
	{ id: 'folder', label: localize('fefitoStepFolder', "Seus projetos") },
	{ id: 'agent', label: localize('fefitoStepAgent', "Sua IA") },
	{ id: 'prepare', label: localize('fefitoStepPrepare', "Preparar") },
	{ id: 'login', label: localize('fefitoStepLogin', "Entrar") },
	{ id: 'done', label: localize('fefitoStepDone', "Pronto") }
];

type PrepareTaskStatus = 'pending' | 'running' | 'ok' | 'error';

interface PrepareTask {
	id: string;
	label: string;
	/** Detects whether the task is already satisfied. Undefined means "always run". */
	detectCommand?: string;
	/** Command that performs the task. */
	runCommand: string;
	status: PrepareTaskStatus;
	detail?: string;
}

/**
 * The fefito first-run experience: a friendly, plain-language wizard that takes a
 * complete beginner from a fresh install to a working AI coding setup — folder,
 * agent CLI, uv + Python 3.12 and agent login — without touching code or settings.
 */
export class FefitoSetupWizard extends EditorPane {

	static readonly ID = 'workbench.editors.fefitoSetupWizard';

	private static readonly STEP_ORDER: FefitoWizardStep[] = ['folder', 'agent', 'prepare', 'login', 'done'];

	private _root: HTMLElement | undefined;
	private _step: FefitoWizardStep = 'folder';
	private _projectsFolder: URI | undefined;
	private _agents: Set<FefitoAgentId> = new Set(['claude']);
	private _requestedAgent: FefitoAgentId | undefined;
	private _prepareTasks: PrepareTask[] = [];
	private _prepareRunning = false;
	private _tasksListElement: HTMLElement | undefined;
	private _loginStarted = new Set<FefitoAgentId>();
	private _finishing = false;
	private _finishError: string | undefined;
	private readonly setupTerminal = this._register(this.instantiationService.createInstance(FefitoSetupTerminal));
	private readonly wizardDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IStorageService private readonly storageService: IStorageService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IFileService private readonly fileService: IFileService,
		@IPathService private readonly pathService: IPathService,
		@IEditorService private readonly editorService: IEditorService,
		@IHostService private readonly hostService: IHostService
	) {
		super(FefitoSetupWizard.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		// Keep the setup above the complete workbench, including the assistant and
		// Explorer. The editor input still owns its lifecycle and close action.
		const workbench = parent.ownerDocument.querySelector('.monaco-workbench') ?? parent.ownerDocument.body;
		this._root = workbench.appendChild($('.fefito-wizard'));
		this._root.hidden = true;
		this._register(toDisposable(() => this._root?.remove()));
		this._root.tabIndex = 0;
		this.render();
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (!(input instanceof FefitoSetupInput)) {
			return;
		}
		if (this._root) {
			this._root.hidden = false;
		}
		this._step = 'folder';
		this.render();
	}

	override clearInput(): void {
		super.clearInput();
		this.wizardDisposables.clear();
		if (this._root) {
			this._root.hidden = true;
		}
	}

	override layout(dimension: Dimension): void {
		// The wizard is CSS-driven and adapts to any size.
	}

	override focus(): void {
		this._root?.focus();
	}

	configureAgent(agentId: FefitoAgentId, currentFolder?: URI): void {
		this._requestedAgent = agentId;
		const selected = this.storageService.get(FEFITO_AGENTS_KEY, StorageScope.APPLICATION);
		if (selected) {
			try {
				this._agents = new Set((JSON.parse(selected) as FefitoAgentId[]).filter(id => id === 'claude' || id === 'codex'));
			} catch {
				this._agents = new Set();
			}
		}
		this._agents.add(agentId);
		const folder = this.storageService.get(FEFITO_PROJECTS_FOLDER_KEY, StorageScope.APPLICATION);
		if (folder || currentFolder) {
			this._projectsFolder = folder ? URI.parse(folder) : currentFolder;
			this.goTo('agent');
		} else {
			this.goTo('folder');
		}
	}

	private goTo(step: FefitoWizardStep): void {
		this._step = step;
		this.render();
	}

	private next(): void {
		const index = FefitoSetupWizard.STEP_ORDER.indexOf(this._step);
		const nextStep = FefitoSetupWizard.STEP_ORDER[index + 1] ?? 'done';
		if (nextStep === 'prepare') {
			this.buildPrepareTasks();
		}
		this.goTo(nextStep);
		if (nextStep === 'prepare') {
			this.runPrepareTasks();
		}
	}

	private back(): void {
		const index = FefitoSetupWizard.STEP_ORDER.indexOf(this._step);
		const previous = FefitoSetupWizard.STEP_ORDER[index - 1];
		if (previous) {
			this.goTo(previous);
		}
	}

	private render(): void {
		this.wizardDisposables.clear();
		const root = this._root;
		if (!root) {
			return;
		}
		clearNode(root);
		const container = append(root, $('.fefito-wizard-content'));
		const close = append(container, $('button.fefito-wizard-close', undefined, localize('fefitoCloseSetup', "Fechar"))) as HTMLButtonElement;
		close.type = 'button';
		close.onclick = () => {
			if (this.input) {
				void this.group.closeEditor(this.input);
			}
		};
		container.appendChild(this.renderStepper());
		switch (this._step) {
			case 'folder':
				this.renderFolder(container);
				break;
			case 'agent':
				this.renderAgent(container);
				break;
			case 'prepare':
				this.renderPrepare(container);
				break;
			case 'login':
				this.renderLogin(container);
				break;
			case 'done':
				this.renderDone(container);
				break;
		}
	}

	private renderStepper(): HTMLElement {
		const stepper = $('.fefito-stepper');
		const currentIndex = FefitoSetupWizard.STEP_ORDER.indexOf(this._step);
		for (let i = 0; i < STEPS.length; i++) {
			const step = STEPS[i];
			const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
			const item = $('.fefito-stepper-item.' + state, undefined,
				$('.fefito-stepper-dot', undefined),
				$('.fefito-stepper-label', undefined, step.label));
			stepper.appendChild(item);
		}
		return stepper;
	}

	private renderHeader(parent: HTMLElement, title: string, subtitle: string): void {
		append(parent, $('.fefito-title', undefined, title));
		append(parent, $('.fefito-subtitle', undefined, subtitle));
	}

	private renderNav(parent: HTMLElement, options: { primaryLabel?: string; primaryAction?: () => void; primaryDisabled?: boolean; primaryBig?: boolean; secondaryLabel?: string; secondaryAction?: () => void; showBack?: boolean }): void {
		const nav = append(parent, $('.fefito-nav'));
		if (options.showBack !== false) {
			const back = append(nav, $('.fefito-btn.secondary', undefined)) as HTMLButtonElement;
			back.type = 'button';
			back.textContent = localize('fefitoBack', "Voltar");
			back.onclick = () => this.back();
		}
		if (options.secondaryLabel && options.secondaryAction) {
			const secondary = append(nav, $('.fefito-btn.secondary', undefined)) as HTMLButtonElement;
			secondary.type = 'button';
			secondary.textContent = options.secondaryLabel;
			secondary.onclick = () => options.secondaryAction!();
		}
		if (options.primaryLabel) {
			const primary = append(nav, $('.fefito-btn.primary' + (options.primaryBig ? '.big' : ''), undefined)) as HTMLButtonElement;
			primary.type = 'button';
			primary.textContent = options.primaryLabel;
			primary.disabled = options.primaryDisabled ?? false;
			primary.onclick = () => options.primaryAction?.();
			if (!options.primaryDisabled) {
				primary.focus();
			}
		}
	}

	private renderFolder(parent: HTMLElement): void {
		const body = append(parent, $('.fefito-body'));
		this.renderHeader(body,
			localize('fefitoFolderTitle', "Onde ficam os seus projetos?"),
			localize('fefitoFolderSubtitle', "Escolha a pasta onde o Fefito vai guardar os seus programas. Pode ser uma pasta nova ou que já existe."));
		const chooser = append(body, $('.fefito-folder-picker'));
		if (this._projectsFolder) {
			append(chooser, $('.fefito-folder-path', undefined, this._projectsFolder.fsPath));
		}
		const pickFolder = async () => {
			const uris = await this.fileDialogService.showOpenDialog({
				canSelectFolders: true,
				canSelectFiles: false,
				canSelectMany: false,
				openLabel: localize('fefitoFolderOpenLabel', "Usar esta pasta"),
				title: localize('fefitoFolderDialogTitle', "Onde ficam os seus projetos?")
			});
			if (uris && uris.length > 0) {
				this._projectsFolder = uris[0];
				this.next();
			}
		};
		if (this._projectsFolder) {
			// Returning to this step: folder already picked, let the user confirm.
			this.renderNav(body, {
				primaryLabel: localize('fefitoFolderContinue', "Continuar"),
				primaryAction: () => this.next(),
				primaryBig: true,
				secondaryLabel: localize('fefitoFolderChange', "Trocar pasta"),
				secondaryAction: () => pickFolder(),
				showBack: false
			});
		} else {
			this.renderNav(body, {
				primaryLabel: localize('fefitoFolderChoose', "Escolher pasta"),
				primaryAction: () => pickFolder(),
				primaryBig: true,
				showBack: false
			});
		}
	}

	private renderAgent(parent: HTMLElement): void {
		const body = append(parent, $('.fefito-body'));
		this.renderHeader(body,
			localize('fefitoAgentTitle', "Qual Inteligência Artificial você quer usar?"),
			localize('fefitoAgentSubtitle', "Escolha com qual conta você vai conversar. Dá para escolher mais de uma."));
		const cards = append(body, $('.fefito-cards.selectable'));
		for (const agent of FEFITO_AGENTS) {
			const selected = this._agents.has(agent.id);
			const card = $('.fefito-card.choice' + (selected ? '.selected' : ''),
				undefined,
				$('.fefito-card-title', undefined, agent.label),
				$('.fefito-card-text', undefined, agent.vendor)) as HTMLElement;
			card.onclick = () => {
				if (this._agents.has(agent.id)) {
					if (this._agents.size > 1) {
						this._agents.delete(agent.id);
					}
				} else {
					this._agents.add(agent.id);
				}
				this.goTo('agent');
			};
			cards.appendChild(card);
		}
		this.renderNav(body, {
			primaryLabel: localize('fefitoAgentContinue', "Continuar"),
			primaryAction: () => this.next(),
			showBack: true
		});
	}

	private buildPrepareTasks(): void {
		this._prepareTasks = [];
		if (this._agents.has('codex')) {
			this._prepareTasks.push({
				id: 'node',
				label: localize('fefitoTaskNode', "Verificar o Node.js (necessário para o Codex)"),
				detectCommand: 'node --version',
				runCommand: 'npm --version',
				status: 'pending'
			});
		}
		for (const agentId of this._agents) {
			const agent = getFefitoAgent(agentId);
			const spec = getAgentCommands(agentId);
			this._prepareTasks.push({
				id: `agent-${agentId}`,
				label: localize('fefitoTaskAgent', "Instalar o {0}", agent.label),
				detectCommand: spec.detectCommand,
				runCommand: spec.installCommand,
				status: 'pending'
			});
		}
		this._prepareTasks.push({
			id: 'uv',
			label: localize('fefitoTaskUv', "Instalar o gerenciador Python (uv)"),
			detectCommand: getUvCommands().detectCommand,
			runCommand: getUvCommands().installCommand,
			status: 'pending'
		});
		this._prepareTasks.push({
			id: 'python',
			label: localize('fefitoTaskPython', "Instalar o Python 3.12"),
			runCommand: getPythonInstallCommand(),
			status: 'pending'
		});
	}

	private async runPrepareTasks(): Promise<void> {
		if (this._prepareRunning) {
			return;
		}
		this._prepareRunning = true;
		try {
			for (const task of this._prepareTasks) {
				if (task.status === 'ok') {
					continue;
				}
				task.status = 'running';
				task.detail = undefined;
				this.renderPrepareTasksList();

				if (task.detectCommand) {
					const detect = await this.setupTerminal.run(`${task.id}-detect`, wrapWithMarkers(`${task.id}-detect`, task.detectCommand));
					if (detect.exitCode === 0) {
						task.status = 'ok';
						task.detail = localize('fefitoTaskAlreadyInstalled', "já está instalado");
						this.renderPrepareTasksList();
						continue;
					}
				}

				const install = await this.setupTerminal.run(task.id, wrapWithMarkers(task.id, task.runCommand));
				if (install.exitCode !== 0) {
					task.status = 'error';
					task.detail = install.exitCode === undefined
						? localize('fefitoTaskTerminalClosed', "o terminal foi fechado antes de terminar")
						: localize('fefitoTaskFailed', "não deu para concluir");
					this.renderPrepareTasksList();
					return;
				}
				task.status = 'ok';
				this.renderPrepareTasksList();
			}
		} finally {
			this._prepareRunning = false;
		}
	}

	private renderPrepare(parent: HTMLElement): void {
		const body = append(parent, $('.fefito-body'));
		this.renderHeader(body,
			localize('fefitoPrepareTitle', "Preparando o seu computador…"),
			localize('fefitoPrepareSubtitle', "Estamos instalando o que falta. Acompanhe no terminal aqui embaixo — você não precisa fazer nada."));
		const list = append(body, $('.fefito-tasks'));
		this._tasksListElement = list;
		this.renderPrepareTasksList();
		const hasError = this._prepareTasks.some(t => t.status === 'error');
		if (hasError) {
			this.renderNav(body, {
				primaryLabel: localize('fefitoPrepareRetry', "Tentar de novo"),
				primaryAction: () => {
					for (const task of this._prepareTasks) {
						if (task.status === 'error') {
							task.status = 'pending';
						}
					}
					this.goTo('prepare');
					this.runPrepareTasks();
				}
			});
		} else {
			this.renderNav(body, {
				primaryLabel: localize('fefitoPrepareContinue', "Continuar"),
				primaryAction: () => this.next(),
				primaryDisabled: this._prepareRunning || this._prepareTasks.some(t => t.status !== 'ok')
			});
		}
	}

	private renderPrepareTasksList(): void {
		const list = this._tasksListElement;
		if (!list) {
			return;
		}
		clearNode(list);
		for (const task of this._prepareTasks) {
			const iconClass = task.status === 'ok' ? Codicon.passFilled.id
				: task.status === 'error' ? Codicon.error.id
					: task.status === 'running' ? Codicon.loading.id
						: Codicon.circle.id;
			list.appendChild($('.fefito-task.' + task.status, undefined,
				$('.codicon.' + iconClass),
				$('.fefito-task-label', undefined, task.label + (task.detail ? ` — ${task.detail}` : ''))));
		}
	}

	private agentLaunchCommand(agentId: FefitoAgentId): string {
		// On Windows the freshly installed binary is not on the PATH of running
		// terminals yet, so launch it through its absolute location.
		if (isWindows) {
			return agentId === 'claude'
				? '& "$HOME\\.local\\bin\\claude.exe"'
				: 'codex';
		}
		return getFefitoAgent(agentId).binary;
	}

	private renderLogin(parent: HTMLElement): void {
		const body = append(parent, $('.fefito-body'));
		const pending = [...this._agents].filter(id => !this._loginStarted.has(id));
		const nextAgent = pending.length > 0 ? getFefitoAgent(pending[0]) : undefined;
		this.renderHeader(body,
			localize('fefitoLoginTitle', "Entrar na sua conta"),
			nextAgent
				? localize('fefitoLoginSubtitleAgent', "Vamos abrir o {0} no painel aqui embaixo. Entre com a sua conta por lá; quando terminar, volte aqui e clique em continuar.", nextAgent.label)
				: localize('fefitoLoginSubtitleDone', "Se você entrou com a sua conta por baixo, está tudo pronto para continuar."));

		// Funnel: one clear action at a time — log in with each chosen agent,
		// then continue. Going forward is only offered after the login
		// terminals have been opened and used.
		if (nextAgent) {
			const agent = nextAgent;
			this.renderNav(body, {
				primaryLabel: localize('fefitoLoginOpen', "Entrar com {0}", agent.label),
				primaryBig: true,
				primaryAction: async () => {
					// The login terminal opens in the bottom panel so this wizard
					// stays front and center; focus returns here afterwards.
					await this.setupTerminal.openInteractiveTerminal(
						agent.label,
						this.agentLaunchCommand(agent.id),
						this._projectsFolder?.fsPath,
						TerminalLocation.Panel
					);
					this._loginStarted.add(agent.id);
					this.goTo('login');
					await this.editorService.openEditor({
						resource: FefitoSetupInput.RESOURCE,
						options: { preserveFocus: false, pinned: false }
					});
				}
			});
		} else {
			this.renderNav(body, {
				primaryLabel: localize('fefitoLoginDone', "Continuar"),
				primaryBig: true,
				primaryAction: () => this.next()
			});
		}
	}

	private renderDone(parent: HTMLElement): void {
		const body = append(parent, $('.fefito-body'));
		this.renderHeader(body,
			localize('fefitoDoneTitle', "Tudo pronto!"),
			localize('fefitoDoneSubtitle', "O seu Fefito está configurado. Vamos abrir a sua pasta de projetos e colocar a IA para conversar com você."));
		const summary = append(body, $('.fefito-summary'));
		if (this._projectsFolder) {
			summary.appendChild($('.fefito-summary-item', undefined,
				$('.codicon.' + Codicon.folder.id),
				$('.fefito-task-label', undefined, this._projectsFolder.fsPath)));
		}
		for (const agentId of this._agents) {
			summary.appendChild($('.fefito-summary-item', undefined,
				$('.codicon.' + Codicon.passFilled.id),
				$('.fefito-task-label', undefined, getFefitoAgent(agentId).label)));
		}
		summary.appendChild($('.fefito-summary-item', undefined,
			$('.codicon.' + Codicon.passFilled.id),
			$('.fefito-task-label', undefined, localize('fefitoDonePython', "Python 3.12"))));
		summary.appendChild($('.fefito-summary-item', undefined,
			$('.codicon.' + Codicon.passFilled.id),
			$('.fefito-task-label', undefined, localize('fefitoDoneMemory', "Memória e orientações para Claude e Codex"))));
		if (this._finishError) {
			append(body, $('.fefito-task-label', undefined, this._finishError));
		}
		this.renderNav(body, {
			primaryLabel: this._finishing ? localize('fefitoDoneSaving', "Salvando...") : localize('fefitoDoneStart', "Começar a usar"),
			primaryAction: () => this.finish(),
			showBack: false
		});
	}

	private async finish(): Promise<void> {
		if (this._finishing) {
			return;
		}
		this._finishing = true;
		this._finishError = undefined;
		this.render();
		try {
			await installFefitoAgentProfile(this.fileService, await this.pathService.userHome());
			this.storageService.store(FEFITO_AGENT_PROFILE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
			this.storageService.store(FEFITO_AGENT_PROFILE_VERSION_KEY, FEFITO_AGENT_PROFILE_VERSION, StorageScope.APPLICATION, StorageTarget.USER);
		} catch (error) {
			this._finishError = localize('fefitoMemoryError', "Não foi possível preparar a memória da IA: {0}", error instanceof Error ? error.message : String(error));
			this._finishing = false;
			this.render();
			return;
		}
		this.storageService.store(FEFITO_SETUP_COMPLETE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
		if (this._projectsFolder) {
			this.storageService.store(FEFITO_PROJECTS_FOLDER_KEY, this._projectsFolder.toString(), StorageScope.APPLICATION, StorageTarget.USER);
		}
		this.storageService.store(FEFITO_AGENTS_KEY, JSON.stringify([...this._agents]), StorageScope.APPLICATION, StorageTarget.USER);
		const active = this.storageService.get(FEFITO_ACTIVE_AGENT_KEY, StorageScope.APPLICATION);
		if (this._requestedAgent || !active || !this._agents.has(active as FefitoAgentId)) {
			this.storageService.store(FEFITO_ACTIVE_AGENT_KEY, this._requestedAgent ?? [...this._agents][0], StorageScope.APPLICATION, StorageTarget.USER);
		}
		if (this._projectsFolder) {
			this.hostService.openWindow([{ folderUri: this._projectsFolder }], { forceReuseWindow: true });
		}
	}
}
