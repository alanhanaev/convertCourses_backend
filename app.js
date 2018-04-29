var koa = require('koa');
var Router = require('koa-router');
var bodyParser = require('koa-bodyparser');
var cors = require('koa-cors');
const serializeError = require('serialize-error');
var http = require('http');
var https = require('https');
var fs = require('fs');
var enforceHttps = require('koa-sslify');
var serve = require('koa-static');
const axios = require("axios");
const xml = require("xml-parse");
var iconv = require('iconv-lite');
var BigNumber = require("bignumber.js");

var app = new koa();
// app.use(enforceHttps());
app.use(cors({ origin: '*' }));
app.use(serve('./public'));

var router = new Router();
router.use(bodyParser());
router.get('/courses', get_courses);

app.use(router.routes());
app.use(router.allowedMethods());


// SSL options 
// var options = {
//     key: fs.readFileSync('server.key'),
//     cert: fs.readFileSync('server.crt')
// }


// start the server 
http.createServer(app.callback()).listen(80);
// https.createServer(options, app.callback()).listen(443);



//Функция возвращает
async function request_axios(options) {
    return new Promise(async (resolve, reject) => {
        await axios.request(options)
            .then((val) => {
                if (val)
                    resolve(val)
                else
                    resolve({ status: 404, data: {} })
            })
            .catch((error) => {
                if (error.code === "ETIMEDOUT") {
                    resolve({ status: 404, data: {} })
                    return;
                }
                if (!error.response) {
                    resolve({ status: 404, data: {} })
                    return;
                }
                if (error) resolve(error.response);
            });
    });
}


/** Функция обрезает число до 15 чисел, для использования в библиотеке BigNumber */
function trim_digits(number_) {
    var count = 15;
    var s = number_.toString();
    if (s.indexOf(".") > -1)
        return parseFloat(s.length > count + 1 ? s.substr(0, count + 1) : s);
    else
        return parseFloat(s.length > count ? s.substr(0, count) : s);
}

/** Обрезает число до 14 знаков после запятой */
function trim(number) {
    return trim_digits(number);
}


/** Сериализует ошибку в текст */
function stringify_error(error) {
    if (error)
        return JSON.stringify(serializeError(error));
    else
        return "";
}

/** Метод для получения списка всех постов с комментариями*/
async function get_courses(ctx) {

    result = { success: false, error_msg: "Произошла ошибка" };
    try {
        var response = await request_axios({
            method: "get",
            baseURL: "http://www.cbr.ru/scripts/XML_daily.asp",
            responseType: 'arraybuffer'
        })
        var data = iconv.decode(response.data, 'CP1251');

        if (response.status === 200 && response.statusText === "OK") {
            var parsedXML = xml.parse(data);
            var currencies = [];
            currencies.push({
                code: "RUB",
                description: "Российский рубль",
                nominal: 1,
                value: 1    
            })
            for (var i = 0; i < parsedXML[1].childNodes.length; i++) {
                var obj = parsedXML[1].childNodes[i];
                var value= parseFloat(obj.childNodes[4].innerXML.replace(",","."));
                var nominal=parseFloat(obj.childNodes[2].innerXML);
                currencies.push({
                    code: obj.childNodes[1].innerXML,
                    description: obj.childNodes[3].innerXML,
                    nominal: 1,
                    value: (new BigNumber(trim(value)).dividedBy(trim(nominal))).toNumber()    
                })
            }
            result = { success: true, values: currencies };
        }
    }
    catch (e) {
        console.log(stringify_error(e));
    }
    ctx.body = result;
}



/*

[
    {
        code:"USD",
        description: "Доллар США",
        nominal:100,
        value: 32.6
    },
    ....
]

*/