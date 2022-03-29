// #part /js/TFGeneratedTexture

// #link PerlinNoiseGenerator

class TFGeneratedTexture {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.texture = new Uint8Array(w * h * 4);

        this.size = 0.05;
        this.alpha = 5;
        this.beta = 2;

        this.generateRandomTexture(w, h);
    }

    generateRandomTexture(w, h) {
        if (w != this.width || h != this.height) {
            this.resizeTexture(w, h);
        }

        let dispX = Math.random() * 255;
        let dispY = Math.random() * 255;

        for (let i = 0; i < this.texture.length; i+=4) {
            let perlin1 = (PerlinNoiseGenerator.perlinNoise((i / 4) * this.size + dispX, dispY) + 1) * 0.5;
            let perlin2 = (PerlinNoiseGenerator.perlinNoise((i / 4) * this.size + dispY, dispX) + 1) * 0.5 * 0.8;
            let hue = perlin1 * 360;
            let saturation = TFGeneratedTexture.betaDistribution(this.alpha, this.beta);
            let value = TFGeneratedTexture.betaDistribution(this.alpha, this.beta);
            //console.log(hue, saturation, value);

            let rgb = TFGeneratedTexture.hsv2rgb(hue, saturation, value);

            this.texture[i] = rgb[0];
            this.texture[i+1] = rgb[1];
            this.texture[i+2] = rgb[2];
            // Maybe multimodal distribution instead?
            // OR interpolate between randomly selected few values in the texture?
            this.texture[i+3] = perlin2 * 255;
        }

        this.someAlphaChannelMagic1();
    }

    // Does this even make sense?
    someAlphaChannelMagic1() {
        let len = this.width * this.height;
        let startValue = 0;
        const indices = [];

        let flipSwitch = Math.round(Math.random());
        startValue = flipSwitch * 255;
        for (let i = 0; i < len; i++) {
            if (TFGeneratedTexture.betaDistribution(this.alpha, this.beta) <= 0.5) {
                indices.push(i);
                this.texture[i] = flipSwitch * 255;
                flipSwitch = (flipSwitch + 1) % 2;
            }
        }

        let indexCounter = -1;
        for (let i = 0; i < len; i++) {
            let start = 0;
            let end = len;
            if (indexCounter >= 0) start = indices[indexCounter];
            if (indexCounter + 1 < indices.length) end = indices[indexCounter + 1];

            if (end - start != 0) {
                this.texture[i * 4 + 3] = this.texture[start] + (i - start)/(end - start) * (this.texture[end] - this.texture[start]);
            } else {
                this.texture[i * 4 + 3] = this.texture[end];
            }

            if (indexCounter == end) indexCounter++;
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

        return [R, G, B];
    }

    resizeTexture(w, h) {
        this.width = w;
        this.height = h;
        this.transferFunctionTexture = new Uint8Array(w * h * 4);
        this.transferFunctionTexture.fill(0);
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