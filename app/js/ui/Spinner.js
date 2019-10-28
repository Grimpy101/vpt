//@@../utils
//@@UIObject.js

(function(global) {
'use strict';

var Class = global.Spinner = Spinner;
CommonUtils.inherit(Class, UIObject);
var _ = Class.prototype;

// ========================== CLASS DECLARATION ============================ //

function Spinner(options) {
    _.sup.constructor.call(this, TEMPLATES.Spinner, options);
    CommonUtils.extend(this, Class.defaults, options);

    this._handleInput = this._handleInput.bind(this);
    this._handleChange = this._handleChange.bind(this);

    _._init.call(this);
};

Class.defaults = {
    value : 0,
    min   : null,
    max   : null,
    step  : 1,
    unit  : null, // TODO: add a label with units at the end of input
    // If logarithmic, step size is proportional to value * this.step
    logarithmic : false
};

// ======================= CONSTRUCTOR & DESTRUCTOR ======================== //

_._nullify = function() {
};

_._init = function() {
    _._nullify.call(this);

    var input = this._binds.input;
    if (this.value !== null) {
        input.value = this.value;
    }
    if (this.min !== null) {
        input.min = this.min;
    }
    if (this.max !== null) {
        input.max = this.max;
    }
    if (this.step !== null) {
        input.step = this.step;
    }

    input.addEventListener('input', this._handleInput);
    input.addEventListener('change', this._handleChange);
};

_.destroy = function() {
    _._nullify.call(this);
    _.sup.destroy.call(this);
};

// =========================== INSTANCE METHODS ============================ //

_.setEnabled = function(enabled) {
    this._binds.input.disabled = !enabled;
    _.sup.setEnabled.call(this, enabled);
};

_.setValue = function(value) {
    this.value = value;
    if (this.min !== null) {
        this.value = Math.max(this.value, this.min);
    }
    if (this.max !== null) {
        this.value = Math.min(this.value, this.max);
    }
    if (this.logarithmic) {
        this._binds.input.step = this.value * this.step;
    }
    this._binds.input.value = this.value;
};

_.getValue = function() {
    return this.value;
};

_._handleInput = function(e) {
    e.stopPropagation();

    if (this._binds.input.value === '') {
        return;
    }

    var parsedValue = parseFloat(this._binds.input.value);
    if (!isNaN(parsedValue)) {
        this.setValue(parsedValue);
        this.trigger('input');
    } else {
        this._binds.input.value = parsedValue;
    }
};

_._handleChange = function(e) {
    e.stopPropagation();

    var parsedValue = parseFloat(this._binds.input.value);
    if (!isNaN(parsedValue)) {
        this.setValue(parsedValue);
        if (this._binds.input.value !== this.value) {
            this._binds.input.value = this.value;
            this.trigger('change');
        }
    } else {
        this._binds.input.value = this.value;
    }
};

// ============================ STATIC METHODS ============================= //

})(this);
