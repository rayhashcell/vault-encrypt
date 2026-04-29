import { Editor, EditorPosition, Notice, Setting, MarkdownPostProcessorContext, MarkdownView } from "obsidian";
import DecryptModal from "./DecryptModal.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import MeldEncrypt from "../../main.ts";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IFeatureInplaceEncryptSettings } from "./IFeatureInplaceEncryptSettings.ts";
import PasswordModal from "./PasswordModal.ts";
import { UiHelper } from "../../services/UiHelper.ts";
import { SessionPasswordService } from "../../services/SessionPasswordService.ts";
import { CryptoHelperFactory } from "../../services/CryptoHelperFactory.ts";
import { Decryptable } from "./Decryptable.ts";
import { FeatureInplaceTextAnalysis } from "./featureInplaceTextAnalysis.ts";
import { ENCRYPTED_ICON, _HINT, _PREFIXES, _PREFIX_ENCODE_DEFAULT, _PREFIX_ENCODE_DEFAULT_VISIBLE, _SUFFIXES, _SUFFIX_NO_COMMENT, _SUFFIX_WITH_COMMENT, _VISIBLE_PREFIXES } from "./FeatureInplaceConstants.ts";

enum EncryptOrDecryptMode{
	Encrypt = 'encrypt',
	Decrypt = 'decrypt'
}

export default class FeatureInplaceEncrypt implements IMeldEncryptPluginFeature{
	plugin:MeldEncrypt;
	pluginSettings: IMeldEncryptPluginSettings;
	featureSettings:IFeatureInplaceEncryptSettings;

	async onload(plugin:MeldEncrypt, settings:IMeldEncryptPluginSettings) {
		this.plugin = plugin;
		this.pluginSettings = settings;
		this.featureSettings = settings.featureInplaceEncrypt;

		this.plugin.registerMarkdownPostProcessor(
			(el,ctx) => this.processEncryptedCodeBlockProcessor(el, ctx)
		);

		plugin.addCommand({
			id: 'custom-encrypt-in-place-encrypt',
			name: 'Encrypt Selection',
			icon: 'lock-keyhole',
			editorCheckCallback: (checking, editor, view) => this.processEncryptCommand( checking, editor )
		});

		plugin.addCommand({
			id: 'custom-encrypt-in-place-decrypt',
			name: 'Decrypt',
			icon: 'lock-keyhole-open',
			editorCheckCallback: (checking, editor, view) => this.processDecryptCommand( checking, editor )
		});

		this.plugin.addRibbonIcon(
			'lock-keyhole',
			'Encrypt Selection',
			(_) => {
				const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView == null ){
					return;
				}
				return this.processEncryptCommand(false, activeView.editor);
			}
		);

