import { WebGL } from './WebGL.js';

export class Volume extends EventTarget {

constructor(gl, reader, options) {
    super();

    Object.assign(this, {
        ready: false
    }, options);

    this._gl = gl;
    this._reader = reader;

    this.meta       = null;
    this.modalities = null;
    this.blocks     = null;
    this._texture   = null;

    this.threshold = 0;
}

destroy() {
    const gl = this._gl;
    if (this._texture) {
        gl.deleteTexture(this._texture);
    }
}

async readMetadata() {
    if (!this._reader) {
        return;
    }

    this.ready = false;
    const data = await this._reader.readMetadata();
    this.meta = data.meta;
    this.modalities = data.modalities;
    this.blocks = data.blocks;
}

async readModality(modalityName) {
    if (!this._reader) {
        throw new Error('No reader');
    }

    if (!this.modalities) {
        throw new Error('No modalities');
    }

    this.ready = false;
    const modality = this.modalities.find(modality => modality.name === modalityName);
    if (!modality) {
        throw new Error('Modality does not exist');
    }

    const dimensions = modality.dimensions;
    const components = modality.components;
    const blocks = this.blocks;

    const gl = this._gl;
    if (this._texture) {
        gl.deleteTexture(this._texture);
    }
    this._texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this._texture);

    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texStorage3D(gl.TEXTURE_3D, 1, modality.internalFormat,
        dimensions.width, dimensions.height, dimensions.depth);
    
    const typedData = []
    let maxValue = 0;

    for (const [index, placement] of modality.placements.entries()) {
        const data = await this._reader.readBlock(placement.index);
        
        const dataArray = new Uint8Array(data);
        for (let arrayItem of dataArray) {
            maxValue = Math.max(maxValue, arrayItem);
        }
        typedData.push(...dataArray);

        const progress = (placement.index + 1) / modality.placements.length;
        this.dispatchEvent(new CustomEvent('progress', { detail: progress }));
        const position = placement.position;
        const block = blocks[placement.index];
        const blockdim = block.dimensions;
        gl.bindTexture(gl.TEXTURE_3D, this._texture);
        gl.texSubImage3D(gl.TEXTURE_3D, 0,
            position.x, position.y, position.z,
            blockdim.width, blockdim.height, blockdim.depth,
            modality.format, modality.type, this._typize(data, modality.type));
    }

    this.methodOtsu(typedData, maxValue);


    this.ready = true;
}

methodOtsu(data, max) {
    let bestThreshold = 0;
    let minCriteria = Infinity;

    for (let t = 0; t <= max; t++) {
        let positiveHitsCount = 0;
        let mean1 = 0;
        let mean2 = 0;
        
        for (let i = 0; i < data.length; i++) {
            if (data[i] >= t) {
                positiveHitsCount += 1;
                mean1 += data[i];
            } else {
                mean2 += data[i];
            }
        }

        mean1 = (positiveHitsCount != 0) ? (mean1 / positiveHitsCount) : 0;
        mean2 = (data.length - positiveHitsCount != 0) ? (mean2 / (data.length - positiveHitsCount)) : 0;

        let weight1 = positiveHitsCount / data.length;
        let weight2 = 1 - weight1;

        if (weight1 == 0 || weight2 == 0) {
            continue;
        }

        let variance1 = 0;
        let variance2 = 0;
        for (let i = 0; i < data.length; i++) {
            if (data[i] >= t) {
                variance1 += (data[i] - mean1)*(data[i] - mean1);
            } else {
                variance2 += (data[i] - mean2)*(data[i] - mean2);
            }
        }

        variance1 = (positiveHitsCount - 1 != 0) ? variance1 / (positiveHitsCount - 1) : 0;
        variance2 = (data.length - positiveHitsCount - 1 != 0) ? variance2 / (data.length - positiveHitsCount - 1) : 0;

        let criteria = weight1 * variance1 + weight2 * variance2;
        if (criteria < minCriteria) {
            minCriteria = criteria;
            bestThreshold = t;
        }
    }

    this.dispatchEvent(new CustomEvent('threshold', { detail: bestThreshold }));
}

_typize(data, type) {
    const gl = this._gl;
    switch (type) {
        case gl.BYTE:                         return new Int8Array(data);
        case gl.UNSIGNED_BYTE:                return new Uint8Array(data);
        case gl.UNSIGNED_BYTE:                return new Uint8ClampedArray(data);
        case gl.SHORT:                        return new Int16Array(data);
        case gl.UNSIGNED_SHORT:               return new Uint16Array(data);
        case gl.UNSIGNED_SHORT_5_6_5:         return new Uint16Array(data);
        case gl.UNSIGNED_SHORT_5_5_5_1:       return new Uint16Array(data);
        case gl.UNSIGNED_SHORT_4_4_4_4:       return new Uint16Array(data);
        case gl.INT:                          return new Int32Array(data);
        case gl.UNSIGNED_INT:                 return new Uint32Array(data);
        case gl.UNSIGNED_INT_5_9_9_9_REV:     return new Uint32Array(data);
        case gl.UNSIGNED_INT_2_10_10_10_REV:  return new Uint32Array(data);
        case gl.UNSIGNED_INT_10F_11F_11F_REV: return new Uint32Array(data);
        case gl.UNSIGNED_INT_24_8:            return new Uint32Array(data);
        case gl.HALF_FLOAT:                   return new Uint16Array(data);
        case gl.FLOAT:                        return new Float32Array(data);
        default: throw new Error('Unknown volume datatype: ' + type);
    }
}

getTexture() {
    if (this.ready) {
        return this._texture;
    } else {
        return null;
    }
}

setFilter(filter) {
    if (!this._texture) {
        return;
    }

    const gl = this._gl;
    filter = filter === 'linear' ? gl.LINEAR : gl.NEAREST;
    gl.bindTexture(gl.TEXTURE_3D, this._texture);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filter);
}

}
