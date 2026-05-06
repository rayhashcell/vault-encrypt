import { App, Modal, Setting, TextComponent } from 'obsidian';
import { UiHelper } from '../../services/UiHelper.ts';
import {
	createTranslator,
	DEFAULT_SETTINGS_LANGUAGE,
	Translator,
} from '../../i18n.ts';

export default class PasswordModal extends Modal {
	
	// input
	private defaultPassword?: string | null = null;
	private defaultHint: string;
	private confirmPassword: boolean;
	private isEncrypting: boolean;
	private t: Translator;
	public showInReadingView: boolean;

	// output
	public resultConfirmed = false;
	public resultPassword?: string | null = null;
	public resultHint: string;
	public resultShowInReadingView?: boolean | null = null;

	constructor(
		app: App,
		isEncrypting:boolean,
		confirmPassword: boolean,
		defaultShowInReadingView: boolean,
		defaultPassword: string | null = null,
		hint:string | null = null,
		t: Translator = createTranslator(DEFAULT_SETTINGS_LANGUAGE)
	) {
		super(app);
		this.defaultPassword = defaultPassword;
		this.confirmPassword = confirmPassword;
		this.showInReadingView = defaultShowInReadingView
		this.isEncrypting = isEncrypting;
		this.defaultHint = hint ?? '';
		this.t = t;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.classList.add('custom-encrypt-password-modal');

		this.invalidate();

		let password = this.defaultPassword ?? '';
		let confirmPass = '';
		let hint = this.defaultHint;
		let showInReadingView = this.showInReadingView;

		new Setting(contentEl).setHeading().setName(
			this.isEncrypting
				? this.t('modal.title.encrypting')
				: this.t('modal.title.decrypting')
		);

		/* Main password input*/

		UiHelper.buildPasswordSetting({
			container: contentEl,
			name: this.t('modal.password.name'),
			placeholder: ( this.isEncrypting || hint.length == 0 )
				? ''
				: this.t('modal.password.hintPlaceholder', { hint }),
			showPasswordTooltip: this.t('modal.password.showPasswordTooltip'),
			hidePasswordTooltip: this.t('modal.password.hidePasswordTooltip'),
			initialValue: password,
			autoFocus: true,
			onChangeCallback: (value) => {
				password = value;
				this.invalidate();
			},
			onEnterCallback: (value) =>{
				password = value;
				this.invalidate();
				
				if (password.length > 0){
					if (sConfirmPassword.settingEl.isShown()){
						//tcConfirmPassword.inputEl.focus();
						const elInp = sConfirmPassword.components.find( (bc) => bc instanceof TextComponent );
						if ( elInp instanceof TextComponent ){
							elInp.inputEl.focus();
						}

					}else if (sHint.settingEl.isShown()){
						//tcHint.inputEl.focus();
						const elInp = sHint.components.find( (bc) => bc instanceof TextComponent );
						if ( elInp instanceof TextComponent ){
							elInp.inputEl.focus();
						}
					}else if( validate() ){
						this.close();
					}
				}
			}
		});

		/* End Main password input row */

		/* Confirm password input row */
		const sConfirmPassword = UiHelper.buildPasswordSetting({
			container : contentEl,
			name: this.t('modal.confirmPassword.name'),
			showPasswordTooltip: this.t('modal.password.showPasswordTooltip'),
			hidePasswordTooltip: this.t('modal.password.hidePasswordTooltip'),
			onChangeCallback: (value) => {
				confirmPass = value;
				this.invalidate();
			},
			onEnterCallback: (value) =>{
				confirmPass = value;
				this.invalidate();
				if (confirmPass.length > 0){
					if ( validate() ){
						if ( sHint.settingEl.isShown() ){
							//tcHint.inputEl.focus();
							const elInp = sHint.components.find( (bc) => bc instanceof TextComponent );
							if ( elInp instanceof TextComponent ){
								elInp.inputEl.focus();
							}
						}
					}
				}
			}
		});

		if ( !this.confirmPassword ){
			sConfirmPassword.settingEl.hide();
		}
		
		/* End Confirm password input row */

		/* Hint input row */
		const sHint = new Setting(contentEl)
			.setName(this.t('modal.optionalPasswordHint.name'))
			.addText( tc=>{
				//tcHint = tc;
				tc.inputEl.placeholder = this.t('modal.optionalPasswordHint.placeholder');
				tc.setValue(hint);
				tc.onChange( v=> hint = v );
				tc.inputEl.on('keypress', '*', (ev, target) => {
					if (
						ev.key == 'Enter'
						&& target instanceof HTMLInputElement
						&& target.value.length > 0
					) {
						ev.preventDefault();
						if ( validate() ){
							this.close();
						}
					}
				});
			})
		;
		if (!this.isEncrypting){
			sHint.settingEl.hide();
		}

		/* END Hint text row */

		/* Show indicator in reading mode */
		const sShowWhenReading = new Setting(contentEl)
			.setName(this.t('modal.showEncryptedMarkerInReadingView.name'))
			.addToggle( cb=>{
				cb
					.setValue( showInReadingView )
					.onChange( value => {
						showInReadingView = value;
					}
				)
			} )
		;
		if (!this.isEncrypting){
			sShowWhenReading.settingEl.hide();
		}
		/* END Show indicator in reading mode */


		new Setting(contentEl).addButton( cb=>{
			cb
				.setButtonText(this.t('modal.button.confirm'))
				.onClick( evt =>{
					if (validate()){
						this.close();
					}
				})
			;
		});

		const validate = () : boolean => {
			this.invalidate();

			sConfirmPassword.setDesc('');
			sHint.setDesc('');

			if ( this.confirmPassword ){
				if (password != confirmPass){
					// passwords don't match
					sConfirmPassword.setDesc(this.t('modal.validation.passwordsDontMatch'));
					return false;
				}
			}

			if ( this.isEncrypting && hint.includes('`') ){
				sHint.setDesc(this.t('modal.validation.passwordHintCannotContainBackticks'));
				return false;
			}

			this.resultConfirmed = true;
			this.resultPassword = password;
			this.resultHint = hint;
			this.resultShowInReadingView = showInReadingView;

			return true;
		}

	}

	private invalidate(){
		this.resultConfirmed = false;
		this.resultPassword = null;
		this.resultHint = '';
	}

}
