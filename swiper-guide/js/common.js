$(function () {

  $(".btn_mode").click(function () {
    $(".wrap").toggleClass("dark");
    $(this).toggleClass("on")
    if ($(this).attr("class") == "btn_mode on") {
      $(this).find("span").text("light_mode")
    } else {
      $(this).find("span").text("dark_mode")
    };
  });


  var pageType = 'bullets';
  var swiper;
  var swiperLoop = false;
  var vertical = "horizontal";
  var navigation = "\tnavigation: {\r" + "\t\tnextEl: '.swiper-button-next',\r" + "\t\tprevEl: '.swiper-button-prev'\r" + "\t},\r"
  var delaly = "3000"
  var autoplay = "\tautoplay: {\r" + "\t\tdelay :" + delaly + ",\r" + "\t\tdisableOnInteraction: false\r" + "\t},\r"
  var newNavigation = navigation;
  var htmlNavigation = ' \t<div class="swiper-button-prev"></div>\r' +
    ' \t<div class="swiper-button-next"></div>\r';
  var htmlpage = ' \t<div class="swiper-pagination"></div>\r'
  var newHtmlNavigation = htmlNavigation
  var newNavigation = navigation;
  var pageJs="\tpagination: {\r\t\tel: '.swiper-pagination',\r\t\ttype: "+pageType+",\r\t},\r";
  var pageTypeIdx = 1;

  slideSwiper();

  // 페이지 타입 변경

  $(".page_type input[type='radio']").click(function () {
    const idx = $(".page_type input[type='radio']").index(this);
    var pageTypeTxt;
    if (pageTypeIdx != idx) {
      pageTypeIdx = idx;
      pageType = $(this).attr('id');
      if (pageType === "none") {
        htmlpage = "";
        pageTypeTxt = "";
        pageJs="";
        jscodeChg(pageJs);
        htmlChg(htmlpage);
      }else if(pageTypeIdx==0){
        console.log("ss")
        htmlChg(htmlpage);
      }else {
        pageTypeTxt = "<i>" + pageType + "</i> type"
        htmlpage = ' \t<div class="swiper-pagination"></div>\r'
        pageJs="\tpagination: {\r\t\tel: '.swiper-pagination',\r\t\ttype: "+pageType+",\r\t},\r";
        jscodeChg(pageType);
        htmlChg();
      }
      $(".swiper-slide .type").html(pageTypeTxt)
      $(".swiper .swiper-pagination, .swiper-slide .type").css({ opacity: "0", transition: ".3s opacity" });
      setTimeout(function () {
        swiper.destroy(false, true)
        slideSwiper();
        $(".swiper .swiper-pagination, .swiper-slide .type").css({ opacity: "1", transition: ".3s opacity" });
      }, 200);
     
      return pageTypeIdx;
    };
  });

  // 좌우 화살표 숨기기
  $("#arow").change(function () {
    if ($(this).is(":checked")) {
      newNavigation = navigation
      newHtmlNavigation = htmlNavigation
      $(".swiper-button-prev, .swiper-button-next").fadeIn(200)
    } else {
      newNavigation = ""
      newHtmlNavigation = ""
      $(".swiper-button-prev, .swiper-button-next").fadeOut(200)
    };
    jscodeChg(newNavigation);
    htmlChg(newHtmlNavigation);
  });

  // 무한루프
  $("#loop").change(function () {
    $(this).is(":checked") ? swiperLoop = true : swiperLoop = false;
    swiper.destroy(false, true)
    slideSwiper();
    jscodeChg(swiperLoop);
  });

  // 가로,세로 방향변경
  $("#vertical").change(function () {
    if ($(this).is(":checked")) {
      vertical = "vertical";
    } else {
      vertical = "horizontal";
    };
    swiper.destroy(false, true);
    slideSwiper();
    jscodeChg(vertical);
  });

  // 오토플레이
  $(".play-btn").click(function () {
    var thisVal = $(this).val();
    if (thisVal === "true") {
      autoplay = "\tautoplay: {\r" + "\t\tdelay :" + delaly + ",\r" + "\t\tdisableOnInteraction: false\r" + "\t},\r"
      swiper.autoplay.start();
    } else {
      autoplay = ""
      swiper.autoplay.stop();
    };
    jscodeChg(autoplay);
  });

  // 딜레이 수치 변경
  $(".delay").click(function () {
    delaly = $(this).siblings(".delayamount").val()
    autoplay = "\tautoplay: {\r" + "\t\tdelay :" + delaly + ",\r" + "\t\tdisableOnInteraction: false\r" + "\t},\r"
    jscodeChg(delaly);
    swiper.destroy(false, true);
    slideSwiper();
  })


  // 조건별 js 코드 변경
  jscodeChg();
  var jscode;
  function jscodeChg(x) {
    jscode = "var swiper  =  new Swiper('.swiper', {\r" +
      "\t direction: '" + vertical + "',\r" +
      "\tspaceBetween: 16,\r" +
      "\tloop: " + swiperLoop + ",\r" +
      autoplay +pageJs + newNavigation +
      "}"
    jscode = jscode.replace((x), "<chg>" + x + "</chg>").replace(/(".*"|'.*')/g, "<green>$1</green>").replace(/(\=)/g, "<orange>$1</orange>").replace(/(var|new)/g, "<puple>$1</puple>").replace(/({|})/g, "<grey>$1</grey>");
    $(".code-box.js .code").html(jscode);
    $(".code-box.js .code chg").addClass("chg");
    setTimeout(function () {
      $(".code-box.js .code chg").removeClass("chg");
      $(".code-box.js .code chg").contents().unwrap("chg");
    }, 400);

  };

  // 조건 별 html 코드 변경
  htmlChg();
  var htmlCode;
  function htmlChg(x) {
    if (x != "" && x != undefined) {
      x = x.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };
    htmlCode = '<div class="swiper">\r' +
      '\t<div class="swiper-wrapper">\r' +
      '    \t\t<div class="swiper-slide">slide 1</div>\r' +
      '    \t\t<div class="swiper-slide">slide 2</div>\r' +
      '    \t\t<div class="swiper-slide">slide 3</div>\r' +
      '    \t\t<div class="swiper-slide">slide 4</div>\r' +
      '  \t</div>\r'  + htmlpage + newHtmlNavigation +
      '</div>'
    htmlCode = htmlCode.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace((x), "<chg>" + x + "</chg>").replace(/(&lt.+?&gt;)/g, "<blue>$1</blue>").replace(/(class|id|name)\s*\=/g, "<green>$1\=</green>").replace(/(\=)/g, "<grey>$1</grey>").replace(/(".*"|'.*')/g, "<orange>$1</orange>")
    $(".code-box.html .code").html(htmlCode)
    $(".code-box.html .code chg").addClass("chg")
    setTimeout(function () {
      $(".code-box.html .code chg").removeClass("chg")
      $(".code-box.html .code chg").contents().unwrap("chg")
    }, 400)
  };
  var change = ""
  var transition = "";
  function consoleTxt(a) {
    transition += "<p>" + a + "</p>";
    $(".console").html(transition)
    $(".box_consle").scrollTop($(".box_consle").prop('scrollHeight'))
  }

  // 미리보기 스와이퍼 스크립트
  function slideSwiper() {
    swiper = new Swiper('.swiper', {
      direction: vertical,
      spaceBetween: 16,
      loop: swiperLoop,
      pagination: {
        el: '.swiper-pagination',
        type: pageType,
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      }, autoplay: {
        delay: delaly,
        disableOnInteraction: false
      },
      on: {
        slideChange: function () {
          change = "slideChange"

        },
        beforeTransitionStart: function () {
          transition = "<p class='blue'>" + change + "</p><b>Active slide number</b> : " + swiper.activeIndex
        },
        slideChangeTransitionEnd: function () {
          x = "slideChangeTransitionEnd"
          consoleTxt(x)
        },
        slideChangeTransitionStart: function () {
          x = "slideChangeTransitionStart"
          consoleTxt(x)
        },
        slideNextTransitionEnd: function () {
          x = "slideNextTransitionEnd"
          consoleTxt(x)
          change = ""
        },
        slideNextTransitionStart: function () {
          x = "slideNextTransitionStart"
          consoleTxt(x)
        },
        slidePrevTransitionEnd: function () {
          x = "slidePrevTransitionEnd"
          consoleTxt(x)
          change = ""
        },
        slidePrevTransitionStart: function () {
          x = "slidePrevTransitionStart"
          consoleTxt(x)
        },
        slideResetTransitionEnd: function () {
          x = "slideResetTransitionEnd"
          consoleTxt(x)
          change = ""
        },
        slideResetTransitionStart: function () {
          x = "slideResetTransitionStart"
          consoleTxt(x)
        },
        transitionStart: function () {
          x = "transitionStart"
          consoleTxt(x)
        },
        transitionEnd: function () {
          x = "transitionEnd"
          consoleTxt(x)
        },
      }
    });

  };

});