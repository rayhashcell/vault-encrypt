import { App, Notice, TFile, TextFileView, moment, normalizePath } from "obsidian";
import { FileDataHelper, JsonFileEncoding } from "../../services/FileDataHelper.ts";
import { CryptoHelperFactory } from "../../services/CryptoHelperFactory.ts";
import { SessionPasswordService } from "../../services/SessionPasswordService.ts";
import { ENCRYPTED_FILE_EXTENSIONS } from "../../services/Constants.ts";
import { FeatureInplaceTextAnalysis } from "../feature-inplace-encrypt/featureInplaceTextAnalysis.ts";
import { INPLACE_FORMATS, _HINT, _PREFIX_ENCODE_DEFAULT, _PREFIX_ENCODE_DEFAULT_VISIBLE, _SUFFIX_NO_COMMENT, _SUFFIX_WITH_COMMENT } from "../feature-inplace-encrypt/FeatureInplaceConstants.ts";
import { EncryptedMarkdownView } from "../feature-whole-note-encrypt/EncryptedMarkdownView.ts";
import { Translator } from "../../i18n.ts";

export type PasswordRotationCandidateType = 'whole-note' | 'inline';
export type PasswordRotationProgressPhase = 'save-open-views' | 'precheck' | 'backup' | 'write' | 'rollback' | 'done';

export interface PasswordRotationCandidate {
	id: string;
	file: TFile;
	type: PasswordRotationCandidateType;
	folderPath: string;
	inlineBlockCount: number;
	selected: boolean;
}

export interface PasswordRotationProgress {
	phase: PasswordRotationProgressPhase;
	completed: number;
	total: number;
	currentPath: string;
	message: string;
}

export interface PasswordRotationIssue {
	path: string;
	stage: PasswordRotationProgressPhase;
	message: string;
	backupPath?: string;
}

export interface PasswordRotationSuccess {
	path: string;
	type: PasswordRotationCandidateType;
	backupPath: string;
}

export interface PasswordRotationRollback {
	path: string;
	backupPath: string;
	success: boolean;
	message: string;
}

export interface PasswordRotationResult {
	backupRoot?: string;
	successes: PasswordRotationSuccess[];
	failures: PasswordRotationIssue[];
	rollbacks: PasswordRotationRollback[];
	wasRolledBack: boolean;
	wasPrecheckBlocked: boolean;
}

export interface PasswordRotationCredentials {
	oldPassword: string;
	newPassword: string;
	hint: string;
}

interface InlineSegment {
	start: number;
	end: number;
	text: string;
	analysis: FeatureInplaceTextAnalysis;
}

interface RotationPlanItem {
	candidate: PasswordRotationCandidate;
	originalContent: string;
	nextContent: string;
	backupPath: string;
}

export class PasswordRotationService {
	public static readonly BACKUP_ROOT = 'AA Vault Encrypt Backups/Password Rotation';

	private app: App;
	private t: Translator;

	constructor(app: App, t: Translator) {
		this.app = app;
		this.t = t;
	}

	public async scanCandidates(
		onProgress?: (completed: number, total: number) => void
	): Promise<PasswordRotationCandidate[]> {
		const files = this.app.vault.getFiles();
		const candidates: PasswordRotationCandidate[] = [];
		let completed = 0;

		for ( const file of files ) {
			completed++;
			onProgress?.(completed, files.length);

			if ( this.isBackupPath(file.path) ){
				continue;
			}

			if ( ENCRYPTED_FILE_EXTENSIONS.includes(file.extension) ){
				candidates.push({
					id: file.path,
					file,
					type: 'whole-note',
					folderPath: this.getFolderPath(file),
					inlineBlockCount: 0,
					selected: false,
				});
				continue;
			}

			if ( file.extension !== 'md' ){
				continue;
			}

			let content: string;
			try {
				content = await this.app.vault.cachedRead(file);
			} catch (_error) {
				await this.yieldToUi();
				continue;
			}
			const inlineSegments = this.findInlineSegments(content);
			if ( inlineSegments.length == 0 ){
				continue;
			}

			candidates.push({
				id: file.path,
				file,
				type: 'inline',
				folderPath: this.getFolderPath(file),
				inlineBlockCount: inlineSegments.length,
				selected: false,
			});

			if ( completed % 20 == 0 ){
				await this.yieldToUi();
			}
		}

		return candidates.sort((a, b) => a.file.path.localeCompare(b.file.path));
	}

