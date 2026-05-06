import { App, Modal, Notice, Setting, TextAreaComponent } from 'obsidian';
import {
	createTranslator,
	DEFAULT_SETTINGS_LANGUAGE,
	Translator,
} from '../../i18n.ts';

export default class DecryptModal extends Modal {
	text: string;
	decryptInPlace = false;
	save = false;
	private t: Translator;
	
	canDecryptInPlace = true;

	constructor(
		app: App,
		title: string,
		text = '',
		t: Translator = createTranslator(DEFAULT_SETTINGS_LANGUAGE)
	) {
		super(app);
		this.titleEl.setText(title);
		this.text = text;
		this.t = t;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.classList.add('custom-encrypt-decrypt-modal');

		let cTextArea : TextAreaComponent;
		const sText = new Setting(contentEl)
			.addTextArea( cb=>{
				cTextArea = cb;
				cb.setValue(this.text);
				cb.inputEl.setSelectionRange(0,0)
				cb.inputEl.rows = 10;
			})
		;
		sText.settingEl.querySelector('.setting-item-info')?.remove();

		const sActions = new Setting(contentEl);

		sActions
			.addButton(cb => {
				cb
					.setButtonText(this.t('modal.button.save'))
					.onClick( evt =>{
						this.save = true;
						this.text = cTextArea.getValue();
						this.close();
					});
			});

		sActions
			.addButton( cb =>{
				cb
					.setButtonText(this.t('modal.button.copy'))
					.onClick( evt =>{
						navigator.clipboard.writeText( cTextArea.getValue() );
						new Notice(this.t('modal.notice.copied'));
					})
				;
			})
		;
		if (this.canDecryptInPlace){
			sActions.addButton( cb =>{
				cb.setWarning()
				.setButtonText(this.t('modal.button.decryptInPlace'))
				.onClick( evt =>{
					this.decryptInPlace = true;
					this.text = cTextArea.getValue();
					this.close();
				});
			});
		}

	}

}
