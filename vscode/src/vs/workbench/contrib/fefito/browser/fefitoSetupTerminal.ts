/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { removeAnsiEscapeCodes } from '../../../../base/common/strings.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import { ITerminalGroupService, ITerminalInstance, ITerminalService } from '../../terminal/browser/terminal.js';

export interface FefitoRunResult {
	/** The id passed to `run`. */
	id: string;
	/** The captured, ANSI-stripped output of the command. */
	output: string;
	/** 0 on success, non-zero on failure, undefined when the terminal died before finishing. */
	exitCode: number | undefined;
}

/**
 * Runs setup commands in a dedicated, user-visible terminal ("Fefito") and reports
 * their outcome by watching the output stream for fefito markers.
 *
 * Keeping installs visible in a real terminal (instead of a hidden process) is a
 * product decision: the beginner sees exactly what happens on their machine and
 * can always intervene.
 */
export class FefitoSetupTerminal extends Disposable {

	private static readonly TERMINAL_NAME = 'Fefito';

	private _terminal: ITerminalInstance | undefined;
	private _terminalAlive = false;
	private _buffer: string = '';

	private readonly _onOutput = this._register(new Emitter<string>());
	readonly onOutput: Event<string> = this._onOutput.event;

	constructor(
		@ITerminalService private readonly terminalService: ITerminalService,
		@ITerminalGroupService private readonly terminalGroupService: ITerminalGroupService
	) {
		super();
	}

	private async ensureTerminal(): Promise<ITerminalInstance> {
		if (this._terminal && this._terminalAlive) {
			return this._terminal;
		}

		this._buffer = '';
		const terminal = await this.terminalService.createTerminal({
			config: {
				name: FefitoSetupTerminal.TERMINAL_NAME,
				isFeatureTerminal: true,
				isTransient: true,
				icon: ThemeIcon.fromId(Codicon.sparkle.id)
			}
		});

		this._terminalAlive = true;
		this._register(terminal.onExit(() => {
			this._terminal = undefined;
			this._terminalAlive = false;
		}));

		this._terminal = terminal;
		await terminal.processReady;
		return terminal;
	}

	/**
	 * Reveals the fefito terminal to the user (does not create it).
	 */
	reveal(): void {
		if (this._terminal) {
			this.terminalGroupService.setActiveInstance(this._terminal);
			this.terminalGroupService.showPanel(true);
		}
	}

	/**
	 * Runs a marker-wrapped command (see `wrapWithMarkers`) in the fefito terminal
	 * and resolves when its end marker shows up in the output stream.
	 */
	async run(id: string, wrappedCommand: string): Promise<FefitoRunResult> {
		const terminal = await this.ensureTerminal();

		const endMarker = new RegExp(`FEFITO_END:${id}:(\\d+)`);
		const disposables = new DisposableStore();
		const start = this._buffer.length;

		return new Promise<FefitoRunResult>(resolve => {
			const finish = (exitCode: number | undefined) => {
				disposables.dispose();
				resolve({
					id,
					output: this._buffer.slice(Math.min(start, this._buffer.length)),
					exitCode
				});
			};

			disposables.add(terminal.onData(chunk => {
				const clean = removeAnsiEscapeCodes(chunk);
				this._buffer += clean;
				this._onOutput.fire(clean);
				if (this._buffer.length > 100_000) {
					this._buffer = this._buffer.slice(this._buffer.length - 50_000);
				}

				const match = endMarker.exec(this._buffer);
				if (match) {
					finish(Number(match[1]));
				}
			}));

			disposables.add(terminal.onExit(() => finish(undefined)));

			terminal.sendText(wrappedCommand, true);
		});
	}

	/**
	 * Opens a fresh interactive terminal for the user (agent chat / login) and
	 * runs `launchCommand` in it. During the wizard the terminal opens in the
	 * bottom panel so the wizard stays front and center; after setup the agent
	 * chat opens in the editor area — the big central surface of the fefito
	 * experience.
	 */
	async openInteractiveTerminal(name: string, launchCommand: string, cwd?: string, location: TerminalLocation = TerminalLocation.Editor): Promise<ITerminalInstance> {
		const terminal = await this.terminalService.createTerminal({
			config: {
				name,
				isFeatureTerminal: true,
				cwd
			},
			location
		});
		await terminal.processReady;
		await terminal.sendText(launchCommand, true);
		return terminal;
	}
}
