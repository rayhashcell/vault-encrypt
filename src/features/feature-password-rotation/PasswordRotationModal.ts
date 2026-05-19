import { App, Modal, Setting } from "obsidian";
import { UiHelper } from "../../services/UiHelper.ts";
import { Translator } from "../../i18n.ts";
import {
	PasswordRotationCandidate,
	PasswordRotationCredentials,
	PasswordRotationProgress,
	PasswordRotationResult,
	PasswordRotationService,
} from "./PasswordRotationService.ts";

type PasswordRotationStep = 'scan' | 'selection' | 'password' | 'progress' | 'result';

export class PasswordRotationModal extends Modal {
	private service: PasswordRotationService;
	private t: Translator;
	private step: PasswordRotationStep = 'scan';
	private candidates: PasswordRotationCandidate[] = [];
	private openFolders = new Set<string>();
	private progress: PasswordRotationProgress | null = null;
	private result: PasswordRotationResult | null = null;
	private progressTextEl: HTMLElement | null = null;
	private progressBarEl: HTMLProgressElement | null = null;

	constructor(app: App, service: PasswordRotationService, t: Translator) {
		super(app);
		this.service = service;
		this.t = t;
	}

	override onOpen(): void {
		this.modalEl.addClass('vault-encrypt-password-rotation-modal-container');
		this.contentEl.addClass('vault-encrypt-password-rotation-modal');
		this.scanCandidates();
	}

	private async scanCandidates(): Promise<void> {
		this.step = 'scan';
		this.renderScanStep(0, 0);
		this.candidates = await this.service.scanCandidates(
			(completed, total) => this.renderScanStep(completed, total)
		);
		this.step = 'selection';
		this.renderSelectionStep();
	}

	private renderScanStep(completed: number, total: number): void {
		this.contentEl.empty();
		new Setting(this.contentEl)
			.setHeading()
			.setName(this.t('passwordRotation.title'))
		;

		const scanEl = this.contentEl.createDiv({
			cls: 'vault-encrypt-password-rotation-status',
		});
		scanEl.setText(
			total > 0
				? this.t('passwordRotation.scan.progress', { completed, total })
				: this.t('passwordRotation.scan.loading')
		);
	}

	private renderSelectionStep(): void {
		this.contentEl.empty();
		this.step = 'selection';

		new Setting(this.contentEl)
			.setHeading()
			.setName(this.t('passwordRotation.title'))
			.setDesc(this.t('passwordRotation.selection.desc'))
		;

		if ( this.candidates.length == 0 ){
			this.contentEl.createDiv({
				cls: 'vault-encrypt-password-rotation-empty',
				text: this.t('passwordRotation.scan.empty'),
			});
			const actionsEl = this.createActionsEl();
			this.createActionButton(actionsEl, this.t('passwordRotation.button.close'), () => this.close());
			return;
		}

		const selectedCount = this.getSelectedCandidates().length;
		const summaryEl = this.contentEl.createDiv({
			cls: 'vault-encrypt-password-rotation-summary',
			text: this.t('passwordRotation.selection.selectedCount', {
				selected: selectedCount,
				total: this.candidates.length,
			}),
		});

		this.renderSelectAllControl(selectedCount);

		const listEl = this.contentEl.createDiv({
			cls: 'vault-encrypt-password-rotation-list',
		});

		for ( const group of this.groupCandidates() ) {
			this.renderFolderGroup(listEl, group.folderPath, group.candidates);
		}

		const actionsEl = this.createActionsEl();
		this.createActionButton(actionsEl, this.t('passwordRotation.button.close'), () => this.close());
		this.createActionButton(
			actionsEl,
			this.t('passwordRotation.button.next'),
			() => this.renderPasswordStep(),
			{ cta: true, disabled: selectedCount == 0 }
		);

		if ( selectedCount == 0 ){
			summaryEl.addClass('is-warning');
		}
	}

