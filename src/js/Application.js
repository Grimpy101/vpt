import { DOMUtils } from './utils/DOMUtils.js';

import { UI } from './ui/UI.js';
import { StatusBar } from './ui/StatusBar.js';

import { LoaderFactory } from './loaders/LoaderFactory.js';
import { ReaderFactory } from './readers/ReaderFactory.js';

import { MainDialog } from './dialogs/MainDialog.js';
import { VolumeLoadDialog } from './dialogs/VolumeLoadDialog.js';
import { EnvmapLoadDialog } from './dialogs/EnvmapLoadDialog.js';
import { TFGalleryDialog } from './dialogs/TFGalleryDialog.js';

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
    //this._handleEnvmapLoad = this._handleEnvmapLoad.bind(this);

    this._tfUpdateEverything = this._tfUpdateEverything.bind(this);
    this._enterFullScreen = this._enterFullScreen.bind(this);
    this._moveBackInTime = this._moveBackInTime.bind(this);
    this._moveForwardInTime = this._moveForwardInTime.bind(this);
    this._finishTFSelection = this._finishTFSelection.bind(this);

    this._binds = DOMUtils.bind(document.body);

    // This is new, boxes to mark generated selection containers
    this._generationContainer = new GenerationContainer(this);
    this._generationContainer.appendTo(document.body);

    // Also send the container to the rendering context
    this._renderingContext = new RenderingContext({
        generationContainer: this._generationContainer,
        renderers: Array(9).fill(null)
    });
    this._binds.container.appendChild(this._renderingContext.getCanvas());

    this._status = "none";

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

    this._inFullScreen = false;

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

    //this._mainDialog = new MainDialog();

    //this._statusBar = new StatusBar();
    //this._statusBar.appendTo(document.body);

    this._volumeLoadDialog = new VolumeLoadDialog();
    this._volumeLoadDialog.appendTo(this._mainDialog.getVolumeLoadContainer());
    this._volumeLoadDialog.addEventListener('load', this._handleVolumeLoad);

    //this._envmapLoadDialog = new EnvmapLoadDialog();
    //this._envmapLoadDialog.appendTo(this._mainDialog.getEnvmapLoadContainer());
    //this._envmapLoadDialog.addEventListener('load', this._handleEnvmapLoad);

    this._renderingContextDialog = new RenderingContextDialog();
    this._renderingContextDialog.appendTo(
        this._mainDialog.getRenderingContextSettingsContainer());
    this._renderingContextDialog.addEventListener('resolution', e => {
        const resolution = this._renderingContextDialog.resolution;
        this._renderingContext.setResolution(resolution);
        this._generationContainer.resize(resolution, resolution, null);
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

    this._tfGalleryDialog = new TFGalleryDialog();
    this._tfGalleryDialog.appendTo(
        this._mainDialog.getTfGeneratorSettingsContainer()
    );
    this._tfGalleryDialog.addEventListener('goback', this._moveBackInTime);
    this._tfGalleryDialog.addEventListener('goforth', this._moveForwardInTime);
    this._tfGalleryDialog.addEventListener('finish', this._finishTFSelection);

    this._renderingContext.addEventListener('progress', e => {
        this._volumeLoadDialog._binds.loadProgress.setProgress(e.detail * 100);
    });

    this._renderingContext.addEventListener('threshold', e => {
        this._generationContainer.setThreshold(e.detail);
        this._tfUpdateEverything();
    });

    this._mainDialog.addEventListener('rendererchange', this._handleRendererChange);
    this._mainDialog.addEventListener('tonemapperchange', this._handleToneMapperChange);
    this._handleRendererChange();
    this._handleToneMapperChange();

    this._generationContainer.addEventListener('change', this._tfUpdateEverything);
    //this._tfUpdateEverything();

    this._mouseX = 0;
    this._mouseY = 0;

    window.addEventListener('mousemove', (e) => {
        this._mouseX = e.pageX;
        this._mouseY = e.pageY;
    });

    window.addEventListener('keydown', this._enterFullScreen);

    let queryParams = window.location.search;
    const urlParams = new URLSearchParams(queryParams);

    if (urlParams.get('popup') == null || urlParams.get('popup') == true) {
        this._createHelperDialog();
    }
    
    /*let recommendedVolumeLabel = urlParams.get('volume');
    if (recommendedVolumeLabel) {
        const selection = this._volumeLoadDialog._binds.demo;
        const select = selection._element.childNodes[1];
        const options = selection._element.childNodes[1].children;
        console.log(options);
        for (let option of options) {
            console.log(option);
            if (option.value == recommendedVolumeLabel) {
                select.value = recommendedVolumeLabel;
                break;
            }
        }
        select.value = recommendedVolumeLabel;
        this._volumeLoadDialog._binds.demo.setValue(recommendedVolumeLabel);
    }*/
}

_createHelperDialog() {
    const overlay = document.createElement('div');
    const helperDialog = document.createElement('dialog');
    const helperText = document.createElement('p');
    const instructionsBtn = document.createElement('button');
    const closeBtn = document.createElement('button');
    const btnDiv = document.createElement('div');

    helperText.innerHTML = "Dobrodošli! Če ste tukaj prvič, si lahko s pomočjo spodnjega gumba ogledate navodila za uporabo ali pa zaprete to okno in pričnete.";

    instructionsBtn.innerHTML = "Navodila za uporabo";
    instructionsBtn.addEventListener('click', () => {
        window.open('https://github.com/Grimpy101/vpt/blob/master/instructions/instructions.pdf', '_blank');
    });
    closeBtn.innerHTML = "Zapri";
    closeBtn.addEventListener('click', () => {
        helperDialog.open = false;
        overlay.style['display'] = 'None';
    });

    btnDiv.appendChild(instructionsBtn);
    btnDiv.appendChild(closeBtn);

    helperDialog.appendChild(helperText);
    helperDialog.appendChild(btnDiv);

    helperDialog.open = true;

    overlay.classList.add('overlay_black');
    helperDialog.classList.add('popup_instructions');

    document.body.appendChild(overlay);
    document.body.appendChild(helperDialog);
}

_tfUpdateEverything() {
    const renderers = this._renderingContext.getRenderers();
    const tfBatch = [];
    for (let i = 0; i < renderers.length; i++) {
        renderers[i].reset();
        const tfTexture = this._generationContainer.boxes[i].transferFunctionTexture;
        tfTexture.addTextureToHistory();
        renderers[i].setTransferFunction(tfTexture);
        tfBatch.push(structuredClone(tfTexture));
    }
}

_moveBackInTime() {
    const renderers = this._renderingContext.getRenderers();
    const tfBatch = [];
    for (let i = 0; i < renderers.length; i++) {
        renderers[i].reset();
        const tfTexture = this._generationContainer.boxes[i].transferFunctionTexture;
        tfTexture.goBackInHistory();
        renderers[i].setTransferFunction(tfTexture);
        tfBatch.push(structuredClone(tfTexture));
    }
    this._generationContainer.goBackInHistory();
}

_moveForwardInTime() {
    const renderers = this._renderingContext.getRenderers();
    const tfBatch = [];
    for (let i = 0; i < renderers.length; i++) {
        renderers[i].reset();
        const tfTexture = this._generationContainer.boxes[i].transferFunctionTexture;
        tfTexture.goForwardInHistory();
        renderers[i].setTransferFunction(tfTexture);
        tfBatch.push(structuredClone(tfTexture));
    }
    this._generationContainer.goForwardInHistory();
}

_finishTFSelection() {
    const tfPackage = {
        tfHistory: [],
        choiceHistory: [],
        name: "Unknown",
        volumeID: ""
    }
    const boxes = this._generationContainer.boxes;
    for (let i = 0; i < boxes.length; i++) {
        const tfHistory = boxes[i].transferFunctionTexture.history;
        for (let j = 0; j < tfHistory.length; j++) {
            if (!tfPackage.tfHistory[j]) {
                tfPackage.tfHistory[j] = [];
            }
            tfPackage.tfHistory[j][i] = Array.from(tfHistory[j]);
        }
    }
    tfPackage.choiceHistory = this._generationContainer.history;

    if (this._volumeLoadDialog.fileName) {
        tfPackage.volumeID = this._volumeLoadDialog.fileLabel;
    }

    fetch("/store", {
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(tfPackage)
    }).then(res => {
        if (res.ok) {
            let json = res.json().then((data) => {
                let volume = "";
                let count = Infinity;
                for (const candidate in data) {
                    if (data[candidate] < count) {
                        count = data[candidate];
                        volume = candidate;
                    }
                }
                window.location.search = ("?popup=false&volume=" + volume);
            });
        }
    });
}

_enterFullScreen(e) {
    if (e.code == 'KeyF') {
        if (!this._inFullScreen) {
            this._generationContainer.fullScreen(this._mouseX, this._mouseY);
            this._status = "fullscreen";
            console.log(this._renderingContext._canvas);
            this._renderingContext._canvas.width = this._renderingContext._canvas.width * 2;
            this._renderingContext._canvas.height = this._renderingContext._canvas.height * 2;
            this._renderingContext._canvas.classList.add('canvas_high_res');
        } else {
            this._renderingContext._canvas.classList.remove('canvas_high_res');
            this._renderingContext._canvas.width = this._renderingContext._canvas.width / 2;
            this._renderingContext._canvas.height = this._renderingContext._canvas.height / 2;
            window.dispatchEvent(new Event('change'));
            this._generationContainer.revertFullScreen();
            this._renderingContext.clearCanvas();
            this._status = "ready";
        }

        this._inFullScreen = !this._inFullScreen;
    }
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
                children: [{ ...property, bind: property.name }],
                contracted: true,
                visible: false
            });
        } else {
            if (property.visible == true) {
                panel.children.push({
                    type: 'field',
                    label: property.label,
                    children: [{...property, bind: property.name }]
                })
            }
            /*if (property.label == "Steps" || property.label == "Midtones") {
                panel.children.push({
                    type: 'field',
                    label: property.label,
                    children: [{ ...property, bind: property.name }]
                });
            } else {
                if (property.type == 'slider') {
                    continue;
                }
                panel.children.push({
                    type: 'field',
                    label: property.label,
                    children: [{ ...property, bind: property.name, enabled: false }]
                });
            }*/
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
    const { object, binds } = this._constructDialogFromProperties(renderers[0]);
    this._rendererDialog = object;
    for (let i = 0; i < renderers.length; i++) {
        const renderer = renderers[i];
        for (const name in binds) {
            binds[name].addEventListener('change', e => {
                const value = binds[name].getValue();
                renderer[name] = value;
                renderer.dispatchEvent(new CustomEvent('change', {
                    detail: { name, value }
                }));
            });
        }
        renderer.reset();
        renderer.setTransferFunction(this._generationContainer.boxes[i].transferFunctionTexture)
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
    //console.log(options.dimensions);
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
            const reader = new readerClass(loader, {
                width   : options.dimensions.x,
                height  : options.dimensions.y,
                depth   : options.dimensions.z,
                bits    : options.precision
            });
            this._renderingContext.stopRendering();
            this._renderingContext.setVolume(reader, {
                threshold: options.threshold
            });
            if (options.scale) {
                this._renderingContext.setScale(options.scale.x, options.scale.y, options.scale.z);
                this._renderingContextDialog._binds.scale.setValue(
                    {
                        x: options.scale.x,
                        y: options.scale.y,
                        z: options.scale.z
                    }
                );
            }
        }
    }
    this._status = "ready"
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
