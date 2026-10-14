(function () {
  if (app.documents.length === 0) {
    alert('먼저 PSD 문서를 열어주세요.');
    return;
  }

  var doc = app.activeDocument;
  var originalUnits = app.preferences.rulerUnits;
  var source = doc.activeLayer;
  var lastCreatedLayer = null;
  var successCount = 0;
  var skippedCount = 0;
  var errorMessage = '';

  function uniqueSorted(list, max) {
    list.push(0);
    list.push(max);
    list.sort(function (a, b) {
      return a - b;
    });
    var result = [];
    for (var i = 0; i < list.length; i++) {
      var value = Math.max(0, Math.min(max, Math.round(list[i])));
      if (!result.length || value > result[result.length - 1]) {
        result.push(value);
      }
    }
    return result;
  }

  function pad(number) {
    return (number < 10 ? '0' : '') + number;
  }

  try {
    app.preferences.rulerUnits = Units.PIXELS;

    if (source.typename !== 'ArtLayer') {
      throw new Error('분할할 통이미지 레이어 하나를 선택해주세요. (그룹 선택은 지원하지 않아요.)');
    }
    if (source.kind !== LayerKind.NORMAL) {
      throw new Error('일반 픽셀 레이어를 선택해주세요. 스마트 오브젝트라면 먼저 복제 후 래스터화해 주세요.');
    }
    if (!source.visible) {
      throw new Error('선택한 이미지 레이어를 먼저 표시해주세요.');
    }
    if (source.allLocked || source.pixelsLocked) {
      throw new Error('선택한 레이어의 잠금을 해제해주세요.');
    }

    var width = Math.round(doc.width.as('px'));
    var height = Math.round(doc.height.as('px'));
    var xs = [],
      ys = [];
    for (var g = 0; g < doc.guides.length; g++) {
      var guide = doc.guides[g];
      var position = guide.coordinate.as('px');
      if (guide.direction === Direction.VERTICAL) xs.push(position);
      if (guide.direction === Direction.HORIZONTAL) ys.push(position);
    }
    xs = uniqueSorted(xs, width);
    ys = uniqueSorted(ys, height);

    if (xs.length === 2 && ys.length === 2) {
      throw new Error('문서 안에 가로 또는 세로 안내선을 하나 이상 추가해주세요.');
    }

    var total = (xs.length - 1) * (ys.length - 1);
    if (total > 200) {
      throw new Error('생성될 영역이 ' + total + '개예요. 실수로 대량 생성되는 일을 막기 위해 200개 이하만 지원해요.');
    }

    // Row-major order: top to bottom, left to right.
    for (var row = 0; row < ys.length - 1; row++) {
      for (var col = 0; col < xs.length - 1; col++) {
        var left = xs[col],
          top = ys[row];
        var right = xs[col + 1],
          bottom = ys[row + 1];
        var label = 'img' + pad(successCount + 1);

        // Select only this guide-defined rectangle from the original layer.
        doc.activeLayer = source;
        doc.selection.select(
          [
            [left, top],
            [right, top],
            [right, bottom],
            [left, bottom]
          ],
          SelectionType.REPLACE,
          0,
          false
        );

        try {
          // Photoshop's Layer Via Copy: keeps pixels at their original coordinates.
          executeAction(charIDToTypeID('CpTL'), undefined, DialogModes.NO);
          var piece = doc.activeLayer;
          piece.name = label;
          lastCreatedLayer = piece;
          successCount++;
        } catch (copyError) {
          // An entirely transparent region may have no pixels to copy.
          skippedCount++;
        }
      }
    }

    if (successCount === 0) {
      throw new Error('복사할 픽셀이 없어요. 선택한 레이어와 안내선 위치를 확인해주세요.');
    }

    source.visible = false;
    doc.activeLayer = lastCreatedLayer;
    alert(
      '완료! ' +
        successCount +
        '개 영역을 개별 레이어로 만들었어요.' +
        (skippedCount ? '\n빈 영역 등 ' + skippedCount + '개는 건너뛰었어요.' : '') +
        '\n원본 레이어는 삭제하지 않고 숨겨뒀어요.'
    );
  } catch (error) {
    errorMessage = error.message || String(error);
    alert('작업을 완료하지 못했어요.\n' + errorMessage + '\n\n일부 레이어가 생성됐다면 실행 전 상태로 되돌리거나 복제 문서에서 다시 시도해주세요.');
  } finally {
    try {
      doc.selection.deselect();
    } catch (ignore) {}
    app.preferences.rulerUnits = originalUnits;
  }
})();