	private renderSelectAllControl(selectedCount: number): void {
		const rowEl = this.contentEl.createEl('label', {
			cls: 'vault-encrypt-password-rotation-select-all',
		});

		const checkbox = rowEl.createEl('input', {
			type: 'checkbox',
			cls: 'vault-encrypt-password-rotation-checkbox',
		});
		checkbox.checked = selectedCount == this.candidates.length;
		checkbox.indeterminate = selectedCount > 0 && selectedCount < this.candidates.length;
		checkbox.onchange = () => {
			const isSelected = checkbox.checked;
			this.candidates.forEach(candidate => {
				candidate.selected = isSelected;
			});
			if ( isSelected ){
				for ( const group of this.groupCandidates() ) {
					this.openFolders.add(group.folderPath);
				}
			}
			this.renderSelectionStep();
		};

		rowEl.createSpan({
			cls: 'vault-encrypt-password-rotation-select-all-text',
			text: this.t('passwordRotation.selection.selectAll'),
		});
	}

	private renderFolderGroup(
		containerEl: HTMLElement,
		folderPath: string,
		candidates: PasswordRotationCandidate[]
	): void {
		const selectedCount = candidates.filter(candidate => candidate.selected).length;
		const detailsEl = containerEl.createEl('details', {
			cls: 'vault-encrypt-password-rotation-folder',
		});
		detailsEl.open = this.openFolders.has(folderPath) || selectedCount > 0;
		detailsEl.ontoggle = () => {
			if ( detailsEl.open ){
				this.openFolders.add(folderPath);
			} else {
				this.openFolders.delete(folderPath);
			}
		};

		const summaryEl = detailsEl.createEl('summary', {
			cls: 'vault-encrypt-password-rotation-folder-summary',
		});

		const folderCheckbox = summaryEl.createEl('input', {
			type: 'checkbox',
			cls: 'vault-encrypt-password-rotation-checkbox',
		});
		folderCheckbox.checked = selectedCount == candidates.length;
		folderCheckbox.indeterminate = selectedCount > 0 && selectedCount < candidates.length;
		folderCheckbox.onclick = (event) => event.stopPropagation();
		folderCheckbox.onchange = () => {
			const isSelected = folderCheckbox.checked;
			candidates.forEach(candidate => {
				candidate.selected = isSelected;
			});
			this.openFolders.add(folderPath);
			this.renderSelectionStep();
		};

		summaryEl.createSpan({
			cls: 'vault-encrypt-password-rotation-folder-name',
			text: this.t('passwordRotation.folder.summary', {
				folder: folderPath === '/' ? this.t('passwordRotation.folder.root') : folderPath,
				selected: selectedCount,
				total: candidates.length,
			}),
		});

		const filesEl = detailsEl.createDiv({
			cls: 'vault-encrypt-password-rotation-files',
		});

		for ( const candidate of candidates ) {
			this.renderCandidateRow(filesEl, candidate);
		}
	}

	private renderCandidateRow(containerEl: HTMLElement, candidate: PasswordRotationCandidate): void {
		const rowEl = containerEl.createEl('label', {
			cls: 'vault-encrypt-password-rotation-file',
		});

		const checkbox = rowEl.createEl('input', {
			type: 'checkbox',
			cls: 'vault-encrypt-password-rotation-checkbox',
		});
		checkbox.checked = candidate.selected;
		checkbox.onchange = () => {
			candidate.selected = checkbox.checked;
			this.renderSelectionStep();
		};

		const textEl = rowEl.createSpan({
			cls: 'vault-encrypt-password-rotation-file-text',
		});
		textEl.createSpan({
			cls: 'vault-encrypt-password-rotation-file-name',
			text: candidate.file.name,
		});
		textEl.createSpan({
			cls: 'vault-encrypt-password-rotation-file-meta',
			text: candidate.type === 'whole-note'
				? this.t('passwordRotation.type.wholeNote')
				: this.t('passwordRotation.type.inline', {
					count: candidate.inlineBlockCount,
				}),
		});
	}

