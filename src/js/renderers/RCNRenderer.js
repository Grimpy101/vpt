// #package js/main

// #include ../WebGL.js
// #include AbstractRenderer.js
// #include ../LightVolume.js

class RCNRenderer extends AbstractRenderer {

    constructor(gl, volume, environmentTexture, options) {
        super(gl, volume, environmentTexture, options);
        Object.assign(this, {
            _lightDefinitions           : [],
            _nActiveLights              : 0,
            _counter                    : 0,
            _iterationsLimit            : 0,
            _elapsedTime                : 0,
            _timer                      : 0,
            _done                       : false,
            // Ray Marching
            _stepSize                   : 0.00333,
            _alphaCorrection            : 100,
            _absorptionCoefficient      : 0,
            // Monte Carlo
            _lightVolumeRatio           : 1,
            _steps                      : 1,
            _majorant                   : 100,
            _absorptionCoefficientMC    : 1,
            _scatteringCoefficientMC    : 1,
            _scatteringBias             : 0,
            _maxBounces                 : 20,
            _mcEnabled                  : true,
            _diffusionEnabled           : false,
            _type                       : 1,
            // Hybrid
            _scattering                 : 0.5,
            // Dynamic Iterations length
            _layersPerFrame             : 1,
            _fastStart                  : true,
            _allowedSlowdown            : 1.5,
            _currentDepth               : 0,
            _preIterations              : 30,
            _preIterationsDone          : false,
            _prevTime                   : new Date(),
            _averageTime                : 0,
            _movingBoxLength            : 10,
            _baseTimePerFrame           : 0,
            // Deferred Rendering
            _deferredRendering          : true,
            _smartDeNoise               : true,
            _smartDeNoiseSigma          : 5,
            _smartDeNoiseKSigma         : 2,
            _smartDeNoiseThreshold      : 0.1
        }, options);

        this._programs = WebGL.buildPrograms(this._gl, {
            // diffusion       : SHADERS.RCDDiffusion,
            generate        : SHADERS.RCNGenerate,
            integrate       : SHADERS.RCNIntegrate,
            integrateENV    : SHADERS.RCNIntegrateENV,
            diffuse         : SHADERS.RCNDiffuse,
            render          : SHADERS.RCNRender,
            resetPhotons    : SHADERS.RCNResetPhotons,
            resetPhotonsENV : SHADERS.RCNResetPhotonsENV,
            resetDiffusion  : SHADERS.RCNResetDiffusion,
            // Deferred Rendering
            deferredRender  : SHADERS.RCNDeferredRender,
            combineRender  : SHADERS.RCNCombineRender
        }, MIXINS);

        this._transferFunction = WebGL.createTexture(gl, {
            width  : 2,
            height : 1,
            data   : new Uint8Array([255, 0, 0, 0, 255, 0, 0, 255]),
            wrapS  : gl.CLAMP_TO_EDGE,
            wrapT  : gl.CLAMP_TO_EDGE,
            min    : gl.LINEAR,
            mag    : gl.LINEAR
        });

        this._lightDefinitions = [
            new LightDefinition('distant', [0.8, 0.01, 0.01], true),
            new LightDefinition('point', [0, -0.1, 0.5], true)
        ]

        if (this._volume.ready) {
            this._initVolume();
        }
    }

    startTesting(testingTime= 100, intervals= 100, saveAs = "MCC") {
        // [0.4595949351787567, 0.017016194760799408, -0.002319802064448595, 1.8643269150686592e-9, 0.0008531888015568256, 0.009490122087299824, 0.37735629081726074, 2.2245090214312313e-9, -1.7914464473724365, 23.797161102294922, -2.561542272567749, -4.89999532699585, 1.85416579246521, -21.197429656982422, 2.650918960571289, 5.0999956130981445]
        this.testingTime = testingTime * 1000;
        this.testingIntervalTime = this.testingTime/intervals;
        this.testingTotalTime = 0;
        this.testing = true;
        this.saveAs = saveAs;
        this._resetPhotons();
    }

