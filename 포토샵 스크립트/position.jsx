/* Layer to CSS — Photoshop ExtendScript */
(function () {
  if (!app.documents.length) {
    alert('PSD 문서를 먼저 열어주세요.');
    return;
  }

  var sourceDocument = app.activeDocument;
  var charID = charIDToTypeID,
    stringID = stringIDToTypeID;

  // Layer data
  function getSelectedLayerIds() {
    var reference = new ActionReference();
    reference.putEnumerated(charID('Dcmn'), charID('Ordn'), charID('Trgt'));
    var descriptor = executeActionGet(reference),
      ids = [],
      key = stringID('targetLayersIDs');

    if (descriptor.hasKey(key)) {
      var selected = descriptor.getList(key);
      for (var i = 0; i < selected.count; i++) ids.push(selected.getReference(i).getIdentifier());
    } else {
      reference = new ActionReference();
      reference.putEnumerated(charID('Lyr '), charID('Ordn'), charID('Trgt'));
      ids.push(executeActionGet(reference).getInteger(stringID('layerID')));
    }
    return ids;
  }

  function getLayerInfo(layerId) {
    var reference = new ActionReference();
    reference.putIdentifier(charID('Lyr '), layerId);
    var descriptor = executeActionGet(reference),
      boundsKey = stringID('boundsNoEffects');

    if (!descriptor.hasKey(boundsKey)) boundsKey = stringID('bounds');
    var bounds = descriptor.getObjectValue(boundsKey);

    function getPixel(key) {
      return bounds.getUnitDoubleValue(charID(key));
    }

    var left = getPixel('Left'),
      top = getPixel('Top ');
    var right = getPixel('Rght'),
      bottom = getPixel('Btom');

    return { name: descriptor.getString(charID('Nm  ')), left: left, top: top, right: right, bottom: bottom, width: right - left, height: bottom - top };
  }

  function formatNumber(value, decimals) {
    var factor = Math.pow(10, decimals);
    var rounded = Math.round(value * factor) / factor;
    return rounded === 0 ? '0' : String(rounded);
  }

  // CSS generation
  function getCss(background, element, viewportWidth, includeLeft) {
    var top = element.top - background.top;
    var bottom = background.bottom - element.bottom;
    var useBottom = Math.abs(bottom) < Math.abs(top);
    var gap = useBottom ? bottom : top;

    var position = (useBottom ? 'bottom' : 'top') + ':min(' + formatNumber((gap / viewportWidth) * 100, 4) + 'vw,' + formatNumber(gap, 2) + 'px);';

    var leftGap = element.left - background.left;
    var left = includeLeft ? 'left:min(' + formatNumber((leftGap / viewportWidth) * 100, 4) + 'vw,' + formatNumber(leftGap, 2) + 'px);' : '';
    var width = 'width:' + formatNumber((element.width / background.width) * 100, 4) + '%;';
    var height = 'height:' + formatNumber((element.height / background.height) * 100, 4) + '%;';

    return position + left + width + height;
  }

  try {
    var selectedIds = getSelectedLayerIds();

    if (selectedIds.length < 2) {
      alert('기준 레이어와 CSS를 추출할 레이어를 함께 선택해주세요.');
      return;
    }

    var layers = [],
      layerNames = [],
      backgroundIndex = 0,
      largestArea = -1;

    for (var i = 0; i < selectedIds.length; i++) {
      var layer = getLayerInfo(selectedIds[i]);
      var area = layer.width * layer.height;

      layers.push(layer);
      layerNames.push(layer.name + ' (' + formatNumber(layer.width, 2) + ' × ' + formatNumber(layer.height, 2) + ')');

      if (area > largestArea) {
        largestArea = area;
        backgroundIndex = i;
      }
    }

    // UI configuration
    var UI_WIDTH = 560,
      LABEL_WIDTH = 112,
      MAX_ROWS = 7;
    var COLUMN_GAP = 10,
      ROW_GAP = 8,
      SCROLL_WIDTH = 14,
      SCROLL_GAP = 6;
    var visibleRows = Math.min(MAX_ROWS, layers.length - 1);
    var needsScroll = layers.length - 1 > MAX_ROWS;
    var listWidth = UI_WIDTH - (needsScroll ? SCROLL_WIDTH + SCROLL_GAP : 0);
    var inputWidth = listWidth - LABEL_WIDTH - COLUMN_GAP;

    var regularFont = ScriptUI.newFont('dialog', 'REGULAR', 12);
    var boldFont = ScriptUI.newFont('dialog', 'BOLD', 12);
    var titleFont = ScriptUI.newFont('dialog', 'BOLD', 16);

    function applyFont(control, font) {
      try {
        control.graphics.font = font || regularFont;
      } catch (error) {}
      return control;
    }

    function createGroup(parent, direction, spacing) {
      var group = parent.add('group');
      group.orientation = direction || 'row';
      group.alignChildren = ['left', 'center'];
      group.spacing = spacing === undefined ? 0 : spacing;
      group.margins = 0;
      return group;
    }

    function createLabel(parent, text, width, font) {
      var label = applyFont(parent.add('statictext', undefined, text), font);
      if (width) label.preferredSize.width = width;
      return label;
    }

    function createDivider(parent) {
      var divider = parent.add('panel');
      divider.preferredSize = [UI_WIDTH, 2];
      divider.margins = 0;
      return divider;
    }

    // Main window
    var dialog = new Window('dialog', 'Layer to CSS');
    dialog.orientation = 'column';
    dialog.alignChildren = ['left', 'top'];
    dialog.margins = [16, 16, 16, 14];
    dialog.spacing = 12;

    createLabel(dialog, 'Layer to CSS', 0, titleFont);
    createDivider(dialog);

    // REFERENCE
    createLabel(dialog, 'REFERENCE', 0, boldFont);

    var referenceRow = createGroup(dialog, 'row', COLUMN_GAP);
    createLabel(referenceRow, '기준 레이어', LABEL_WIDTH);

    var backgroundSelect = referenceRow.add('dropdownlist', undefined, layerNames);
    backgroundSelect.preferredSize = [UI_WIDTH - LABEL_WIDTH - COLUMN_GAP, 27];
    backgroundSelect.selection = backgroundIndex;
    applyFont(backgroundSelect);

    var viewportRow = createGroup(dialog, 'row', COLUMN_GAP);
    createLabel(viewportRow, 'vw 기준 너비', LABEL_WIDTH);

    var viewportInput = viewportRow.add('edittext', undefined, formatNumber(layers[backgroundIndex].width, 2));
    viewportInput.preferredSize.width = 90;
    applyFont(viewportInput);
    createLabel(viewportRow, 'px');

    createDivider(dialog);

    // ELEMENTS header
    var elementsHeader = createGroup(dialog, 'row', 0);
    elementsHeader.preferredSize.width = UI_WIDTH;

    var headerLeft = createGroup(elementsHeader, 'row', 8);
    headerLeft.preferredSize.width = UI_WIDTH - 100;

    createLabel(headerLeft, 'ELEMENTS', 0, boldFont);
    var elementCount = createLabel(headerLeft, '');

    var includeLeft = elementsHeader.add('checkbox', undefined, 'left 포함');
    includeLeft.preferredSize.width = 100;
    includeLeft.value = false;
    applyFont(includeLeft);

    // ELEMENTS list
    var list = createGroup(dialog, 'row', SCROLL_GAP);
    list.alignChildren = ['left', 'top'];

    var listColumn = createGroup(list, 'column', ROW_GAP);
    listColumn.alignChildren = ['left', 'top'];

    var rows = [],
      results = [],
      scrollOffset = 0;

    function createElementRow() {
      var row = createGroup(listColumn, 'row', COLUMN_GAP);

      var name = createLabel(row, '', LABEL_WIDTH);

      var cssInput = row.add('edittext', undefined, '', { readonly: true });
      cssInput.preferredSize.width = inputWidth;
      applyFont(cssInput);

      return { name: name, input: cssInput };
    }

    for (var rowIndex = 0; rowIndex < visibleRows; rowIndex++) {
      rows.push(createElementRow());
    }

    var scrollbar = null;

    if (needsScroll) {
      scrollbar = list.add('scrollbar', undefined, 0, 0, 0);
      scrollbar.preferredSize = [SCROLL_WIDTH, 50];
    }

    function renderResults() {
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i],
          result = results[i + scrollOffset];

        row.name.text = result ? result.name : '';
        row.name.helpTip = result ? result.name + ' (' + result.size + ')' : '';
        row.input.text = result ? result.css : '';
      }
    }

    function updateResults() {
      var background = layers[backgroundSelect.selection.index];
      var viewportWidth = Number(viewportInput.text);

      if (background.width <= 0 || background.height <= 0) {
        alert('기준 레이어의 크기를 확인해주세요.');
        return;
      }

      if (!isFinite(viewportWidth) || viewportWidth <= 0) {
        alert('올바른 vw 기준 너비를 입력해주세요.');
        return;
      }

      results = [];

      for (var i = 0; i < layers.length; i++) {
        if (i === backgroundSelect.selection.index) continue;

        var element = layers[i];

        results.push({
          name: element.name,
          size: formatNumber(element.width, 2) + ' × ' + formatNumber(element.height, 2) + 'px',
          css: getCss(background, element, viewportWidth, includeLeft.value)
        });
      }

      elementCount.text = results.length + ' layers';
      scrollOffset = 0;

      if (scrollbar) {
        scrollbar.value = 0;
        scrollbar.maxvalue = Math.max(0, results.length - visibleRows);
        scrollbar.enabled = results.length > visibleRows;
      }

      renderResults();
    }

    // Events
    backgroundSelect.onChange = function () {
      viewportInput.text = formatNumber(layers[backgroundSelect.selection.index].width, 2);
      updateResults();
    };

    viewportInput.onChange = updateResults;
    includeLeft.onClick = updateResults;

    if (scrollbar) {
      scrollbar.onChanging = scrollbar.onChange = function () {
        scrollOffset = Math.round(scrollbar.value);
        renderResults();
      };
    }

    // Footer
    var footer = createGroup(dialog, 'row', 0);
    footer.preferredSize.width = UI_WIDTH;

    var footerSpace = footer.add('group');
    footerSpace.preferredSize.width = UI_WIDTH - 80;

    var closeButton = footer.add('button', undefined, '닫기', { name: 'cancel' });
    closeButton.preferredSize = [80, 27];
    applyFont(closeButton);

    updateResults();
    dialog.layout.layout(true);

    if (scrollbar) {
      scrollbar.preferredSize.height = listColumn.size.height;
      dialog.layout.layout(true);
    }

    dialog.center();
    dialog.show();
  } catch (error) {
    alert('CSS 추출 오류: ' + error.message + '\n라인: ' + (error.line || '?'));
  }
})();