	private renderPasswordStep(): void {
		this.contentEl.empty();
		this.step = 'password';

		let oldPassword = '';
		let newPassword = '';
		let confirmPassword = '';
		let hint = '';

		new Setting(this.contentEl)
			.setHeading()
			.setName(this.t('passwordRotation.password.title'))
			.setDesc(this.t('passwordRotation.password.desc', {
				count: this.getSelectedCandidates().length,
			}))
		;

		const oldPasswordSetting = UiHelper.buildPasswordSetting({
			container: this.contentEl,
			name: this.t('passwordRotation.password.oldPassword'),
			showPasswordTooltip: this.t('modal.password.showPasswordTooltip'),
			hidePasswordTooltip: this.t('modal.password.hidePasswordTooltip'),
			autoFocus: true,
			onChangeCallback: value => {
				oldPassword = value;
				oldPasswordSetting.setDesc('');
			},
			onEnterCallback: value => {
				oldPassword = value;
			},
		});

		const newPasswordSetting = UiHelper.buildPasswordSetting({
			container: this.contentEl,
			name: this.t('passwordRotation.password.newPassword'),
			showPasswordTooltip: this.t('modal.password.showPasswordTooltip'),
			hidePasswordTooltip: this.t('modal.password.hidePasswordTooltip'),
			onChangeCallback: value => {
				newPassword = value;
				newPasswordSetting.setDesc('');
			},
			onEnterCallback: value => {
				newPassword = value;
			},
		});

		const confirmPasswordSetting = UiHelper.buildPasswordSetting({
			container: this.contentEl,
			name: this.t('passwordRotation.password.confirmNewPassword'),
			showPasswordTooltip: this.t('modal.password.showPasswordTooltip'),
			hidePasswordTooltip: this.t('modal.password.hidePasswordTooltip'),
			onChangeCallback: value => {
				confirmPassword = value;
				confirmPasswordSetting.setDesc('');
			},
			onEnterCallback: value => {
				confirmPassword = value;
			},
		});

		const hintSetting = new Setting(this.contentEl)
			.setName(this.t('passwordRotation.password.hint'))
			.setDesc(this.t('passwordRotation.password.hintDesc'))
			.addText(text => {
				text
					.setPlaceholder(this.t('modal.optionalPasswordHint.placeholder'))
					.onChange(value => {
						hint = value;
						hintSetting.setDesc(this.t('passwordRotation.password.hintDesc'));
					})
				;
			})
		;

		const actionsEl = this.createActionsEl();
		this.createActionButton(actionsEl, this.t('passwordRotation.button.back'), () => this.renderSelectionStep());
		this.createActionButton(
			actionsEl,
			this.t('passwordRotation.button.start'),
			() => {
				const credentials = this.validateCredentials(
					{
						oldPassword,
						newPassword,
						hint,
					},
					confirmPassword,
					oldPasswordSetting,
					newPasswordSetting,
					confirmPasswordSetting,
					hintSetting
				);
				if ( credentials == null ){
					return;
				}
				this.startRotation(credentials);
			},
			{ cta: true }
		);
	}

	private validateCredentials(
		credentials: PasswordRotationCredentials,
		confirmPassword: string,
		oldPasswordSetting: Setting,
		newPasswordSetting: Setting,
		confirmPasswordSetting: Setting,
		hintSetting: Setting
	): PasswordRotationCredentials | null {
		oldPasswordSetting.setDesc('');
		newPasswordSetting.setDesc('');
		confirmPasswordSetting.setDesc('');
		hintSetting.setDesc(this.t('passwordRotation.password.hintDesc'));

		if ( credentials.oldPassword.length == 0 ){
			oldPasswordSetting.setDesc(this.t('passwordRotation.validation.oldPasswordRequired'));
			return null;
		}
		if ( credentials.newPassword.length == 0 ){
			newPasswordSetting.setDesc(this.t('passwordRotation.validation.newPasswordRequired'));
			return null;
		}
		if ( credentials.newPassword !== confirmPassword ){
			confirmPasswordSetting.setDesc(this.t('modal.validation.passwordsDontMatch'));
			return null;
		}

		const hintIssue = this.service.validateHint(credentials.hint);
		if ( hintIssue != null ){
			hintSetting.setDesc(hintIssue);
			return null;
		}

		return credentials;
	}

