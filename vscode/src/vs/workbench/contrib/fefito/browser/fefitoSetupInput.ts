/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { URI } from '../../../../base/common/uri.js';
import { IUntypedEditorInput } from '../../../common/editor.js';

export const fefitoSetupInputTypeId = 'workbench.editors.fefitoSetupWizard';

/** Dedicated scheme so fefito's editor resolver does not clash with the walkthrough scheme. */
export const FefitoSetupInputScheme = 'fefito-setup';

export class FefitoSetupInput extends EditorInput {

	static readonly ID = fefitoSetupInputTypeId;
	static readonly RESOURCE = URI.from({ scheme: FefitoSetupInputScheme, authority: 'fefito_setup_wizard' });

	override get typeId(): string {
		return FefitoSetupInput.ID;
	}

	override get editorId(): string | undefined {
		return this.typeId;
	}

	override toUntyped(): IUntypedEditorInput {
		return {
			resource: FefitoSetupInput.RESOURCE,
			options: {
				override: FefitoSetupInput.ID,
				pinned: false
			}
		};
	}

	get resource(): URI | undefined {
		return FefitoSetupInput.RESOURCE;
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		if (super.matches(other)) {
			return true;
		}

		return other instanceof FefitoSetupInput;
	}

	override getName() {
		return localize('fefitoSetupName', "Configurar o Fefito");
	}
}