	public async execute(
		candidates: PasswordRotationCandidate[],
		credentials: PasswordRotationCredentials,
		onProgress: (progress: PasswordRotationProgress) => void
	): Promise<PasswordRotationResult> {
		const result: PasswordRotationResult = {
			successes: [],
			failures: [],
			rollbacks: [],
			wasRolledBack: false,
			wasPrecheckBlocked: false,
		};

		onProgress(this.buildProgress(
			'save-open-views',
			0,
			candidates.length,
			'',
			this.t('passwordRotation.progress.savingViews')
		));
		await this.saveOpenSelectedViews(candidates);

		const plan = await this.precheck(candidates, credentials, onProgress, result);
		if ( result.failures.length > 0 ){
			result.wasPrecheckBlocked = true;
			onProgress(this.buildProgress(
				'done',
				0,
				candidates.length,
				'',
				this.t('passwordRotation.progress.precheckFailed')
			));
			return result;
		}

		const backupRoot = await this.buildBackupRoot();
		result.backupRoot = backupRoot;

		try {
			await this.writeBackups(plan, backupRoot, onProgress);
		} catch (error) {
			result.failures.push({
				path: backupRoot,
				stage: 'backup',
				message: this.t('passwordRotation.issue.backupFailed', {
					reason: this.getErrorMessage(error),
				}),
			});
			onProgress(this.buildProgress(
				'done',
				0,
				candidates.length,
				'',
				this.t('passwordRotation.progress.backupFailed')
			));
			return result;
		}

		await this.writeRotatedFiles(plan, credentials, onProgress, result);

		onProgress(this.buildProgress(
			'done',
			result.successes.length,
			candidates.length,
			'',
			this.t('passwordRotation.progress.done')
		));

		return result;
	}

	public validateHint(hint: string): string | null {
		if ( hint.includes('`') ){
			return this.t('modal.validation.passwordHintCannotContainBackticks');
		}
		if ( hint.includes(_HINT) ){
			return this.t('passwordRotation.validation.hintCannotContainMarker');
		}
		return null;
	}

	private async precheck(
		candidates: PasswordRotationCandidate[],
		credentials: PasswordRotationCredentials,
		onProgress: (progress: PasswordRotationProgress) => void,
		result: PasswordRotationResult
	): Promise<RotationPlanItem[]> {
		const plan: RotationPlanItem[] = [];

		for (let idx = 0; idx < candidates.length; idx++) {
			const candidate = candidates[idx];
			onProgress(this.buildProgress(
				'precheck',
				idx,
				candidates.length,
				candidate.file.path,
				this.t('passwordRotation.progress.prechecking', {
					path: candidate.file.path,
				})
			));

			try {
				const originalContent = await this.app.vault.read(candidate.file);
				const nextContent = candidate.type === 'whole-note'
					? await this.rotateWholeNoteContent(originalContent, credentials)
					: await this.rotateInlineContent(originalContent, credentials);

				if ( nextContent == null ){
					result.failures.push({
						path: candidate.file.path,
						stage: 'precheck',
						message: this.t('passwordRotation.issue.decryptFailed'),
					});
					continue;
				}

				plan.push({
					candidate,
					originalContent,
					nextContent,
					backupPath: '',
				});
			} catch (error) {
				result.failures.push({
					path: candidate.file.path,
					stage: 'precheck',
					message: this.getErrorMessage(error),
				});
			}

			await this.yieldToUi();
		}

		return plan;
	}