	private startRotation(credentials: PasswordRotationCredentials): void {
		this.step = 'progress';
		this.progress = null;
		this.result = null;
		this.renderProgressStep();

		const selectedCandidates = this.getSelectedCandidates();
		this.service.execute(
			selectedCandidates,
			credentials,
			progress => {
				this.progress = progress;
				this.updateProgress();
			}
		).then(result => {
			this.result = result;
			this.renderResultStep();
		}).catch(error => {
			this.result = {
				successes: [],
				failures: [{
					path: this.t('passwordRotation.title'),
					stage: 'done',
					message: this.t('passwordRotation.issue.unexpectedFailure', {
						reason: this.getErrorMessage(error),
					}),
				}],
				rollbacks: [],
				wasRolledBack: false,
				wasPrecheckBlocked: false,
			};
			this.renderResultStep();
		});
	}

	private renderProgressStep(): void {
		this.contentEl.empty();

		new Setting(this.contentEl)
			.setHeading()
			.setName(this.t('passwordRotation.progress.title'))
		;

		const progressWrapEl = this.contentEl.createDiv({
			cls: 'vault-encrypt-password-rotation-progress',
		});
		this.progressBarEl = progressWrapEl.createEl('progress', {
			cls: 'vault-encrypt-password-rotation-progress-bar',
		});
		this.progressBarEl.max = Math.max(this.getSelectedCandidates().length, 1);
		this.progressBarEl.value = 0;
		this.progressTextEl = progressWrapEl.createDiv({
			cls: 'vault-encrypt-password-rotation-progress-text',
			text: this.t('passwordRotation.progress.starting'),
		});
	}

	private updateProgress(): void {
		if ( this.progress == null ){
			return;
		}
		if ( this.progressBarEl != null ){
			this.progressBarEl.max = Math.max(this.progress.total, 1);
			this.progressBarEl.value = this.progress.completed;
		}
		if ( this.progressTextEl != null ){
			this.progressTextEl.setText(this.progress.message);
		}
	}

	private renderResultStep(): void {
		this.contentEl.empty();
		this.step = 'result';

		if ( this.result == null ){
			return;
		}

		const result = this.result;
		new Setting(this.contentEl)
			.setHeading()
			.setName(this.t('passwordRotation.result.title'))
		;

		this.contentEl.createDiv({
			cls: 'vault-encrypt-password-rotation-summary',
			text: this.t('passwordRotation.result.summary', {
				success: result.successes.length,
				failed: result.failures.length,
				rollback: result.rollbacks.filter(item => item.success).length,
			}),
		});

		if ( result.backupRoot != null ){
			this.contentEl.createDiv({
				cls: 'vault-encrypt-password-rotation-backup-path',
				text: this.t('passwordRotation.result.backupRoot', {
					path: result.backupRoot,
				}),
			});
		}

		if ( result.wasPrecheckBlocked ){
			this.contentEl.createDiv({
				cls: 'vault-encrypt-password-rotation-warning',
				text: this.t('passwordRotation.result.precheckBlocked'),
			});
		}
		if ( result.wasRolledBack ){
			this.contentEl.createDiv({
				cls: 'vault-encrypt-password-rotation-warning',
				text: this.t('passwordRotation.result.rolledBack'),
			});
		}

		const resultsEl = this.contentEl.createDiv({
			cls: 'vault-encrypt-password-rotation-results',
		});
		this.renderSuccesses(resultsEl, result);
		this.renderFailures(resultsEl, result);
		this.renderRollbacks(resultsEl, result);

		const actionsEl = this.createActionsEl();
		this.createActionButton(actionsEl, this.t('passwordRotation.button.backToSelection'), () => this.scanCandidates());
		this.createActionButton(actionsEl, this.t('passwordRotation.button.close'), () => this.close(), { cta: true });
	}

