// content.js v19

(function () {
  "use strict";
  if (window.__focInit) return;
  window.__focInit = true;

  // ── 상태 ────────────────────────────────────────────
  var S = {
    scrollFollow: false,
    blendMode: "normal",
    opacity: 50,
    size: 100,
    x: 0,
    y: 0,
  };
  var pointerOn = false;
  var imgVisible = true;
  var anchorEl = null;
  var anchorObs = null;
  var anchorRAF = null;

  var BLENDS = [
    { id: "normal", label: "Normal", dot: "#9b94b8", desc: "기본" },
    {
      id: "difference",
      label: "Difference",
      dot: "#e06b61",
      desc: "차이 강조",
    },
    { id: "multiply", label: "Multiply", dot: "#c4a55a", desc: "어둡게 합성" },
    { id: "screen", label: "Screen", dot: "#5a9be0", desc: "밝게 합성" },
  ];

  // ── 중앙 상태 적용 ──────────────────────────────────
  // fields: { opacity, blendMode, size, pointerOn, imgVisible, scrollFollow }
  // 변경된 필드만 넘기면 img + topbar + ctx 세 곳을 동시에 동기화
  function applyState(fields, skipMsg) {
    var img = document.getElementById("foc-img");
    if (!img) return;

    if (fields.opacity !== undefined) {
      S.opacity = fields.opacity;
      img.style.opacity = S.opacity / 100;
    }
    if (fields.blendMode !== undefined) {
      S.blendMode = fields.blendMode;
      img.style.mixBlendMode = S.blendMode;
    }
    if (fields.size !== undefined) {
      S.size = fields.size;
      img.style.transform = "scale(" + S.size / 100 + ")";
      placeImg(img, S.x, S.y);
      requestAnimationFrame(function () {
        var bar = document.getElementById("foc-topbar");
        if (!bar || !imgVisible) return;
        var ir = img.getBoundingClientRect();
        bar.style.left = ir.left + "px";
        bar.style.top = ir.top + "px";
        bar.style.transform = "translateY(-100%)";
      });
    }
    if (fields.pointerOn !== undefined) {
      pointerOn = fields.pointerOn;
      img.classList.toggle("foc-passthrough", pointerOn);
    }
    if (fields.imgVisible !== undefined) {
      imgVisible = fields.imgVisible;
      img.classList.toggle("foc-hidden", !imgVisible);
    }
    if (fields.scrollFollow !== undefined) {
      S.scrollFollow = fields.scrollFollow;
      img.classList.toggle("foc-follow", S.scrollFollow);
      placeImg(img, S.x, S.y);
    }

    syncUI(fields);

    if (!skipMsg) {
      if (fields.opacity !== undefined)
        msg({ type: "OPACITY_UPDATE", opacity: S.opacity });
      if (fields.blendMode !== undefined)
        msg({ type: "BLEND_UPDATE", blendMode: S.blendMode });
      if (fields.size !== undefined) msg({ type: "SIZE_UPDATE", size: S.size });
      if (fields.pointerOn !== undefined)
        msg({ type: "POINTER_UPDATE", pointerOn: pointerOn });
      if (fields.imgVisible !== undefined)
        msg({ type: "IMG_VISIBLE_UPDATE", imgVisible: imgVisible });
      if (fields.scrollFollow !== undefined)
        msg({ type: "SCROLL_FOLLOW_UPDATE", scrollFollow: S.scrollFollow });
    }
  }

  // topbar + ctx UI를 현재 S / pointerOn / imgVisible 에 맞게 갱신
  function syncUI(changed) {
    changed = changed || {};
    var bar = document.getElementById("foc-topbar");
    if (bar) {
      if ("pointerOn" in changed || "imgVisible" in changed) {
        var pills = bar.querySelectorAll(".foc-topbar-pill");
        if (pills[0])
          pills[0].className = "foc-topbar-pill" + (pointerOn ? " on" : " off");
        if (pills[1])
          pills[1].className =
            "foc-topbar-pill" + (!imgVisible ? " on" : " off");
      }
      if ("opacity" in changed) {
        var opVal = bar.querySelector(".foc-topbar-op-val");
        if (opVal) opVal.textContent = S.opacity + "%";
      }
      if ("blendMode" in changed) {
        var blend =
          BLENDS.find(function (b) {
            return b.id === S.blendMode;
          }) || BLENDS[0];
        var dot = bar.querySelector(".foc-topbar-blend-dot");
        var lbl = bar.querySelector(".foc-topbar-blend-label");
        if (dot) dot.style.background = blend.dot;
        if (lbl) lbl.textContent = blend.label;
        bar.querySelectorAll(".foc-topbar-blend-opt").forEach(function (o) {
          o.classList.toggle("on", o.dataset.blendId === S.blendMode);
        });
      }
    }
    var ctx = document.getElementById("foc-ctx");
    if (ctx) {
      if ("pointerOn" in changed) {
        var elPtr = ctx.querySelector("[data-foc-id='ptr']");
        if (elPtr) elPtr.classList.toggle("ctx-active", pointerOn);
      }
      if ("imgVisible" in changed) {
        var elEye = ctx.querySelector("[data-foc-id='eye']");
        if (elEye) {
          elEye.classList.toggle("ctx-active", !imgVisible);
          elEye.classList.toggle("ctx-ico-eye-off", !imgVisible);
          elEye.querySelector(".ctx-name").textContent = imgVisible
            ? "이미지 숨기기"
            : "이미지 보이기";
        }
      }
      if ("opacity" in changed) {
        var ctxSl = ctx.querySelector(".ctx-sl");
        var ctxPct = ctx.querySelector(".ctx-pct");
        if (ctxSl) {
          ctxSl.value = S.opacity;
          ctxSl.style.setProperty("--p", S.opacity + "%");
        }
        if (ctxPct) ctxPct.textContent = S.opacity + "%";
      }
      if ("blendMode" in changed) {
        var blend2 =
          BLENDS.find(function (b) {
            return b.id === S.blendMode;
          }) || BLENDS[0];
        var bDot = ctx.querySelector(".ctx-blend-trigger-dot");
        var bName = ctx.querySelector(".ctx-blend-trigger-name");
        var bDesc = ctx.querySelector(".ctx-blend-trigger-desc");
        if (bDot) bDot.style.background = blend2.dot;
        if (bName) bName.textContent = blend2.label;
        if (bDesc) bDesc.textContent = blend2.desc;
        ctx.querySelectorAll(".ctx-blend-opt").forEach(function (o) {
          o.classList.toggle("ctx-active", o.dataset.blendId === S.blendMode);
        });
      }
      if ("size" in changed) {
        ctx.querySelectorAll(".ctx-sz-btn").forEach(function (b) {
          b.classList.toggle("ctx-active", +b.dataset.size === S.size);
        });
      }
      if ("scrollFollow" in changed) {
        var elPin = ctx.querySelector("[data-foc-id='pin']");
        if (elPin) {
          elPin.classList.toggle("ctx-active", !S.scrollFollow);
          elPin.querySelector(".ctx-name").textContent = S.scrollFollow
            ? "문서기준"
            : "화면고정";
        }
      }
    }
  }
  // ── 빌드 ────────────────────────────────────────────
  function build(data) {
    S = {
      scrollFollow: false,
      blendMode: "normal",
      opacity: 50,
      size: 100,
      x: 0,
      y: 0,
    };
    Object.assign(S, data);
    pointerOn = data.pointerOn === true;
    imgVisible = data.imgVisible !== false;

    removeEl("foc-img");
    removeEl("foc-ctx");
    removeEl("foc-highlight");

    var img = document.createElement("img");
    img.id = "foc-img";
    img.src = data.imageUrl;
    img.draggable = false;
    img.style.opacity = (data.opacity !== undefined ? data.opacity : 50) / 100;
    img.style.transform =
      "scale(" + (data.size !== undefined ? data.size : 100) / 100 + ")";
    img.style.mixBlendMode = data.blendMode || "normal";
    if (S.scrollFollow) img.classList.add("foc-follow");
    if (!imgVisible) img.classList.add("foc-hidden");
    if (pointerOn) img.classList.add("foc-passthrough");
    document.body.appendChild(img);

    var _initX = S.x > 0 || S.y > 0 ? S.x : -1;
    var _initY = S.x > 0 || S.y > 0 ? S.y : -1;
    if (img.complete && img.naturalWidth > 0) {
      placeImg(img, _initX, _initY);
    } else {
      img.addEventListener(
        "load",
        function () {
          placeImg(img, _initX, _initY);
        },
        { once: true },
      );
    }

    makeDrag(img);
    setupContextMenu(img);
    updateTopBar();
  }

  // ── 위치 ────────────────────────────────────────────
  function placeImg(img, x, y) {
    var vw = window.innerWidth,
      vh = window.innerHeight;
    var sc = (S.size || 100) / 100;
    var iw = (img.naturalWidth || 400) * sc;
    var ih = (img.naturalHeight || 300) * sc;
    var cx, cy;
    if (x < 0 && y < 0) {
      // 초기 배치: 화면 중앙
      cx = Math.max(0, (vw - iw) / 2);
      cy = Math.max(0, (vh - ih) / 2);
    } else {
      cx = Math.max(0, Math.min(x, vw - 20));
      cy = Math.max(0, Math.min(y, vh - 20));
    }
    img.style.left = S.scrollFollow ? cx + window.scrollX + "px" : cx + "px";
    img.style.top = S.scrollFollow ? cy + window.scrollY + "px" : cy + "px";
    S.x = cx;
    S.y = cy;
  }

  // ── 스크롤 ──────────────────────────────────────────
  window.addEventListener(
    "scroll",
    function () {
      if (anchorEl) syncToAnchor();
    },
    { passive: true },
  );

  // ── 앵커 ────────────────────────────────────────────
  function syncToAnchor() {
    if (!anchorEl || anchorRAF) return;
    anchorRAF = requestAnimationFrame(function () {
      anchorRAF = null;
      if (!anchorEl) return;
      var img = document.getElementById("foc-img");
      if (!img) return;
      var r = anchorEl.getBoundingClientRect();
      img.classList.remove("foc-follow");
      img.style.left = r.left + "px";
      img.style.top = r.top + "px";
      S.x = r.left;
      S.y = r.top;
      updateTopBarAnchor();
    });
  }

  function updateTopBarAnchor() {
    var bar = document.getElementById("foc-topbar");
    if (!bar) return;
    var pick = bar.querySelector(".foc-topbar-pick");
    if (pick) pick.className = "foc-topbar-pick" + (anchorEl ? " on" : "");
  }

  function releaseAnchor() {
    if (anchorRAF) {
      cancelAnimationFrame(anchorRAF);
      anchorRAF = null;
    }
    if (anchorObs) {
      anchorObs.disconnect();
      anchorObs = null;
    }
    anchorEl = null;
    updateTopBarAnchor();
    var img = document.getElementById("foc-img");
    if (img) {
      var rect = img.getBoundingClientRect();
      S.x = rect.left;
      S.y = rect.top;
      img.classList.toggle("foc-follow", !!S.scrollFollow);
      img.style.left = S.scrollFollow
        ? rect.left + window.scrollX + "px"
        : rect.left + "px";
      img.style.top = S.scrollFollow
        ? rect.top + window.scrollY + "px"
        : rect.top + "px";
    }
    msg({ type: "ANCHOR_UPDATE", anchorActive: false });
  }

  function setAnchor(el) {
    releaseAnchor();
    anchorEl = el;
    var img = document.getElementById("foc-img");
    if (img) img.classList.remove("foc-follow");
    anchorObs = new ResizeObserver(function () {
      syncToAnchor();
    });
    anchorObs.observe(el);
    syncToAnchor();
    updateTopBarAnchor();
    msg({ type: "ANCHOR_SET" });
  }

  function startPicking() {
    document.body.classList.add("foc-picking");
    var hl = document.createElement("div");
    hl.id = "foc-highlight";
    document.body.appendChild(hl);
    var lastEl = null;
    var SKIP = ["foc-img", "foc-ctx", "foc-highlight", "foc-topbar"];

    function onMove(e) {
      var cx = e.touches ? e.touches[0].clientX : e.clientX;
      var cy = e.touches ? e.touches[0].clientY : e.clientY;
      var el = document.elementFromPoint(cx, cy);
      while (el && SKIP.indexOf(el.id) !== -1) el = el.parentElement;
      if (!el || el === document.body || el === document.documentElement) {
        hl.style.display = "none";
        lastEl = null;
        return;
      }
      if (el === lastEl) return;
      lastEl = el;
      var r = el.getBoundingClientRect();
      hl.style.display = "block";
      hl.style.top = r.top + "px";
      hl.style.left = r.left + "px";
      hl.style.width = r.width + "px";
      hl.style.height = r.height + "px";
    }

    function onPick(e) {
      e.preventDefault();
      e.stopPropagation();
      var cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      var cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      var el = document.elementFromPoint(cx, cy);
      while (el && SKIP.indexOf(el.id) !== -1) el = el.parentElement;
      cleanup();
      if (el && el !== document.body && el !== document.documentElement)
        setAnchor(el);
    }

    function onKey(e) {
      if (e.key === "Escape") cleanup();
    }

    function cleanup() {
      document.body.classList.remove("foc-picking");
      removeEl("foc-highlight");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("click", onPick, true);
      document.removeEventListener("touchend", onPick, true);
      document.removeEventListener("keydown", onKey);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("click", onPick, true);
    document.addEventListener("touchend", onPick, {
      capture: true,
      passive: false,
    });
    document.addEventListener("keydown", onKey);
  }

  // ── 드래그 ──────────────────────────────────────────
  function makeDrag(img) {
    var active = false,
      sx = 0,
      sy = 0,
      ox = 0,
      oy = 0;

    function getClientPos(e) {
      var src = e.touches ? e.touches[0] : e;
      return { x: src.clientX, y: src.clientY };
    }

    function onStart(e) {
      if (!e.touches && e.button !== 0) return;

      if (anchorEl) {
        var rect = img.getBoundingClientRect();
        S.x = rect.left;
        S.y = rect.top;
        releaseAnchor();
        img.style.left = rect.left + "px";
        img.style.top = rect.top + "px";
      }
      if (S.scrollFollow) {
        S.scrollFollow = false;
        img.classList.remove("foc-follow");
        var r = img.getBoundingClientRect();
        S.x = r.left;
        S.y = r.top;
        img.style.left = r.left + "px";
        img.style.top = r.top + "px";
        msg({ type: "SCROLL_FOLLOW_UPDATE", scrollFollow: false });
      }

      active = true;
      var pos = getClientPos(e);
      sx = pos.x;
      sy = pos.y;
      ox = S.x;
      oy = S.y;
      e.preventDefault();
    }

    function onMove(e) {
      if (!active) return;
      var pos = getClientPos(e);
      S.x = ox + pos.x - sx;
      S.y = oy + pos.y - sy;
      img.style.left = S.x + "px";
      img.style.top = S.y + "px";
      // 바 위치 직접 계산 (getBCR 없이)
      var bar = document.getElementById("foc-topbar");
      if (bar) {
        bar.style.left = S.x + "px";
        bar.style.top = S.y + "px";
      }
    }

    function onEnd() {
      if (!active) return;
      active = false;
      msg({ type: "POSITION_UPDATE", x: S.x, y: S.y });
    }

    img.addEventListener("mousedown", onStart);
    img.addEventListener("touchstart", onStart, { passive: false });
    document.addEventListener("mousemove", onMove);
    document.addEventListener(
      "touchmove",
      function (e) {
        if (active) e.preventDefault();
        onMove(e);
      },
      { passive: false },
    );
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchend", onEnd);
  }

  // ── 스냅 ────────────────────────────────────────────
  function doSnap(snapTo, imgEl) {
    var img = imgEl || document.getElementById("foc-img");
    if (!img) return;
    function run() {
      var vw = window.innerWidth,
        vh = window.innerHeight;
      var sc = (S.size || 100) / 100;
      var iw = (img.naturalWidth || 400) * sc;
      var ih = (img.naturalHeight || 300) * sc;
      var map = {
        top: { x: (vw - iw) / 2, y: 0 },
        middle: { x: (vw - iw) / 2, y: (vh - ih) / 2 },
        bottom: { x: (vw - iw) / 2, y: vh - ih },
        left: { x: 0, y: (vh - ih) / 2 },
        right: { x: vw - iw, y: (vh - ih) / 2 },
      };
      var p = map[snapTo] || map.middle;
      placeImg(img, Math.max(0, p.x), Math.max(0, p.y));
      msg({ type: "POSITION_UPDATE", x: S.x, y: S.y });
    }
    if (img.complete && img.naturalWidth > 0) run();
    else img.addEventListener("load", run, { once: true });
  }

  // ── 우클릭 메뉴 ─────────────────────────────────────
  function setupContextMenu(img) {
    img.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      showCtx(e.clientX, e.clientY, img);
    });
    document.addEventListener("contextmenu", function (e) {
      var ctx = document.getElementById("foc-ctx");
      if (ctx && ctx.contains(e.target)) return;
      if (ctx) {
        e.preventDefault();
        closeCtx();
      }
    });
    document.addEventListener("mousedown", function (e) {
      var ctx = document.getElementById("foc-ctx");
      if (!ctx) return;
      if (ctx.contains(e.target)) return;
      if (e.target.closest && e.target.closest(".foc-topbar-menu")) return;
      closeCtx();
    });

    // mobile: long press 500ms -> context menu
    var _lpTimer = null,
      _lpMoved = false;
    img.addEventListener(
      "touchstart",
      function (e) {
        if (e.touches.length !== 1) return;
        _lpMoved = false;
        var t = e.touches[0];
        _lpTimer = setTimeout(function () {
          if (_lpMoved) return;
          showCtx(t.clientX, t.clientY, img);
        }, 500);
      },
      { passive: true },
    );
    img.addEventListener(
      "touchmove",
      function () {
        _lpMoved = true;
        if (_lpTimer) {
          clearTimeout(_lpTimer);
          _lpTimer = null;
        }
      },
      { passive: true },
    );
    img.addEventListener("touchend", function () {
      if (_lpTimer) {
        clearTimeout(_lpTimer);
        _lpTimer = null;
      }
    });

    // mobile: close ctx on outside touch
    document.addEventListener(
      "touchstart",
      function (e) {
        var ctx = document.getElementById("foc-ctx");
        if (!ctx) return;
        if (ctx.contains(e.target)) return;
        if (e.target.closest && e.target.closest(".foc-topbar-menu")) return;
        closeCtx();
      },
      { passive: true },
    );
  }

  function closeCtx() {
    removeEl("foc-ctx");
  }

  function showCtx(x, y, img) {
    closeCtx();
    var m = document.createElement("div");
    m.id = "foc-ctx";
    m.appendChild(mkEl("div", "ctx-lbl", "Overlay Image"));

    // 투명도
    var slRow = mkEl("div", "ctx-sl-row");
    var sl = document.createElement("input");
    sl.type = "range";
    sl.min = "0";
    sl.max = "100";
    sl.step = "1";
    sl.value = String(S.opacity !== undefined ? S.opacity : 50);
    sl.className = "ctx-sl";
    sl.style.setProperty("--p", sl.value + "%");
    var pct = mkEl("span", "ctx-pct", sl.value + "%");
    sl.addEventListener("input", function () {
      var v = Number(sl.value);
      sl.style.setProperty("--p", v + "%");
      applyState({ opacity: v });
    });
    slRow.appendChild(sl);
    slRow.appendChild(pct);
    m.appendChild(slRow);
    m.appendChild(mkSep());

    // 블렌드 모드
    m.appendChild(mkEl("div", "ctx-lbl", "블렌드 모드"));
    var bWrap = mkEl("div", "ctx-blend-wrap");
    var curBlend = BLENDS[0];
    for (var bi = 0; bi < BLENDS.length; bi++) {
      if (BLENDS[bi].id === S.blendMode) {
        curBlend = BLENDS[bi];
        break;
      }
    }
    var bTrig = mkEl("div", "ctx-blend-trigger");
    var bTrigDot = mkEl("div", "ctx-blend-trigger-dot");
    bTrigDot.style.background = curBlend.dot;
    var bTrigName = mkEl("span", "ctx-blend-trigger-name", curBlend.label);
    var bTrigDesc = mkEl("span", "ctx-blend-trigger-desc", curBlend.desc);
    var bTrigArr = mkEl("div", "ctx-blend-trigger-arr ctx-blend-arr-ico");
    bTrig.appendChild(bTrigDot);
    bTrig.appendChild(bTrigName);
    bTrig.appendChild(bTrigDesc);
    bTrig.appendChild(bTrigArr);

    var bDrop = mkEl("div", "ctx-blend-dropdown");
    for (var bj = 0; bj < BLENDS.length; bj++) {
      (function (blend) {
        var opt = mkEl(
          "div",
          "ctx-blend-opt" + (S.blendMode === blend.id ? " ctx-active" : ""),
        );
        var oDot = mkEl("div", "ctx-blend-dot");
        oDot.style.background = blend.dot;
        opt.appendChild(oDot);
        opt.appendChild(mkEl("span", "ctx-blend-name", blend.label));
        opt.appendChild(mkEl("span", "ctx-blend-desc", blend.desc));
        opt.appendChild(mkEl("span", "ctx-blend-chk", "✓"));
        opt.dataset.blendId = blend.id;
        opt.addEventListener("click", function (e) {
          e.stopPropagation();
          bTrig.classList.remove("open");
          bDrop.classList.remove("open");
          applyState({ blendMode: blend.id });
        });
        bDrop.appendChild(opt);
      })(BLENDS[bj]);
    }
    bTrig.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !bDrop.classList.contains("open");
      bTrig.classList.toggle("open", open);
      bDrop.classList.toggle("open", open);
    });
    bWrap.appendChild(bTrig);
    bWrap.appendChild(bDrop);
    m.appendChild(bWrap);
    m.appendChild(mkSep());

    // 숨기기
    var iEye = mkItem("ctx-ico-eye", "이미지 숨기기", "Alt+X", !imgVisible);
    iEye.dataset.focId = "eye";
    if (!imgVisible) iEye.classList.add("ctx-ico-eye-off");
    iEye.addEventListener("click", function () {
      applyState({ imgVisible: !imgVisible });
    });

    // 포인터 통과
    var iPtr = mkItem("ctx-ico-ptr", "포인터 통과", "Alt+Z", pointerOn);
    iPtr.dataset.focId = "ptr";
    iPtr.addEventListener("click", function () {
      applyState({ pointerOn: !pointerOn });
    });

    // 요소에 고정 — 일반 버튼
    var iAnchor = mkItem(
      "ctx-ico-target",
      anchorEl ? "앵커 해제" : "요소에 고정",
      "",
      !!anchorEl,
    );
    iAnchor.addEventListener("click", function () {
      if (anchorEl) {
        releaseAnchor();
        iPin.style.opacity = "";
        iPin.style.pointerEvents = "";
        iPin.classList.remove("ctx-disabled");
        iAnchor.classList.remove("ctx-active");
        iAnchor.querySelector(".ctx-name").textContent = "요소에 고정";
      } else {
        closeCtx();
        startPicking();
      }
    });

    // 화면고정
    var iPin = mkItem(
      "ctx-ico-pin",
      S.scrollFollow ? "문서기준" : "화면고정",
      anchorEl ? "" : "Alt+S",
      !S.scrollFollow && !anchorEl,
    );
    if (anchorEl) {
      iPin.classList.add("ctx-disabled");
      iPin.style.opacity = "0.35";
      iPin.style.pointerEvents = "none";
    }
    iPin.dataset.focId = "pin";
    iPin.addEventListener("click", function () {
      applyState({ scrollFollow: !S.scrollFollow });
    });

    m.appendChild(iEye);
    m.appendChild(iPtr);
    m.appendChild(iAnchor);
    m.appendChild(iPin);
    m.appendChild(mkSep());

    // 크기
    m.appendChild(mkEl("div", "ctx-lbl", "크기"));
    var szRow = mkEl("div", "ctx-size-row");
    [
      ["x0.5", 50],
      ["x1", 100],
      ["x2", 200],
    ].forEach(function (item) {
      var b = document.createElement("button");
      b.className =
        "ctx-sz-btn" + ((S.size || 100) === item[1] ? " ctx-active" : "");
      b.textContent = item[0];
      b.dataset.size = item[1];
      b.addEventListener("click", function () {
        applyState({ size: item[1] });
      });
      szRow.appendChild(b);
    });
    m.appendChild(szRow);
    m.appendChild(mkSep());

    // 정렬(상중하) + X/Y 한 줄
    var snapXyRow = mkEl("div", "ctx-snap-xy-row");

    // 상중하 버튼
    [
      ["top", "ctx-al-top"],
      ["middle", "ctx-al-mid"],
      ["bottom", "ctx-al-bot"],
    ].forEach(function (item) {
      var b = document.createElement("button");
      b.className = "ctx-al ctx-al-sm " + item[1];
      b.addEventListener("click", function () {
        doSnap(item[0], img);
      });
      snapXyRow.appendChild(b);
    });

    // 구분
    var snapDiv = mkEl("div", "ctx-snap-div");
    snapXyRow.appendChild(snapDiv);

    // X/Y 인풋
    function mkXYField(label, getter, setter) {
      var wrap = mkEl("div", "ctx-xy-wrap");
      var inp = document.createElement("input");
      inp.type = "number";
      inp.className = "ctx-xy-inp";
      inp.value = Math.round(getter());
      wrap.appendChild(mkEl("span", "ctx-xy-lbl", label));
      wrap.appendChild(inp);
      inp.addEventListener("focus", function () {
        inp.select();
      });
      inp.addEventListener("change", function () {
        var v = parseInt(inp.value, 10);
        if (isNaN(v)) {
          inp.value = Math.round(getter());
          return;
        }
        setter(v);
        inp.value = Math.round(getter());
        msg({ type: "POSITION_UPDATE", x: S.x, y: S.y });
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          inp.value = Math.round(getter()) - 1;
          inp.dispatchEvent(new Event("change"));
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          inp.value = Math.round(getter()) + 1;
          inp.dispatchEvent(new Event("change"));
        }
        if (e.key === "Enter") inp.blur();
      });
      return wrap;
    }
    snapXyRow.appendChild(
      mkXYField(
        "X",
        function () {
          return S.x;
        },
        function (v) {
          S.x = v;
          img.style.left = S.scrollFollow
            ? v + window.scrollX + "px"
            : v + "px";
        },
      ),
    );
    snapXyRow.appendChild(
      mkXYField(
        "Y",
        function () {
          return S.y;
        },
        function (v) {
          S.y = v;
          img.style.top = S.scrollFollow ? v + window.scrollY + "px" : v + "px";
        },
      ),
    );
    m.appendChild(snapXyRow);

    // 중지
    m.appendChild(mkSep());
    var iClose = document.createElement("div");
    iClose.className = "ctx-stop-btn";
    var iCloseIco = document.createElement("div");
    iCloseIco.className = "ctx-stop-ico";
    iClose.appendChild(iCloseIco);
    iClose.appendChild(mkEl("span", "", "중지"));
    iClose.addEventListener("click", function () {
      closeCtx();
      removeOverlay();
    });
    m.appendChild(iClose);

    document.body.appendChild(m);
    var vw = window.innerWidth,
      vh = window.innerHeight;
    var mw = 210,
      mh = m.offsetHeight || 480;
    m.style.left = (x + mw > vw ? vw - mw - 8 : x) + "px";
    m.style.top = (y + mh > vh ? Math.max(8, vh - mh - 8) : y) + "px";
  }

  // ── 오버레이 제거 ───────────────────────────────────
  function removeOverlay() {
    if (document.__focBlendClose) {
      document.removeEventListener("click", document.__focBlendClose);
      document.__focBlendClose = null;
    }
    releaseAnchor();
    removeEl("foc-img");
    removeEl("foc-ctx");
    removeEl("foc-highlight");
    removeEl("foc-anchor-badge");
    removeEl("foc-topbar");
    document.body.classList.remove("foc-picking");
    window.__focInit = false;
    msg({ type: "OVERLAY_CLOSED" });
  }

  // ── 상단 바 ─────────────────────────────────────────
  function updateTopBar() {
    if (window.__focPtObs) {
      window.__focPtObs.disconnect();
      window.__focPtObs = null;
    }
    removeEl("foc-topbar");
    var img = document.getElementById("foc-img");
    if (!img) return;

    var bar = document.createElement("div");
    bar.id = "foc-topbar";

    function positionBar() {
      // 숨김 상태엔 img가 display:none이라 getBCR이 0,0 → S.x/S.y 직접 사용
      if (!imgVisible) {
        bar.style.left = S.x + "px";
        bar.style.top = S.y - 30 + "px";
        bar.style.transform = "none";
      } else {
        var ir = img.getBoundingClientRect();
        bar.style.left = ir.left + "px";
        bar.style.top = ir.top + "px";
        bar.style.transform = "translateY(-100%)";
      }
    }
    positionBar();

    // 그리드 메뉴 버튼
    var menuBtn = document.createElement("div");
    menuBtn.className = "foc-topbar-menu";
    menuBtn.title =
      "\uba54\ub274 (\ubaa8\ubc14\uc77c \uc5d0\ubc84\uc5bc\ub808\uc774\ud130\uc5d0\uc11c\ub294 \uc6b0\ud074\ub9ad \ub300\uc2e0 \uc774 \ubc84\ud2bc \uc0ac\uc6a9)";
    for (var i = 0; i < 4; i++)
      menuBtn.appendChild(document.createElement("span"));
    menuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (document.getElementById("foc-ctx")) {
        closeCtx();
        return;
      }
      var tr = bar.getBoundingClientRect();
      showCtx(tr.left + tr.width / 2, tr.bottom + 4, img);
    });

    // 활성 dot
    var activeDot = document.createElement("div");
    activeDot.className = "foc-topbar-dot";

    // 포인터 통과 pill
    var pillPtr = document.createElement("div");
    pillPtr.className = "foc-topbar-pill" + (pointerOn ? " on" : " off");
    pillPtr.textContent = "통과";
    pillPtr.addEventListener("click", function (e) {
      e.stopPropagation();
      applyState({ pointerOn: !pointerOn });
    });

    // 숨김 pill
    var pillHide = document.createElement("div");
    pillHide.className = "foc-topbar-pill" + (!imgVisible ? " on" : " off");
    pillHide.textContent = "숨김";
    pillHide.addEventListener("click", function (e) {
      e.stopPropagation();
      applyState({ imgVisible: !imgVisible });
      positionBar();
    });

    // 블렌드 드롭다운
    var blendWrap = document.createElement("div");
    blendWrap.className = "foc-topbar-blend-wrap";
    var blendTrig = document.createElement("div");
    blendTrig.className = "foc-topbar-blend-trig";
    var blendDot = document.createElement("div");
    blendDot.className = "foc-topbar-blend-dot";
    var curBlend =
      BLENDS.find(function (b) {
        return b.id === S.blendMode;
      }) || BLENDS[0];
    blendDot.style.background = curBlend.dot;
    var blendLabel = document.createElement("span");
    blendLabel.className = "foc-topbar-blend-label";
    blendLabel.textContent = curBlend.label;
    blendTrig.appendChild(blendDot);
    blendTrig.appendChild(blendLabel);

    var blendDrop = document.createElement("div");
    blendDrop.className = "foc-topbar-blend-drop";
    blendDrop.id = "foc-topbar-blend-drop";
    BLENDS.forEach(function (blend) {
      var opt = document.createElement("div");
      opt.className =
        "foc-topbar-blend-opt" + (S.blendMode === blend.id ? " on" : "");
      opt.dataset.blendId = blend.id;
      var oDot = document.createElement("div");
      oDot.className = "foc-topbar-blend-dot";
      oDot.style.background = blend.dot;
      var oName = document.createElement("span");
      oName.textContent = blend.label;
      opt.appendChild(oDot);
      opt.appendChild(oName);
      opt.addEventListener("click", function (e) {
        e.stopPropagation();
        blendDrop.classList.remove("open");
        applyState({ blendMode: blend.id });
      });
      blendDrop.appendChild(opt);
    });
    blendTrig.addEventListener("click", function (e) {
      e.stopPropagation();
      blendDrop.classList.toggle("open");
    });
    function closeBlendDrop() {
      blendDrop.classList.remove("open");
    }
    document.__focBlendClose = closeBlendDrop;
    document.addEventListener("click", closeBlendDrop);
    blendWrap.appendChild(blendTrig);
    blendWrap.appendChild(blendDrop);

    // 불투명도 조절
    var opCtrl = document.createElement("div");
    opCtrl.className = "foc-topbar-op";
    var opMinus = document.createElement("div");
    opMinus.className = "foc-topbar-op-btn";
    opMinus.textContent = "−";
    var opVal = document.createElement("span");
    opVal.className = "foc-topbar-op-val";
    opVal.textContent = (S.opacity !== undefined ? S.opacity : 50) + "%";
    var opPlus = document.createElement("div");
    opPlus.className = "foc-topbar-op-btn";
    opPlus.textContent = "+";
    opMinus.addEventListener("click", function (e) {
      e.stopPropagation();
      applyState({ opacity: Math.max(0, (S.opacity || 50) - 10) });
    });
    opPlus.addEventListener("click", function (e) {
      e.stopPropagation();
      applyState({ opacity: Math.min(100, (S.opacity || 50) + 10) });
    });
    opCtrl.appendChild(opMinus);
    opCtrl.appendChild(opVal);
    opCtrl.appendChild(opPlus);

    var pickBtn = document.createElement("div");
    pickBtn.className = "foc-topbar-pick" + (anchorEl ? " on" : "");
    pickBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (anchorEl) {
        releaseAnchor();
      } else {
        closeCtx();
        startPicking();
      }
    });

    bar.appendChild(menuBtn);
    bar.appendChild(activeDot);
    bar.appendChild(pillPtr);
    bar.appendChild(pillHide);
    bar.appendChild(pickBtn);
    bar.appendChild(blendWrap);
    bar.appendChild(opCtrl);

    function forwardDrag(e) {
      if (
        e.target.closest(
          ".foc-topbar-menu, .foc-topbar-pill, .foc-topbar-op, .foc-topbar-blend-wrap",
        )
      )
        return;
      e.preventDefault();
      var src = e.touches ? e.touches[0] : e;
      img.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          clientX: src.clientX,
          clientY: src.clientY,
          button: 0,
        }),
      );
    }
    bar.addEventListener("mousedown", forwardDrag);
    bar.addEventListener("touchstart", forwardDrag, { passive: false });

    // img style/class 변화 → 바 위치 동기화 (드래그 외 케이스: 스냅, 크기변경 등)
    window.__focPtObs = new MutationObserver(function () {
      if (document.getElementById("foc-topbar") !== bar) return;
      requestAnimationFrame(positionBar);
    });
    window.__focPtObs.observe(img, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    document.body.appendChild(bar);
  }

  // ── 단축키 ──────────────────────────────────────────
  document.addEventListener("keydown", function (e) {
    if (!e.altKey) return;
    if (!document.getElementById("foc-img")) return;
    if (e.key === "x" || e.key === "X") {
      applyState({ imgVisible: !imgVisible });
      e.preventDefault();
    }
    if (e.key === "z" || e.key === "Z") {
      applyState({ pointerOn: !pointerOn });
      e.preventDefault();
    }
    if (e.key === "s" || e.key === "S") {
      applyState({ scrollFollow: !S.scrollFollow });
      e.preventDefault();
    }
    if (e.key === "ArrowUp") {
      applyState({ opacity: Math.min(100, (S.opacity || 50) + 10) });
      e.preventDefault();
    }
    if (e.key === "ArrowDown") {
      applyState({ opacity: Math.max(0, (S.opacity || 50) - 10) });
      e.preventDefault();
    }
  });

  // ── 메시지 수신 ─────────────────────────────────────
  chrome.runtime.onMessage.addListener(function (m, _, res) {
    var img = document.getElementById("foc-img");

    if (m.type === "SHOW_OVERLAY") {
      if (img) {
        if (m.imageUrl) img.src = m.imageUrl;
      } else {
        build(m);
      }
    } else if (m.type === "UPDATE_OVERLAY") {
      if (!img) {
        res({ ok: true });
        return true;
      }
      if (m.imageUrl !== undefined && m.imageUrl !== img.src)
        img.src = m.imageUrl;
      if (m.x !== undefined) {
        S.x = m.x;
        S.y = m.y;
        placeImg(img, m.x, m.y);
      }
      var fields = {};
      if (m.opacity !== undefined) fields.opacity = m.opacity;
      if (m.blendMode !== undefined) fields.blendMode = m.blendMode;
      if (m.size !== undefined) fields.size = m.size;
      if (m.pointerOn !== undefined) fields.pointerOn = m.pointerOn;
      if (m.imgVisible !== undefined) fields.imgVisible = m.imgVisible;
      if (m.scrollFollow !== undefined) fields.scrollFollow = m.scrollFollow;
      if (Object.keys(fields).length) applyState(fields, true);
    } else if (m.type === "IMG_VISIBLE_UPDATE") {
      applyState({ imgVisible: m.imgVisible }, true);
    } else if (m.type === "CTX_STATE_SYNC") {
      var f = {};
      if (m.pointerOn !== undefined) f.pointerOn = m.pointerOn;
      if (m.imgVisible !== undefined) f.imgVisible = m.imgVisible;
      if (Object.keys(f).length) applyState(f, true);
    } else if (m.type === "NUDGE") {
      if (img) {
        S.x += m.dx || 0;
        S.y += m.dy || 0;
        img.style.left = S.scrollFollow
          ? S.x + window.scrollX + "px"
          : S.x + "px";
        img.style.top = S.scrollFollow
          ? S.y + window.scrollY + "px"
          : S.y + "px";
        msg({ type: "POSITION_UPDATE", x: S.x, y: S.y });
      }
    } else if (m.type === "SIZE_UPDATE") {
      if (img) applyState({ size: m.size }, true);
    } else if (m.type === "SNAP_POSITION") {
      doSnap(m.snapTo, img);
    } else if (m.type === "REMOVE_OVERLAY") {
      removeOverlay();
    } else if (m.type === "START_PICKING") {
      if (document.getElementById("foc-img")) startPicking();
    } else if (m.type === "RELEASE_ANCHOR") {
      releaseAnchor();
    } else if (m.type === "GET_STATE") {
      res({
        alive: !!document.getElementById("foc-img"),
        S: S,
        pointerOn: pointerOn,
        imgVisible: imgVisible,
        anchorActive: !!anchorEl,
      });
      return true;
    }

    res({ ok: true });
    return true;
  });

  // ── 유틸 ────────────────────────────────────────────
  function removeEl(id) {
    var el = document.getElementById(id);
    if (el) el.parentNode.removeChild(el);
  }
  function mkEl(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function mkSep() {
    return mkEl("div", "ctx-sep");
  }
  // icon은 CSS로 표현 — ico-class만 넘김
  function mkItem(icoClass, name, kbd, active) {
    var d = mkEl("div", "ctx-item" + (active ? " ctx-active" : ""));
    var ico = mkEl("div", "ctx-ico " + icoClass);
    var nm = mkEl("span", "ctx-name", name);
    d.appendChild(ico);
    d.appendChild(nm);
    if (kbd) d.appendChild(mkEl("span", "ctx-kbd", kbd));
    return d;
  }
  function msg(d) {
    try {
      chrome.runtime.sendMessage(d);
    } catch (e) {}
  }
})();
