// #part /js/PerlinNoiseGenerator

class PerlinNoiseGenerator {
    // Based on https://rtouti.github.io/graphics/perlin-noise-algorithm

    // Original Ken Perlin permutation
    static permutation = [
        151,160,137,91,90,15,
        131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
        190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
        88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
        77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
        102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
        135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
        5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
        223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
        129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
        251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
        49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
        138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
    ];

    static dot(u, v) {
        return u[0]*v[0] + u[1]*v[1];
    }

    static getConstantVector(v) {
        let h = v & 3;
        if (h == 0) {
            return [1.0, 1.0];
        }
        if (h == 1) {
            return [-1.0, 1.0];
        }
        if (h == 2) {
            return [-1.0, -1.0];
        }
        return [1.0, -1.0];
    }

    static lerp(t, a1, a2) {
        return a1 + t * (a2 - a1);
    }

    static fade(t) {
        return 6 * Math.pow(t, 5) - 15 * Math.pow(t, 4) + 10 * Math.pow(t, 3);
    }

    static perlinNoise(x, y) {
        // First vector
        let X = Math.floor(x) & 255;
        let Y = Math.floor(y) & 255;
        let dX = x - Math.floor(x);
        let dY = y - Math.floor(y);

        let topRight    = [dX-1.0, dY-1.0];
        let topLeft     = [dX,     dY-1.0];
        let bottomRight = [dX-1.0, dY];
        let bottomLeft  = [dX,     dY];

        let valueTopRight = PerlinNoiseGenerator.permutation[
            PerlinNoiseGenerator.permutation[X+1] + Y + 1
        ];
        let valueTopLeft = PerlinNoiseGenerator.permutation[
            PerlinNoiseGenerator.permutation[X] + Y + 1
        ];
        let valueBottomRight = PerlinNoiseGenerator.permutation[
            PerlinNoiseGenerator.permutation[X+1] + Y
        ];
        let valueBottomLeft = PerlinNoiseGenerator.permutation[
            PerlinNoiseGenerator.permutation[X] + Y
        ];

        let constantTopRight = PerlinNoiseGenerator.getConstantVector(valueTopRight);
        let constantTopLeft = PerlinNoiseGenerator.getConstantVector(valueTopLeft);
        let constantBottomRight = PerlinNoiseGenerator.getConstantVector(valueBottomRight);
        let constantBottomLeft = PerlinNoiseGenerator.getConstantVector(valueBottomLeft);

        let dotTopRight = PerlinNoiseGenerator.dot(topRight, constantTopRight);
        let dotTopLeft = PerlinNoiseGenerator.dot(topLeft, constantTopLeft);
        let dotBottomRight = PerlinNoiseGenerator.dot(bottomRight, constantBottomRight);
        let dotBottomLeft = PerlinNoiseGenerator.dot(bottomLeft, constantBottomLeft);

        let u = PerlinNoiseGenerator.fade(dX);
        let v = PerlinNoiseGenerator.fade(dY);
        
        let lerpLeft = PerlinNoiseGenerator.lerp(v, dotBottomLeft, dotTopLeft);
        let lerpRight = PerlinNoiseGenerator.lerp(v, dotBottomRight, dotTopRight);

        return PerlinNoiseGenerator.lerp(u, lerpLeft, lerpRight);
    }
}