const log = require('ololog');

const MOON = 2;
let READONLY = false;

function setProduction(){
    READONLY=false;
}

function getReadOnly(){
    return READONLY;
}

async function checkBalance(exchange, symbol) {
    exchange.apiKey = process.env["APIKEY_" + exchange.id];
    exchange.secret = process.env["APISECRET_" + exchange.id];
    let balance = false;
    if (READONLY || !exchange.apiKey || !exchange.secret) {
        return true;//this exchange is for information only
    }
    try {
        let _balance = await exchange.fetchBalance();
        balance = _balance[symbol.split("/")[0]].total > 0;
    } catch (err) {
        balance = true; //maybe next time it will be better
        //log("Error checking balance at ", exchange.id, " for ", symbol, ": ", err);
    }
    return balance;
}

async function cancelStopLoss(exchange, symbol) {
    exchange.apiKey = process.env["APIKEY_" + exchange.id];
    exchange.secret = process.env["APISECRET_" + exchange.id];
    if (READONLY || !exchange.apiKey || !exchange.secret) {
        log("READONLY: ", READONLY);
        log("READONLY: ", "Cancelled all orders for: ", symbol, " @ ", exchange.id);
        return;
    }

    let orders = await exchange.fetchOpenOrders(symbol);
    for (let i = 0; i < orders.length; i++) {
        await exchange.cancelOrder(orders[i].id, orders[i].symbol);
        log("Cancelled order: ", orders[i].symbol, " @ ", orders[i].price);
    }
}

async function setNewStopLoss(exchange, tick, amount) {
    let cpy = {};
    cpy.id = tick.iteration + 0.1;
    cpy.t = 'hardsell';
    cpy.e = tick.exchange;
    cpy.m = tick.symbol;
	cpy.amount = amount;
    cpy.a = tick.bid * 0.85;//safe 10% margin to avoid selling in dumps
    cpy.b = tick.bid * 0.95;
    //RULES.push(cpy);
    log(cpy.id, tick.exchange, tick.symbol, 'NEW HARDSELL RULE '.magenta, '@', cpy.b);
    return cpy;
}

async function setNewMoon(exchange, tick, amount) {
    exchange.apiKey = process.env["APIKEY_" + exchange.id];
    exchange.secret = process.env["APISECRET_" + exchange.id];
    if (READONLY || !exchange.apiKey || !exchange.secret) {
        log("READONLY: ", READONLY);
        log("READONLY: ", "New moon: ", tick.symbol, " @ ", exchange.id);
        return;
    }

    let pairs = await exchange.loadMarkets();
    let precision = exchange.markets[tick.symbol].precision;
    let min = exchange.markets[tick.symbol].limits.amount.min;
    let _balance = await exchange.fetchBalance();
    let totalAmount = _balance[tick.symbol.split("/")[0]].free;
    let tradeAmount = (totalAmount-amount>min)?amount:totalAmount;
    tradeAmount = Number(Math.round(tradeAmount + ('e' + precision.amount )) + ('e' + (-1 * precision.amount)));
    let price = Number(Math.round(tick.bid * MOON + ('e' + precision.price )) + ('e' + (-1 * precision.price)));
    await exchange.createLimitSellOrder(tick.symbol, tradeAmount, price);
    log(tick.exchange, tick.symbol, ' NEW MOON '.cyan, '@', price);
}

async function marketSell(exchange, tick, amount) {
    exchange.apiKey = process.env["APIKEY_" + exchange.id];
    exchange.secret = process.env["APISECRET_" + exchange.id];
    if (READONLY || !exchange.apiKey || !exchange.secret) {
        log("READONLY: ", READONLY);
        log("READONLY: ", "MarketSell: ", amount, tick.symbol, " @ ", exchange.id);
        return;
    }

    let pairs = await exchange.loadMarkets();
    let precision = exchange.markets[tick.symbol].precision;
	let min = exchange.markets[tick.symbol].limits.amount.min;
    let _balance = await exchange.fetchBalance();
    let totalAmount = _balance[tick.symbol.split("/")[0]].free;
	let tradeAmount = (totalAmount-amount>min)?amount:totalAmount;
    tradeAmount = Number(Math.round(tradeAmount + ('e' + precision.amount )) + ('e' + (-1 * precision.amount)));
    let price = Number(Math.round(tick.bid * 0.98 + ('e' + precision.price )) + ('e' + (-1 * precision.price)));
    await exchange.createLimitSellOrder(tick.symbol, tradeAmount, price);
    log(tradeAmount, tick.exchange, tick.symbol, ' Sold at market price '.cyan, '@', price);
}

module.exports = {
    checkBalance: checkBalance,
    cancelStopLoss: cancelStopLoss,
    setNewStopLoss: setNewStopLoss,
    setNewMoon: setNewMoon,
    marketSell: marketSell,
    setProduction: setProduction,
    getReadOnly:getReadOnly,
};