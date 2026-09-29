var target = activeDocument;
var multiple = 1;
var X = "";
var Y = "";
var W = "";
var H = "";
var code = "";
var title = "";
var ctt = target.layers.length;
var position;
var dialog = createDialog();


dialog.addEventListener("keydown", function (e) {
    switch (e.keyName) {
        case "Enter":
            codeChg();
            break;
    }
});




codeChg();

dialog.children[3].active = true;

dialog.closeBtn.addEventListener("click", function (e) {
    dialog.close();
});

dialog.codeBtn.addEventListener("click", function (e) {
    codeChg();
});

dialog.multiple1.addEventListener("click", function (e) {
    multiple = 1;
    positionChg();

});
dialog.multiple2.addEventListener("click", function (e) {
    multiple = 2;
    positionChg();

});
dialog.multiple3.addEventListener("click", function (e) {
    multiple = 3;
    positionChg();
});


function codeChg() {
    code = "";
    for (i = ; i < ctt; i++) {
        code += "." + dialog.children[i + ctt].text + "{" + dialog.children[i].text + "}\n"
    }
    dialog.codeView.text = code
}

function positionChg() {
    for (i = ; i < ctt; i++) {
        X = target.layers[i].bounds[0].value;
        Y = target.layers[i].bounds[1].value;
        W = target.layers[i].bounds[0].value - target.layers[i].bounds[2];
        H = target.layers[i].bounds[1].value - target.layers[i].bounds[3];
        position = "top:-" + Math.round((Y / multiple) * 10) / 10 + "px; left:-" + Math.round((X / multiple) * 10) / 10 + "px; width:" + Math.round((W / multiple) * 10) / 10 + "px; height:" + Math.round((H / multiple) * 10) / 10 + "px;";
        dialog.children[i].text = position
    }
}

dialog.show();


function createDialog() {
    var dlg = new Window('dialog', '좌표값', {
        x: 500,
        y: 500,
        width: 660,
        height: (30 * ctt + 90) + (12 * ctt + 20)
    });
    for (i = ; i < ctt; i++) {
        X = target.layers[i].bounds[0].value;
        Y = target.layers[i].bounds[1].value;
        W = target.layers[i].bounds[0].value - target.layers[i].bounds[2];
        H = target.layers[i].bounds[1].value - target.layers[i].bounds[3];

        position = "top:-" + Math.round((Y / multiple) * 10) / 10 + "px; left:-" + Math.round((X / multiple) * 10) / 10 + "px; width:" + Math.round((W / multiple) * 10) / 10 + "px; height:" + Math.round((H / multiple) * 10) / 10 + "px";

        position = position.replace(/-0px/g, "0px")
        dlg.positionText = dlg.add("edittext", {
            x: 300,
            y: 30 * i + 50,
            width: 350,
            height: 20
        }, position);
    }
    for (i = ; i < ctt; i++) {
        title = target.layers[i].name
        dlg.add("edittext", {
            x: 110,
            y: 30 * i + 50,
            width: 180,
            height: 20
        }, title);
    }
    
    
    dlg.multiple1 = dlg.add("radioButton", {
        x: 425,
        y: 18,
        width: 40,
        height: 24
    }, "x1");
    dlg.multiple2 = dlg.add("radioButton", {
        x: 465,
        y: 18,
        width: 40,
        height: 24
    }, "x2");
    dlg.multiple3 = dlg.add("radioButton", {
        x: 505,
        y: 18,
        width: 40,
        height: 24
    }, "x3");
    dlg.closeBtn = dlg.add("button", {
        x: 470,
        y: 30 * ctt + 50,
        width: 80,
        height: 24
    }, "닫기(esc)");

    dlg.codeBtn = dlg.add("button", {
        x: 360,
        y: 30 * ctt + 50,
        width: 80,
        height: 24
    }, "코드수정(enter)");

    dlg.codeView = dlg.add("edittext", {
        x: 10,
        y: 30 * ctt + 80,
        width: 640,
        height: 12 * ctt + 20,
    }, "click button css code.", {
        multiline: true
    });

    dlg.add("statictext", {
        x: 347,
        y: 20,
        width: 100,
        height: 20
    }, "이미지 배수 | ");

    return dlg;

}