	private async writeBackups(
		plan: RotationPlanItem[],
		backupRoot: string,
		onProgress: (progress: PasswordRotationProgress) => void
	): Promise<void> {
		await this.ensureFolder(backupRoot);

		for (let idx = 0; idx < plan.length; idx++) {
			const item = plan[idx];
			const backupPath = normalizePath(`${backupRoot}/${item.candidate.file.path}`);
			item.backupPath = backupPath;

			onProgress(this.buildProgress(
				'backup',
				idx,
				plan.length,
				item.candidate.file.path,
				this.t('passwordRotation.progress.backingUp', {
					path: item.candidate.file.path,
				})
			));

			await this.ensureFolder(this.getParentPath(backupPath));
			await this.app.vault.adapter.write(backupPath, item.originalContent);
			await this.yieldToUi();
		}
	}

	private async writeRotatedFiles(
		plan: RotationPlanItem[],
		credentials: PasswordRotationCredentials,
		onProgress: (progress: PasswordRotationProgress) => void,
		result: PasswordRotationResult
	): Promise<void> {
		const modifiedItems: RotationPlanItem[] = [];

		for (let idx = 0; idx < plan.length; idx++) {
			const item = plan[idx];

			onProgress(this.buildProgress(
				'write',
				idx,
				plan.length,
				item.candidate.file.path,
				this.t('passwordRotation.progress.writing', {
					path: item.candidate.file.path,
				})
			));

			try {
				const currentContent = await this.app.vault.read(item.candidate.file);
				if ( currentContent !== item.originalContent ){
					result.failures.push({
						path: item.candidate.file.path,
						stage: 'write',
						message: this.t('passwordRotation.issue.changedAfterPrecheck'),
						backupPath: item.backupPath,
					});
					continue;
				}

				await this.app.vault.modify(item.candidate.file, item.nextContent);
				modifiedItems.push(item);
				result.successes.push({
					path: item.candidate.file.path,
					type: item.candidate.type,
					backupPath: item.backupPath,
				});
			} catch (error) {
				result.failures.push({
					path: item.candidate.file.path,
					stage: 'write',
					message: this.t('passwordRotation.issue.writeFailed', {
						reason: this.getErrorMessage(error),
					}),
					backupPath: item.backupPath,
				});
				await this.rollback(modifiedItems, onProgress, result);
				result.successes = [];
				return;
			}

			await this.yieldToUi();
		}

		if ( result.successes.length > 0 ){
			try {
				await this.refreshSessionPasswords(result.successes, plan, credentials);
			} catch (error) {
				result.failures.push({
					path: this.t('passwordRotation.title'),
					stage: 'done',
					message: this.t('passwordRotation.issue.cacheRefreshFailed', {
						reason: this.getErrorMessage(error),
					}),
				});
			}
		}
	}

	private async rollback(
		modifiedItems: RotationPlanItem[],
		onProgress: (progress: PasswordRotationProgress) => void,
		result: PasswordRotationResult
	): Promise<void> {
		result.wasRolledBack = modifiedItems.length > 0;

		for (let idx = 0; idx < modifiedItems.length; idx++) {
			const item = modifiedItems[idx];
			onProgress(this.buildProgress(
				'rollback',
				idx,
				modifiedItems.length,
				item.candidate.file.path,
				this.t('passwordRotation.progress.rollingBack', {
					path: item.candidate.file.path,
				})
			));

			try {
				await this.app.vault.modify(item.candidate.file, item.originalContent);
				result.rollbacks.push({
					path: item.candidate.file.path,
					backupPath: item.backupPath,
					success: true,
					message: this.t('passwordRotation.issue.rollbackSucceeded'),
				});
			} catch (error) {
				result.rollbacks.push({
					path: item.candidate.file.path,
					backupPath: item.backupPath,
					success: false,
					message: this.t('passwordRotation.issue.rollbackFailed', {
						reason: this.getErrorMessage(error),
					}),
				});
			}

			await this.yieldToUi();
		}
	}

