// #part /js/ui/GenerationContainer

// #link /html/ui/GenerationContainer

class GenerationContainer extends EventTarget {

    constructor() {
        super();
        this.html = document.createElement("div");
        this.html.classList.add("generation-container");
        this.boxes = [];
        this.selectedBox = null;
        this.radius = 250;
    }

    appendTo(object) {
        object.appendChild(this.html);
    }

    updateSelected(box) {
        for (let i = 0; i < this.boxes.length; i++) {
            if (this.boxes[i] != box) {
                this.boxes[i].deselect();
                this.boxes[i].updateTFTexture(box.transferFunctionTexture.texture, this.radius);
            }
        }
        console.log(this.radius)
        this.radius = Math.max(this.radius - 2, 0);
        this.selectedBox = box;
        box.select();

        this.dispatchEvent(new Event('change'));
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