	private renderSuccesses(containerEl: HTMLElement, result: PasswordRotationResult): void {
		if ( result.successes.length == 0 ){
			return;
		}
		const detailsEl = containerEl.createEl('details');
		detailsEl.open = true;
		detailsEl.createEl('summary', {
			text: this.t('passwordRotation.result.successHeading', {
				count: result.successes.length,
			}),
		});
		const listEl = detailsEl.createEl('ul');
		for ( const success of result.successes ) {
			listEl.createEl('li', {
				text: `${success.path} - ${success.type === 'whole-note'
					? this.t('passwordRotation.type.wholeNote')
					: this.t('passwordRotation.type.inlineShort')}`,
			});
		}
	}

	private renderFailures(containerEl: HTMLElement, result: PasswordRotationResult): void {
		if ( result.failures.length == 0 ){
			return;
		}
		const detailsEl = containerEl.createEl('details');
		detailsEl.open = true;
		detailsEl.createEl('summary', {
			text: this.t('passwordRotation.result.failureHeading', {
				count: result.failures.length,
			}),
		});
		const listEl = detailsEl.createEl('ul');
		for ( const failure of result.failures ) {
			const backupText = failure.backupPath == null
				? ''
				: ` ${this.t('passwordRotation.result.backupForItem', { path: failure.backupPath })}`;
			listEl.createEl('li', {
				text: `${failure.path} - ${failure.message}${backupText}`,
			});
		}
	}

	private renderRollbacks(containerEl: HTMLElement, result: PasswordRotationResult): void {
		if ( result.rollbacks.length == 0 ){
			return;
		}
		const detailsEl = containerEl.createEl('details');
		detailsEl.open = true;
		detailsEl.createEl('summary', {
			text: this.t('passwordRotation.result.rollbackHeading', {
				count: result.rollbacks.length,
			}),
		});
		const listEl = detailsEl.createEl('ul');
		for ( const rollback of result.rollbacks ) {
			listEl.createEl('li', {
				text: `${rollback.path} - ${rollback.message} ${this.t('passwordRotation.result.backupForItem', {
					path: rollback.backupPath,
				})}`,
			});
		}
	}

	private groupCandidates(): { folderPath: string; candidates: PasswordRotationCandidate[] }[] {
		const groups = new Map<string, PasswordRotationCandidate[]>();
		for ( const candidate of this.candidates ) {
			const group = groups.get(candidate.folderPath) ?? [];
			group.push(candidate);
			groups.set(candidate.folderPath, group);
		}
		return Array.from(groups.entries())
			.sort(([folderA], [folderB]) => folderA.localeCompare(folderB))
			.map(([folderPath, candidates]) => ({
				folderPath,
				candidates,
			}));
	}

	private getSelectedCandidates(): PasswordRotationCandidate[] {
		return this.candidates.filter(candidate => candidate.selected);
	}

	private createActionsEl(): HTMLElement {
		return this.contentEl.createDiv({
			cls: 'vault-encrypt-password-rotation-actions',
		});
	}

	private createActionButton(
		containerEl: HTMLElement,
		text: string,
		onClick: () => void,
		options: { cta?: boolean; disabled?: boolean } = {}
	): HTMLButtonElement {
		const buttonEl = containerEl.createEl('button', {
			cls: 'vault-encrypt-password-rotation-action',
			text,
		});
		buttonEl.type = 'button';
		buttonEl.disabled = options.disabled === true;
		if ( options.cta === true ){
			buttonEl.addClass('mod-cta');
		}
		buttonEl.onclick = () => {
			if ( buttonEl.disabled ){
				return;
			}
			onClick();
		};
		return buttonEl;
	}

	private getErrorMessage(error: unknown): string {
		if ( error instanceof Error ){
			return error.message;
		}
		return `${error}`;
	}
}
