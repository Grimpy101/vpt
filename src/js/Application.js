import { DOMUtils } from './utils/DOMUtils.js';

import { UI } from './ui/UI.js';
import { StatusBar } from './ui/StatusBar.js';

import { LoaderFactory } from './loaders/LoaderFactory.js';
import { ReaderFactory } from './readers/ReaderFactory.js';

import { MainDialog } from './dialogs/MainDialog.js';
import { VolumeLoadDialog } from './dialogs/VolumeLoadDialog.js';
import { EnvmapLoadDialog } from './dialogs/EnvmapLoadDialog.js';

import { RenderingContext } from './RenderingContext.js';
import { RenderingContextDialog } from './dialogs/RenderingContextDialog.js';

import { GenerationContainer } from './ui/GenerationContainer.js'
import { SelectionBox } from './ui/SelectionBox.js'

export class Application {

constructor() {
    this._handleFileDrop = this._handleFileDrop.bind(this);
    this._handleRendererChange = this._handleRendererChange.bind(this);
    this._handleToneMapperChange = this._handleToneMapperChange.bind(this);
    this._handleVolumeLoad = this._handleVolumeLoad.bind(this);
    this._handleEnvmapLoad = this._handleEnvmapLoad.bind(this);

    this._binds = DOMUtils.bind(document.body);

    // This is new, boxes to mark generated selection containers
    this._generationContainer = new GenerationContainer();
    this._generationContainer.appendTo(document.body);

    // Also send the container to the rendering context
    this._renderingContext = new RenderingContext({
        generationContainer: this._generationContainer,
        renderers: Array(9).fill(null)
    });
    this._binds.container.appendChild(this._renderingContext.getCanvas());

    for(let i = 0; i < 9; i++) {
        let box = new SelectionBox();
        this._generationContainer.addBox(box);
        box.setParent(this._generationContainer);
    }

    // Moved this here to get width
    this._mainDialog = new MainDialog();
    // Moved this here because hasComputeCapabilities() is not a function!!!
    // TODO: Check it it breaks anything!
    /*if (!this._renderingContext.hasComputeCapabilities()) {
        this._mainDialog.disableMCC();
    }*/

    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this._renderingContext.resize(width, height);
        // New, needs to always be the same size as canvas
        this._generationContainer.resize(width, height, this._mainDialog._object._element);
    });
    window.dispatchEvent(new Event('resize'));

    document.body.addEventListener('dragover', e => e.preventDefault());
    document.body.addEventListener('drop', this._handleFileDrop);

    this._mainDialog = new MainDialog();

    this._statusBar = new StatusBar();
    this._statusBar.appendTo(document.body);

    this._volumeLoadDialog = new VolumeLoadDialog();
    this._volumeLoadDialog.appendTo(this._mainDialog.getVolumeLoadContainer());
    this._volumeLoadDialog.addEventListener('load', this._handleVolumeLoad);

    this._envmapLoadDialog = new EnvmapLoadDialog();
    this._envmapLoadDialog.appendTo(this._mainDialog.getEnvmapLoadContainer());
    this._envmapLoadDialog.addEventListener('load', this._handleEnvmapLoad);

    this._renderingContextDialog = new RenderingContextDialog();
    this._renderingContextDialog.appendTo(
        this._mainDialog.getRenderingContextSettingsContainer());
    this._renderingContextDialog.addEventListener('resolution', e => {
        const resolution = this._renderingContextDialog.resolution;
        this._renderingContext.setResolution(resolution);
    });
    this._renderingContextDialog.addEventListener('transformation', e => {
        const s = this._renderingContextDialog.scale;
        const t = this._renderingContextDialog.translation;
        this._renderingContext.setScale(s.x, s.y, s.z);
        this._renderingContext.setTranslation(t.x, t.y, t.z);
    });
    this._renderingContextDialog.addEventListener('filter', e => {
        const filter = this._renderingContextDialog.filter;
        this._renderingContext.setFilter(filter);
    });
    this._renderingContextDialog.addEventListener('noiseSize', e => {
        let num = this._renderingContextDialog.noiseSize;
        this._generationContainer.setAllNoiseSizes(num);
    });

    this._renderingContext.addEventListener('progress', e => {
        this._volumeLoadDialog._binds.loadProgress.setProgress(e.detail * 100);
    });

    this._mainDialog.addEventListener('rendererchange', this._handleRendererChange);
    this._mainDialog.addEventListener('tonemapperchange', this._handleToneMapperChange);
    this._handleRendererChange();
    this._handleToneMapperChange();

    this._generationContainer.addEventListener('change', () => {
        const renderers = this._renderingContext.getRenderers();
        for (let i = 0; i < renderers.length; i++) {
            renderers[i].reset();
            renderers[i].setTransferFunction(this._generationContainer.boxes[i].transferFunctionTexture)
        }
    });

    this._mouseX = 0;
    this._mouseY = 0;
    this._inFullScreen = false;

    window.addEventListener('mousemove', (e) => {
        this._mouseX = e.pageX;
        this._mouseY = e.pageY;
    });

    window.addEventListener('keydown', (e) => {
        if (e.code == 'KeyF') {
            if (!this._inFullScreen) {
                this._generationContainer.fullScreen(this._mouseX, this._mouseY);
            } else {
                window.dispatchEvent(new Event('change'));
                this._generationContainer.revertFullScreen();
            }

            this._inFullScreen = !this._inFullScreen;
        }
    });
}

