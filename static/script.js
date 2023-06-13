$("#update").click(()=>{
    $("#update").find("span").text("正在更新")
    $.get(
        "/update",
        (data)=>{
            console.log(data)
            swal("成功", "更新完成！", "success").then(()=>{
                location.reload();
            });
        }
    )
})