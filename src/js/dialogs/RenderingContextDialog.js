import { AbstractDialog } from './AbstractDialog.js';

const spec = await fetch('./uispecs/RenderingContextDialog.json').then(response => response.json());

export class RenderingContextDialog extends AbstractDialog {

constructor(options) {
    super(spec, options);

    this._handleResolutionChange = this._handleResolutionChange.bind(this);
    this._handleTransformationChange = this._handleTransformationChange.bind(this);
    this._handleFilterChange = this._handleFilterChange.bind(this);
    this._handleNoiseSizeChange = this._handleNoiseSizeChange.bind(this);

    this._binds.resolution.addEventListener('change', this._handleResolutionChange);
    this._binds.noise_size.addEventListener('change', this._handleNoiseSizeChange);
    this._binds.scale.addEventListener('input', this._handleTransformationChange);
    this._binds.translation.addEventListener('input', this._handleTransformationChange);
    this._binds.filter.addEventListener('change', this._handleFilterChange);
}

get resolution() {
    return this._binds.resolution.getValue();
}

get noiseSize() {
    return this._binds.noise_size.getValue();
}

get scale() {
    return this._binds.scale.getValue();
}

get translation() {
    return this._binds.translation.getValue();
}

get filter() {
    return this._binds.filter.isChecked() ? 'linear' : 'nearest';
}

_handleResolutionChange() {
    this.dispatchEvent(new Event('resolution'));
}

_handleTransformationChange() {
    this.dispatchEvent(new Event('transformation'));
}

_handleFilterChange() {
    this.dispatchEvent(new Event('filter'));
}

_handleNoiseSizeChange() {
    this.dispatchEvent(new Event('noiseSize'));
}

}