		this.plugin.addRibbonIcon(
			'lock-keyhole-open',
			'Decrypt at Cursor',
			(_) => {
				const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView == null ){
					return;
				}
				return this.processDecryptCommand(false, activeView.editor);
			}
		);

	}

	onunload(){

	}

	private static escapeRegExp( text: string ): string {
		return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	private buildReadingMarkerNode( encryptedText: string ): HTMLElement {
		return createSpan({
			cls: 'custom-encrypt-inline-reading-marker',
			text: ENCRYPTED_ICON,
			attr: {
				'data-custom-encrypt-encrypted' : encryptedText
			}
		});
	}

	private replaceInlineCodeMarkersInElement( el: HTMLElement ): void {
		let node = el.firstChild;
		while ( node != null ){
			const nextNode = node.nextSibling;
			if ( !(node instanceof Text) ){
				node = nextNode;
				continue;
			}

			const text = node.textContent ?? '';
			const markerStart = text.indexOf( ENCRYPTED_ICON );
			if ( markerStart < 0 ){
				node = nextNode;
				continue;
			}

			const codeNode = node.nextSibling;
			const markerEndNode = codeNode?.nextSibling;
			if (
				!(codeNode instanceof HTMLElement)
				|| codeNode.tagName.toLowerCase() !== 'code'
				|| !(markerEndNode instanceof Text)
			){
				node = nextNode;
				continue;
			}

			const markerEndText = markerEndNode.textContent ?? '';
			const markerEnd = markerEndText.indexOf( ENCRYPTED_ICON );
			if ( markerEnd < 0 ){
				node = nextNode;
				continue;
			}

			const encryptedText = `${ENCRYPTED_ICON}\`${codeNode.textContent ?? ''}\`${ENCRYPTED_ICON}`;
			const analysis = new FeatureInplaceTextAnalysis( encryptedText );
			if ( !analysis.canDecrypt ){
				node = nextNode;
				continue;
			}

			const beforeText = text.slice( 0, markerStart );
			const afterText = markerEndText.slice( markerEnd + ENCRYPTED_ICON.length );
			const parent = node.parentNode;
			if ( parent == null ){
				node = nextNode;
				continue;
			}

			if ( beforeText.length > 0 ){
				parent.insertBefore( new Text( beforeText ), node );
			}

			const markerNode = this.buildReadingMarkerNode( encryptedText );
			parent.insertBefore( markerNode, node );

			const afterNode = afterText.length > 0 ? new Text( afterText ) : null;
			if ( afterNode != null ){
				parent.insertBefore( afterNode, node );
			}

			node.remove();
			codeNode.remove();
			markerEndNode.remove();

			node = afterNode ?? markerNode.nextSibling;
		}
	}

	private replaceMarkersRecursive( node: Node, rlevel: number = 0 ) : Node[] {
		
		if ( node instanceof HTMLElement ){
			for( const n of Array.from(node.childNodes) ){
				var childNodes = this.replaceMarkersRecursive( n, rlevel+1 );
				n.replaceWith( ...childNodes );
			}
			this.replaceInlineCodeMarkersInElement( node );
			return [node];
		}

		if ( node instanceof Text ){
			
			const text = node.textContent;

			if ( text == null ){
				return [node];
			}

			if ( !text.contains( ENCRYPTED_ICON ) ){
				return [node];
			}

			const nodes : Node[] = [];
			const visiblePrefixPattern = _VISIBLE_PREFIXES
				.map( prefix => FeatureInplaceEncrypt.escapeRegExp( prefix ) )
				.join('|');
			const escapedSuffix = FeatureInplaceEncrypt.escapeRegExp( _SUFFIX_NO_COMMENT );
			const reInplaceMatcher = new RegExp( `(${visiblePrefixPattern})(.*?)${escapedSuffix}`, 'g' );

			let lastIndex = 0;
			for ( const match of text.matchAll( reInplaceMatcher ) ){
				const matchIndex = match.index ?? 0;
				if ( matchIndex > lastIndex ){
					nodes.push( new Text( text.slice(lastIndex, matchIndex) ) );
				}

				const encryptedText = match[0];
				const analysis = new FeatureInplaceTextAnalysis( encryptedText );
				if ( analysis.canDecrypt ){
					nodes.push( this.buildReadingMarkerNode( encryptedText ) );
				}else{
					nodes.push( new Text( encryptedText ) );
				}

				lastIndex = matchIndex + encryptedText.length;
			}

			if ( lastIndex < text.length ){
				nodes.push( new Text( text.slice(lastIndex) ) );
			}

			return nodes;

		}

		return [node];
	}

	private async processEncryptedCodeBlockProcessor(el: HTMLElement, ctx: MarkdownPostProcessorContext){
		const replacementNodes = this.replaceMarkersRecursive(el);
		el.replaceWith( ...replacementNodes );
		// bind events
		const elIndicators = el.querySelectorAll('.custom-encrypt-inline-reading-marker');
		this.bindReadingIndicatorEventHandlers( ctx.sourcePath, elIndicators );
	}

	private bindReadingIndicatorEventHandlers( sourcePath: string, elements: NodeListOf<Element> ){
		elements.forEach( el => {
			const htmlEl = el as HTMLElement;
			if ( htmlEl == null ){
				return;
			}
			
			htmlEl.onClickEvent( async (ev) => {
				const targetEl = ev.target as HTMLElement;
				if ( targetEl == null ){
					return;
				}
				const encryptedText = targetEl.dataset['customEncryptEncrypted'] as string;
				if ( encryptedText == null ){
					return;
				}
				const selectionAnalysis = new FeatureInplaceTextAnalysis( encryptedText );
				await this.handleReadingIndicatorClick( sourcePath, selectionAnalysis.decryptable );
			});
		} );
	}

	private async handleReadingIndicatorClick( path: string, decryptable?:Decryptable ){
		// indicator click handler
		if (decryptable == null){
			new Notice('❌ Decryption failed!');
			return;
		}

		if ( await this.showDecryptedTextIfPasswordKnown( path, decryptable ) ){
			return;
		}

		const pw = await this.fetchPasswordFromUser( decryptable.hint );

		if ( pw == null ){
			return;
		}

		const didDecrypt = await this.showDecryptedResultForPassword(
			decryptable,
			pw,
			() => SessionPasswordService.putByPath(
				{
					password: pw,
					hint: decryptable.hint
				},
				path
			)
		);
		if ( !didDecrypt ){
			new Notice('❌ Decryption failed!');
		}

	}
	
	private async showDecryptedResultForPassword(
		decryptable: Decryptable,
		pw:string,
		onDecryptSuccess?: () => void
	): Promise<boolean> {
		const crypto =  CryptoHelperFactory.BuildFromDecryptableOrThrow( decryptable );

		const decryptedText = await crypto.decryptFromBase64( decryptable.base64CipherText, pw );

		// show result
		if (decryptedText === null) {
			return false;
		}

		onDecryptSuccess?.();
		
		return new Promise<boolean>( (resolve) => {
			const decryptModal = new DecryptModal(this.plugin.app, '🔓', decryptedText );
			decryptModal.canDecryptInPlace = false;
			decryptModal.onClose = () =>{
				resolve(true);
			}
			decryptModal.open();
		} )
			
			
	}

	private async fetchPasswordFromUser( hint:string ): Promise<string|null|undefined> {
		// fetch password
		return new Promise<string|null|undefined>( (resolve) => {
			const pwModal = new PasswordModal(
				this.plugin.app,
				/*isEncrypting*/ false,
				/*confirmPassword*/ false,
				/*defaultShowInReadingView*/ this.featureSettings.showMarkerWhenReadingDefault,
				'',
				hint
			);

			pwModal.onClose = () =>{
				resolve( pwModal.resultPassword );
			}

			pwModal.open();


		} );
	}

	private async showDecryptedTextIfPasswordKnown( filePath: string, decryptable: Decryptable ) : Promise<boolean> {
		const bestGuessPasswordAndHint = await SessionPasswordService.peekByPathAsync(filePath);
		if ( bestGuessPasswordAndHint.password.length == 0 ){
			return false;
		}

		return await this.showDecryptedResultForPassword(
			decryptable,
			bestGuessPasswordAndHint.password,
			() => SessionPasswordService.touchByPath( filePath )
		);
	}

	public buildSettingsUi(
		containerEl: HTMLElement,
		saveSettingCallback : () => Promise<void>
	): void {
		new Setting(containerEl)
			.setHeading()
			.setName('In-place encryption')
		;

		new Setting(containerEl)
			.setName('Inline marker search limit')
			.setDesc('Maximum characters to scan before and after the cursor or selection when finding inline encryption markers. Increase this for very long encrypted blocks.')
			.addText( text => {
				text
					.setValue(this.featureSettings.markerSearchLimit?.toString() ?? '10000' )
					.onChange( async value => {
						const num = parseInt(value);
						if ( !isNaN(num) ){
							this.featureSettings.markerSearchLimit = num;
							await saveSettingCallback();
						}
					})
				;
				text.inputEl.type = 'number';
				text.inputEl.min = '1000';
				text.inputEl.max = '9999999';
			})

		new Setting(containerEl)
			.setName('Show inline encryption markers in Reading view by default')
			.setDesc('Default for new inline encryption only. On shows lock markers in Reading view; off hides them with Markdown comments.')
			.addToggle( toggle =>{
				toggle
					.setValue(this.featureSettings.showMarkerWhenReadingDefault)
					.onChange( async value =>{
						this.featureSettings.showMarkerWhenReadingDefault = value;
						await saveSettingCallback();
					})
			})
		;
	}
	private processEncryptCommand(
		checking: boolean,
		editor: Editor
	): boolean {
		if ( checking && UiHelper.isSettingsModalOpen() ){
			// Settings is open, ensures this command can show up in other
			// plugins which list commands e.g. customizable-sidebar
			return true;
		}

		let startPos = editor.getCursor('from');
		let endPos = editor.getCursor('to');

		const nothingSelected = !editor.somethingSelected();
		if ( nothingSelected){
			if (!checking){
				new Notice('Please select text to encrypt.');
			}
			return false;
		}

		// check we are not within encrypted text or have selected encrypted text

		const foundStartMarkerPos = this.getClosestPrefixCursorPos( editor, startPos );
		const foundEndMarkerPos = this.getClosestSuffixCursorPos( editor, startPos );

		if ( foundStartMarkerPos != null && foundEndMarkerPos != null && foundStartMarkerPos.line === foundEndMarkerPos.line ){

			// start pos checks
			// check if the start position is within the encrypted text
			if ( startPos.line === foundStartMarkerPos.line && startPos.ch >= foundStartMarkerPos.ch && startPos.ch < foundEndMarkerPos.ch ){
				// the start position is within the encrypted text, so we do not encrypt
				return false;
			}

			// end pos checks
			// check if the end position is within the encrypted text
			if ( endPos.line === foundEndMarkerPos.line && endPos.ch >= foundStartMarkerPos.ch && endPos.ch < foundEndMarkerPos.ch ){
				// the end position is within the encrypted text, so we do not encrypt
				return false;
			}
			
		}
			
		// get selection to encrypt
		const selectionText = editor.getRange(startPos, endPos);

		// check have not selected encrypted text or part of it
		if ( selectionText.includes( ENCRYPTED_ICON ) ){
			return false; // do not encrypt within encrypted text
		}
		
		return this.processSelection(
			checking,
			editor,
			selectionText,
			startPos,
			endPos,
			EncryptOrDecryptMode.Encrypt
		);
	}

	private processDecryptCommand(
		checking: boolean,
		editor: Editor
	): boolean {

		if ( checking && UiHelper.isSettingsModalOpen() ){
			// Settings is open, ensures this command can show up in other
			// plugins which list commands e.g. customizable-sidebar
			return true;
		}

		let startPos = editor.getCursor('from');
		let endPos = editor.getCursor('to');

		const nothingSelected = !editor.somethingSelected();

		if ( nothingSelected ){
			// nothing selected, first assume user wants to decrypt, expand to start and end markers...
			// but if no markers found then ask the user to select encrypted text
			const foundStartPos = this.getClosestPrefixCursorPos( editor, startPos );
			const foundEndPos = this.getClosestSuffixCursorPos( editor, startPos );

			if (
				foundStartPos == null
				|| foundEndPos == null
				|| ( startPos.line < foundStartPos.line )
				|| ( endPos.line > foundEndPos.line )
			){
				if( !checking ){
					new Notice('Please select text to decrypt or place cursor on encrypted text.');
				}
				return false;
			}

			startPos = foundStartPos;
			endPos = foundEndPos;
		}

		// Encrypt or Decrypt selected text
		let selectionText = editor.getRange(startPos, endPos);

		const decryptableRange = this.findDecryptableRangeInSelection(editor, startPos, endPos);
		if ( decryptableRange != null ){
			startPos = decryptableRange.start;
			endPos = decryptableRange.end;
			selectionText = decryptableRange.text;
		}

		return this.processSelection(
			checking,
			editor,
			selectionText,
			startPos,
			endPos,
			EncryptOrDecryptMode.Decrypt
		);
	}

	private findDecryptableRangeInSelection(
		editor: Editor,
		selectionStart: EditorPosition,
		selectionEnd: EditorPosition
	): { start: EditorPosition, end: EditorPosition, text: string } | null {
		const selectionText = editor.getRange(selectionStart, selectionEnd);
		const selectionStartOffset = editor.posToOffset(selectionStart);

		for (let prefixStart = 0; prefixStart < selectionText.length; prefixStart++) {
			for (const prefix of _PREFIXES) {
				if (!selectionText.startsWith(prefix, prefixStart)){
					continue;
				}

				const contentStart = prefixStart + prefix.length;
				for (const suffix of _SUFFIXES) {
					const suffixStart = selectionText.indexOf(suffix, contentStart);
					if (suffixStart < 0){
						continue;
					}

					const suffixEnd = suffixStart + suffix.length;
					const text = selectionText.slice(prefixStart, suffixEnd);
					const analysis = new FeatureInplaceTextAnalysis(text);
					if (!analysis.canDecrypt){
						continue;
					}

					return {
						start: editor.offsetToPos(selectionStartOffset + prefixStart),
						end: editor.offsetToPos(selectionStartOffset + suffixEnd),
						text,
					};
				}
			}
		}

		return null;
	}

	private getClosestPrefixCursorPos( editor: Editor, fromEditorPosition: EditorPosition ): EditorPosition | null{
		
		const maxLookback = this.featureSettings.markerSearchLimit;

		const maxLengthPrefix = _PREFIXES.reduce((prev,cur, i) => {
			if (i== 0) return cur;
			if ( cur.length > prev.length ) return cur;
			return prev;
		} );
		const initOffset = editor.posToOffset( fromEditorPosition ) + maxLengthPrefix.length;

		const minOffset = Math.max(initOffset - maxLookback, 0);

		for (let offset = initOffset; offset >= minOffset; offset--) {
			const offsetPos = editor.offsetToPos(offset);
			for (const prefix of _PREFIXES) {
				const prefixStartOffset = offset - prefix.length;
				const prefixStartPos = editor.offsetToPos(prefixStartOffset);
			
				const testText = editor.getRange( prefixStartPos, offsetPos );

				if (testText == prefix){
					return editor.offsetToPos(prefixStartOffset);
				}
			}
		}

		return null;

	}

	private getClosestSuffixCursorPos( editor: Editor, fromEditorPosition:EditorPosition ): EditorPosition | null{
		const maxLookForward = this.featureSettings.markerSearchLimit;

		const maxLengthPrefix = _PREFIXES.reduce((prev,cur, i) => {
			if (i== 0) return cur;
			if ( cur.length > prev.length ) return cur;
			return prev;
		} );
		
		const initOffset = editor.posToOffset( fromEditorPosition ) - maxLengthPrefix.length + 1;
		const lastLineNum = editor.lastLine();

		const maxOffset = Math.min( initOffset + maxLookForward, editor.posToOffset( {line:lastLineNum, ch:editor.getLine(lastLineNum).length} ) );

		for (let offset = initOffset; offset <= maxOffset; offset++) {
			const offsetPos = editor.offsetToPos(offset);
			for (const suffix of _SUFFIXES) {	
				const textEndOffset = offset + suffix.length;
				const textEndPos = editor.offsetToPos(textEndOffset);
				
				const testText = editor.getRange( offsetPos, textEndPos );
				
				if (testText == suffix){
					return textEndPos;
				}
			}
		}
		
		return null;
	}

	private processSelection(
		checking: boolean,
		editor: Editor,
		selectionText: string,
		finalSelectionStart: CodeMirror.Position,
		finalSelectionEnd: CodeMirror.Position,
		mode:EncryptOrDecryptMode
	) : boolean {
		const selectionAnalysis = new FeatureInplaceTextAnalysis( selectionText );

		if (selectionAnalysis.isEmpty) {
			if (!checking){
				new Notice(`Nothing to ${mode == EncryptOrDecryptMode.Encrypt ? "Encrypt" : "Decrypt"}.`);
			}
			return false;
		}

		if ( mode == EncryptOrDecryptMode.Encrypt && !selectionAnalysis.canEncrypt ) {
			if (!checking){
				new Notice('Unable to Encrypt that.');
			}
			return false;
		}

		if ( mode == EncryptOrDecryptMode.Decrypt && !selectionAnalysis.canDecrypt ) {
			if (!checking){
				new Notice('Unable to Decrypt that.');
			}
			return false;
		}

		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (activeFile == null){
			return false;
		}

		if (checking) {
			return true;
		}

		
		// Fetch password from user

		// determine default password and hint
		let defaultPassword = '';
		let defaultHint = selectionAnalysis.decryptable?.hint;
		let defaultPasswordCameFromCache = false;
		if ( this.pluginSettings.rememberPassword ){
			const bestGuessPasswordAndHint = SessionPasswordService.peekByPath( activeFile.path );

			defaultPassword = bestGuessPasswordAndHint.password;
			defaultPasswordCameFromCache = defaultPassword.length > 0;
			defaultHint = defaultHint ?? bestGuessPasswordAndHint.hint;
		}

		const confirmPassword = selectionAnalysis.canEncrypt && this.pluginSettings.confirmPassword;

		const pwModal = new PasswordModal(
			this.plugin.app,
			selectionAnalysis.canEncrypt,
			confirmPassword,
			/*defaultShowInReadingView*/ this.featureSettings.showMarkerWhenReadingDefault,
			defaultPassword,
			defaultHint
		);

		pwModal.onClose = async () => {
			if ( !pwModal.resultConfirmed ){
				return;
			}
			const pw = pwModal.resultPassword ?? ''
			const hint = pwModal.resultHint ?? '';

			if (
				defaultPasswordCameFromCache
				&& !SessionPasswordService.hasUnexpiredByPath( activeFile.path )
			) {
				new Notice('Remembered password expired. Please run the command again.');
				return;
			}

			if (selectionAnalysis.canEncrypt) {

				const encryptable = new Encryptable();
				encryptable.text = selectionText;
				encryptable.hint = hint;

				await this.encryptSelection(
					editor,
					encryptable,
					pw,
					finalSelectionStart,
					finalSelectionEnd,
					pwModal.resultShowInReadingView ?? this.featureSettings.showMarkerWhenReadingDefault
				);

				// remember password
				this.rememberPasswordAfterSuccessfulInlineUse(
					activeFile.path,
					pw,
					hint,
					defaultPassword,
					defaultPasswordCameFromCache
				);

			} else if ( selectionAnalysis.decryptable ) {

				const decryptSuccess = await this.decryptSelection(
					editor,
					selectionAnalysis.decryptable,
					pw,
					finalSelectionStart,
					finalSelectionEnd,
				);

				// remember password?
				if ( decryptSuccess ) {
					this.rememberPasswordAfterSuccessfulInlineUse(
						activeFile.path,
						pw,
						hint,
						defaultPassword,
						defaultPasswordCameFromCache
					);
				}
				
			}
		}
		pwModal.open();

		return true;
	}

	private rememberPasswordAfterSuccessfulInlineUse(
		path: string,
		password: string,
		hint: string,
		defaultPassword: string,
		defaultPasswordCameFromCache: boolean
	): void {
		if (
			defaultPasswordCameFromCache
			&& password == defaultPassword
			&& SessionPasswordService.touchByPath( path )
		) {
			return;
		}

		SessionPasswordService.putByPath( { password, hint }, path );
	}

	private async encryptSelection(
		editor: Editor,
		encryptable: Encryptable,
		password: string,
		finalSelectionStart: CodeMirror.Position,
		finalSelectionEnd: CodeMirror.Position,
		showInReadingView: boolean
	) {
		//encrypt
		const crypto = CryptoHelperFactory.BuildDefault();
		const encodedText = this.encodeEncryption(
			await crypto.encryptToBase64(encryptable.text, password),
			encryptable.hint,
			showInReadingView
		);
		editor.setSelection(finalSelectionStart, finalSelectionEnd);
		editor.replaceSelection(encodedText);
	}

	private async decryptSelection(
		editor: Editor,
		decryptable: Decryptable,
		password: string,
		selectionStart: CodeMirror.Position,
		selectionEnd: CodeMirror.Position
	) : Promise<boolean> {

		// decrypt

		const crypto = CryptoHelperFactory.BuildFromDecryptableOrThrow(decryptable);
		const decryptedText = await crypto.decryptFromBase64(decryptable.base64CipherText, password);
		if (decryptedText === null) {
			new Notice('❌ Decryption failed!');
			return false;
		} else {

			const decryptModal = new DecryptModal(this.plugin.app, '🔓', decryptedText );
			decryptModal.onClose = async () => {
				editor.focus();
				if (decryptModal.decryptInPlace) {
					editor.setSelection(selectionStart, selectionEnd);
					editor.replaceSelection(decryptModal.text);
				} else if (decryptModal.save) {
					const crypto = CryptoHelperFactory.BuildDefault();
					const encodedText = this.encodeEncryption(
						await crypto.encryptToBase64(decryptModal.text, password),
						decryptable.hint ?? "",
						decryptable.showInReadingView
					);
					editor.setSelection(selectionStart, selectionEnd);
					editor.replaceSelection(encodedText);
				}
			}
			decryptModal.open();

		}
		return true;
	}

	private encodeEncryption( encryptedText: string, hint: string, showInReadingView: boolean ): string {
		if (
			!_PREFIXES.some( (prefix) => encryptedText.includes(prefix) )
			&& !_SUFFIXES.some( (suffix) => encryptedText.includes(suffix) )
		) {
			const prefix = showInReadingView ? _PREFIX_ENCODE_DEFAULT_VISIBLE : _PREFIX_ENCODE_DEFAULT;
			const suffix = showInReadingView ? _SUFFIX_NO_COMMENT : _SUFFIX_WITH_COMMENT;

			if ( hint.length > 0 ){
				return prefix.concat(_HINT, hint, _HINT, encryptedText, suffix);
			}
			return prefix.concat(encryptedText, suffix);
		}
		return encryptedText;
	}
}

class Encryptable{
	text:string;
	hint:string;
}
