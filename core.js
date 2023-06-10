const puppeteer = require("puppeteer");
const cheerio = require("cheerio")
const fs = require("fs")
const path = require("path")
const { createWorker } = require("tesseract.js")

class Synchronization {
    FileSavePath= "files"
    DispatchOrMailInfoJsonFile = "DispatchOrMailInfo.json"
    MainUrl = "https://jxoa.jxt189.com/jascx/Login.aspx"
    ValidateCode = "";
    ACCOUNT = "dqpaxwxx"
    PASSWORD = "^QhkD19QP$"
    ValidateImage = "ValidateCode.png"
    BROWSER = {};
    PAGE = {};
    DispatchOrMailInfoArray = [];
    DispatchOrMailInfoFileArray = JSON.parse(fs.readFileSync(path.join(__dirname, this.DispatchOrMailInfoJsonFile)))
    NewDispatchStartKey = -1;
    SUCCESS = false;
    OVER = false;

    DownloadFunction = `
    function downFile(url, fileName) {
        const x = new XMLHttpRequest()
        x.open('GET', url, true)
        x.responseType = 'blob'
        x.onload = function() {
            const url = window.URL.createObjectURL(x.response)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            a.click()
        }
        x.send()}
    `
    constructor() {}
    extraIdFromUrl(url) {
        return url.substring(url.indexOf("=") + 1, url.lastIndexOf("'"))
    }
    spliceString(str) {
        return str.trim().replace(/\s{2,}/g, ' ').split(' ')
    }

