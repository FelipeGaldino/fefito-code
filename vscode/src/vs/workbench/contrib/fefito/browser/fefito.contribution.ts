/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { isWindows } from '../../../../base/common/platform.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { EditorExtensions, IEditorFactoryRegistry, IEditorSerializer } from '../../../common/editor.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { registerWorkbenchContribution2, WorkbenchPhase, IWorkbenchContribution } from '../../../common/contributions.js';
import { ILifecycleService, LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../../common/views.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry, IConfigurationDefaults } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ConfigurationTarget, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IOnboardingService } from '../../welcomeOnboarding/common/onboardingService.js';
import { FefitoSetupInput, FefitoSetupInputScheme } from './fefitoSetupInput.js';
import { FefitoSetupWizard } from './fefitoSetupWizard.js';
import { installFefitoAgentProfile } from '../common/fefitoAgentProfile.js';
import {
	FEFITO_SETUP_COMPLETE_KEY,
	FEFITO_PROJECTS_FOLDER_KEY,
	FEFITO_AGENTS_KEY,
	FEFITO_ACTIVE_AGENT_KEY,
	FEFITO_AGENT_PROFILE_KEY,
	FEFITO_AGENT_PROFILE_VERSION_KEY,
	FEFITO_AGENT_PROFILE_VERSION,
	FEFITO_CHAT_TERMINAL_PREFIX,
	FefitoAgentId,
	getFefitoAgent
} from '../common/fefito.js';

//#region Fefito product defaults

/**
 * The upstream Copilot onboarding is not shipped (see workbench.common.main.ts),
 * so satisfy its service contract with an inert implementation: the fefito setup
 * wizard is the product's onboarding.
 */
class DisabledOnboardingService implements IOnboardingService {

	readonly _serviceBrand: undefined;

	readonly onDidDismiss: Event<void> = Event.None;

	show(): void {
		// no-op
	}
}

registerSingleton(IOnboardingService, DisabledOnboardingService, InstantiationType.Delayed);

/**
 * Product decisions baked in as configuration defaults (the user can still change
 * them in Settings). Registered defaults win over the built-in ones, keeping all
 * fefito choices in one place and upstream files untouched:
 *
 * - `workbench.startupEditor: none` — the upstream Welcome page (GitHub sign-in
 *   cards, walkthroughs) must never compete with the fefito wizard or the chat.
 * - `security.workspace.trust.enabled: false` — "Do you trust the authors?" is
 *   meaningless for beginners opening their own folder.
 * - `update.showReleaseNotes: false` — release notes are for developers.
 * - `files.autoSave: afterDelay` — beginners never think about saving, and the
 *   agent reads files from disk.
 */
const fefitoConfigurationDefaults: IConfigurationDefaults[] = [
	{
		overrides: {
			'workbench.startupEditor': 'none',
			'security.workspace.trust.enabled': false,
			'update.showReleaseNotes': false,
			'files.autoSave': 'afterDelay',
			'workbench.statusBar.visible': false,
			'window.menuBarVisibility': 'hidden',
			'window.commandCenter': false,
			'workbench.layoutControl.enabled': false,
			'chat.titleBar.openInAgentsWindow.enabled': false,
			'workbench.colorTheme': 'Dracula Theme',
			'workbench.iconTheme': 'material-icon-theme'
		}
	}
];

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerDefaultConfigurations(fefitoConfigurationDefaults);

//#endregion

//#region Editor registration

class FefitoSetupInputSerializer implements IEditorSerializer {

	public canSerialize(): boolean {
		return true;
	}

	public serialize(): string {
		return '{}';
	}

	public deserialize(): FefitoSetupInput {
		return new FefitoSetupInput();
	}
}

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(FefitoSetupInput.ID, FefitoSetupInputSerializer);

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		FefitoSetupWizard,
		FefitoSetupWizard.ID,
		localize('fefitoSetupWizard', "Configurar o Fefito")
	),
	[
		new SyncDescriptor(FefitoSetupInput)
	]
);

export class FefitoSetupEditorResolverContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fefitoSetupEditorResolver';

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IEditorResolverService editorResolverService: IEditorResolverService
	) {
		super();

		this._register(editorResolverService.registerEditor(
			`${FefitoSetupInputScheme}:/**`,
			{
				id: FefitoSetupInput.ID,
				label: localize('fefitoSetupDisplayName', "Configurar o Fefito"),
				priority: RegisteredEditorPriority.builtin,
			},
			{
				singlePerResource: true,
				canSupportResource: uri => uri.scheme === FefitoSetupInputScheme,
			},
			{
				createEditorInput: ({ options }) => {
					return {
						editor: instantiationService.createInstance(FefitoSetupInput),
						options: {
							...options,
							pinned: false
						}
					};
				}
			}
		));
	}
}

registerWorkbenchContribution2(FefitoSetupEditorResolverContribution.ID, FefitoSetupEditorResolverContribution, WorkbenchPhase.BlockRestore);

//#endregion

//#region Agent chat launch

/**
 * Reads the agents the user picked during setup, defaulting to Claude.
 */
export function readChosenAgents(storageService: IStorageService): FefitoAgentId[] {
	try {
		const raw = storageService.get(FEFITO_AGENTS_KEY, StorageScope.APPLICATION);
		const agents = raw ? JSON.parse(raw) as FefitoAgentId[] : undefined;
		if (agents && agents.length > 0) {
			return agents;
		}
	} catch {
		// fall through to default
	}
	return ['claude'];
}

function readActiveAgent(storageService: IStorageService): FefitoAgentId {
	const active = storageService.get(FEFITO_ACTIVE_AGENT_KEY, StorageScope.APPLICATION);
	return active === 'claude' || active === 'codex' ? active : readChosenAgents(storageService)[0];
}

/**
 * The central fefito surface: the chosen agent CLI running big, in the editor
 * area, where a beginner expects the conversation to live.
 */
async function openAgentChat(accessor: ServicesAccessor): Promise<void> {
	const storageService = accessor.get(IStorageService);
	const terminalService = accessor.get(ITerminalService);
	const contextService = accessor.get(IWorkspaceContextService);

	const agentId = readActiveAgent(storageService);
	const agent = getFefitoAgent(agentId);
	const cwd = contextService.getWorkspace().folders[0]?.uri.fsPath;

	// On Windows a freshly installed agent is not yet on the PATH of running
	// terminals, so it is launched through its absolute location.
	const launchCommand = isWindows && agentId === 'claude'
		? '& "$HOME\\.local\\bin\\claude.exe"'
		: agent.binary;

	const terminal = await terminalService.createTerminal({
		config: {
			name: `${FEFITO_CHAT_TERMINAL_PREFIX} ${agent.label}`,
			isFeatureTerminal: true,
			icon: ThemeIcon.fromId(Codicon.commentDiscussion.id),
			cwd,
			initialText: localize('fefitoChatTerminalHint', "Conversa com o {0}. Escreva em português o que você quer criar.\r\n", agent.label)
		},
		location: TerminalLocation.Editor
	});
	await terminal.processReady;
	await terminal.sendText(launchCommand, true);
}

function findAgentChatTerminal(terminalService: ITerminalService, agentId: FefitoAgentId) {
	return terminalService.instances.find(t => t.title.startsWith(FEFITO_CHAT_TERMINAL_PREFIX) && t.title.includes(getFefitoAgent(agentId).label));
}

//#endregion

//#region Commands

registerAction2(class OpenFefitoSetupWizardAction extends Action2 {
	constructor() {
		super({
			id: 'fefito.openSetupWizard',
			title: localize2('fefitoOpenSetup', "Fefito: Configurar (assistente de primeira vez)"),
			category: Categories.Help,
			f1: true,
			icon: Codicon.sparkle
		});
	}

	async run(accessor: ServicesAccessor, targetAgent?: FefitoAgentId): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const editor = await editorService.openEditor({
			resource: FefitoSetupInput.RESOURCE,
			options: { pinned: false }
		});
		if (targetAgent && editor instanceof FefitoSetupWizard) {
			editor.configureAgent(targetAgent, accessor.get(IWorkspaceContextService).getWorkspace().folders[0]?.uri);
		}
	}
});

