import { Vector } from './math/Vector.js';
import { Matrix } from './math/Matrix.js';
import { Quaternion } from './math/Quaternion.js';

import { WebGL } from './WebGL.js';
import { Ticker } from './Ticker.js';
import { Camera } from './Camera.js';
import { OrbitCameraController } from './OrbitCameraController.js';
import { Volume } from './Volume.js';

import { RendererFactory } from './renderers/RendererFactory.js';
import { ToneMapperFactory } from './tonemappers/ToneMapperFactory.js';

const [ SHADERS, MIXINS ] = await Promise.all([
    'shaders.json',
    'mixins.json',
].map(url => fetch(url).then(response => response.json())));

export class RenderingContext extends EventTarget {

constructor(options) {
    super();

    this._render = this._render.bind(this);
    this._webglcontextlostHandler = this._webglcontextlostHandler.bind(this);
    this._webglcontextrestoredHandler = this._webglcontextrestoredHandler.bind(this);

    // This was the simplest solution to render it like I wanted to
    this._generationContainer = options.generationContainer;
    this._renderers = options.renderers;

    Object.assign(this, {
        _resolution : 512,
        _filter     : 'linear'
    }, options);

    this._canvas = document.createElement('canvas');
    this._canvas.width = this._resolution;
    this._canvas.height = this._resolution;
    this._canvas.addEventListener('webglcontextlost', this._webglcontextlostHandler);
    this._canvas.addEventListener('webglcontextrestored', this._webglcontextrestoredHandler);

    this._initGL();

    this._camera = new Camera();
    this._camera.position.z = 1.5;
    this._camera.fovX = 0.3;
    this._camera.fovY = 0.3;
    this._camera.updateMatrices();

    this._cameraController = new OrbitCameraController(this._camera, this._canvas);
    this._camera.zoom(-1.2);

    this._volume = new Volume(this._gl);
    this._scale = new Vector(1, 1, 1);
    this._translation = new Vector(0, 0, 0);
    this._isTransformationDirty = true;
    this._updateMvpInverseMatrix();
}

// ============================ WEBGL SUBSYSTEM ============================ //

_initGL() {
    const contextSettings = {
        alpha                 : false,
        depth                 : false,
        stencil               : false,
        antialias             : false,
        preserveDrawingBuffer : true,
    };

    this._contextRestorable = true;

    const gl = this._gl = this._canvas.getContext('webgl2', contextSettings);

    this._extLoseContext = gl.getExtension('WEBGL_lose_context');
    this._extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
    this._extTextureFloatLinear = gl.getExtension('OES_texture_float_linear');

    if (!this._extColorBufferFloat) {
        console.error('EXT_color_buffer_float not supported!');
    }

    if (!this._extTextureFloatLinear) {
        console.error('OES_texture_float_linear not supported!');
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
        max            : gl.LINEAR,
    });

    this._program = WebGL.buildPrograms(gl, {
        quad: SHADERS.quad
    }, MIXINS).quad;

    this._clipQuad = WebGL.createClipQuad(gl);
}

_webglcontextlostHandler(e) {
    if (this._contextRestorable) {
        e.preventDefault();
    }
}

_webglcontextrestoredHandler(e) {
    this._initGL();
}

clearCanvas() {
    this._gl.clear(this._gl.COLOR_BUFFER_BIT);
    this._gl.clearColor(0.0, 0.0, 0.0, 1.0);
}

resize(width, height) {
    this._canvas.width = width;
    this._canvas.height = height;
    this._camera.resize(width, height);
}

async setVolume(reader, options) {
    this._volume = new Volume(this._gl, reader, options);
    this._volume.addEventListener('progress', e => {
        this.dispatchEvent(new CustomEvent('progress', { detail: e.detail }));
    });
    this._volume.addEventListener('threshold', e => {
        this.dispatchEvent(new CustomEvent('threshold', {detail: e.detail}));
    });
    await this._volume.readMetadata();
    await this._volume.readModality('default');
    this._volume.setFilter(this._filter);
    for (let renderer of this._renderers) {
        if (renderer) {
            renderer.setVolume(this._volume);
        }
    }
    if (this._renderers[0]) {
        this.startRendering();
    }
}

setEnvironmentMap(image) {
    WebGL.createTexture(this._gl, {
        texture : this._environmentTexture,
        image   : image
    });
}

setFilter(filter) {
    this._filter = filter;
    if (this._volume) {
        this._volume.setFilter(filter);
        for (let renderer of this._renderers) {
            if (renderer) {
                renderer.reset();
            }
        }
    }
}

