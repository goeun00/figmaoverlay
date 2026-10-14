/* Rename child groups and remove parent groups — Photoshop ExtendScript */
(function () {
  if (!app.documents.length) {
    alert('PSD 문서를 먼저 열어주세요.');
    return;
  }

  var document = app.activeDocument;
  var charID = charIDToTypeID,
    stringID = stringIDToTypeID;

  function getSelectedLayerIds() {
    var reference = new ActionReference();
    reference.putEnumerated(charID('Dcmn'), charID('Ordn'), charID('Trgt'));

    var descriptor = executeActionGet(reference);
    var key = stringID('targetLayersIDs');
    var selectedIds = {};

    if (descriptor.hasKey(key)) {
      var selected = descriptor.getList(key);

      for (var i = 0; i < selected.count; i++) {
        selectedIds[selected.getReference(i).getIdentifier()] = true;
      }
    } else {
      reference = new ActionReference();
      reference.putEnumerated(charID('Lyr '), charID('Ordn'), charID('Trgt'));
      selectedIds[executeActionGet(reference).getInteger(stringID('layerID'))] = true;
    }

    return selectedIds;
  }

  function getSelectedParentGroups(container, selectedIds, results) {
    for (var i = 0; i < container.layers.length; i++) {
      var layer = container.layers[i];
      if (layer.typename !== 'LayerSet') continue;

      if (selectedIds[layer.id]) {
        results.push(layer);
        continue; // 선택한 상위 그룹 내부는 탐색하지 않음
      }

      getSelectedParentGroups(layer, selectedIds, results);
    }
  }

  function renameChildGroups(parent) {
    var prefix = parent.name + '_';
    var count = 0;

    for (var i = 0; i < parent.layerSets.length; i++) {
      var child = parent.layerSets[i];
      child.name = prefix + child.name;
      count++;
    }

    return count;
  }

  function removeParentGroup(parent) {
    while (parent.layers.length > 0) {
      parent.layers[0].move(parent, ElementPlacement.PLACEBEFORE);
    }

    parent.remove();
  }

  try {
    var selectedIds = getSelectedLayerIds();
    var parentGroups = [];
    var renamedCount = 0;

    getSelectedParentGroups(document, selectedIds, parentGroups);

    if (!parentGroups.length) {
      alert('상위 그룹을 하나 이상 선택해주세요.');
      return;
    }

    var targetCount = 0;
    for (var i = 0; i < parentGroups.length; i++) {
      targetCount += parentGroups[i].layerSets.length;
    }

    if (!confirm('하위 그룹 ' + targetCount + '개 이름 변경\n' + '상위 그룹 ' + parentGroups.length + '개 해제\n\n' + '진행할까요?')) return;

    // 1. 바로 아래 하위 그룹 이름만 변경
    for (var j = 0; j < parentGroups.length; j++) {
      renamedCount += renameChildGroups(parentGroups[j]);
    }

    // 2. 마지막에 선택한 상위 그룹만 해제
    for (var k = 0; k < parentGroups.length; k++) {
      removeParentGroup(parentGroups[k]);
    }

    alert('완료! 하위 그룹 ' + renamedCount + '개 변경했어요.');
  } catch (error) {
    alert('오류: ' + error.message + '\n라인: ' + (error.line || '?'));
  }
})();
