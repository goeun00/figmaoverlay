#target photoshop

if (app.documents.length === 0) {
    alert("열려 있는 문서가 없습니다.");
} else {
    run();
}

function run() {
    var doc = app.activeDocument;
    var groups = [];

    /*
     * 보이는 그룹만 수집.
     * 숨겨진 그룹은 내부까지 아예 탐색하지 않음.
     */
    collectGroups(doc, groups);

    if (groups.length === 0) {
        alert("해제할 그룹이 없습니다.");
        return;
    }

    // 진행창
    var win = new Window("palette", "모든 그룹 해제");

    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 16;

    var status = win.add(
        "statictext",
        undefined,
        "그룹을 확인하고 있어요..."
    );

    status.preferredSize.width = 300;

    var progress = win.add(
        "progressbar",
        undefined,
        0,
        groups.length
    );

    progress.preferredSize = [300, 14];

    var countText = win.add(
        "statictext",
        undefined,
        "0 / " + groups.length
    );

    win.center();
    win.show();
    win.update();

    // suspendHistory 내부에서 사용
    $.global.__ungroupGroups = groups;
    $.global.__ungroupWindow = win;
    $.global.__ungroupProgress = progress;
    $.global.__ungroupStatus = status;
    $.global.__ungroupCount = countText;

    try {
        doc.suspendHistory(
            "모든 그룹 해제",
            "ungroupAll()"
        );
    } catch (e) {
        try {
            win.close();
        } catch (_) {}

        cleanup();

        alert(
            "그룹 해제 중 오류가 발생했습니다.\n\n" +
            e.message
        );

        return;
    }

    try {
        win.close();
    } catch (_) {}

    cleanup();
}


/*
 * ====================================
 * 그룹 수집
 * ====================================
 *
 * 숨겨진 그룹:
 *   - 수집 안 함
 *   - 내부 그룹도 탐색 안 함
 *
 * 보이는 그룹:
 *   - 수집
 *   - 내부 그룹 계속 탐색
 */
function collectGroups(container, result) {
    for (var i = 0; i < container.layerSets.length; i++) {
        var group = container.layerSets[i];

        // 숨겨진 그룹은 통째로 무시
        if (!group.visible) {
            continue;
        }

        result.push(group);

        collectGroups(group, result);
    }
}


/*
 * ====================================
 * 실제 그룹 해제
 * ====================================
 */
function ungroupAll() {
    var doc = app.activeDocument;

    var groups = $.global.__ungroupGroups;
    var win = $.global.__ungroupWindow;
    var progress = $.global.__ungroupProgress;
    var status = $.global.__ungroupStatus;
    var countText = $.global.__ungroupCount;

    var total = groups.length;

    /*
     * 부모 → 자식 순서로 수집했으므로
     * 뒤에서부터 처리하면
     * 가장 안쪽 그룹부터 해제됨.
     */
    for (var i = groups.length - 1; i >= 0; i--) {
        var group = groups[i];
        var processed = total - i;

        try {
            status.text =
                "처리 중... " +
                group.name;

            /*
             * 그룹에 레이어 효과가 있으면
             * 그룹을 그대로 유지.
             */
            if (hasLayerEffects(group)) {
                progress.value = processed;
                countText.text =
                    processed + " / " + total;

                win.update();

                continue;
            }

            /*
             * 빈 그룹이면 삭제.
             */
            if (group.layers.length === 0) {
                group.remove();
            } else {
                /*
                 * 일반 그룹은 Photoshop 자체
                 * 그룹 해제 명령 사용.
                 */
                doc.activeLayer = group;

                ungroupCurrent();
            }

        } catch (e) {
            /*
             * 이미 처리됐거나
             * Photoshop에서 해제할 수 없는 그룹은
             * 건너뜀.
             */
        }

        progress.value = processed;

        countText.text =
            processed + " / " + total;

        win.update();
    }
}


/*
 * ====================================
 * 그룹에 레이어 효과가 있는지 확인
 * ====================================
 */
function hasLayerEffects(layer) {
    try {
        var ref = new ActionReference();

        ref.putIdentifier(
            charIDToTypeID("Lyr "),
            layer.id
        );

        var desc = executeActionGet(ref);

        return desc.hasKey(
            stringIDToTypeID("layerEffects")
        );

    } catch (e) {
        return false;
    }
}


/*
 * ====================================
 * Photoshop 자체 그룹 해제
 * ====================================
 */
function ungroupCurrent() {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();

    ref.putEnumerated(
        charIDToTypeID("Lyr "),
        charIDToTypeID("Ordn"),
        charIDToTypeID("Trgt")
    );

    desc.putReference(
        charIDToTypeID("null"),
        ref
    );

    executeAction(
        stringIDToTypeID("ungroupLayersEvent"),
        desc,
        DialogModes.NO
    );
}


/*
 * ====================================
 * 전역 변수 정리
 * ====================================
 */
function cleanup() {
    try {
        delete $.global.__ungroupGroups;
        delete $.global.__ungroupWindow;
        delete $.global.__ungroupProgress;
        delete $.global.__ungroupStatus;
        delete $.global.__ungroupCount;
    } catch (e) {}
}