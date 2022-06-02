import { TFGeneratedTexture } from "../TFGeneratedTexture.js";

export class SelectionBox {

    constructor() {
        this.parent = null;
        this.selected = false;
        this.html = document.createElement("div");
        this.html.classList.add("selection-box");
        this.html.classList.add("selection-box-deselected");
        
        this.tfCanvas = document.createElement("canvas");
        this.html.appendChild(this.tfCanvas)

        this.html.addEventListener('click', () => {
            if (this.parent.app._status == "ready") {
                this.parent.updateSelected(this);
            }
        })

        // The size of TF is given here
        this.transferFunctionTexture = new TFGeneratedTexture(255, 1);
    }

    updateTFTextureByRadius(texture, r) {
        /*this.transferFunctionTexture.generateRandomTexture(
            this.transferFunctionTexture.width,
            this.transferFunctionTexture.height
        );*/
        this.transferFunctionTexture.generateTextureInRadius(texture, r);
        this.transferFunctionTexture.updateCanvas(this.tfCanvas);
    }

    updateTFTexture() {
        this.transferFunctionTexture.generateRandomTexture(this.transferFunctionTexture.width, this.transferFunctionTexture.height);
        this.transferFunctionTexture.updateCanvas(this.tfCanvas);
    }

    setParent(object) {
        this.parent = object;
    }

    select() {
        this.selected = true;
        if (!this.html.classList.contains("selection-box-selected")) {
            this.html.classList.remove("selection-box-deselected");
            this.html.classList.add("selection-box-selected");
        }
    }

    deselect() {
        this.selected = false;
        if (this.html.classList.contains("selection-box-selected")) {
            this.html.classList.remove("selection-box-selected");
            this.html.classList.add("selection-box-deselected");
        }
    }

    updateThreshold(threshold) {
        this.transferFunctionTexture.alpha_threshold = threshold;
        this.updateTFTexture();
    }
}