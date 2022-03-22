// #part /js/TFGeneratedTexture

class TFGeneratedTexture {

    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.texture = new Uint8Array(w * h * 4);
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
}