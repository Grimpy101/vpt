import { UIObject } from './UIObject.js';

const response = await fetch('./html/ui/FileChooser.html');
const template = await response.text();

export class FileChooser extends UIObject {

constructor(options) {
    super(template, options);

    this._handleChange = this._handleChange.bind(this);
    this._handleClick = this._handleClick.bind(this);

    this._element.addEventListener('click', this._handleClick);
    this._binds.input.addEventListener('change', this._handleChange);
}

_handleChange() {
    if (this._binds.input.files.length > 0) {
        const fileName = this._binds.input.files[0].name;
        this._binds.label.textContent = fileName;
    } else {
        this._binds.label.textContent = '';
    }
}

_handleClick() {
    this._binds.input.click();
}

getFiles() {
    return this._binds.input.files;
}

}