    testingProtocalSave() {
        if (this.testing && this.testingTotalTime <= this.testingTime && this._elapsedTime >= this.testingIntervalTime) {
            // console.log("saving")
            let lastTime = this._elapsedTime;
            this.testingTotalTime += lastTime;
            // this._elapsedTime = lastTime - this.testingIntervalTime;
            this._elapsedTime = 0
            let canvas = document.getElementsByClassName("renderer")[0];
            let link = document.createElement('a');
            link.download = this.saveAs + "_" + this.testingTotalTime + ".png";
            link.href = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
            link.click();
        }
    }


    _initDynamicIterationValues() {
        this._layersPerFrame = 1;
        this._fastStart = true;
        this._currentPreIterations = this._preIterations;
        this._preIterationsDone  = false;
        this._prevTime = new Date();
        this._averageTime = 0;
    }

    setVolume(volume) {
        this._volume = volume;
        this._initVolume();
    }

    render() {
        const gl = this._gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this._clipQuad);
        gl.enableVertexAttribArray(0); // position always bound to attribute 0
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        // this._frameBuffer.use();
        // this._generateFrame();

        // this._accumulationBuffer.use();
        switch (this._type){
            case 0: this._integrateFrame(); break;
            case 1: this._integrateFrameENV(); break;
            default: this._integrateFrameENV(); break;
        }
        this._accumulationBuffer.swap();

        if (this._deferredRendering) {
            // this._defferedRenderBuffer.use();
            this._deferredRenderFrame();

            // this._renderBuffer.use();
            this._combineRenderFrame();
        } else {
            this._renderBuffer.use();
            this._renderFrame();
        }
        // console.log(this._elapsedTime)
        if (!this._done) {
            const currentTime = new Date().getTime();
            this._elapsedTime += currentTime - this._previousTime;
            this._previousTime = currentTime;
            this.testingProtocalSave()
        }

