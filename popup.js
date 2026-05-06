// popup.js v10

const $ = (id) => document.getElementById(id);

const uploadZone = $("uploadZone");
const uploadEmpty = $("uploadEmpty");
const previewImg = $("previewImg");
const previewName = $("previewName");
const imgFooter = $("imgFooter");
const fileInput = $("fileInput");
const fileChange = $("fileChange");
const opSlider = $("opSlider");
const opVal = $("opVal");
const warnBar = $("warnBar");
const toggleBtn = $("toggleBtn");
const removeBtn = $("removeBtn");
const statusDot = $("statusDot");
const modePtr = $("modePtr");
const modeHide = $("modeHide");
const inlineWarn = $("inlineWarn");

let img64 = null;
let isActive = false;
let currentTabId = null;
let scrollFollow = false; // 기본: 화면고정 (fixed)
let pointerOn = false; // 기본: 드래그 가능, 우클릭 가능
let imgVisible = true;
let currentSize = 100;
let currentBlend = "normal";

// SVG icons via DOM API (no innerHTML)
function makeSVG(paths) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "11");
  svg.setAttribute("height", "11");
  svg.setAttribute("viewBox", "0 0 11 11");
  svg.setAttribute("fill", "none");
  paths.forEach(([tag, attrs]) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    svg.appendChild(el);
  });
  return svg;
}
function makeIconStart() {
  return makeSVG([
    [
      "circle",
      {
        cx: "5.5",
        cy: "5.5",
        r: "4.5",
        stroke: "currentColor",
        "stroke-width": "1.2",
      },
    ],
    [
      "path",
      {
        d: "M4 5.5h3M5.5 4v3",
        stroke: "currentColor",
        "stroke-width": "1.2",
        "stroke-linecap": "round",
      },
    ],
  ]);
}
function makeIconStop() {
  return makeSVG([
    [
      "circle",
      {
        cx: "5.5",
        cy: "5.5",
        r: "4.5",
        stroke: "currentColor",
        "stroke-width": "1.2",
      },
    ],
    [
      "rect",
      {
        x: "3.5",
        y: "3.5",
        width: "4",
        height: "4",
        rx: ".5",
        fill: "currentColor",
      },
    ],
  ]);
}

// ── 초기화: 탭 상태 확인 ────────────────────────────
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return;
  }
  currentTabId = tab.id;

  // 사용 불가 페이지 감지 (chrome://, about:, 확장 페이지 등)
  const url = tab.url || "";
  const blocked =
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("about:") ||
    url.startsWith("edge://") ||
    url.startsWith("brave://") ||
    url === "";
  if (blocked) {
    if (warnBar) {
      warnBar.style.display = "flex";
    }
    if (toggleBtn) {
      toggleBtn.disabled = true;
    }
    return;
  }

  // storage에서 이미지 + 이 탭의 상태 불러오기
  chrome.storage.local.get(
    ["overlayImage", `overlayState_${currentTabId}`],
    async (r) => {
      if (r.overlayImage) {
        img64 = r.overlayImage.dataUrl;
        showPreview(r.overlayImage.name, img64);
      }

      const saved = r[`overlayState_${currentTabId}`];

      // 탭에 content.js가 살아있는지 확인 → 실제 active 상태 확인
      let liveActive = false;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          files: ["content.js"],
        });
        // content.js 내부에서 __focInit이 이미 true면 재실행 안 됨 (IIFE guard)
      } catch (e) {}

      try {
        const resp = await chrome.tabs.sendMessage(currentTabId, {
          type: "GET_STATE",
        });
        if (resp && resp.alive) {
          liveActive = true;
          currentSize = resp.S.size ?? 100;
          scrollFollow = resp.S.scrollFollow ?? false;
          pointerOn = resp.pointerOn ?? false;
          imgVisible = resp.imgVisible ?? true;
          opSlider.value = resp.S.opacity ?? 50;
          currentBlend = resp.S.blendMode ?? "normal";
        }
      } catch (e) {
        // content.js 없거나 응답 없음 = 비활성
        liveActive = false;
      }

      if (!liveActive && saved) {
        opSlider.value = saved.opacity ?? 50;
        currentSize = saved.size ?? 100;
        scrollFollow = saved.scrollFollow ?? false;
        pointerOn = saved.pointerOn ?? false;
        imgVisible = saved.imgVisible ?? true;
        currentBlend = saved.blendMode ?? "normal";
      }

      isActive = liveActive;
      syncSlider();
      syncSizeBtns();
      syncBlendSelect();
      syncModes();
      syncToggleBtn();
      syncAlignBtns();
    },
  );
}
init();

