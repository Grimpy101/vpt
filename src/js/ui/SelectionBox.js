// #part /js/ui/SelectionBox

// #link /html/ui/SelectionBox
// #link /js/TFGeneratedTexture

class SelectionBox {

    constructor() {
        this.parent = null;
        this.selected = false;
        this.html = document.createElement("div");
        this.html.classList.add("selection-box");
        this.html.classList.add("selection-box-deselected");

        this.html.addEventListener('click', () => {
            this.parent.updateSelected(this);
        })

        this.transferFunctionTexture = new TFGeneratedTexture(50, 1);
    }

    updateTFTexture(texture, r) {
        /*this.transferFunctionTexture.generateRandomTexture(
            this.transferFunctionTexture.width,
            this.transferFunctionTexture.height
        );*/
        this.transferFunctionTexture.generateTextureInRadius(texture, r);
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
}