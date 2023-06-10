$("#update").click(()=>{
    $.get(
        "/update",
        ()=>{
            location.reload();
        }
    )
})