// ── 파일 업로드 ──────────────────────────────────────
fileInput.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) readFile(f);
});
fileChange.addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) readFile(f);
});

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag");
});
uploadZone.addEventListener("dragleave", () =>
  uploadZone.classList.remove("drag"),
);
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag");
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) {
    readFile(f);
  }
});
document.addEventListener("paste", (e) => {
  for (const it of e.clipboardData?.items || []) {
    if (!it.type.startsWith("image/")) {
      continue;
    }
    const f = it.getAsFile();
    if (!f) continue;
    uploadZone.classList.add("flash");
    setTimeout(() => uploadZone.classList.remove("flash"), 400);
    readFile(f, "클립보드 이미지");
    break;
  }
});

const STORAGE_WARN_MB = 7;

function showStorageWarn(text) {
  if (!inlineWarn) return;
  inlineWarn.textContent = text;
  inlineWarn.classList.add("show");
  setTimeout(() => {
    inlineWarn.classList.remove("show");
    inlineWarn.textContent = "";
  }, 3500);
}

function readFile(file, name) {
  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > STORAGE_WARN_MB) {
    showStorageWarn(
      `추천 용량 초과 (${sizeMB.toFixed(1)}MB) — 저장이 실패할 수 있어요`,
    );
  }
  const r = new FileReader();
  r.onload = (ev) => {
    img64 = ev.target.result;
    const n = name || file.name;
    showPreview(n, img64);
    chrome.storage.local.set(
      { overlayImage: { dataUrl: img64, name: n } },
      () => {
        if (chrome.runtime.lastError) {
          showStorageWarn(
            `저장 실패: 이미지가 너빔 큽니다 (${sizeMB.toFixed(1)}MB)`,
          );
        }
      },
    );
    if (isActive) sendUpdate({ imageUrl: img64 });
  };
  r.onerror = () => showStorageWarn("파일을 읽을 수 없어요");
  r.readAsDataURL(file);
}

function showPreview(name, src) {
  uploadEmpty.style.display = "none";
  previewImg.src = src;
  previewImg.classList.add("on");
  previewName.textContent = name;
  imgFooter.classList.add("on");
  uploadZone.classList.add("has");
}

// ── 슬라이더 ─────────────────────────────────────────
opSlider.addEventListener("input", () => {
  syncSlider();
  sendUpdate({ opacity: +opSlider.value });
});
function syncSlider() {
  const v = opSlider.value;
  opVal.textContent = v + "%";
  opSlider.style.setProperty("--p", v + "%");
}
syncSlider();

// ── 크기 프리셋 ───────────────────────────────────────
document.querySelectorAll(".sz-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentSize = +btn.dataset.scale;
    syncSizeBtns();
    sendUpdate({ size: currentSize });
  });
});
function syncSizeBtns() {
  document
    .querySelectorAll(".sz-btn")
    .forEach((b) => b.classList.toggle("on", +b.dataset.scale === currentSize));
}

// ── 블렌드 모드 커스텀 셀렉트 ──────────────────────
const blendTrigger = $("blendTrigger");
const blendDropdown = $("blendDropdown");
const blendDot = $("blendDot");
const blendLabel = $("blendLabel");

blendTrigger.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = blendDropdown.classList.toggle("open");
  blendTrigger.classList.toggle("open", open);
});

// 외부 클릭 시 닫기
document.addEventListener("click", () => {
  blendDropdown.classList.remove("open");
  blendTrigger.classList.remove("open");
});

document.querySelectorAll(".blend-option").forEach((opt) => {
  opt.addEventListener("click", (e) => {
    e.stopPropagation();
    currentBlend = opt.dataset.blend;
    syncBlendSelect();
    sendUpdate({ blendMode: currentBlend });
    blendDropdown.classList.remove("open");
    blendTrigger.classList.remove("open");
  });
});

function syncBlendSelect() {
  document.querySelectorAll(".blend-option").forEach((o) => {
    const active = o.dataset.blend === currentBlend;
    o.classList.toggle("on", active);
  });
  // 트리거 업데이트
  const activeOpt = document.querySelector(
    `.blend-option[data-blend="${currentBlend}"]`,
  );
  if (activeOpt) {
    blendDot.style.background = activeOpt.dataset.dot;
    blendLabel.textContent = activeOpt.dataset.name;
  }
}

// ── 정렬 ─────────────────────────────────────────────
document.querySelectorAll(".al-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!isActive) {
      return;
    }
    chrome.tabs.sendMessage(currentTabId, {
      type: "SNAP_POSITION",
      snapTo: btn.dataset.snap,
    });
  });
});
function syncAlignBtns() {
  document.querySelectorAll(".al-btn").forEach((b) => {
    b.disabled = !isActive;
  });
}

// ── 모드 버튼 ─────────────────────────────────────────

modePtr.addEventListener("click", () => {
  pointerOn = !pointerOn;
  syncModes();
  sendUpdate({ pointerOn });
  if (isActive)
    chrome.tabs.sendMessage(currentTabId, {
      type: "CTX_STATE_SYNC",
      pointerOn,
      imgVisible,
    });
});
modeHide.addEventListener("click", () => {
  imgVisible = !imgVisible;
  syncModes();
  sendUpdate({ imgVisible });
  if (isActive)
    chrome.tabs.sendMessage(currentTabId, {
      type: "IMG_VISIBLE_UPDATE",
      imgVisible,
    });
  if (isActive)
    chrome.tabs.sendMessage(currentTabId, {
      type: "CTX_STATE_SYNC",
      pointerOn,
      imgVisible,
    });
});