chooseRenderer(renderer) {
    const boxes =  this.generationContainer.boxes;
    for (let i = 0; i < this._renderers.length; i++) {
        if (renderer && this._renderers[i]) {
            this._renderers[i].destroy();
        }
        const rendererClass = RendererFactory(renderer);
        this._renderers[i] = new rendererClass(this._gl, this._volume, this._environmentTexture, {
            _bufferSize: this._resolution,
        });
        //this._renderers[i].setTransferFunction(boxes[i].transferFunctionTexture);
        if (this._toneMapper) {
            this._toneMapper.setTexture(this._renderers[i].getTexture());
        }
        this._isTransformationDirty = true;
    }
}

chooseToneMapper(toneMapper) {
    if (this._toneMapper) {
        this._toneMapper.destroy();
    }
    const gl = this._gl;
    let texture;
    if (this._renderers[0]) {
        texture = this._renderers[0].getTexture();
    } else {
        texture = WebGL.createTexture(gl, {
            width  : 1,
            height : 1,
            data   : new Uint8Array([255, 255, 255, 255]),
        });
    }
    const toneMapperClass = ToneMapperFactory(toneMapper);
    this._toneMapper = new toneMapperClass(gl, texture, {
        _bufferSize: this._resolution,
    });
}

getCanvas() {
    return this._canvas;
}

getRenderers() {
    return this._renderers;
}

getToneMapper() {
    return this._toneMapper;
}

_updateMvpInverseMatrix() {
    if (!this._camera.isDirty && !this._isTransformationDirty) {
        return;
    }

    this._camera.isDirty = false;
    this._isTransformationDirty = false;
    this._camera.updateMatrices();

    const centerTranslation = new Matrix().fromTranslation(-0.5, -0.5, -0.5);
    const volumeTranslation = new Matrix().fromTranslation(
        this._translation.x, this._translation.y, this._translation.z);
    const volumeScale = new Matrix().fromScale(
        this._scale.x, this._scale.y, this._scale.z);

    const modelMatrix = new Matrix();
    modelMatrix.multiply(volumeScale, centerTranslation);
    modelMatrix.multiply(volumeTranslation, modelMatrix);

    const viewMatrix = this._camera.viewMatrix;
    const projectionMatrix = this._camera.projectionMatrix;

    for (let i = 0; i < this._renderers.length; i++) {
        if (this._renderers[i]) {
            this._renderers[i].modelMatrix.copy(modelMatrix);
            this._renderers[i].viewMatrix.copy(viewMatrix);
            this._renderers[i].projectionMatrix.copy(projectionMatrix);
            this._renderers[i].reset();
        }
    }
}

_render() {
    const gl = this._gl;
    if (!gl || !this._toneMapper) {
        return;
    }
    for (let i = 0; i < this._renderers.length; i++) {
        if (!this._renderers[i]) {
            return;
        }
    }

    this._updateMvpInverseMatrix();

    // Now renders volume 9 times, for each box, in designated positions
    const boxes =  this.generationContainer.boxes;
    let gen_h = this.generationContainer.html.getBoundingClientRect().height;
    for (let i = 0; i < boxes.length; i++) {
        const bb = boxes[i].html.getBoundingClientRect();
        let x = parseInt(bb.left);
        let y = parseInt(gen_h - bb.bottom);
        let w = parseInt(bb.width);
        let h = parseInt(bb.height);

        //this._renderers[i].setTransferFunction(boxes[i].transferFunctionTexture);

        this._renderers[i].render();
        if (this._toneMapper) {
            this._toneMapper.setTexture(this._renderers[i].getTexture());
        }
        this._toneMapper.render();

        gl.viewport(x, y, w, h);
        const program = this._program;
        gl.useProgram(program.program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._clipQuad);
        const aPosition = program.attributes.aPosition;
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._toneMapper.getTexture());
        gl.uniform1i(program.uniforms.uTexture, 0);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        gl.disableVertexAttribArray(aPosition);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    if (this._renderers[0] == this._renderers[1]) console.log("Šment, enaki so!");
}

getScale() {
    return this._scale;
}

setScale(x, y, z) {
    this._scale.set(x, y, z);
    this._isTransformationDirty = true;
}

getTranslation() {
    return this._translation;
}

setTranslation(x, y, z) {
    this._translation.set(x, y, z);
    this._isTransformationDirty = true;
}

getResolution() {
    return this._resolution;
}

setResolution(resolution) {
    this._resolution = resolution;
    this._canvas.width = resolution;
    this._canvas.height = resolution;

    this._camera.resize(resolution, resolution);

    for (let i = 0; i < this._renderers.length; i++) {
        if (this._renderers[i]) {
            this._renderers[i].setResolution(resolution);
        }
        if (this._toneMapper) {
            this._toneMapper.setResolution(resolution);
            if (this._renderers[i]) {
                this._toneMapper.setTexture(this._renderers[i].getTexture());
            }
        }
    }
}

startRendering() {
    Ticker.add(this._render);
}

stopRendering() {
    Ticker.remove(this._render);
}

}
