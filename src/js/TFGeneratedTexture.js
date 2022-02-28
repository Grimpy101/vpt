// #part /js/TFGeneratedTexture

class TFGeneratedTexture {

    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.texture = new Uint8Array(w * h * 4);
        this.generateRandomTexture(w, h, 1);
    }

    generateRandomTexture(w, h, n) {
        if (w != this.width || h != this.height) {
            this.resizeTexture(w, h);
        }
        
        this.texture.fill(0);

        for (let i = 0; i < n; i++) {
            let index = Math.floor(Math.random() * w * h);
            
            let r = Math.floor(Math.random() * 256);
            let g = Math.floor(Math.random() * 256);
            let b = Math.floor(Math.random() * 256);
            //let a = Math.floor(Math.random() * 256);
            let a = 255;

            this.texture[index] = r;
            this.texture[index + 1] = g;
            this.texture[index + 2] = b;
            this.texture[index + 3] = a;
        }
        //console.log(this.texture);
    }

    resizeTexture(w, h) {
        this.width = w;
        this.height = h;
        this.transferFunctionTexture = new Uint8Array(w * h * 4);
        this.transferFunctionTexture.fill(0);
    }
}