function syncModes() {
  modePtr.classList.toggle("on", pointerOn);
  modeHide.classList.toggle("on", !imgVisible);
}

// ── 시작/중지 ─────────────────────────────────────────
toggleBtn.addEventListener("click", async () => {
  if (!img64) {
    inlineWarn.classList.add("show");
    // 애니메이션 재실행을 위해 reflow 트릭
    void inlineWarn.offsetWidth;
    inlineWarn.style.animation = "none";
    requestAnimationFrame(() => {
      inlineWarn.style.animation = "";
    });
    setTimeout(() => inlineWarn.classList.remove("show"), 2500);
    return;
  }
  inlineWarn.classList.remove("show");
  isActive = !isActive;
  syncToggleBtn();
  syncAlignBtns();
  save();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return;
  }
  currentTabId = tab.id;

  if (isActive) {
    // 매 시작마다 pointerOn을 false로 초기화 (우클릭이 동작하게)
    pointerOn = false;
    imgVisible = true;
    syncModes();
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch (e) {}
    chrome.tabs.sendMessage(tab.id, { type: "SHOW_OVERLAY", ...getState() });
    statusDot.classList.add("on");
  } else {
    chrome.tabs.sendMessage(tab.id, { type: "REMOVE_OVERLAY" });
    statusDot.classList.remove("on");
  }
});

function syncToggleBtn() {
  toggleBtn.textContent = "";
  if (isActive) {
    toggleBtn.appendChild(makeIconStop());
    toggleBtn.appendChild(document.createTextNode("중지"));
    toggleBtn.classList.add("off");
  } else {
    toggleBtn.appendChild(makeIconStart());
    toggleBtn.appendChild(document.createTextNode("시작"));
    toggleBtn.classList.remove("off");
  }
}

// ── 제거 ─────────────────────────────────────────────
removeBtn.addEventListener("click", async () => {
  isActive = false;
  syncToggleBtn();
  syncAlignBtns();
  statusDot.classList.remove("on");
  const keys = ["overlayImage"];
  if (currentTabId) keys.push(`overlayState_${currentTabId}`);
  chrome.storage.local.remove(keys);

  img64 = null;
  uploadEmpty.style.display = "";
  previewImg.classList.remove("on");
  previewImg.src = "";
  previewName.textContent = "";
  imgFooter.classList.remove("on");
  uploadZone.classList.remove("has");
  opSlider.value = 50;
  syncSlider();
  currentSize = 100;
  syncSizeBtns();
  scrollFollow = false;
  pointerOn = false;
  imgVisible = true;
  syncModes();
  currentBlend = "normal";
  syncBlendSelect();

  if (currentTabId)
    chrome.tabs.sendMessage(currentTabId, { type: "REMOVE_OVERLAY" });
});

// ── helpers ───────────────────────────────────────────
function getState() {
  return {
    imageUrl: img64,
    opacity: +opSlider.value,
    size: currentSize,
    scrollFollow,
    pointerOn,
    imgVisible,
    blendMode: currentBlend,
  };
}

function save() {
  if (!currentTabId) {
    return;
  }
  chrome.storage.local.set({
    [`overlayState_${currentTabId}`]: { ...getState(), active: isActive },
  });
}

// 특정 필드만 업데이트
function sendUpdate(fields = {}) {
  save();
  if (!isActive || !currentTabId) {
    return;
  }
  chrome.tabs.sendMessage(currentTabId, {
    type: "UPDATE_OVERLAY",
    ...getState(),
    ...fields,
  });
}

// ── content → popup 동기화 ───────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "OVERLAY_CLOSED") {
    isActive = false;
    syncToggleBtn();
    statusDot.classList.remove("on");
    save();
  }
  if (msg.type === "POSITION_UPDATE") {
    save();
  }
  if (msg.type === "OPACITY_UPDATE") {
    opSlider.value = msg.opacity;
    syncSlider();
    save();
  }
  if (msg.type === "SIZE_UPDATE") {
    currentSize = msg.size;
    syncSizeBtns();
    save();
  }
  if (msg.type === "SCROLL_FOLLOW_UPDATE") {
    scrollFollow = msg.scrollFollow;
    syncModes();
    save();
  }
  if (msg.type === "POINTER_UPDATE") {
    pointerOn = msg.pointerOn;
    syncModes();
    save();
  }
  if (msg.type === "IMG_VISIBLE_UPDATE") {
    imgVisible = msg.imgVisible;
    syncModes();
    save();
  }
  if (msg.type === "BLEND_UPDATE") {
    currentBlend = msg.blendMode;
    syncBlendSelect();
    save();
  }
});
