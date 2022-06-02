export class GenerationContainer extends EventTarget {

    constructor(app) {
        super();
        this.html = document.createElement("div");
        this.html.classList.add("generation-container");
        this.boxes = [];
        this.app = app

        this.i = -1;
        this.history = [];

        this.selectedBox = null;
        // What should radius be?
        this.radius = 250;
    }

    appendTo(object) {
        object.appendChild(this.html);
    }

    addTextureToHistory(boxNum) {
        this.i += 1;
        let offset = this.history.length - this.i;
        this.history.splice(this.i, offset);
        this.history.push(boxNum);
    }

    goForwardInHistory() {
        if (this.i < this.history.length - 1) {
            this.i += 1;
        }
    }

    goBackInHistory() {
        if (this.i >= 1) {
            this.i -= 1;
        }
    }

    updateSelected(box) {
        let boxNum = -1;
        for (let i = 0; i < this.boxes.length; i++) {
            if (this.boxes[i] != box) {
                this.boxes[i].deselect();
                if (i > this.boxes.length / 2) {
                    this.boxes[i].updateTFTextureByRadius(box.transferFunctionTexture.texture, this.radius);
                } else {
                    this.boxes[i].updateTFTexture();
                }
            } else {
                boxNum = i;
            }
        }
        this.radius = Math.max(this.radius * 0.9, 10);
        this.selectedBox = box;
        box.select();
        
        this.addTextureToHistory(boxNum);

        this.dispatchEvent(new Event('change'));
    }

    setAllNoiseSizes(num) {
        for (let i = 0; i < this.boxes.length; i++) {
            this.boxes[i].transferFunctionTexture.size = num;
        }
    }

    getSelected() {
        return this.selectedBox;
    }

    addBox(box) {
        this.boxes.push(box);
        this.html.appendChild(box.html);
    }

    resize(width, height, object) {
        let dWidth = 0;
        if (object) {
            dWidth = object.clientWidth;
        }

        width = width - dWidth;

        this.html.style.width = width + "px";
        this.html.style.height = height + "px";
        this.html.style.left = dWidth + "px";
        this.dispatchEvent(new Event('change'));
    }

    fullScreen(mouseX, mouseY) {
        let focusedBox = null;
        for (let box of this.boxes) {
            const domRect = box.html.getBoundingClientRect();
            let leftX = domRect.x;
            let topY = domRect.y;
            let rightX = leftX + domRect.width;
            let bottomY = topY + domRect.height;

            if (leftX <= mouseX && rightX >= mouseX) {
                if (topY <= mouseY && bottomY >= mouseY) {
                    focusedBox = box;
                    break;
                }
            }
        }

        if (focusedBox) {
            for (let box of this.boxes) {
                box.html.classList.remove("selection-box");
                if (box != focusedBox) {
                    box.html.classList.add("selection-box-minimized");
                } else {
                    box.html.classList.add("selection-box-fullscreen");
                }
            }

            this.html.classList.remove("generation-container");
            this.html.classList.add("generation-container-fullscreen");
        }
    }

    revertFullScreen() {
        for (let box of this.boxes) {
            box.html.classList.remove("selection-box-minimized");
            box.html.classList.remove("selection-box-fullscreen");
            box.html.classList.add("selection-box");
        }

        this.html.classList.remove("generation-container-fullscreen");
        this.html.classList.add("generation-container");
    }

    setThreshold(threshold) {
        for (const box of this.boxes) {
            box.updateThreshold(threshold);
        }
    }

}