	private async rotateWholeNoteContent(
		content: string,
		credentials: PasswordRotationCredentials
	): Promise<string | null> {
		let fileData;
		try {
			fileData = JsonFileEncoding.decode(content);
		} catch (_error) {
			throw new Error(this.t('passwordRotation.issue.invalidEncryptedFile'));
		}

		if ( !FileDataHelper.isSupported(fileData) ){
			throw new Error(this.t('passwordRotation.issue.unsupportedFormat'));
		}

		let decryptedText = await FileDataHelper.decrypt(fileData, credentials.oldPassword);
		if ( decryptedText == null ){
			return null;
		}

		const nextFileData = await FileDataHelper.encrypt(
			credentials.newPassword,
			credentials.hint,
			decryptedText
		);
		decryptedText = '';
		return JsonFileEncoding.encode(nextFileData);
	}

	private async rotateInlineContent(
		content: string,
		credentials: PasswordRotationCredentials
	): Promise<string | null> {
		const segments = this.findInlineSegments(content);
		if ( segments.length == 0 ){
			throw new Error(this.t('passwordRotation.issue.noInlineBlocks'));
		}

		let nextContent = content;
		const defaultCrypto = CryptoHelperFactory.BuildDefault();

		for (let idx = segments.length - 1; idx >= 0; idx--) {
			const segment = segments[idx];
			const decryptable = segment.analysis.decryptable;
			if ( decryptable == null ){
				return null;
			}

			const crypto = CryptoHelperFactory.BuildFromDecryptableOrNull(decryptable);
			if ( crypto == null ){
				throw new Error(this.t('passwordRotation.issue.unsupportedFormat'));
			}

			let decryptedText = await crypto.decryptFromBase64(
				decryptable.base64CipherText,
				credentials.oldPassword
			);
			if ( decryptedText == null ){
				return null;
			}

			const nextCipherText = await defaultCrypto.encryptToBase64(
				decryptedText,
				credentials.newPassword
			);
			decryptedText = '';
			const nextMarker = this.encodeInlineEncryption(
				nextCipherText,
				credentials.hint,
				decryptable.showInReadingView
			);
			nextContent = nextContent.slice(0, segment.start) + nextMarker + nextContent.slice(segment.end);
		}

		return nextContent;
	}

	private findInlineSegments(content: string): InlineSegment[] {
		const matches: InlineSegment[] = [];
		const formatMatchers: { prefix: string; suffix: string }[] = [];
		for ( const format of INPLACE_FORMATS ) {
			formatMatchers.push({
				prefix: format.hiddenPrefix,
				suffix: _SUFFIX_WITH_COMMENT,
			});
			formatMatchers.push({
				prefix: format.visiblePrefix,
				suffix: _SUFFIX_NO_COMMENT,
			});
		}

		for ( const matcher of formatMatchers ) {
			const regex = new RegExp(
				`${this.escapeRegExp(matcher.prefix)}[\\s\\S]*?${this.escapeRegExp(matcher.suffix)}`,
				'g'
			);
			for ( const match of content.matchAll(regex) ) {
				const start = match.index ?? 0;
				const text = match[0];
				const analysis = new FeatureInplaceTextAnalysis(text);
				if ( !analysis.canDecrypt ){
					continue;
				}
				matches.push({
					start,
					end: start + text.length,
					text,
					analysis,
				});
			}
		}

		return matches
			.sort((a, b) => {
				if ( a.start !== b.start ){
					return a.start - b.start;
				}
				return b.text.length - a.text.length;
			})
			.reduce((acc, segment) => {
				const previous = acc[acc.length - 1];
				if ( previous != null && segment.start < previous.end ){
					return acc;
				}
				acc.push(segment);
				return acc;
			}, [] as InlineSegment[]);
	}

	private encodeInlineEncryption(
		encryptedText: string,
		hint: string,
		showInReadingView: boolean
	): string {
		const prefix = showInReadingView ? _PREFIX_ENCODE_DEFAULT_VISIBLE : _PREFIX_ENCODE_DEFAULT;
		const suffix = showInReadingView ? _SUFFIX_NO_COMMENT : _SUFFIX_WITH_COMMENT;
		if ( hint.length > 0 ){
			return prefix.concat(_HINT, hint, _HINT, encryptedText, suffix);
		}
		return prefix.concat(encryptedText, suffix);
	}

