//@@utils
//@@math
//@@WebGL.js
//@@Ticker.js
//@@Camera.js
//@@OrbitCameraController.js
//@@Volume.js
//@@EventEmitter.js
//@@renderers
//@@tonemappers

(function(global) {
'use strict';

var Class = global.RenderingContext = RenderingContext;
var _ = Class.prototype;
CommonUtils.extend(_, EventEmitter);

// ========================== CLASS DECLARATION ============================ //

function RenderingContext(options) {
    CommonUtils.extend(this, Class.defaults, options);

    this._render = this._render.bind(this);
    this._webglcontextlostHandler = this._webglcontextlostHandler.bind(this);
    this._webglcontextrestoredHandler = this._webglcontextrestoredHandler.bind(this);

    _._init.call(this);
};

Class.defaults = {
    _resolution : 512,
    _filter     : 'linear'
};

// ======================= CONSTRUCTOR & DESTRUCTOR ======================== //

_._nullify = function() {
    this._canvas                = null;
    this._camera                = null;
    this._cameraController      = null;
    this._renderer              = null;
    this._toneMapper            = null;
    this._scale                 = null;
    this._translation           = null;
    this._isTransformationDirty = null;

    this._nullifyGL();
};

_._init = function() {
    _._nullify.call(this);

    this._canvas = document.createElement('canvas');
    this._initGL();

    this._camera = new Camera();
    this._camera.position.z = 1.5;
    this._camera.fovX = 0.3;
    this._camera.fovY = 0.3;
    this._camera.updateMatrices();

    this._cameraController = new OrbitCameraController(this._camera, this._canvas);

    var loader = new BlobLoader();
    this._volume = new Volume(this._gl);

    this._contextRestorable = true;

    this._canvas.addEventListener('webglcontextlost', this._webglcontextlostHandler);
    this._canvas.addEventListener('webglcontextrestored', this._webglcontextrestoredHandler);

    this._scale = new Vector(1, 1, 1);
    this._translation = new Vector(0, 0, 0);
    this._isTransformationDirty = true;

    this._updateMvpInverseMatrix();
};

_.destroy = function() {
    this.stopRendering();

    this._volume.destroy();
    if (this._toneMapper) {
        this._toneMapper.destroy();
    }
    if (this._renderer) {
        this._renderer.destroy();
    }
    this._cameraController.destroy();
    this._camera.destroy();

    this._destroyGL();

    this._canvas.removeEventListener('webglcontextlost', this._webglcontextlostHandler);
    this._canvas.removeEventListener('webglcontextrestored', this._webglcontextrestoredHandler);

    if (this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
    }

    _._nullify.call(this);
};

// ============================ WEBGL SUBSYSTEM ============================ //

_._nullifyGL = function() {
    this._gl                  = null;
    this._hasCompute          = null;
    this._volume              = null;
    this._environmentTexture  = null;
    this._transferFunction    = null;
    this._program             = null;
    this._clipQuad            = null;
    this._extLoseContext      = null;
    this._extColorBufferFloat = null;
};

_._initGL = function() {
    this._nullifyGL();

    var contextSettings = {
        alpha                 : false,
        depth                 : false,
        stencil               : false,
        antialias             : false,
        preserveDrawingBuffer : true,
    };

    try {
        this._gl = WebGL.getContext(this._canvas, ['webgl2-compute'], contextSettings);
    } catch (err) {
    }
    if (this._gl) {
        this._hasCompute = true;
    } else {
        this._hasCompute = false;
        this._gl = WebGL.getContext(this._canvas, ['webgl2'], contextSettings);
    }
    var gl = this._gl;
    this._extLoseContext = gl.getExtension('WEBGL_lose_context');
    this._extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');

    if (!this._extColorBufferFloat) {
        console.error('EXT_color_buffer_float not supported!');
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    this._environmentTexture = WebGL.createTexture(gl, {
        width          : 1,
        height         : 1,
        data           : new Uint8Array([255, 255, 255, 255]),
        format         : gl.RGBA,
        internalFormat : gl.RGBA, // TODO: HDRI & OpenEXR support
        type           : gl.UNSIGNED_BYTE,
        wrapS          : gl.CLAMP_TO_EDGE,
        wrapT          : gl.CLAMP_TO_EDGE,
        min            : gl.LINEAR,
        max            : gl.LINEAR
    });

    this._program = WebGL.buildPrograms(gl, {
        quad: SHADERS.quad
    }, MIXINS).quad;

    this._clipQuad = WebGL.createClipQuad(gl);
};

_._destroyGL = function() {
    var gl = this._gl;
    if (!gl) {
        return;
    }

    gl.deleteProgram(this._program.program);
    gl.deleteBuffer(this._clipQuad);

    this._contextRestorable = false;
    if (this._extLoseContext) {
        this._extLoseContext.loseContext();
    }
    this._nullifyGL();
};

_._webglcontextlostHandler = function(e) {
    if (this._contextRestorable) {
        e.preventDefault();
    }
    this._nullifyGL();
};

_._webglcontextrestoredHandler = function(e) {
    this._initGL();
};

// =========================== INSTANCE METHODS ============================ //

_.resize = function(width, height) {
    var gl = this._gl;
    if (!gl) {
        return;
    }

    this._canvas.width = width;
    this._canvas.height = height;
    this._camera.resize(width, height);
};

_.setVolume = function(reader) {
    var gl = this._gl;
    if (!gl) {
        return;
    }

    var volume = this._volume = new Volume(this._gl, reader);

    volume.readMetadata({
        onData: function() {
            if (volume.settings) {
                this.trigger('settings', volume.settings);
            }
            volume.readModality('default', {
                onLoad: function() {
                    volume.setFilter(this._filter);
                    if (this._renderer) {
                        this._renderer.setVolume(volume);
                        this.startRendering();
                    }
                }.bind(this)
            });
        }.bind(this)
    });
};

_.setEnvironmentMap = function(image) {
    var gl = this._gl;
    if (!gl) {
        return;
    }

    // TODO: texture class, to avoid duplicating texture specs
    gl.bindTexture(gl.TEXTURE_2D, this._environmentTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl. RGBA,
        image.width, image.height,
        0, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.bindTexture(gl.TEXTURE_2D, null);
};

_.setFilter = function(filter) {
    this._filter = filter;
    if (this._volume) {
        this._volume.setFilter(filter);
        if (this._renderer) {
            this._renderer.reset();
        }
    }
};

_.chooseRenderer = function(renderer) {
    if (this._renderer) {
        this._renderer.destroy();
    }
    var gl = this._gl;
    var volume = this._volume;
    var env = this._environmentTexture;
    switch (renderer) {
        case 'mip' : this._renderer = new MIPRenderer(gl, volume, env); break;
        case 'iso' : this._renderer = new ISORenderer(gl, volume, env); break;
        case 'eam' : this._renderer = new EAMRenderer(gl, volume, env); break;
        case 'mcs' : this._renderer = new MCSRenderer(gl, volume, env); break;
        case 'mcm' : this._renderer = new MCMRenderer(gl, volume, env); break;
        case 'mcc' : this._renderer = new MCCRenderer(gl, volume, env); break;
    }
    if (this._toneMapper) {
        this._toneMapper.setTexture(this._renderer.getTexture());
    }
    this._isTransformationDirty = true;
};

_.chooseToneMapper = function(toneMapper) {
    if (this._toneMapper) {
        this._toneMapper.destroy();
    }
    var gl = this._gl;
    if (this._renderer) {
        var texture = this._renderer.getTexture();
    } else {
        var texture = WebGL.createTexture(gl, {
            width  : 1,
            height : 1,
            data   : new Uint8Array([255, 255, 255, 255]),
        });
    }
    switch (toneMapper) {
        case 'range'    : this._toneMapper = new RangeToneMapper(gl, texture); break;
        case 'reinhard' : this._toneMapper = new ReinhardToneMapper(gl, texture); break;
        case 'artistic' : this._toneMapper = new ArtisticToneMapper(gl, texture); break;
    }
};

_.getCanvas = function() {
    return this._canvas;
};

_.getRenderer = function() {
    return this._renderer;
};

_.getToneMapper = function() {
    return this._toneMapper;
};

_._updateMvpInverseMatrix = function() {
    if (this._camera.isDirty || this._isTransformationDirty) {
        this._camera.isDirty = false;
        this._isTransformationDirty = false;
        this._camera.updateMatrices();

        var centerTranslation = new Matrix().fromTranslation(-0.5, -0.5, -0.5);
        var volumeTranslation = new Matrix().fromTranslation(this._translation.x, this._translation.y, this._translation.z);
        var volumeScale = new Matrix().fromScale(this._scale.x, this._scale.y, this._scale.z);

        var tr = new Matrix();
        tr.multiply(volumeScale, centerTranslation);
        tr.multiply(volumeTranslation, tr);
        tr.multiply(this._camera.transformationMatrix, tr);

        tr.inverse().transpose();
        if (this._renderer) {
            this._renderer.setMvpInverseMatrix(tr);
            this._renderer.reset();
        }
    }
};

_._render = function() {
    var gl = this._gl;
    if (!gl || !this._renderer || !this._toneMapper) {
        return;
    }

    this._updateMvpInverseMatrix();

    this._renderer.render();
    this._toneMapper.render();

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    var program = this._program;
    gl.useProgram(program.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._clipQuad);
    var aPosition = program.attributes.aPosition;
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._toneMapper.getTexture());
    gl.uniform1i(program.uniforms.uTexture, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    gl.disableVertexAttribArray(aPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
};

_.getScale = function() {
    return this._scale;
};

_.setScale = function(x, y, z) {
    this._scale.set(x, y, z);
    this._isTransformationDirty = true;
};

_.getTranslation = function() {
    return this._translation;
};

_.setTranslation = function(x, y, z) {
    this._translation.set(x, y, z);
    this._isTransformationDirty = true;
};

_.getResolution = function() {
    return this._resolution;
};

_.setResolution = function(resolution) {
    if (this._renderer) {
        this._renderer.setResolution(resolution);
    }
    if (this._toneMapper) {
        this._toneMapper.setResolution(resolution);
        if (this._renderer) {
            this._toneMapper.setTexture(this._renderer.getTexture());
        }
    }
};

_.startRendering = function() {
    Ticker.add(this._render);
};

_.stopRendering = function() {
    Ticker.remove(this._render);
};

_.hasComputeCapabilities = function() {
    return this._hasCompute;
};

// ============================ STATIC METHODS ============================= //

})(this);
