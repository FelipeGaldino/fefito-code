/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { IReference, toDisposable } from '../../../../../base/common/lifecycle.js';
import { $, append, hide } from '../../../../../base/browser/dom.js';
import { CodeEditorWidget } from '../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { IViewDescriptorService } from '../../../../common/views.js';
import { IViewPaneOptions, ViewPane } from '../../../../browser/parts/views/viewPane.js';

export const FEFITO_CODE_VIEW_ID = 'workbench.explorer.fefitoCodeView';

export class FefitoCodeView extends ViewPane {
	private editor!: CodeEditorWidget;
	private placeholder!: HTMLElement;
	private modelReference: IReference<IResolvedTextEditorModel> | undefined;
	private openSequence = 0;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ITextModelService private readonly textModelService: ITextModelService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register(toDisposable(() => this.modelReference?.dispose()));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.classList.add('fefito-code-view-body');
		this.placeholder = append(container, $('.fefito-code-view-placeholder', undefined, 'Abra um arquivo nas pastas para ver o código aqui.'));
		const editorContainer = append(container, $('.fefito-code-view-editor'));
		this.editor = this._register(this.instantiationService.createInstance(CodeEditorWidget, editorContainer, {
			minimap: { enabled: false },
			lineNumbers: 'on',
			wordWrap: 'on',
			automaticLayout: false,
			fontSize: 12,
			scrollBeyondLastLine: false
		}, { isSimpleWidget: true }));
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.editor?.layout({ height, width });
	}

	async openFile(resource: URI): Promise<void> {
		const sequence = ++this.openSequence;
		const reference = await this.textModelService.createModelReference(resource);
		if (sequence !== this.openSequence || !reference.object.textEditorModel) {
			reference.dispose();
			return;
		}
		this.editor.setModel(reference.object.textEditorModel);
		this.modelReference?.dispose();
		this.modelReference = reference;
		this.updateTitleDescription(resource.path.split('/').pop());
		hide(this.placeholder);
		this.editor.layout();
	}

	override focus(): void {
		this.editor?.focus();
	}
}
