// background.js v2

// 탭 닫힐 때 해당 탭 오버레이 상태 정리
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove([`overlayState_${tabId}`]);
});

// 탭 URL이 바뀌면 (페이지 이동) active 상태만 false로 초기화
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  chrome.storage.local.get([`overlayState_${tabId}`], (result) => {
    const state = result[`overlayState_${tabId}`];
    if (state && state.active) {
      chrome.storage.local.set({
        [`overlayState_${tabId}`]: { ...state, active: false },
      });
    }
  });
});
