var __guidesFastContext = null;
function __guidesFastPad(n) {
  return (n < 10 ? '0' : '') + n;
}
function __guidesFastInBounds(box, bounds) {
  return box[0] < bounds[2] && box[2] > bounds[0] && box[1] < bounds[3] && box[3] > bounds[1];
}

function __guidesFastSplit() {
  var ctx = __guidesFastContext;
  var doc = ctx.doc,
    source = ctx.source,
    regions = ctx.regions;
  var sourceBounds = ctx.sourceBounds,
    result = ctx.result;
  var idCopyToLayer = ctx.idCopyToLayer;
  var last = null;
  var started = new Date().getTime();
  try {
    for (var i = 0; i < regions.length; i++) {
      var rect = regions[i];
      if (!__guidesFastInBounds(rect, sourceBounds)) {
        result.empty++;
        continue;
      }

      doc.activeLayer = source;
      doc.selection.select(
        [
          [rect[0], rect[1]],
          [rect[2], rect[1]],
          [rect[2], rect[3]],
          [rect[0], rect[3]]
        ],
        SelectionType.REPLACE,
        0,
        false
      );

      try {
        executeAction(idCopyToLayer, undefined, DialogModes.NO);
      } catch (e) {
        // Copy may fail for entirely transparent regions. Other errors are reported.
        var message = String(e.message || e);
        if (/no pixels|empty|selected area is empty|선택.*비어|픽셀이 없|비어 있/i.test(message)) {
          result.empty++;
          continue;
        }
        throw new Error('영역 ' + (i + 1) + ' 처리 실패: ' + message);
      }
      last = doc.activeLayer;
      last.name = 'img' + __guidesFastPad(result.created + 1);
      result.created++;
    }
    if (!result.created) throw new Error('복사할 픽셀이 없어요. 레이어와 안내선을 확인해주세요.');
    source.visible = false;
    doc.activeLayer = last;
  } catch (e) {
    result.error = String(e.message || e);
    // Original stays visible unless everything finished successfully.
  } finally {
    try {
      doc.selection.deselect();
    } catch (ignored) {}
    result.elapsed = (new Date().getTime() - started) / 1000;
  }
}

(function () {
  if (!app.documents.length) {
    alert('PSD 문서를 먼저 열어주세요.');
    return;
  }

  var doc = app.activeDocument;
  var source = doc.activeLayer;

  // 배경 레이어라면 복제본으로 작업
  if (source.isBackgroundLayer) {
    source = source.duplicate();
    source.name = '분할용 이미지';
  }
  var originalUnits = app.preferences.rulerUnits;
  var result = { created: 0, empty: 0, elapsed: 0, error: '' };
  var regions = [];
  var sourceBounds;
  var idCopyToLayer = charIDToTypeID('CpTL');

  function axes(values, max) {
    values.push(0, max);
    values.sort(function (a, b) {
      return a - b;
    });
    var out = [];
    for (var i = 0; i < values.length; i++) {
      var n = Math.max(0, Math.min(max, Math.round(values[i])));
      if (!out.length || n !== out[out.length - 1]) out.push(n);
    }
    return out;
  }

  try {
    app.preferences.rulerUnits = Units.PIXELS;
    if (source.typename !== 'ArtLayer' || source.kind !== LayerKind.NORMAL) {
      throw new Error('분할할 일반 픽셀 레이어 하나를 선택해주세요.');
    }
    if (!source.visible) {
      throw new Error('보이는 픽셀 레이어를 선택해주세요.');
    }

    // 배경 레이어라면 복제본으로 작업
    if (source.isBackgroundLayer) {
      source = source.duplicate();
      source.name = '분할용 이미지';
    } else {
      // 일반 레이어는 잠금 해제
      if (source.allLocked) source.allLocked = false;
      if (source.pixelsLocked) source.pixelsLocked = false;
      if (source.positionLocked) source.positionLocked = false;
      if (source.transparentPixelsLocked) source.transparentPixelsLocked = false;
    }
    var width = Math.round(doc.width.as('px'));
    var height = Math.round(doc.height.as('px'));
    var xs = [],
      ys = [];
    for (var g = 0; g < doc.guides.length; g++) {
      var guide = doc.guides[g];
      if (guide.direction === Direction.VERTICAL) xs.push(guide.coordinate.as('px'));
      else if (guide.direction === Direction.HORIZONTAL) ys.push(guide.coordinate.as('px'));
    }
    xs = axes(xs, width);
    ys = axes(ys, height);
    if (xs.length === 2 && ys.length === 2) {
      throw new Error('분할할 가로 또는 세로 안내선이 없어요.');
    }
    var count = (xs.length - 1) * (ys.length - 1);
    if (count > 200) {
      throw new Error('분할 영역 ' + count + '개는 안전 제한(200개)을 초과해요.');
    }

    var b = source.bounds;
    sourceBounds = [b[0].as('px'), b[1].as('px'), b[2].as('px'), b[3].as('px')];
    for (var row = 0; row < ys.length - 1; row++) {
      for (var col = 0; col < xs.length - 1; col++) {
        regions.push([xs[col], ys[row], xs[col + 1], ys[row + 1]]);
      }
    }

    // One undoable history state; no slice generation.
    __guidesFastContext = { doc: doc, source: source, regions: regions, sourceBounds: sourceBounds, result: result, idCopyToLayer: idCopyToLayer };
    doc.suspendHistory('안내선 → 개별 레이어', '__guidesFastSplit()');

    if (result.error) {
      alert('분할 중 문제가 발생했어요.\n' + result.error + '\n' + result.created + '개 생성됨. Photoshop 실행 취소(Ctrl+Z)로 되돌릴 수 있어요.');
    } else {
      alert(
        '분리 완료! ' +
          result.created +
          '개 레이어 생성' +
          (result.empty ? '\n빈 영역 ' + result.empty + '개 건너뜀' : '') +
          '\n실행 시간: ' +
          result.elapsed.toFixed(2) +
          '초' +
          '\n원본 레이어와 안내선은 보존했어요.'
      );
    }
  } catch (e) {
    alert('실행 실패: ' + String(e.message || e));
  } finally {
    app.preferences.rulerUnits = originalUnits;
    __guidesFastContext = null;
  }
})();
