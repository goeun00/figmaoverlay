#target photoshop

/*
 * 선택한 그룹 중 "제일 겉 그룹"만 이름을 변경합니다.
 *
 * 예:
 *   부모 그룹 + 그 안의 자식 그룹을 같이 선택한 경우
 *   -> 부모 그룹만 이름 변경
 *
 * 순서:
 *   실제 캔버스 위치 기준 위 -> 아래
 *   같은 줄이면 왼쪽 -> 오른쪽
 *
 * 예:
 *   img 입력
 *   -> img01, img02, img03 ...
 *
 *   slide01 입력
 *   -> slide01_1, slide01_2, slide01_3 ...
 */

var SAME_LINE_TOLERANCE = 2;

if (app.documents.length === 0) {
    alert("열려 있는 문서가 없습니다.");
} else {
    main();
}

function main() {
    var identifier = prompt(
        "식별자 / 파일명을 입력하세요.\n\n예: img, slide01",
        "img"
    );

    if (identifier === null) {
        return;
    }

    identifier = trim(identifier);

    if (identifier === "") {
        alert("식별자를 입력해주세요.");
        return;
    }

    var selectedIDs = getSelectedLayerIDs();

    if (selectedIDs.length === 0) {
        alert("선택한 그룹이 없습니다.");
        return;
    }

    var selectedMap = {};
    var groups = [];

    for (var i = 0; i < selectedIDs.length; i++) {
        selectedMap[selectedIDs[i]] = true;
    }

    /*
     * 선택한 그룹 중
     * 선택된 부모가 없는 "제일 겉 그룹"만 수집
     */
    collectTopSelectedGroups(
        app.activeDocument,
        selectedMap,
        groups,
        false
    );

    if (groups.length === 0) {
        alert("선택한 항목 중 이름을 변경할 그룹이 없습니다.");
        return;
    }

    var items = getPositionItems(groups);

    sortByPosition(items);

    renameGroups(
        items,
        identifier
    );
}


/*
 * ========================================
 * 선택한 그룹 중 제일 겉 그룹만 수집
 * ========================================
 */

function collectTopSelectedGroups(
    container,
    selectedMap,
    result,
    hasSelectedAncestor
) {
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];

        if (layer.typename !== "LayerSet") {
            continue;
        }

        var isSelected =
            !!selectedMap[layer.id];

        /*
         * 선택되어 있고,
         * 위쪽에 선택된 부모 그룹이 없을 때만 추가
         */
        if (
            isSelected &&
            !hasSelectedAncestor
        ) {
            result.push(layer);
        }

        /*
         * 현재 그룹이 선택되어 있으면
         * 그 아래 선택 그룹은 전부 제외
         */
        collectTopSelectedGroups(
            layer,
            selectedMap,
            result,
            hasSelectedAncestor || isSelected
        );
    }
}


/*
 * ========================================
 * 위치값은 그룹당 한 번만 읽음
 * ========================================
 */

function getPositionItems(groups) {
    var items = [];

    for (var i = 0; i < groups.length; i++) {
        var group = groups[i];

        try {
            var bounds =
                group.boundsNoEffects;

            items.push({
                group: group,
                top: bounds[1].as("px"),
                left: bounds[0].as("px")
            });

        } catch (e) {
            items.push({
                group: group,
                top: Number.MAX_VALUE,
                left: Number.MAX_VALUE
            });
        }
    }

    return items;
}


/*
 * ========================================
 * 캔버스 위치 기준 정렬
 * 위 -> 아래
 * 같은 줄이면 왼쪽 -> 오른쪽
 * ========================================
 */

function sortByPosition(items) {
    items.sort(function (a, b) {
        var topDiff =
            a.top - b.top;

        if (
            Math.abs(topDiff) >
            SAME_LINE_TOLERANCE
        ) {
            return topDiff;
        }

        return a.left - b.left;
    });
}


/*
 * ========================================
 * 이름 변경
 * ========================================
 */

function renameGroups(
    items,
    identifier
) {
    var isSlide =
        /^slide\d+$/i.test(identifier);

    var digits =
        Math.max(
            2,
            String(items.length).length
        );

    for (var i = 0; i < items.length; i++) {
        if (isSlide) {
            items[i].group.name =
                identifier +
                "_" +
                (i + 1);
        } else {
            items[i].group.name =
                identifier +
                padNumber(
                    i + 1,
                    digits
                );
        }
    }
}


/*
 * ========================================
 * 현재 선택된 레이어 ID
 * ========================================
 */

function getSelectedLayerIDs() {
    var ids = [];

    try {
        var key =
            stringIDToTypeID(
                "targetLayersIDs"
            );

        var ref =
            new ActionReference();

        ref.putProperty(
            charIDToTypeID("Prpr"),
            key
        );

        ref.putEnumerated(
            charIDToTypeID("Dcmn"),
            charIDToTypeID("Ordn"),
            charIDToTypeID("Trgt")
        );

        var desc =
            executeActionGet(ref);

        if (desc.hasKey(key)) {
            var list =
                desc.getList(key);

            for (var i = 0; i < list.count; i++) {
                ids.push(
                    list
                        .getReference(i)
                        .getIdentifier()
                );
            }
        }
    } catch (e) {}

    if (ids.length === 0) {
        try {
            ids.push(
                app.activeDocument
                    .activeLayer.id
            );
        } catch (e) {}
    }

    return ids;
}


function padNumber(
    number,
    digits
) {
    var text =
        String(number);

    while (
        text.length < digits
    ) {
        text =
            "0" + text;
    }

    return text;
}


function trim(text) {
    return String(text)
        .replace(/^\s+|\s+$/g, "");
}
