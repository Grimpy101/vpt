import { UIObject } from './UIObject.js';

const response = await fetch('./html/ui/Accordion.html');
const template = await response.text();

export class Accordion extends UIObject {

constructor(options) {
    super(template, options);

    Object.assign(this, {
        label      : '',
        contracted : false
    }, options);

    this._handleClick = this._handleClick.bind(this);

    this._binds.handle.textContent = this.label;
    this._binds.handle.addEventListener('click', this._handleClick);
    this.setContracted(this.contracted);
}

add(object) {
    object.appendTo(this._binds.container);
}

setContracted(contracted) {
    this.contracted = contracted;
    this._element.classList.toggle('contracted', contracted);
}

expand() {
    if (!this.contracted) {
        return;
    }

    this.setContracted(false);
}

contract() {
    if (this.contracted) {
        return;
    }

    this.setContracted(true);
}

toggleContracted() {
    this.setContracted(!this.contracted);
}

_handleClick() {
    if (this.enabled) {
        this.toggleContracted();
    }
}

}
