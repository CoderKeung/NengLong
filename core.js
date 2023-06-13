const puppeteer = require("puppeteer");
const cheerio = require("cheerio")
const fs = require("fs")
const path = require("path")
const { createWorker } = require("tesseract.js")
const TimeoutError = puppeteer.TimeoutError
const chalk = require('chalk');

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
    WORKER = {};
    DispatchOrMailInfoArray = [];
    DispatchOrMailInfoFileArray = JSON.parse(fs.readFileSync(path.join(__dirname, this.DispatchOrMailInfoJsonFile)))
    NewDispatchStartKey = -1;
    // SUCCESS = false;
    // OVER = false;

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
    async goto(page, link) {
        return page.evaluate((link) => {
            location.href = link;
        }, link);
    }

    async createBrowser(){
        this.BROWSER = await puppeteer.launch({
            headless: 'new',
            args: ['--use-gl=egl','--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
            //defaultViewport: { width: 1920, height: 1080},
        });
        console.log(chalk.yellow("创建浏览器"), "")
        this.PAGE = await this.BROWSER.newPage()
        console.log(chalk.yellow("创建页面"), "")
        const client = await this.PAGE.target().createCDPSession()
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: path.join(__dirname,this.FileSavePath),
        })
        this.WORKER = await createWorker({
            langPath: path.join(__dirname, "lang-data")
        });
        await this.WORKER.loadLanguage("eng");
        await this.WORKER.initialize('eng');
    }

    async login() {
        await this.createBrowser();
        await this.userLogin().then(async ()=>{
            try {
                await this.getDispatchOrMailInfo().then( async ()=>{
                    this.setNewDispatchStartKey();
                    try {
                        await this.downloadAttachmentFile().then(()=>{
                            this.dispatchOrMailInfoMain()
                            this.PAGE.close().then(()=>{
                                console.log(chalk.red("关闭页面"))
                            });
                            this.BROWSER.close().then(()=>{
                                console.log(chalk.red("关闭浏览器"))
                            });
                        })
                    } catch (e) {
                        console.log(e)
                    }
                });
            } catch (e) {
                console.log(e)
            }
        })
    }

    async getDispatchOrMailInfo() {
        console.log(chalk.yellow("前往消息列表"))
        await this.PAGE.goto(`https://jxoa.jxt189.com/jascx/Message/MessageAlertHistory.aspx`, {waitUntil: 'load'})
        const $ = cheerio.load( await this.PAGE.evaluate( ()=> {
            return $("#dtg_Data").html().replace(/[\r\n\t]/g,"");
        }));
        const aTageElementArray = $("a").slice(0,20);
        console.log(chalk.yellow("开始获取消息列表数据"))
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

    async userLogin() {
            await this.PAGE.goto(this.MainUrl, {
                waitUntil: 'load'
            })
            await console.log(chalk.yellow("进入登录页面"))
            await this.PAGE.type('#txt_Account_Input',this.ACCOUNT);
            await this.PAGE.type('#txt_Password',this.PASSWORD);
            const ImageValidateCode = await this.PAGE.$(".ImageValidateCode")
            ImageValidateCode.screenshot({path: "./1.png"}).then(async ()=>{
                const { data: { text } } = await this.WORKER.recognize("./1.png");
                console.log(chalk.yellow("验证码：") + chalk.green.bold(text))
                await this.PAGE.type('#txt_ValidateCode', text);
            })
            try {
                console.log(chalk.yellow("开始登录"))
                await this.PAGE.waitForNavigation({
                    timeout: 5000
                }).then(async ()=>{
                    try {
                        await this.PAGE.waitForSelector("#link_MessageAlertNewLink", {
                            timeout: 5000
                        }).then(()=>{
                            console.log(chalk.green.bold("登录成功"))
                        });
                    } catch (e) {
                        if (e instanceof TimeoutError) {
                            console.log(chalk.red("重新登录"))
                            await this.userLogin()
                        }
                    }

                });
            } catch (e) {
                if (e instanceof TimeoutError) {
                    console.log(chalk.red("重新登录"))
                    await this.userLogin()
                }
            }
    }

    /*
    async loginBack() {
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
                        this.getDispatchOrMailInfo().then(async ()=>{
                            this.setNewDispatchStartKey();
                            this.downloadAttachmentFile().then(()=>{
                                this.dispatchOrMailInfoMain();
                                this.PAGE.close().then(()=>{
                                    console.log("关闭页面")
                                });
                                this.BROWSER.close().then(()=>{
                                    console.log("关闭浏览器")
                                    this.OVER = true;
                                });
                            });
                        });
                    }
                });
            }, 15000)
    }

    async start() {
        this.OVER = false
        await this.login()
        do {
            await new Promise(r => setTimeout(r, 500));
        } while (!this.OVER)
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
            await this.PAGE.screenshot({path: 'ValidateCode.png', clip:{x: clip.x + 40, y: clip.y, width: 50, height: 20}})
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

    async getDispatchOrMailInfoBack() {
        await this.PAGE.goto(`https://jxoa.jxt189.com/jascx/Message/MessageAlertHistory.aspx`, {waitUntil: 'load'})
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
     */

    setNewDispatchStartKey(){
        this.NewDispatchStartKey = -1;
        if (this.DispatchOrMailInfoFileArray.length === 0) {
            this.NewDispatchStartKey = this.DispatchOrMailInfoArray.length - 1;
        }
        for (let key = 0; key < this.DispatchOrMailInfoArray.length && this.DispatchOrMailInfoFileArray.length !== 0; key++) {
            if (this.DispatchOrMailInfoArray[key].id === this.DispatchOrMailInfoFileArray[this.DispatchOrMailInfoFileArray.length - 1].id) {
                this.NewDispatchStartKey = key - 1;
                break;
            }
        }
    }

    updateDispatchOrMailInfoToJsonFile() {
        console.log(chalk.yellow("更新数据"))
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
        console.log(chalk.yellow("写入数据文件"))
        fs.writeFile(path.join(__dirname, this.DispatchOrMailInfoJsonFile), JSON.stringify(this.DispatchOrMailInfoFileArray, null, 4), (err) => {
            if (err) { throw err; }
            console.log(chalk.green.bold("数据写入成功"))
        });
    }

    writeDispatchOrMailInfoToJsonFile(){
        let temporaryArray = [];
        console.log(chalk.yellow("全新写入"))
        for (let key = this.DispatchOrMailInfoArray.length - 1; key >=  0; key--) {
            temporaryArray.push(this.DispatchOrMailInfoArray[key]);
        }
        fs.writeFile(path.join(__dirname, this.DispatchOrMailInfoJsonFile), JSON.stringify(temporaryArray, null, 4), (err) => {
            if (err) { throw err; }
            console.log(chalk.green.bold("数据写入成功"))
        });
        this.NewDispatchStartKey = this.DispatchOrMailInfoArray.length - 1
    }

    dispatchOrMailInfoMain(){
        if (this.DispatchOrMailInfoFileArray.length === 0) {
            this.writeDispatchOrMailInfoToJsonFile();
        } else {
            if (this.NewDispatchStartKey !== -1) {
                this.updateDispatchOrMailInfoToJsonFile();
            } else {
                console.log(chalk.green.bold("不需要更新！"))
            }
        }
    }

    async openDispatch(page, dispatchId) {
        this.PAGE.goto(`https://jxoa.jxt189.com/jascx/CommonForm/DispatchView.aspx?formId=${dispatchId}`)
        await this.PAGE.on('dialog', async dialog => {
            await dialog.accept();
        })
        await new Promise(r => setTimeout(r, 2000));
    }
    async openMail(page, mailID) {
        this.PAGE.goto(`https://jxoa.jxt189.com/jascx/InternalMail/View.aspx?mailId=${mailID}`)
        await new Promise(r => setTimeout(r, 2000));
    }

    async downloadDispatchFile(page, dispatchId, dispatchDate, dispatchName ) {
        page.evaluate(`${this.DownloadFunction};downFile("https://jxoa.jxt189.com/jascx/CommonForm/DownLoadALL.aspx?formId=${dispatchId}","1.zip")`)
        console.log(chalk.yellow("正在下载文件："+dispatchName))
        await new Promise(r => setTimeout(r, 3000));
        fs.rename(path.join(__dirname, "files/1.zip"), path.join(__dirname, `files/${dispatchDate}${dispatchName}.zip`), ()=>{})
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
        console.log(chalk.yellow("正在下载文件："+mailName))
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