const puppeteer = require('puppeteer-extra')
const mysql = require('mysql2')
const fs = require('fs')
const moment = require('moment')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())


const mysql_options = {
}
let pool = mysql.createPool(mysql_options)
function sleep(secondes){
    return new Promise((resolve, reject) =>{
        setTimeout(resolve, secondes)
    })
}
async function pool_query(sql, params){
    return  new Promise((resolve, reject) => {
        try {
            pool.query(sql, params, (err, rows, fields) => {
                if(err){
                    console.log(err)
                    reject(err)
                }
                resolve(rows)
            })
        }catch(e){
            pool = mysql.createPool(mysql_options)
        }
    })
}
async function getBrowser(){
    let browser = puppeteer.launch({
        headless: false,
        args: [
            "--disable-gpu",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "proxy-server=127.0.0.1:7890"
        ]
    })
    return browser
}
async function getData(url){
    try{
        // const sql = "insert into hot(question_title, question_url, questi)"
        let browser = await getBrowser()
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36");
        await page.setDefaultNavigationTimeout(60000)
        await page.goto(url,{
            waitUntil: "networkidle0"
        })
        await sleep(5000)
        await page.screenshot({
            path:"img.jpg",
            clip:{
                'x': 255,
                'y': 260,
                'width': 126,
                'height': 126
            }
        })
        console.log("截图成功,请对二维码进行扫瞄并进行登录")
        await page.waitForNavigation()
        console.log("登录成功")
        await page.click("div.List-headerOptions div.Popover button")
        await page.click("#Select1-1")
        await sleep(1000)
        await page.waitForSelector(".List-item")
        console.log("按时间回答成功")
        // 循环翻页
        while(true){
            const question_title  = await page.$eval(".QuestionHeader-title", title=>title.innerText)
            if(await page.$("button.QuestionRichText-more") != null) {
                await page.click("button.QuestionRichText-more")
            }
            const question_url = await page.url()
            let question_description = ''
            if(await page.$("div.QuestionRichText") != null) {
                question_description = await page.$eval("div.QuestionRichText", description=>description.innerText)
            }
            if(await page.$$('.List-item') == []){
                console.log("无数据")
                break
            }
            const items = await page.$$eval('.List-item', items => items.length)
            // const user_name = await page.$$eval('.List-item', items => {
            //     return items.map(item => {
            //         if(item.querySelector("div.List-item div.AuthorInfo-content a.UserLink-link") || null){
            //             return item.querySelector("div.List-item div.AuthorInfo-content a.UserLink-link").innerText
            //         }else{
            //             return null
            //         }
            //     })
            // })
            const user_name = await page.$$eval('.List-item', items => {
                return items.map(item => {
                    if(item.querySelector("span.UserLink.AuthorInfo-name") || null){
                        return item.querySelector("span.UserLink.AuthorInfo-name").innerText.replace('\n','')
                    }else{
                        return null
                    }
                })
            })
            const user_url = await page.$$eval('.List-item', items => {
                return items.map(item => {
                    if(item.querySelector("div.List-item div.AuthorInfo-content a.UserLink-link") || null){
                        return item.querySelector("div.List-item div.AuthorInfo-content a.UserLink-link").getAttribute('href')
                    }else{
                        return null
                    }
                })
            })
            const content = await page.$$eval('.List-item', items => {
                return items.map(item =>{
                    if(item.querySelector('span.RichText') || null){
                        return item.querySelector('span.RichText').innerText
                    }else{
                        return null
                    }
                })
            })
            const edit_time = await page.$$eval('.List-item', items => {
                return items.map(item =>{
                    if(item.querySelector("div.ContentItem-time") || null){
                        return item.querySelector("div.ContentItem-time").innerText
                    }else{
                        return null
                    }
                })
            })
            const agree_count = await page.$$eval('.List-item', items => {
                return items.map(item =>{
                    if(item.querySelector("button.VoteButton.VoteButton--up") || null){
                        if(item.querySelector("button.VoteButton.VoteButton--up").innerText != "\n赞同"){
                            return item.querySelector("button.VoteButton.VoteButton--up").innerText.replace('\n赞同 ','')
                        }else {
                            return 0
                        }
                    }
                })
            })
            const content_attachment = await page.$$eval('.List-item', items => {
                return items.map(item =>{
                    if(item.querySelector("span.RichText  img") || null){
                        return item.querySelectorAll("span.RichText  img").length
                    }else {
                        return 0
                    }
                })
            })
            const content_comment = await page.$$eval('.List-item', items => {
                return items.map(item =>{
                    if(item.querySelector("button.ContentItem-action")||null){
                        if(item.querySelector("button.ContentItem-action").innerText == "​\n添加评论"){
                            return 0
                        }else {
                            return item.querySelector("button.ContentItem-action").innerText.replace(" 条评论",'').replace('\n','')
                        }
                    }
                })
            })
            for(let i = 0; i < items; i++){
                let str = "问题标题:"+question_title+"\n问题链接:"+question_url+"\n问题描述:"+question_description+"\n回答用户名:"+user_name[i]+"\n回答用户链接:"+user_url[i]+"\n回答内容:"+content[i]+"\n编辑时间:"+edit_time[i]+"\n赞同数:"+agree_count[i]+"\n附件数:"+content_attachment[i]+"\n评论数:"+content_comment[i]
                fs.writeFileSync(user_name[i]+".text",str,(err)=>{
                    if(err){
                        console.log(err)
                    }
                })
                console.log("写入成功")
            }
            await sleep(2000)
            if(await page.$eval('div.Pagination button:last-child', button_val=>button_val.innerText) == "下一页"){
                await page.click('div.Pagination button:last-child')
                await sleep(1000)
                await page.waitForSelector(".List-item")
            }else {
                console.log("已完成--跳出循环")
                break
            }
        }
    }catch(e){
        console.log("err:",e)
        // browser = await getBrowser()
    }
}
getData("https://www.zhihu.com/question/397679126")