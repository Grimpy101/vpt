import { AbstractDialog } from './AbstractDialog.js';

const spec = await fetch('./uispecs/TFGalleryDialog.json').then(response => response.json());

export class TFGalleryDialog extends AbstractDialog {

    constructor(options) {
        super(spec, options);

        this._handlePrevious = this._handlePrevious.bind(this);
        this._handleNext = this._handleNext.bind(this);
        this._handleFinish = this._handleFinish.bind(this);

        this._addEventListeners();
    }

    _addEventListeners() {
        this._binds.prevButton.addEventListener('click', this._handlePrevious);
        this._binds.nextButton.addEventListener('click', this._handleNext);
        this._binds.confirmButton.addEventListener('click', this._handleFinish);
    }

    _handlePrevious() {
        this.dispatchEvent(new CustomEvent('goback'));
    }

    _handleNext() {
        this.dispatchEvent(new CustomEvent('goforth'));
    }

    _handleFinish() {
        this.dispatchEvent(new CustomEvent('finish'));
    }
}