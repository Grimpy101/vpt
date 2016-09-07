(function(global) {

global.VolumeRenderer = VolumeRenderer;
function VolumeRenderer(canvas) {
    var raycaster = new VolumeRayCaster(canvas);

    this.resize = function(width, height) {
        raycaster.resize(width, height);
    };

    this.setVolume = function(volume) {
        raycaster.setVolume(volume);
    };

    this.render = function() {
        raycaster.render();
    };

    this.onMouseDown = function(e) {
        e.preventDefault();
        this.render();
    }.bind(this);

    canvas.addEventListener('mousedown', this.onMouseDown);

    function temprender() {
        raycaster.render();
        requestAnimationFrame(temprender);
    }
    requestAnimationFrame(temprender);

}

global.VolumeRayCaster = VolumeRayCaster;
function VolumeRayCaster(canvas) {
    var volume, gl, vbo, program;
    var camera;

    function init() {
        camera = new Camera();

        try {
            gl = WebGLUtils.getContext(canvas, ['webgl2', 'experimental-webgl2']);

            // create volume
            volume = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_3D, volume);
            gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F,
                1, 1, 1,
                0, gl.RED, gl.FLOAT, new Float32Array([1]));
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
            gl.bindTexture(gl.TEXTURE_3D, null);

            // create quad
            vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,1,1,-1,1]), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);

            // create shaders
            program = WebGLUtils.createProgram(gl, [
                WebGLUtils.createShader(gl, Shaders.mip.vertex, gl.VERTEX_SHADER),
                WebGLUtils.createShader(gl, Shaders.mip.fragment, gl.FRAGMENT_SHADER)
            ]);
        } catch(e) {
            gl = undefined;
            console.error(e);
        }
    }

    this.resize = function(width, height) {
        canvas.width = width;
        canvas.height = height;
        if (gl) {
            gl.viewport(0, 0, width, height);
        }
    };

    this.setVolume = function(_volume) {
        if (!gl) {
            return;
        }

        gl.bindTexture(gl.TEXTURE_3D, volume);
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F,
            _volume.width, _volume.height, _volume.depth,
            0, gl.RED, gl.FLOAT, _volume.data);
        gl.bindTexture(gl.TEXTURE_3D, null);
    };

    this.render = function() {
        if (!gl) {
            return;
        }

        // update camera
        var angle = +Date.now() * 0.002;
        //camera.fovY = 0.5 + 0.5 * Math.sin(angle);
        //camera.position.z = 5 * Math.sin(angle);
        //camera.rotation.set(0, 1, 0, angle + Math.PI / 2).fromAxisAngle();
        camera.updateViewMatrix();
        camera.updateProjectionMatrix();
        var mat = new Matrix();
        mat.copy(camera.projectionMatrix).transpose().inv();

        // use shader
        gl.useProgram(program.program);

        // set volume
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, volume);

        // set vbo
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        var aPosition = program.attributes['aPosition'];
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

        // set uniforms
        gl.uniform1i(program.uniforms['uVolume'], 0);
        gl.uniformMatrix4fv(program.uniforms['uMvpMatrix'], false, mat.m);

        // render
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        // clean up
        gl.disableVertexAttribArray(aPosition);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_3D, null);
    };

    init();

}

})(this);