
#target photoshop

(function () {
    var SAME_LINE_TOLERANCE = 12;
    var LINE_HEIGHT_RATIO = 0.4;

    if (!app.documents.length) {
        alert('열려 있는 PSD가 없습니다.');
        return;
    }

    var doc = app.activeDocument;
    var outputFile;

    // PSD와 동일한 경로 및 파일명
    try {
        var folder = doc.path;
        var baseName = doc.name.replace(/\.[^.]+$/, '');

        outputFile = new File(
            folder.fsName + '/' + baseName + '.txt'
        );
    } catch (e) {
        alert('PSD를 먼저 저장해주세요.');
        return;
    }

    // 이미 존재하는 TXT 보호
    if (outputFile.exists) {
        if (!confirm(
            '같은 이름의 TXT 파일이 있습니다.\n덮어쓸까요?'
        )) {
            return;
        }
    }

    var blocks = [];

    // 최상위 그룹 기준 수집
    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];

        if (!layer.visible) continue;

        var texts = [];

        if (layer.typename === 'LayerSet') {
            collectTexts(layer, texts);
        } else {
            collectSingleText(layer, texts);
        }

        if (!texts.length) continue;

        // 텍스트 위치를 이용해 그룹 위치 결정
        var minTop = Number.MAX_VALUE;
        var minLeft = Number.MAX_VALUE;

        for (var j = 0; j < texts.length; j++) {
            if (texts[j].top < minTop) {
                minTop = texts[j].top;
            }

            if (texts[j].left < minLeft) {
                minLeft = texts[j].left;
            }
        }

        blocks.push({
            top: minTop,
            left: minLeft,
            texts: texts
        });
    }

    if (!blocks.length) {
        alert('추출할 텍스트가 없습니다.');
        return;
    }

    // 그룹 위치 정렬
    blocks.sort(function (a, b) {
        var diff = a.top - b.top;

        if (Math.abs(diff) > SAME_LINE_TOLERANCE) {
            return diff;
        }

        return a.left - b.left;
    });

    var lines = [];

    for (var b = 0; b < blocks.length; b++) {
        var ordered = sortTexts(blocks[b].texts);
        var parts = [];

        for (var t = 0; t < ordered.length; t++) {
            parts.push(ordered[t].text);
        }

        lines.push(parts.join(' '));
    }

    // TXT 저장
    outputFile.encoding = 'UTF-8';
    outputFile.lineFeed = 'Windows';

    if (!outputFile.open('w')) {
        alert('TXT 파일을 열 수 없습니다.');
        return;
    }

    try {
        outputFile.write(
            '\uFEFF' + lines.join('\r\n')
        );
    } finally {
        outputFile.close();
    }

    alert(
        '텍스트 추출 완료!\n\n' +
        outputFile.fsName
    );

    // ----------------------------------
    // 보이는 그룹 내부 텍스트 수집
    // ----------------------------------

    function collectTexts(container, result) {
        var layers = container.layers;

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];

            if (!layer.visible) continue;

            if (layer.typename === 'LayerSet') {
                collectTexts(layer, result);
            } else {
                collectSingleText(layer, result);
            }
        }
    }

    // ----------------------------------
    // 텍스트 레이어만 수집
    // ----------------------------------

    function collectSingleText(layer, result) {
        if (layer.typename !== 'ArtLayer') return;
        if (layer.kind !== LayerKind.TEXT) return;

        try {
            var text = cleanText(layer.textItem.contents);

            if (!text) return;

            var bounds = layer.boundsNoEffects;
            var top = bounds[1].as('px');
            var bottom = bounds[3].as('px');

            result.push({
                text: text,
                top: top,
                left: bounds[0].as('px'),
                centerY: (top + bottom) / 2,
                height: bottom - top
            });
        } catch (e) {}
    }

    // ----------------------------------
    // 위→아래 / 좌→우 정렬
    // ----------------------------------

    function sortTexts(texts) {
        var items = texts.slice();

        items.sort(function (a, b) {
            return a.centerY - b.centerY ||
                   a.left - b.left;
        });

        var rows = [];

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var target = null;

            // 가장 가까운 행부터 검사
            for (var r = rows.length - 1; r >= 0; r--) {
                var row = rows[r];

                var diff = Math.abs(
                    item.centerY - row.centerY
                );

                var tolerance = Math.min(
                    SAME_LINE_TOLERANCE,
                    Math.min(item.height, row.height) *
                    LINE_HEIGHT_RATIO
                );

                if (diff <= tolerance) {
                    target = row;
                    break;
                }

                if (
                    row.centerY <
                    item.centerY - SAME_LINE_TOLERANCE
                ) {
                    break;
                }
            }

            if (target) {
                target.items.push(item);
            } else {
                rows.push({
                    centerY: item.centerY,
                    height: item.height,
                    items: [item]
                });
            }
        }

        var result = [];

        for (var j = 0; j < rows.length; j++) {
            rows[j].items.sort(function (a, b) {
                return a.left - b.left;
            });

            for (var k = 0; k < rows[j].items.length; k++) {
                result.push(rows[j].items[k]);
            }
        }

        return result;
    }

    // ----------------------------------
    // 텍스트 정리
    // ----------------------------------

    function cleanText(text) {
        return String(text)
            .replace(/[\r\n]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '');
    }

})();