_handleFileDrop(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length === 0) {
        return;
    }
    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.bvp')) {
        throw new Error('Filename extension must be .bvp');
    }
    this._handleVolumeLoad(new CustomEvent('load', {
        detail: {
            type       : 'file',
            file       : file,
            filetype   : 'bvp',
            dimensions : { x: 0, y: 0, z: 0 }, // doesn't matter
            precision  : 8, // doesn't matter
        }
    }));
}

_constructDialogFromProperties(object) {
    const panel = {
        type: 'panel',
        children: [],
    };
    for (const property of object.properties) {
        if (property.type === 'transfer-function') {
            panel.children.push({
                type: 'accordion',
                label: property.label,
                children: [{ ...property, bind: property.name }]
            });
        } else {
            panel.children.push({
                type: 'field',
                label: property.label,
                children: [{ ...property, bind: property.name }]
            });
        }
    }
    return UI.create(panel);
}

_handleRendererChange() {
    if (this._rendererDialog) {
        this._rendererDialog.destroy();
    }
    const which = this._mainDialog.getSelectedRenderer();
    this._renderingContext.chooseRenderer(which);
    const renderers = this._renderingContext.getRenderers();
    for (const renderer of renderers) {
        const { object, binds } = this._constructDialogFromProperties(renderer);
        this._rendererDialog = object;
        for (const name in binds) {
            binds[name].addEventListener('change', e => {
                const value = binds[name].getValue();
                renderer[name] = value;
                renderer.dispatchEvent(new CustomEvent('change', {
                    detail: { name, value }
                }));
            });
        }
    }
    const container = this._mainDialog.getRendererSettingsContainer()._element;
    this._rendererDialog.appendTo(container);
}

_handleToneMapperChange() {
    if (this._toneMapperDialog) {
        this._toneMapperDialog.destroy();
    }
    const which = this._mainDialog.getSelectedToneMapper();
    this._renderingContext.chooseToneMapper(which);
    const toneMapper = this._renderingContext.getToneMapper();
    const { object, binds } = this._constructDialogFromProperties(toneMapper);
    this._toneMapperDialog = object;
    for (const name in binds) {
        binds[name].addEventListener('change', e => {
            const value = binds[name].getValue();
            toneMapper[name] = value;
            toneMapper.dispatchEvent(new CustomEvent('change', {
                detail: { name, value }
            }));
        });
    }
    const container = this._mainDialog.getToneMapperSettingsContainer()._element;
    this._toneMapperDialog.appendTo(container);
}

_handleVolumeLoad(e) {
    const options = e.detail;
    if (options.type === 'file') {
        const readerClass = ReaderFactory(options.filetype);
        if (readerClass) {
            const loaderClass = LoaderFactory('blob');
            const loader = new loaderClass(options.file);
            const reader = new readerClass(loader, {
                width  : options.dimensions.x,
                height : options.dimensions.y,
                depth  : options.dimensions.z,
                bits   : options.precision,
            });
            this._renderingContext.stopRendering();
            this._renderingContext.setVolume(reader);
        }
    } else if (options.type === 'url') {
        const readerClass = ReaderFactory(options.filetype);
        if (readerClass) {
            const loaderClass = LoaderFactory('ajax');
            const loader = new loaderClass(options.url);
            const reader = new readerClass(loader);
            this._renderingContext.stopRendering();
            this._renderingContext.setVolume(reader);
        }
    }
}

_handleEnvmapLoad(e) {
    const options = e.detail;
    let image = new Image();
    image.crossOrigin = 'anonymous';
    image.addEventListener('load', () => {
        this._renderingContext.setEnvironmentMap(image);
        const renderers = this._renderingContext.getRenderers();
        for (let i = 0; i < renderers.length; i++) {
            renderers[i].reset();
        }
    });

    if (options.type === 'file') {
        let reader = new FileReader();
        reader.addEventListener('load', () => {
            image.src = reader.result;
        });
        reader.readAsDataURL(options.file);
    } else if (options.type === 'url') {
        image.src = options.url;
    }
}

}
