$(function () {

    const nameTarget = $(".naming-list li a")
    const inputTarget = $(".naming-list li input[type='text']")
    const nameCalculation = $(".name-calculation").children()
    const calculationCopybox = $("#calculation-copybox")
    var text = ["블록", " 요소", "수식어"]

    calculationChange();

    function calculationChange(a, b) {
        if (a == "사용안함") {
            a = ""
            nameCalculation.eq(b).children("span").addClass("disabled")
        } else {
            nameCalculation.eq(b).children("span").removeClass("disabled")
        }
        nameCalculation.eq(b).children("span").text(a)

        text[b] = a

        if (text[1] !== "") {
            var underBar = "__"
        } else {
            underBar = ""
        }
        if (text[2] !== "") {
            var hyphen = "--"
        } else {
            hyphen = ""
        }
        calculationCopybox.val(text[0] + underBar + text[1] + hyphen + text[2])
    }


    /*텍스트 입력 영역말고는 탭 안되게*/
    nameTarget.each(function () {
        $(this).attr("tabIndex", "-1")
    })


    /*태그 버튼 클릭시 실행 이벤트*/
    nameTarget.click(function (e) {
        e.preventDefault();
        var name = $(this).text()
        var idx = $(".naming-list").children("li").index($(this).parents("ul").parent("li"))

        $(this).parent("li").addClass("on").siblings().removeClass("on")
        $(this).parent("li").siblings().children("input").val(name)
        calculationChange(name, idx);
    })
    /*태그 버튼 클릭시 실행 이벤트 끝*/
    
    inputTarget.keyup(function () {
        var name = $(this).val()
        var idx = $(".naming-list").children("li").index($(this).parents("ul").parent("li"))

        calculationChange(name, idx);
        nameTarget.parent("li").removeClass("on")
    })

    
    $(".calculation-box").click(function () {
        calculationCopybox.select();
        document.execCommand('copy');
        $(this).addClass("on");
        setTimeout(function () {
            $(".calculation-box").removeClass("on");
        }, 550)
        
    })
})
