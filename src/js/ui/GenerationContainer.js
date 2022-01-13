// #part /js/ui/GenerationContainer

// #link /html/ui/GenerationContainer
// #link /js/EventEmitter

class GenerationContainer extends EventEmitter {

    constructor() {
        super();
        this.html = document.createElement("div");
        this.html.classList.add("generation-container");
        this.boxes = [];
        this.selectedBox = null;
    }

    appendTo(object) {
        object.appendChild(this.html);
    }

    updateSelected(box) {
        for (let i = 0; i < this.boxes.length; i++) {
            if (this.boxes[i] != box) {
                this.boxes[i].deselect();
                this.boxes[i].updateTFTexture();
            }
        }
        this.selectedBox = box;
        box.select();

        this.trigger('change');
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