        // this._calculateAverageTime()
    }

    _calculateAverageTime() {
        if (!this._mcEnabled)
            return
        const currentTime = new Date();
        const timeDiff = currentTime - this._prevTime;
        this._averageTime += (1 / this._movingBoxLength)  * (timeDiff - this._averageTime);
        // console.log(this._averageTime)
        this._prevTime = currentTime;
        if (!this._preIterationsDone) {
            // console.log("LALA")
            this._currentPreIterations -= 1;
            if (this._currentPreIterations <= 0) {
                this._preIterationsDone = true
                this._baseTimePerFrame = this._averageTime
                console.log("Average Base Time: ", this._averageTime)
            }
        } else {
            this._determineLayersPerFrame();
            // console.log(this._layersPerFrame)
        }
    }

    _determineLayersPerFrame() {
        if (this._averageTime <= this._allowedSlowdown * this._baseTimePerFrame) {
            if (this._fastStart)
                this._layersPerFrame *= 2;
            else
                this._layersPerFrame += 1;
        } else {
            if (this._fastStart) {
                this._layersPerFrame /= 2;
                this._fastStart = false;
            }
            else if (this._layersPerFrame > 1)
                this._layersPerFrame -= 1;
        }
        if (this._layersPerFrame >= this._lightVolumeDimensions.depth) {
            this._fastStart = false;
            this._layersPerFrame = this._lightVolumeDimensions.depth;
        }
    }

    destroy() {
        const gl = this._gl;
        Object.keys(this._programs).forEach(programName => {
            gl.deleteProgram(this._programs[programName].program);
        });
        if (this._defferedRenderBuffer)
            this._defferedRenderBuffer.destroy();
        if (this._lightsTexture && gl.isTexture(this._lightsTexture)) {
            gl.deleteTexture(this._lightsTexture);
        }
        super.destroy();
    }

    resetLightVolume() {
        if (this._volumeDimensions) {
            this._resetPhotons();
            // this._layersPerFrame = 1
            // this._fastStart = true
            this._initDynamicIterationValues()
        }
    }

    _initVolume() {
        const volumeDimensions = this._volume.getDimensions('default');
        this._volumeDimensions = volumeDimensions;

        console.log("Volume Dimensions: " + volumeDimensions.width + " " + volumeDimensions.height + " " + volumeDimensions.depth);
        // this._mcEnabled = false
        this._setLightVolumeDimensions();
        this._setLightTexture();
        this._setAccumulationBuffer();
        this._resetPhotons();
        this._initDynamicIterationValues();
        // this._mcEnabled = true
    }

    _setLightVolumeDimensions() {
        if (!this._volumeDimensions) {
            return;
        }
        const volumeDimensions = this._volumeDimensions;
        this._lightVolumeDimensions = {
            width: Math.floor(volumeDimensions.width / this._lightVolumeRatio),
            height: Math.floor(volumeDimensions.height / this._lightVolumeRatio),
            depth: Math.floor(volumeDimensions.depth / this._lightVolumeRatio)
        };

        console.log("Light Volume Dimensions: " + this._lightVolumeDimensions.width + " " +
            this._lightVolumeDimensions.height + " " + this._lightVolumeDimensions.depth);
        // this._lightVolumeDimensions.depth = 150
    }

    _setAccumulationBuffer() {
        if (this._accumulationBuffer) {
            this._accumulationBuffer.destroy();
        }
        this._accumulationBuffer = new DoubleBuffer3D(this._gl, this._getAccumulationBufferSpec());
    }

    _setLightTexture() {
        const gl = this._gl;
        if (this._lightsTexture && gl.isTexture(this._lightsTexture)) {
            gl.deleteTexture(this._lightsTexture);
        }

        const lightDefinitionArray = this._getLightDefinitionArray();

        this._lightsTexture = WebGL.createTexture(gl, {
            width          : this._nActiveLights,
            height         : 1,
            data           : new Float32Array(lightDefinitionArray),
            format         : gl.RGBA,
            internalFormat : gl.RGBA32F,
            type           : gl.FLOAT,
            wrapS          : gl.CLAMP_TO_EDGE,
            wrapT          : gl.CLAMP_TO_EDGE,
            min            : gl.NEAREST,
            mag            : gl.NEAREST
        });
    }

    _getLightDefinitionArray() {
        let lightsArray = [];
        let nLights = 0
        for (let i = 0; i < this._lightDefinitions.length; i++) {
            if (!this._lightDefinitions[i].isEnabled())
                continue;
            let lightArray = this._lightDefinitions[i].getLightArr();
            lightsArray.push(lightArray[0], lightArray[1], lightArray[2], this._lightDefinitions[i].typeToInt());
            nLights++;
        }
        this._nActiveLights = nLights;
        return lightsArray;
    }

    _resetPhotons() {
        const gl = this._gl;
        this._previousTime = new Date().getTime()

        // this._setAccumulationBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, this._clipQuad);
        gl.enableVertexAttribArray(0); // position always bound to attribute 0
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        if (this._type === 0) {
            const program = this._programs.resetPhotons;
            gl.useProgram(program.program);

            for (let i = 0; i < this._lightVolumeDimensions.depth; i++) {
                this._accumulationBuffer.use(i);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this._lightsTexture);

                gl.uniform1i(program.uniforms.uLights, 0);

                // gl.uniform1ui(program.uniforms.uNLights, this._nActiveLights);

                gl.uniform1f(program.uniforms.uLayer, (i + 0.5) / this._lightVolumeDimensions.depth);

                // const light = this._lightDefinitions[0];
                // const lightArr = light.getLightArr();
                // gl.uniform4f(program.uniforms.uLight, lightArr[0], lightArr[1], lightArr[2], light.typeToInt());

                gl.drawBuffers([
                    gl.COLOR_ATTACHMENT0,
                    gl.COLOR_ATTACHMENT1,
                    gl.COLOR_ATTACHMENT2,
                    gl.COLOR_ATTACHMENT3
                ]);
                gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
            }
        }
        else {
            const program = this._programs.resetPhotonsENV;
            gl.useProgram(program.program);
            console.log("Photons")
            for (let i = 0; i < this._lightVolumeDimensions.depth; i++) {
                this._accumulationBuffer.use(i);

                gl.uniform1f(program.uniforms.uLayer, (i + 0.5) / this._lightVolumeDimensions.depth);

                gl.drawBuffers([
                    gl.COLOR_ATTACHMENT0,
                    gl.COLOR_ATTACHMENT1,
                    gl.COLOR_ATTACHMENT2,
                    gl.COLOR_ATTACHMENT3
                ]);
                gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
            }
        }
        this._currentDepth = 0;
        this._accumulationBuffer.swap();
        this._counter = 0;
        this._elapsedTime = 0;
        this._done = false;
    }

    _resetDiffusion() {
        const gl = this._gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this._clipQuad);
        gl.enableVertexAttribArray(0); // position always bound to attribute 0
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        const program = this._programs.resetDiffusion;

        gl.useProgram(program.program);

        for (let i = 0; i < this._lightVolumeDimensions.depth; i++) {
            this._accumulationBuffer.use(i);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[0]);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[1]);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[2]);
            gl.activeTexture(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[3]);

            gl.uniform1i(program.uniforms.uPosition, 0);
            gl.uniform1i(program.uniforms.uDirectionAndTransmittance, 1);
            gl.uniform1i(program.uniforms.uDistanceTravelledAndSamples, 2);
            gl.uniform1i(program.uniforms.uRadianceAndDiffusion, 3);

            gl.uniform1f(program.uniforms.uLayer, (i + 0.5) / this._lightVolumeDimensions.depth);

            gl.drawBuffers([
                gl.COLOR_ATTACHMENT0,
                gl.COLOR_ATTACHMENT1,
                gl.COLOR_ATTACHMENT2,
                gl.COLOR_ATTACHMENT3
            ]);
            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        }
        this._accumulationBuffer.swap();
    }

    _rebuildBuffers() {
        if (this._frameBuffer) {
            this._frameBuffer.destroy();
        }
        // if (this._accumulationBuffer) {
        //     this._accumulationBuffer.destroy();
        // }
        if (this._renderBuffer) {
            this._renderBuffer.destroy();
        }
        if (this._deferredRendering) {
            this._destroyDeferredRenderBuffer();
        }
        const gl = this._gl;
        this._frameBuffer = new SingleBuffer(gl, this._getFrameBufferSpec());
        // this._accumulationBuffer = new DoubleBuffer(gl, this._getAccumulationBufferSpec());
        this._renderBuffer = new SingleBuffer(gl, this._getRenderBufferSpec());
        if (this._deferredRendering)
            this._buildDeferredRenderBuffer();
    }

    _buildDeferredRenderBuffer() {
        const gl = this._gl;
        this._defferedRenderBuffer = new SingleBuffer(gl, this._getDeferredRenderBufferSpec());
    }

    _destroyDeferredRenderBuffer() {
        this._defferedRenderBuffer.destroy();
        this._defferedRenderBuffer = null;
    }

    reset() {}

    _resetFrame() {}

    _generateFrame() {}

    _integrateFrame() {
        const gl = this._gl;
        if (!this._mcEnabled || !this._preIterationsDone)
            return;
        let program = this._programs.integrate;
        gl.useProgram(program.program);

        const dimensions = this._lightVolumeDimensions;
        const uSize = [dimensions.width, dimensions.height, dimensions.depth];
        const uStep = [1 / dimensions.width, 1 / dimensions.height, 1 / dimensions.depth];

        const iterations = Math.min(this._layersPerFrame, this._lightVolumeDimensions.depth);

        const startingDepth = this._currentDepth;
        let currentDepth = startingDepth

        for (let i = 0; i < iterations; i++) {
            this._accumulationBuffer.use(currentDepth);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[0]);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[1]);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[2]);
            gl.activeTexture(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[3]);

            gl.activeTexture(gl.TEXTURE4);
            gl.bindTexture(gl.TEXTURE_3D, this._volume.getTexture());
            gl.activeTexture(gl.TEXTURE5);
            gl.bindTexture(gl.TEXTURE_2D, this._transferFunction);

            gl.activeTexture(gl.TEXTURE6);
            gl.bindTexture(gl.TEXTURE_2D, this._lightsTexture);

            gl.uniform1i(program.uniforms.uPosition, 0);
            gl.uniform1i(program.uniforms.uDirectionAndTransmittance, 1);
            gl.uniform1i(program.uniforms.uDistanceTravelledAndSamples, 2);
            gl.uniform1i(program.uniforms.uRadianceAndDiffusion, 3);
            gl.uniform1i(program.uniforms.uVolume, 4);
            gl.uniform1i(program.uniforms.uTransferFunction, 5);
            gl.uniform1i(program.uniforms.uLights, 6);

            gl.uniform1ui(program.uniforms.uSteps, this._steps);
            // gl.uniform1ui(program.uniforms.uNLights, this._nActiveLights);
            gl.uniform1f(program.uniforms.uLayer, (currentDepth + 0.5) / dimensions.depth);

            gl.uniform1f(program.uniforms.uAbsorptionCoefficient, this._absorptionCoefficientMC)
            gl.uniform1f(program.uniforms.uMajorant, this._majorant);
            gl.uniform1f(program.uniforms.uRandSeed, Math.random());

            // const dimensions = this._lightVolumeDimensions;
            // gl.uniform3f(program.uniforms.uSize, dimensions.width, dimensions.height, dimensions.depth);

            // const light = this._lightDefinitions[0];
            // const lightArr = light.getLightArr();
            // gl.uniform4f(program.uniforms.uLight, lightArr[0], lightArr[1], lightArr[2], light.typeToInt());

            gl.drawBuffers([
                gl.COLOR_ATTACHMENT0,
                gl.COLOR_ATTACHMENT1,
                gl.COLOR_ATTACHMENT2,
                gl.COLOR_ATTACHMENT3
            ]);

            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

            currentDepth++;

            if (currentDepth >= this._lightVolumeDimensions.depth) {
                currentDepth = 0
                this._accumulationBuffer.swap();
            }
        }

        if (this._diffusionEnabled) {
            this._accumulationBuffer.swap();
            program = this._programs.diffuse;
            gl.useProgram(program.program);

            currentDepth = startingDepth;

            for (let i = 0; i < iterations; i++) {
                this._accumulationBuffer.use(currentDepth);

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[0]);
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[1]);
                gl.activeTexture(gl.TEXTURE2);
                gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[2]);
                gl.activeTexture(gl.TEXTURE3);
                gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[3]);
                gl.activeTexture(gl.TEXTURE4);
                gl.bindTexture(gl.TEXTURE_3D, this._volume.getTexture());
                gl.activeTexture(gl.TEXTURE5);
                gl.bindTexture(gl.TEXTURE_2D, this._transferFunction);

                gl.uniform1i(program.uniforms.uPosition, 0);
                gl.uniform1i(program.uniforms.uDirectionAndTransmittance, 1);
                gl.uniform1i(program.uniforms.uDistanceTravelledAndSamples, 2);
                gl.uniform1i(program.uniforms.uRadianceAndDiffusion, 3);
                gl.uniform1i(program.uniforms.uVolume, 4);
                gl.uniform1i(program.uniforms.uTransferFunction, 5);

                gl.uniform1f(program.uniforms.uLayer, (currentDepth + 0.5) / dimensions.depth);
                // console.log(this._scattering, Math.floor(this._lightVolumeRatio))
                gl.uniform1f(program.uniforms.uScattering, this._scattering);
                gl.uniform1f(program.uniforms.uAbsorptionCoefficient, this._absorptionCoefficientMC);
                gl.uniform1f(program.uniforms.uRatio, Math.floor(this._lightVolumeRatio));

                gl.uniform3fv(program.uniforms.uStep, uStep);
                gl.uniform3fv(program.uniforms.uSize, uSize);

                gl.drawBuffers([
                    gl.COLOR_ATTACHMENT0,
                    gl.COLOR_ATTACHMENT1,
                    gl.COLOR_ATTACHMENT2,
                    gl.COLOR_ATTACHMENT3
                ]);

                gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

                currentDepth++;

                if (currentDepth >= this._lightVolumeDimensions.depth) {
                    currentDepth = 0
                }
                // this._accumulationBuffer.swap();
            }
        }

        this._currentDepth = currentDepth
    }

    _integrateFrameENV() {
        const gl = this._gl;
        // if (!this._mcEnabled || !this._preIterationsDone)
        //     return;
        if (!this._mcEnabled || this._done)
            return
        if ((this._iterationsLimit !== 0  && this._counter >= this._iterationsLimit) ||
            (this._timer !== 0 && this._elapsedTime >= this._timer * 1000)) {
            if (!this._done) {
                this._done = true
                console.log("Rendering stopped, total time:", this._elapsedTime)
            }
            return
        }
        let program = this._programs.integrateENV;
        gl.useProgram(program.program);

        const dimensions = this._lightVolumeDimensions;
        // console.log(this._layersPerFrame)
        // const iterations = Math.min(this._layersPerFrame, this._lightVolumeDimensions.depth);
        const iterations = this._lightVolumeDimensions.depth
        // let currentDepth = this._currentDepth
        let currentDepth = 0
        // console.log("IT:", iterations, "CD:", this._currentDepth)
        for (let i = 0; i < iterations; i++) {
        // for (let currentDepth = 0; currentDepth < this._lightVolumeDimensions.depth; currentDepth++) {
            this._accumulationBuffer.use(currentDepth);


            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[0]);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[1]);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[2]);
            gl.activeTexture(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[3]);

            gl.activeTexture(gl.TEXTURE4);
            gl.bindTexture(gl.TEXTURE_3D, this._volume.getTexture());
            gl.activeTexture(gl.TEXTURE5);
            gl.bindTexture(gl.TEXTURE_2D, this._environmentTexture);
            gl.activeTexture(gl.TEXTURE6);
            gl.bindTexture(gl.TEXTURE_2D, this._transferFunction);



            gl.uniform1i(program.uniforms.uPosition, 0);
            gl.uniform1i(program.uniforms.uDirection, 1);
            gl.uniform1i(program.uniforms.uTransmittance, 2);
            gl.uniform1i(program.uniforms.uRadiance, 3);
            gl.uniform1i(program.uniforms.uVolume, 4);
            gl.uniform1i(program.uniforms.uEnvironment, 5);
            gl.uniform1i(program.uniforms.uTransferFunction, 6);

            gl.uniform1ui(program.uniforms.uSteps, this._steps);
            gl.uniform1f(program.uniforms.uLayer, (currentDepth + 0.5) / dimensions.depth);

            gl.uniform1f(program.uniforms.uAbsorptionCoefficient, this._absorptionCoefficientMC)

            gl.uniform1f(program.uniforms.uScatteringCoefficient, this._scatteringCoefficientMC);
            gl.uniform1f(program.uniforms.uScatteringBias, this._scatteringBias);
            gl.uniform1ui(program.uniforms.uMaxBounces, this._maxBounces);

            gl.uniform1f(program.uniforms.uMajorant, this._majorant);
            gl.uniform1f(program.uniforms.uRandSeed, Math.random());

            gl.drawBuffers([
                gl.COLOR_ATTACHMENT0,
                gl.COLOR_ATTACHMENT1,
                gl.COLOR_ATTACHMENT2,
                gl.COLOR_ATTACHMENT3
            ]);

            gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

            currentDepth++;
            // console.log(currentDepth, this._lightVolumeDimensions.depth)
            // if (currentDepth >= this._lightVolumeDimensions.depth) {
            //     // console.log("LALA")
            //     currentDepth = 0
            //     this._accumulationBuffer.swap();
            // }
        }

        this._currentDepth = currentDepth
    }

    _renderFrame() {
        const gl = this._gl;

        const program = this._programs.render;
        gl.useProgram(program.program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, this._volume.getTexture());
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._transferFunction);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[3]);

        gl.uniform1i(program.uniforms.uVolume, 0);
        gl.uniform1i(program.uniforms.uTransferFunction, 1);
        gl.uniform1i(program.uniforms.uRadianceAndDiffusion, 2);

        gl.uniform1f(program.uniforms.uStepSize, this._stepSize);
        gl.uniform1f(program.uniforms.uOffset, Math.random());
        gl.uniform1f(program.uniforms.uAlphaCorrection, this._alphaCorrection);

        gl.uniformMatrix4fv(program.uniforms.uMvpInverseMatrix, false, this._mvpInverseMatrix.m);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    _deferredRenderFrame() {
        const gl = this._gl;

        this._defferedRenderBuffer.use()

        let program = this._programs.deferredRender;
        gl.useProgram(program.program);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, this._volume.getTexture());
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._transferFunction);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_3D, this._accumulationBuffer.getAttachments().color[3]);

        gl.uniform1i(program.uniforms.uVolume, 0);
        gl.uniform1i(program.uniforms.uTransferFunction, 1);
        gl.uniform1i(program.uniforms.uRadianceAndDiffusion, 2);

        gl.uniform1f(program.uniforms.uStepSize, this._stepSize);
        gl.uniform1f(program.uniforms.uOffset, Math.random());
        gl.uniform1f(program.uniforms.uAlphaCorrection, this._alphaCorrection);

        gl.uniformMatrix4fv(program.uniforms.uMvpInverseMatrix, false, this._mvpInverseMatrix.m);

        gl.drawBuffers([
            gl.COLOR_ATTACHMENT0,
            gl.COLOR_ATTACHMENT1
        ]);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    _combineRenderFrame() {
        const gl = this._gl;
        const program = this._programs.combineRender;
        gl.useProgram(program.program);

        this._renderBuffer.use()

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._defferedRenderBuffer.getAttachments().color[1]);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._defferedRenderBuffer.getAttachments().color[0]);

        gl.uniform1i(program.uniforms.uColor, 0);
        gl.uniform1i(program.uniforms.uLighting, 1);

        gl.uniform1i(program.uniforms.uSmartDeNoise, this._smartDeNoise ? 1 : 0);
        gl.uniform1f(program.uniforms.uSigma, this._smartDeNoiseSigma);
        gl.uniform1f(program.uniforms.uKSigma, this._smartDeNoiseKSigma);
        gl.uniform1f(program.uniforms.uTreshold, this._smartDeNoiseThreshold);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    _getFrameBufferSpec() {
        const gl = this._gl;
        return [{
            width          : this._bufferSize,
            height         : this._bufferSize,
            min            : gl.NEAREST,
            mag            : gl.NEAREST,
            format         : gl.RGBA,
            internalFormat : gl.RGBA,
            type           : gl.UNSIGNED_BYTE
        }];
    }

    _getAccumulationBufferSpec() {
        const gl = this._gl;

        const width = this._lightVolumeDimensions.width;
        const height = this._lightVolumeDimensions.height;
        const depth = this._lightVolumeDimensions.depth;

        const positionBufferSpec = {
            target         : gl.TEXTURE_3D,
            width          : width,
            height         : height,
            depth          : depth,
            min            : gl.NEAREST,
            mag            : gl.NEAREST,
            // format         : gl.RGB,
            // internalFormat : gl.RGB32F,
            format         : gl.RGBA,
            internalFormat : gl.RGBA32F,
            type           : gl.FLOAT,
            wrapS          : gl.CLAMP_TO_EDGE,
            wrapT          : gl.CLAMP_TO_EDGE,
            wrapR          : gl.CLAMP_TO_EDGE,
            storage        : true
        };

        const directionAndTransmittanceBufferSpec = {
            target         : gl.TEXTURE_3D,
            width          : width,
            height         : height,
            depth          : depth,
            min            : gl.NEAREST,
            mag            : gl.NEAREST,
            // format         : gl.RGBA,
            // internalFormat : gl.RGBA32F,
            format         : gl.RGBA,
            internalFormat : gl.RGBA32F,
            type           : gl.FLOAT,
            wrapS          : gl.CLAMP_TO_EDGE,
            wrapT          : gl.CLAMP_TO_EDGE,
            wrapR          : gl.CLAMP_TO_EDGE,
            storage        : true
        };

        const distanceTravelledAndSample = {
            target         : gl.TEXTURE_3D,
            width          : width,
            height         : height,
            depth          : depth,
            min            : gl.NEAREST,
            mag            : gl.NEAREST,
            // format         : gl.RGB,
            // internalFormat : gl.RGB32F,
            format         : gl.RGBA,
            internalFormat : gl.RGBA32F,
            type           : gl.FLOAT,
            wrapS          : gl.CLAMP_TO_EDGE,
            wrapT          : gl.CLAMP_TO_EDGE,
            wrapR          : gl.CLAMP_TO_EDGE,
            storage        : true
        };

        const radianceAndDiffusion = {
            target         : gl.TEXTURE_3D,
            width          : width,
            height         : height,
            depth          : depth,
            min            : gl.LINEAR,
            mag            : gl.LINEAR,
            // min            : gl.NEAREST,
            // mag            : gl.NEAREST,
            // format         : gl.RG,
            // internalFormat : gl.RG32F,
            format         : gl.RGBA,
            internalFormat : gl.RGBA32F,
            type           : gl.FLOAT,
            wrapS          : gl.CLAMP_TO_EDGE,
            wrapT          : gl.CLAMP_TO_EDGE,
            wrapR          : gl.CLAMP_TO_EDGE,
            storage        : true
        };

        return [
            positionBufferSpec,
            directionAndTransmittanceBufferSpec,
            distanceTravelledAndSample,
            radianceAndDiffusion
        ];
    }

    _getDeferredRenderBufferSpec() {
        const gl = this._gl;

        const lighting = {
            width          : this._bufferSize,
            height         : this._bufferSize,
            min            : gl.NEAREST,
            mag            : gl.NEAREST,
            wrapS          : gl.CLAMP_TO_EDGE,
            wrapT          : gl.CLAMP_TO_EDGE,
            format         : gl.RGBA,
            internalFormat : gl.RGBA16F,
            // format         : gl.RED,
            // internalFormat : gl.R32F,
            type           : gl.FLOAT
        };

        const color = {
            width          : this._bufferSize,
            height         : this._bufferSize,
            min            : gl.NEAREST,
            mag            : gl.NEAREST,
            wrapS          : gl.CLAMP_TO_EDGE,
            wrapT          : gl.CLAMP_TO_EDGE,
            format         : gl.RGBA,
            internalFormat : gl.RGBA16F,
            type           : gl.FLOAT
        };
        return [
            lighting,
            color
        ];
    }
}