$("#update").click(()=>{
    $.get(
        "/update",
        (data)=>{
            console.log(data)
        }
    )
})