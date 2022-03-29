// #part /js/ui/GenerationContainer

// #link /html/ui/GenerationContainer

class GenerationContainer extends EventTarget {

    constructor() {
        super();
        this.html = document.createElement("div");
        this.html.classList.add("generation-container");
        this.boxes = [];
        this.selectedBox = null;
        // What should radius be?
        this.radius = 250;
    }

    appendTo(object) {
        object.appendChild(this.html);
    }

    updateSelected(box) {
        for (let i = 0; i < this.boxes.length; i++) {
            if (this.boxes[i] != box) {
                this.boxes[i].deselect();
                if (i > this.boxes.length / 2) {
                    this.boxes[i].updateTFTextureByRadius(box.transferFunctionTexture.texture, this.radius);
                } else {
                    this.boxes[i].updateTFTexture();
                }
            }
        }
        console.log(this.radius)
        this.radius = Math.max(this.radius * 0.9, 0);
        this.selectedBox = box;
        box.select();

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
        const dWidth = object.clientWidth;

        width = width - dWidth;

        this.html.style.width = width + "px";
        this.html.style.height = height + "px";
        this.html.style.left = dWidth + "px";
    }
}