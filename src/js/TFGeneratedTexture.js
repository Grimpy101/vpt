// #part /js/TFGeneratedTexture

class TFGeneratedTexture {

    // Ken Perlin's random permutations
    static permutation = [151,160,137,91,90,15,
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
        138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];

    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.texture = new Uint8Array(w * h * 4);

        this.repeat = 0;
        this.p = new Int16Array(512);
        for (let i = 0; i < 512; i++) {
            this.p[i] = TFGeneratedTexture.permutation[i % 256];
        }

        this.generateRandomTexture(w, h);
    }

    generateRandomTexture(w, h) {
        if (w != this.width || h != this.height) {
            this.resizeTexture(w, h);
        }

        for (let i = 0; i < this.texture.length; i+=4) {
            let r = Math.floor(Math.random() * 256);
            let g = Math.floor(Math.random() * 256);
            let b = Math.floor(Math.random() * 256);
            let a = 0;
            let aRand = Math.random();
            if (aRand >= 0.5) {
                a = 255;
            }

            this.texture[i] = r;
            this.texture[i + 1] = g;
            this.texture[i + 2] = b;
            this.texture[i + 3] = a;
        }
    }

    generateTextureInRadius(texture, r) {
        // Box-Muller transform + Dropped Coordinates
        const sphereVector = new Float32Array(this.width * this.height * 4 + 2);
        let sum = 0;
        for (let i = 0; i < sphereVector.length; i+=2) {
            let u1 = Math.random();
            let u2 = Math.random();
            let R = Math.sqrt(-2 * Math.log(u1));
            let phi = 2 * Math.PI * u2;
            
            let z0 = R * Math.cos(phi);
            let z1 = R * Math.sin(phi);

            sphereVector[i] = z0;
            sum += Math.pow(sphereVector[i], 2);
            if (i+1 < sphereVector.length) {
                sphereVector[i+1] = z1;
                sum += Math.pow(sphereVector[i+1], 2);
            }
        }

        let norm = Math.sqrt(sum);

        for (let i = 0; i < sphereVector.length; i++) {
            sphereVector[i] = sphereVector[i] / norm;
        }

        for (let i = 0; i < this.texture.length; i++) {
            let elem = Math.round((sphereVector[i] * r) + texture[i]);
            if (elem > 255 || elem < 0) {
                this.generateRandomTexture(this.width, this.height);
                return;
            }
            this.texture[i] = Math.min(Math.max(elem, 0), 255);
        }
    }

    // Using degrees, not radians for h!
    // s and v contain interval [0, 1]
    static hsv2rgb(h, s, v) {
        let C = v * s;
        let H1 = h / 60;
        let X = C * (1 - Math.abs((H1 % 2) - 1));
        console.log(C, X, H1);

        let R = 0;
        let G = 0;
        let B = 0;
        if (0 <= H1 && H1 < 1) {
            R = C;
            G = X;
            B = 0;
        } else if (1 <= H1 && H1 < 2) {
            R = X;
            G = C;
            B = 0;
        } else if (2 <= H1 && H1 < 3) {
            R = 0;
            C = G;
            B = X;
        } else if (3 <= H1 && H1 < 4) {
            R = 0;
            G = X;
            B = C;
        } else if (4 <= H1 && H1 < 5) {
            R = X;
            G = 0;
            B = C;
        } else if (5 <= H1 && H1 < 6) {
            R = C;
            G = 0;
            B = X;
        }

        let m = v - C;
        R = (R + m) * 255;
        G = (G + m) * 255;
        B = (B + m) * 255;

        return (R, G, B);
    }

    resizeTexture(w, h) {
        this.width = w;
        this.height = h;
        this.transferFunctionTexture = new Uint8Array(w * h * 4);
        this.transferFunctionTexture.fill(0);
    }

    static dotProduct(x, y) {
        return x[0]*y[0] + x[1]*y[1];
    }

    static lerp(start, end, t) {
        let diff = end - start;
        let relPos = t * diff;
        return start + relPos;
    }

    static grad(hash, x) {
        switch(hash % 2) {
            case 0: return x;
            case 1: return -x;
        }
    }

    static fade(t) {
        let e1 = 6  * Math.pow(t, 5);
        let e2 = 15 * Math.pow(t, 4);
        let e3 = 10 * Math.pow(t, 3);
        return e1 - e2 + e3;
    }

    increment(x) {
        x = x + 1;
        if (this.repeat > 0) {
            x = x % this.repeat;
        }
        return x;
    }

    perlinNoise(x) {
        if (this.repeat > 0) {
            x = x % this.repeat;
        }
        let cx0 = Math.floor(x) % 255;
        let cx = x - Math.floor(x);

        let u = TFGeneratedTexture.fade(cx);

        let a = this.p[cx0];
        let b = this.p[this.increment(cx0)];

        let x1 = lerp(grad(a, cx), grad(b, cx-1), u);
        return x1;
    }

    static exponentialDistribution(lambda) {
        let rand = Math.random();
        while (rand == 0) rand = Math.random();
        return -(Math.log(1 - rand))/lambda;
    }

    static gammaDistribution(k, phi) {
        let n = Math.floor(k);
        
        let dist1 = 0;
        for (let i = 1; i <= n; i++) {
            dist1 += TFGeneratedTexture.exponentialDistribution(1);
        }

        return phi * dist1;
    }

    static betaDistribution(alpha, beta) {
        let phi = 1;
        let X = TFGeneratedTexture.gammaDistribution(alpha, phi);
        let Y = TFGeneratedTexture.gammaDistribution(beta, phi);
        return X / (X + Y);
    }
}