    async createBrowser(){
        this.BROWSER = await puppeteer.launch({
            headless: 'new',
            args: ['--use-gl=egl','--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
            defaultViewport: { width: 1920, height: 1080},
        });
        this.PAGE = await this.BROWSER.newPage();
        const client = await this.PAGE.target().createCDPSession()
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: path.join(__dirname,this.FileSavePath),
        })
    }

    async start() {
        this.OVER = false
        await this.login()
        do {
            await new Promise(r => setTimeout(r, 500));
        } while (!this.OVER)
    }

    async login() {
        await this.createBrowser();
        await console.log("打开浏览器……等待15s……")
        const loginTimer = setInterval(async ()=>{
            console.log("打开页面……")
            this.ValidateCode = "";
            await this.PAGE.goto(this.MainUrl,{
                waitUntil: 'networkidle0'
            })
            await this.identificationVerificationCode();
            do {
                await new Promise(r => setTimeout(r, 500));
                console.log("等待0.5ms……")
            } while (this.ValidateCode === "")
            this.inputInfo().then(async ()=>{
                if (this.SUCCESS) {
                    clearInterval(loginTimer)
                    await this.getDispatchOrMailInfo().then(async ()=>{
                        this.dispatchOrMailInfoMain();
                        await this.downloadAttachmentFile();
                        this.PAGE.close().then(()=>{
                            console.log("关闭页面")
                        });
                        this.BROWSER.close().then(()=>{
                            console.log("关闭浏览器")
                            this.OVER = true;
                        });
                    });
                }
            });
        }, 15000)
    }

    async inputInfo(){
        await this.PAGE.type('#txt_Account_Input',this.ACCOUNT);
        await this.PAGE.type('#txt_Password',this.PASSWORD);
        await this.PAGE.type('#txt_ValidateCode', this.ValidateCode);
        await this.PAGE.waitForSelector("#link_MessageAlertNewLink",1000).then(()=>{
            console.log("登录成功!")
            this.SUCCESS = true;
        })
    }

    async identificationVerificationCode(){
        await this.PAGE.waitForSelector('.ImageValidateCode')
        await new Promise(r => setTimeout(r, 2000));
        this.PAGE.evaluate(()=>{
            let {
                x,
                y,
                width,
                height
            }  = document.getElementById("txt_ValidateCode").getBoundingClientRect();
            return {x,y,width,height};
        }).then(async (clip)=>{
            console.log(clip)
            await this.PAGE.screenshot({path: 'ValidateCode.png', clip:{x: clip.x + 50, y: clip.y, width: 50, height: 20}})
            createWorker({
                langPath: path.join(__dirname, "lang-data")
            }).then(async (worker)=>{
                await worker.loadLanguage('eng');
                await worker.initialize('eng');
                worker.recognize(path.join(__dirname, this.ValidateImage)).then(async (temporaryData)=>{
                    this.ValidateCode = temporaryData.data.text
                    await worker.terminate();
                })
            })
        })
    }

    async getDispatchOrMailInfo() {
        await this.goto(this.PAGE,`https://jxoa.jxt189.com/jascx/Message/MessageAlertHistory.aspx`)
        this.SUCCESS = true;
        await new Promise(r => setTimeout(r, 2000));
        const $ = cheerio.load( await this.PAGE.evaluate(()=>{
            return $("#dtg_Data").html().replace(/[\r\n\t]/g,"");
        }));
        const aTageElementArray = $("a").slice(0,20);
        for (const aTageElementArrayItem of aTageElementArray) {
            const dispatchInfo = this.spliceString(aTageElementArrayItem.parent.prev.data)
            this.DispatchOrMailInfoArray.push({
                id: this.extraIdFromUrl(aTageElementArrayItem.attribs.onclick),
                name: aTageElementArrayItem.children[0].data,
                date: dispatchInfo[2],
                time: dispatchInfo[3],
                type: dispatchInfo[1],
                file: `${dispatchInfo[2]}${aTageElementArrayItem.children[0].data}.zip`
            })
        }
    }

    setNewDispatchStartKey(){
        this.NewDispatchStartKey = -1;
        for (const key in this.DispatchOrMailInfoFileArray) {
            if (this.DispatchOrMailInfoArray[key].id === this.DispatchOrMailInfoFileArray[this.DispatchOrMailInfoFileArray.length - 1].id) {
                this.NewDispatchStartKey = key - 1;
            }
        }
    }

    updateDispatchOrMailInfoToJsonFile() {
        for (let key = this.NewDispatchStartKey; key >= 0; key--){
            this.DispatchOrMailInfoFileArray.push({
                id: this.DispatchOrMailInfoArray[key].id,
                name: this.DispatchOrMailInfoArray[key].name,
                date: this.DispatchOrMailInfoArray[key].date,
                time: this.DispatchOrMailInfoArray[key].time,
                type: this.DispatchOrMailInfoArray[key].type,
                file: this.DispatchOrMailInfoArray[key].file
            })
        }
        fs.writeFile(path.join(__dirname, this.DispatchOrMailInfoJsonFile), JSON.stringify(this.DispatchOrMailInfoFileArray, null, 4), (err) => {
            if (err) { throw err; }
            console.log("更新数据!");
        });
    }

    writeDispatchOrMailInfoToJsonFile(){
        let temporaryArray = [];
        for (let key = this.DispatchOrMailInfoArray.length - 1; key >=  0; key--) {
            temporaryArray.push(this.DispatchOrMailInfoArray[key]);
        }
        fs.writeFile(path.join(__dirname, this.DispatchOrMailInfoJsonFile), JSON.stringify(temporaryArray, null, 4), (err) => {
            if (err) { throw err; }
            console.log("写入新数据");
        });
        this.NewDispatchStartKey = this.DispatchOrMailInfoArray.length - 1
    }

    dispatchOrMailInfoMain(){
        this.setNewDispatchStartKey();
        if (this.DispatchOrMailInfoFileArray.length === 0) {
            this.writeDispatchOrMailInfoToJsonFile();
        } else {
            if (this.NewDispatchStartKey !== -1) {
                this.updateDispatchOrMailInfoToJsonFile();
            } else {
                console.log("不需要更新！")
            }
        }
    }

    async openDispatch(page, dispatchId) {
        await this.goto(page, `https://jxoa.jxt189.com/jascx/CommonForm/DispatchView.aspx?formId=${dispatchId}`)
        await this.PAGE.on('dialog', async dialog => {
            await dialog.accept();
        })
        await new Promise(r => setTimeout(r, 2000));
    }
    async openMail(page, mailID) {
        await this.goto(page,`https://jxoa.jxt189.com/jascx/InternalMail/View.aspx?mailId=${mailID}`)
        await new Promise(r => setTimeout(r, 2000));
    }
    async goto(page, link) {
        return page.evaluate((link) => {
            location.href = link;
        }, link);
    }

    async downloadDispatchFile(page, dispatchId, dispatchDate, dispatchName ) {
        //page.evaluate(`${this.DownloadFunction};downFile("https://jxoa.jxt189.com/jascx/CommonForm/DownLoad.aspx?formId=DownLoadAll.aspx?formId=${dispatchId}","${dispatchDate}${dispatchName}.zip")`)
        await this.goto(page, `https://jxoa.jxt189.com/jascx/CommonForm/DownLoadAll.aspx?formId=${dispatchId}`)
        console.log("正在下载文件："+dispatchName)
        await new Promise(r => setTimeout(r, 3000));
    }

    async downloadMailFile(page, mailDate, mailName){
        await page.evaluate(
            `if ($(".formTable_Item>div>a").length > 0) {
                    const id = window.location.href;
                    const mailId = id.substr(id.indexOf("=")+1,6);
                    ${this.DownloadFunction};
                    downFile("https://jxoa.jxt189.com/jascx/InternalMail/DownLoadAll.aspx?id="+mailId,"${mailDate}${mailName}.zip")
                }
                `)
        console.log("正在下载文件："+mailName)
        await new Promise(r => setTimeout(r, 3000));
    }

    async downloadAttachmentFile(){
        const mailArray = [];
        for (let key = this.NewDispatchStartKey; key >= 0; key--) {
            if (this.DispatchOrMailInfoArray[key].type === "收文签收") {
                await this.openDispatch(this.PAGE, this.DispatchOrMailInfoArray[key].id)
                console.log(this.DispatchOrMailInfoArray[key])
                await this.downloadDispatchFile(
                    this.PAGE,
                    this.DispatchOrMailInfoArray[key].id,
                    this.DispatchOrMailInfoArray[key].date,
                    this.DispatchOrMailInfoArray[key].name
                )
            } else {
                mailArray.push(key);
            }
        }
        for (const key of mailArray) {
            await this.openMail(this.PAGE, this.DispatchOrMailInfoArray[key].id)
            await this.downloadMailFile(
                this.PAGE,
                this.DispatchOrMailInfoArray[key].date,
                this.DispatchOrMailInfoArray[key].name
            )
        }
    }
}

module.exports = {
    Synchronization: Synchronization
}