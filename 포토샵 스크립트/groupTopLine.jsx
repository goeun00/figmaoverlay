#target photoshop

var MIN_LOADING_TIME = 450;
var FRAME_TIME = 16;

if (app.documents.length === 0) {
    alert("열려 있는 문서가 없습니다.");
} else {
    run();
}

function run() {
    var doc = app.activeDocument;
    var groups = doc.layerSets;
    var positions = [];
    var total = groups.length;

    if (total === 0) {
        alert("최상위 그룹이 없습니다.");
        return;
    }

    // 귀여운 진행창
    var win = new Window(
        "palette",
        "✦ 안내선 만들기"
    );

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 12;
    win.margins = [18, 16, 18, 16];

    var status = win.add(
        "statictext",
        undefined,
        "그룹 위치를 살펴보는 중이에요 ·ᴗ·"
    );

    status.preferredSize.width = 310;

    var progress = win.add(
        "progressbar",
        undefined,
        0,
        100
    );

    progress.preferredSize = [310, 16];

    var subText = win.add(
        "statictext",
        undefined,
        "잠시만 기다려주세요..."
    );

    try {
        subText.graphics.foregroundColor =
            subText.graphics.newPen(
                subText.graphics.PenType.SOLID_COLOR,
                [0.45, 0.45, 0.45],
                1
            );
    } catch (e) {}

    win.center();
    win.show();
    win.update();

    var startedAt = new Date().getTime();
    var lastUpdate = startedAt;

    for (var i = 0; i < total; i++) {
        var group = groups[i];

        try {
            var top =
                group.boundsNoEffects[1].as("px");

            positions.push(
                Math.max(0, top)
            );
        } catch (e) {}

        var now = new Date().getTime();

        if (
            now - lastUpdate >= FRAME_TIME ||
            i === total - 1
        ) {
            progress.value =
                ((i + 1) / total) * 82;

            if (progress.value < 30) {
                status.text =
                    "그룹 위치를 살펴보는 중이에요 ·ᴗ·";
            } else if (progress.value < 65) {
                status.text =
                    "차곡차곡 확인하고 있어요 ✦";
            } else {
                status.text =
                    "거의 다 됐어요...!";
            }

            win.update();
            lastUpdate = now;
        }
    }

    positions.sort(function (a, b) {
        return a - b;
    });

    $.global.__guidePositions = positions;

    status.text =
        "안내선을 쏙쏙 넣고 있어요 ✨";

    subText.text =
        "마무리 중이에요...";

    progress.value = 86;
    win.update();

    try {
        doc.suspendHistory(
            "최상위 그룹 상단 안내선 생성",
            "addGuides()"
        );
    } catch (e) {
        try {
            win.close();
        } catch (_) {}

        cleanup();

        alert(
            "안내선 생성 중 오류가 발생했습니다.\n\n" +
            e.message
        );

        return;
    }

    var elapsed =
        new Date().getTime() - startedAt;

    var remaining =
        Math.max(
            0,
            MIN_LOADING_TIME - elapsed
        );

    status.text =
        "완성 직전이에요 ✦";

    animateFinish(
        win,
        progress,
        progress.value,
        remaining
    );

    subText.text =
        "완료했어요 ·ᴗ·";

    status.text =
        "안내선 완성 ✨";

    win.update();

    $.sleep(220);

    try {
        win.close();
    } catch (_) {}

    cleanup();
}

function addGuides() {
    var doc = app.activeDocument;
    var positions =
        $.global.__guidePositions;

    var last = null;

    for (
        var i = 0;
        i < positions.length;
        i++
    ) {
        var y = positions[i];

        if (
            last !== null &&
            Math.abs(y - last) < 0.01
        ) {
            continue;
        }

        doc.guides.add(
            Direction.HORIZONTAL,
            UnitValue(y, "px")
        );

        last = y;
    }
}

function animateFinish(
    win,
    progress,
    from,
    duration
) {
    if (duration <= 0) {
        progress.value = 100;
        win.update();
        return;
    }

    var start =
        new Date().getTime();

    while (true) {
        var now =
            new Date().getTime();

        var ratio =
            (now - start) / duration;

        if (ratio >= 1) {
            break;
        }

        var eased =
            1 - Math.pow(
                1 - ratio,
                3
            );

        progress.value =
            from +
            (100 - from) * eased;

        win.update();

        $.sleep(FRAME_TIME);
    }

    progress.value = 100;
    win.update();
}

function cleanup() {
    try {
        delete $.global.__guidePositions;
    } catch (e) {}
}