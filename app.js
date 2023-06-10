const Express = require('express');
const Core = require("./core")
const Path = require("path")
const Fs = require("fs")
const constants = require("constants");
const schedule = require('node-schedule');

let app = Express();

app.use(Express.static(Path.join(__dirname, "static")))
app.use(Express.static(Path.join(__dirname, "./files")))
app.set('views', Path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    const list = JSON.parse(Fs.readFileSync(Path.join(__dirname, "DispatchOrMailInfo.json")))
    res.render('index', { title: "转换工具" , list: list})
})

app.get('/update', (req, res) => {
    const Synchronization= new Core.Synchronization()
    Synchronization.start().then(()=>{
        res.send("OK")
    });
})

app.get('/data', (req, res)=>{
    res.send(JSON.parse(Fs.readFileSync(Path.join(__dirname, "DispatchOrMailInfo.json"))));
})

// 定时任务
let rule = new schedule.RecurrenceRule();
rule.hour = [10, 12, 17];
rule.minute = 0;
rule.second = 0;
let job = schedule.scheduleJob(rule, () => {
    const Synchronization= new Core.Synchronization()
    Synchronization.start().then(()=>{
        console.log(new Date() + ": 定时任务执行。")
    });
});

let server = app.listen(8081,  function () {
    let host = server.address().address
    let port = server.address().port
    console.log("应用实例，访问地址为 http://%s:%s", host, port)

})