registerAction2(class OpenFefitoAgentChatAction extends Action2 {
	constructor() {
		super({
			id: 'fefito.openAgentChat',
			title: localize2('fefitoOpenAgentChat', "Fefito: Conversar com a IA"),
			category: Categories.Help,
			f1: true,
			icon: Codicon.commentDiscussion
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		return openAgentChat(accessor);
	}
});

async function switchAgent(accessor: ServicesAccessor, agentId: FefitoAgentId): Promise<void> {
	const storage = accessor.get(IStorageService);
	if (!readChosenAgents(storage).includes(agentId)) {
		await accessor.get(ICommandService).executeCommand('fefito.openSetupWizard', agentId);
		return;
	}
	storage.store(FEFITO_ACTIVE_AGENT_KEY, agentId, StorageScope.APPLICATION, StorageTarget.USER);
	const terminalService = accessor.get(ITerminalService);
	const terminal = findAgentChatTerminal(terminalService, agentId);
	if (terminal) {
		await terminalService.revealTerminal(terminal);
		return;
	}
	await openAgentChat(accessor);
}

function registerAgentSwitch(id: FefitoAgentId, title: ReturnType<typeof localize2>): void {
	registerAction2(class extends Action2 {
		constructor() {
			super({ id: `fefito.use.${id}`, title, category: Categories.Help, f1: true });
		}
		run(accessor: ServicesAccessor): Promise<void> { return switchAgent(accessor, id); }
	});
}

registerAgentSwitch('claude', localize2('fefitoUseClaude', "Fefito: Usar Claude Code"));
registerAgentSwitch('codex', localize2('fefitoUseCodex', "Fefito: Usar Codex"));

function registerAgentLogin(id: FefitoAgentId, title: ReturnType<typeof localize2>): void {
	registerAction2(class extends Action2 {
		constructor() {
			super({ id: `fefito.login.${id}`, title, category: Categories.Help, f1: true });
		}
		async run(accessor: ServicesAccessor): Promise<void> {
			if (!readChosenAgents(accessor.get(IStorageService)).includes(id)) {
				await accessor.get(ICommandService).executeCommand('fefito.openSetupWizard', id);
				return;
			}
			if (id === 'codex') {
				const terminal = await accessor.get(ITerminalService).createTerminal({ config: { name: 'Entrar no Codex' }, location: TerminalLocation.Editor });
				await terminal.processReady;
				await terminal.sendText('codex login', true);
				return;
			}
			await switchAgent(accessor, id);
			const terminalService = accessor.get(ITerminalService);
			const terminal = findAgentChatTerminal(terminalService, id);
			if (terminal) {
				await terminalService.revealTerminal(terminal);
				await terminal.sendText('/login', true);
			}
		}
	});
}

registerAgentLogin('claude', localize2('fefitoLoginClaude', "Fefito: Entrar no Claude Code"));
registerAgentLogin('codex', localize2('fefitoLoginCodex', "Fefito: Entrar no Codex"));

registerAction2(class ChooseFefitoProjectsFolderAction extends Action2 {
	constructor() {
		super({ id: 'fefito.chooseProjectsFolder', title: localize2('fefitoChooseProjectsFolder', "Fefito: Trocar pasta de projetos"), category: Categories.Help, f1: true });
	}
	async run(accessor: ServicesAccessor, folderPath?: string): Promise<void> {
		const fileService = accessor.get(IFileService);
		const fileDialogService = accessor.get(IFileDialogService);
		const storageService = accessor.get(IStorageService);
		const hostService = accessor.get(IHostService);
		const folders = folderPath ? [URI.file(folderPath)] : await fileDialogService.showOpenDialog({
			canSelectFolders: true, canSelectFiles: false, canSelectMany: false,
			openLabel: localize('fefitoUseFolder', "Usar esta pasta"),
			title: localize('fefitoSelectProjectsFolder', "Escolha a pasta dos seus projetos")
		});
		const folder = folders?.[0];
		if (!folder) { return; }
		if (!(await fileService.exists(folder)) || !(await fileService.resolve(folder)).isDirectory) {
			throw new Error(localize('fefitoFolderNotFound', "A pasta escolhida não existe."));
		}
		storageService.store(FEFITO_PROJECTS_FOLDER_KEY, folder.toString(), StorageScope.APPLICATION, StorageTarget.USER);
		await hostService.openWindow([{ folderUri: folder }], { forceReuseWindow: true });
	}
});

registerAction2(class SetFefitoThemeAction extends Action2 {
	constructor() {
		super({ id: 'fefito.setTheme', title: localize2('fefitoSetTheme', "Fefito: Mudar tema"), category: Categories.Help, f1: true });
	}
	run(accessor: ServicesAccessor, theme: string): Promise<void> {
		const name = theme === 'claro' ? 'Light Modern' : theme === 'escuro' ? 'Dracula Theme' : theme;
		return accessor.get(IConfigurationService).updateValue('workbench.colorTheme', name, ConfigurationTarget.USER);
	}
});

registerAction2(class SetFefitoIconsAction extends Action2 {
	constructor() {
		super({ id: 'fefito.setIcons', title: localize2('fefitoSetIcons', "Fefito: Mudar ícones"), category: Categories.Help, f1: true });
	}
	run(accessor: ServicesAccessor, icons: string): Promise<void> {
		const name = icons === 'material' ? 'material-icon-theme' : icons === 'padrao' ? 'vs-minimal' : icons;
		return accessor.get(IConfigurationService).updateValue('workbench.iconTheme', name, ConfigurationTarget.USER);
	}
});

registerAction2(class ShowFefitoAccountUsageAction extends Action2 {
	constructor() {
		super({ id: 'fefito.showAccountUsage', title: localize2('fefitoShowAccountUsage', "Fefito: Ver uso e limites da IA"), category: Categories.Help, f1: true });
	}
	async run(accessor: ServicesAccessor, selectedAgent?: FefitoAgentId): Promise<void> {
		const terminalService = accessor.get(ITerminalService);
		const agent = selectedAgent ?? readActiveAgent(accessor.get(IStorageService));
		let terminal = findAgentChatTerminal(terminalService, agent);
		if (!terminal) {
			await switchAgent(accessor, agent);
			terminal = findAgentChatTerminal(terminalService, agent);
		}
		if (terminal) {
			await terminalService.revealTerminal(terminal);
			await terminal.sendText(agent === 'claude' ? '/usage' : '/status', true);
		}
	}
});

registerAction2(class ShowFefitoAccountDetailsAction extends Action2 {
	constructor() {
		super({ id: 'fefito.showAccountDetails', title: localize2('fefitoShowAccountDetails', "Fefito: Ver detalhes da conta"), category: Categories.Help, f1: true });
	}
	async run(accessor: ServicesAccessor, selectedAgent?: FefitoAgentId): Promise<void> {
		const terminalService = accessor.get(ITerminalService);
		const agent = selectedAgent ?? readActiveAgent(accessor.get(IStorageService));
		let terminal = findAgentChatTerminal(terminalService, agent);
		if (!terminal) {
			await switchAgent(accessor, agent);
			terminal = findAgentChatTerminal(terminalService, agent);
		}
		if (terminal) {
			await terminalService.revealTerminal(terminal);
			await terminal.sendText('/status', true);
		}
	}
});

registerAction2(class ShowFefitoSessionCostAction extends Action2 {
	constructor() {
		super({ id: 'fefito.showSessionCost', title: localize2('fefitoShowSessionCost', "Fefito: Ver custo da conversa Claude (API)"), category: Categories.Help, f1: true });
	}
	async run(accessor: ServicesAccessor, selectedAgent?: FefitoAgentId): Promise<void> {
		const terminalService = accessor.get(ITerminalService);
		const agent = selectedAgent ?? readActiveAgent(accessor.get(IStorageService));
		let terminal = findAgentChatTerminal(terminalService, agent);
		if (!terminal) {
			await switchAgent(accessor, agent);
			terminal = findAgentChatTerminal(terminalService, agent);
		}
		if (terminal) {
			await terminalService.revealTerminal(terminal);
			await terminal.sendText('/cost', true);
		}
	}
});

registerAction2(class ChangeFefitoAccountAction extends Action2 {
	constructor() {
		super({ id: 'fefito.changeAccount', title: localize2('fefitoChangeAccount', "Fefito: Entrar com outra conta"), category: Categories.Help, f1: true });
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const agent = readActiveAgent(accessor.get(IStorageService));
		if (agent === 'claude') {
			const terminalService = accessor.get(ITerminalService);
			let terminal = terminalService.instances.find(t => t.title.startsWith(FEFITO_CHAT_TERMINAL_PREFIX));
			if (!terminal) {
				await openAgentChat(accessor);
				terminal = terminalService.instances.find(t => t.title.startsWith(FEFITO_CHAT_TERMINAL_PREFIX));
			}
			if (terminal) {
				await terminalService.revealTerminal(terminal);
				await terminal.sendText('/login', true);
			}
			return;
		}
		const terminalService = accessor.get(ITerminalService);
		for (const chat of terminalService.instances.filter(t => t.title.startsWith(FEFITO_CHAT_TERMINAL_PREFIX))) {
			chat.dispose();
		}
		const terminal = await terminalService.createTerminal({ config: { name: `${FEFITO_CHAT_TERMINAL_PREFIX} Codex` }, location: TerminalLocation.Editor });
		await terminal.processReady;
		await terminal.sendText(isWindows ? 'codex logout; codex login; codex' : 'codex logout && codex login && codex', true);
	}
});

//#endregion

//#region Contributions

/**
 * Owns the fefito entry experience on every window start:
 * - never configured → open the setup wizard
 * - configured → land the user straight in their workspace with the AI chat ready
 */
export class FefitoSetupRunnerContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.fefitoSetupRunner';

	constructor(
		@ICommandService private readonly commandService: ICommandService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@ITerminalService private readonly terminalService: ITerminalService,
		@IHostService private readonly hostService: IHostService,
		@ILifecycleService lifecycleService: ILifecycleService,
		@IStorageService private readonly storageService: IStorageService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IPaneCompositePartService private readonly paneCompositePartService: IPaneCompositePartService,
		@IFileService private readonly fileService: IFileService,
		@IPathService private readonly pathService: IPathService,
		@INotificationService private readonly notificationService: INotificationService,
		@IExtensionService private readonly extensionService: IExtensionService
	) {
		super();

		this.run(lifecycleService);
	}

	private async run(lifecycleService: ILifecycleService): Promise<void> {
		await lifecycleService.when(LifecyclePhase.Restored);

		// The fefito layout has exactly two surfaces: folders on the left, AI
		// chat in the center. Anything else (secondary side bar with the
		// built-in chat, etc.) must never be visible.
		this.layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
		this.layoutService.setPartHidden(true, Parts.STATUSBAR_PART);
		await this.extensionService.whenInstalledExtensionsRegistered();
		const sidebarConfigured = this.configureSimpleSidebar();
		if (sidebarConfigured && this.storageService.getBoolean(FEFITO_SETUP_COMPLETE_KEY, StorageScope.APPLICATION)) {
			// The activity bar reads its pinned items while the window is built.
			// Reload once so an existing setup sees the simpler bar immediately.
			await this.hostService.reload();
			return;
		}

		if (this.storageService.getBoolean(FEFITO_SETUP_COMPLETE_KEY, StorageScope.APPLICATION)) {
			if (this.storageService.get(FEFITO_AGENT_PROFILE_VERSION_KEY, StorageScope.APPLICATION) !== FEFITO_AGENT_PROFILE_VERSION) {
				try {
					await installFefitoAgentProfile(this.fileService, await this.pathService.userHome());
					this.storageService.store(FEFITO_AGENT_PROFILE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
					this.storageService.store(FEFITO_AGENT_PROFILE_VERSION_KEY, FEFITO_AGENT_PROFILE_VERSION, StorageScope.APPLICATION, StorageTarget.USER);
				} catch (error) {
					this.notificationService.error(localize('fefitoProfileMigrationError', "Não foi possível preparar a memória da IA: {0}", error instanceof Error ? error.message : String(error)));
				}
			}
			await this.startChatControl();
			await this.openWorkspaceAndChat();
			return;
		}

		if (this.contextService.getWorkspace().folders.length > 0) {
			return;
		}

		if (this.editorService.editors.some(e => e.typeId === FefitoSetupInput.ID)) {
			return;
		}

		await this.editorService.openEditor({
			resource: FefitoSetupInput.RESOURCE,
			options: { pinned: false }
		});
	}

	private async startChatControl(): Promise<void> {
		const root = joinPath(await this.pathService.userHome(), '.fefito');
		const commandFile = joinPath(root, 'command.json');
		const responseFile = joinPath(root, 'response.json');
		let lastId: string | undefined;
		let checking = false;
		try {
			const initial = JSON.parse((await this.fileService.readFile(commandFile)).value.toString()) as { id?: string };
			lastId = initial.id;
		} catch {
			// No request has been sent yet.
		}
		const respond = async (id: string, error?: string): Promise<void> => {
			const data = VSBuffer.fromString(JSON.stringify({ id, error }));
			if (await this.fileService.exists(responseFile)) {
				await this.fileService.writeFile(responseFile, data);
			} else {
				await this.fileService.createFile(responseFile, data);
			}
		};
		const check = async (): Promise<void> => {
			if (checking) { return; }
			checking = true;
			try {
				const request = JSON.parse((await this.fileService.readFile(commandFile)).value.toString()) as { id?: string; action?: string; value?: string };
				if (!request.id || request.id === lastId) { return; }
				lastId = request.id;
				const command = request.action === 'tema' ? 'fefito.setTheme'
					: request.action === 'icones' ? 'fefito.setIcons'
						: request.action === 'pasta' ? 'fefito.chooseProjectsFolder'
							: request.action === 'agente' && (request.value === 'claude' || request.value === 'codex') ? `fefito.use.${request.value}`
								: request.action === 'conta' ? 'fefito.changeAccount'
									: request.action === 'uso' ? 'fefito.showAccountUsage' : undefined;
				if (!command || (['tema', 'icones', 'pasta'].includes(request.action ?? '') && typeof request.value !== 'string')) {
				await respond(request.id, 'Pedido de personalização inválido.');
				return;
			}
				await respond(request.id);
				try {
					await this.commandService.executeCommand(command, request.value);
				} catch (error) {
					await respond(request.id, error instanceof Error ? error.message : String(error));
				}
			} catch {
				// The command file may not exist or may be mid-write.
			} finally {
				checking = false;
			}
		};
		const timer = mainWindow.setInterval(() => { void check(); }, 750);
		this._register(toDisposable(() => mainWindow.clearInterval(timer)));
	}

	private configureSimpleSidebar(): boolean {
		const key = 'fefito.simpleSidebarV2Configured';
		if (this.storageService.getBoolean(key, StorageScope.PROFILE)) {
			return false;
		}

		const explorer = this.viewDescriptorService.getViewContainerById('workbench.view.explorer');
		const sidebarContainers = this.paneCompositePartService.getPaneComposites(ViewContainerLocation.Sidebar);
		if (!explorer || !sidebarContainers.some(container => container.id === 'workbench.view.search')) {
			return false;
		}
		const model = this.viewDescriptorService.getViewContainerModel(explorer);
		model.setVisible('outline', false);
		model.setVisible('timeline', false);

		const pinned = sidebarContainers.map((container, order) => ({
			id: container.id,
			pinned: container.id === 'workbench.view.explorer' || container.id === 'workbench.view.search',
			visible: true,
			order
		}));
		this.storageService.store('workbench.activity.pinnedViewlets2', JSON.stringify(pinned), StorageScope.PROFILE, StorageTarget.USER);
		this.storageService.store(key, true, StorageScope.PROFILE, StorageTarget.USER);
		return true;
	}

	/**
	 * Returning users go straight to work: their folders/scripts on the left and
	 * the AI conversation front and center — nothing in between.
	 */
	private async openWorkspaceAndChat(): Promise<void> {
		if (this.contextService.getWorkspace().folders.length === 0) {
			const projectsFolder = this.storageService.get(FEFITO_PROJECTS_FOLDER_KEY, StorageScope.APPLICATION);
			if (projectsFolder) {
				// The window reloads with the folder; this contribution runs again
				// and lands in the branch below.
				await this.hostService.openWindow([{ folderUri: URI.parse(projectsFolder) }], { forceReuseWindow: true });
			}
			return;
		}

		this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
		this.layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
		this.layoutService.setPartHidden(true, Parts.STATUSBAR_PART);

		// Only spawn a chat terminal when none exists yet, so restarts do not
		// pile up terminals.
		const hasChat = !!findAgentChatTerminal(this.terminalService, readActiveAgent(this.storageService));
		if (!hasChat) {
			await this.commandService.executeCommand('fefito.openAgentChat');
		}
	}
}

registerWorkbenchContribution2(FefitoSetupRunnerContribution.ID, FefitoSetupRunnerContribution, WorkbenchPhase.AfterRestored);

//#endregion