	private async saveOpenSelectedViews(candidates: PasswordRotationCandidate[]): Promise<void> {
		const selectedPaths = new Set(candidates.map(candidate => candidate.file.path));
		const savePromises: Promise<void>[] = [];

		this.app.workspace.iterateAllLeaves(leaf => {
			const view = leaf.view;
			if ( !(view instanceof TextFileView) || view.file == null ){
				return;
			}
			if ( !selectedPaths.has(view.file.path) ){
				return;
			}
			if ( view instanceof EncryptedMarkdownView ){
				savePromises.push(view.detachSafely());
				return;
			}
			savePromises.push(view.save());
		});

		await Promise.all(savePromises);
	}

	private async refreshSessionPasswords(
		successes: PasswordRotationSuccess[],
		plan: RotationPlanItem[],
		credentials: PasswordRotationCredentials
	): Promise<void> {
		const successPaths = new Set(successes.map(success => success.path));
		await this.lockAndCloseOpenEncryptedViews();
		SessionPasswordService.clear();
		for ( const item of plan ) {
			if ( !successPaths.has(item.candidate.file.path) ){
				continue;
			}
			const passwordAndHint = {
				password: credentials.newPassword,
				hint: credentials.hint,
			};
			if ( item.candidate.type === 'whole-note' ){
				SessionPasswordService.putByFile(passwordAndHint, item.candidate.file);
			} else {
				SessionPasswordService.putByPath(passwordAndHint, item.candidate.file.path);
			}
		}
		new Notice(this.t('passwordRotation.notice.cacheRefreshed'));
	}

	private async lockAndCloseOpenEncryptedViews(): Promise<void> {
		const detachPromises: Promise<void>[] = [];
		for ( const leaf of this.app.workspace.getLeavesOfType(EncryptedMarkdownView.VIEW_TYPE) ) {
			const view = leaf.view;
			if ( view instanceof EncryptedMarkdownView ){
				detachPromises.push(view.detachSafely());
			}
		}
		await Promise.all(detachPromises);
	}

	private async buildBackupRoot(): Promise<string> {
		const base = normalizePath(`${PasswordRotationService.BACKUP_ROOT}/${moment().format('YYYY-MM-DD-HHmmss')}`);
		let candidate = base;
		let suffix = 2;
		while ( await this.app.vault.adapter.exists(candidate, true) ) {
			candidate = `${base}-${suffix}`;
			suffix++;
		}
		return candidate;
	}

	private async ensureFolder(folderPath: string): Promise<void> {
		const normalizedFolderPath = normalizePath(folderPath);
		if ( normalizedFolderPath.length == 0 || normalizedFolderPath === '/' ){
			return;
		}

		const parts = normalizedFolderPath.split('/').filter(part => part.length > 0);
		let currentPath = '';
		for ( const part of parts ) {
			currentPath = normalizePath(currentPath.length == 0 ? part : `${currentPath}/${part}`);
			if ( await this.app.vault.adapter.exists(currentPath, true) ){
				continue;
			}
			await this.app.vault.createFolder(currentPath);
		}
	}

	private getFolderPath(file: TFile): string {
		const slashIndex = file.path.lastIndexOf('/');
		if ( slashIndex < 0 ){
			return '/';
		}
		return file.path.slice(0, slashIndex) || '/';
	}

	private getParentPath(path: string): string {
		const slashIndex = path.lastIndexOf('/');
		if ( slashIndex < 0 ){
			return '';
		}
		return path.slice(0, slashIndex);
	}

	private isBackupPath(path: string): boolean {
		return normalizePath(path).startsWith(`${PasswordRotationService.BACKUP_ROOT}/`);
	}

	private buildProgress(
		phase: PasswordRotationProgressPhase,
		completed: number,
		total: number,
		currentPath: string,
		message: string
	): PasswordRotationProgress {
		return {
			phase,
			completed,
			total,
			currentPath,
			message,
		};
	}

	private getErrorMessage(error: unknown): string {
		if ( error instanceof Error ){
			return error.message;
		}
		return `${error}`;
	}

	private escapeRegExp(text: string): string {
		return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	private async yieldToUi(): Promise<void> {
		await new Promise<void>(resolve => window.setTimeout(resolve, 0));
	}
}
