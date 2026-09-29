$(function () {
    /*이름 규칙 배열*/


    var block = ["text", "list", "table", "table-head", "section", "link", "image", "form", "list-item", "table-row", "table-data", "box", "button", "sprite", "anchor"]

    var element = [ "anchor","section", "title", "deal", "dimmed",]

    var modifier = ["active", "disabled", "soldout", "dimmed"]
    block.sort();



    /*이름 규칙 배열 끝*/
    var list = $(".naming-list")

    var cte = [block, element, modifier]


    cte.forEach(function (x, idx) {
        x.forEach(function (item) {
            list.children("li").eq(idx).children("ul").append("<li><a href='#'>" + item + "</a></li>")
        })
    })




})
