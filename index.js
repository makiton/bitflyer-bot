/**
 * Triggered from a message on a Cloud Pub/Sub topic.
 *
 * @param {!Object} event The Cloud Functions event.
 * @param {!Function} The callback function.
 */
var bitflyer = require('bitflyer-node');

exports.bitflyerBot = function bitflyerBot(event, callback) {
  // The Cloud Pub/Sub Message object.
  const pubsubMessage = event.data;

  var api= new bitflyer.REST(pubsubMessage.api.key, pubsubMessage.api.secret);
  getJPYBalance(api)
    .then(function(jpy_balance){
      console.log("jpy_balance: " + jpy_balance);
      if (jpy_balance < 5000) {
        return sellBTCJPY(api, 60000);
      }
      return new Promise(function(resolve, reject) {
        Promise.all([
          buyBTCJPY(api, 5000),
          //buyMONAJPY(api, 2500)
        ])
          .then(function(res) { console.log(res); resolve(res); }, reject)
      });
    })
    .then(function(res) {
      console.log(res);
    })
    .catch(function(err) {
      console.log(err);
    });

  callback();
};

function getJPYBalance(api) {
  return new Promise(function(resolve, reject) {
    api.getBalance(function(err, data) {
      if(err) {
        reject(err);
        return;
      }
      var jpy_balance = 0;
      data.forEach(function(d) {
        if (d['currency_code'] == 'JPY') {
          jpy_balance = d['available'];
        }
      });
      resolve(jpy_balance);
    });
  });
}

function sellBTCJPY(api, jpy_amount) {
  return new Promise(function (resolve, reject) {
    getPrice(api, "BTC_JPY")
      .then(function(price){
        amount = Math.floor(jpy_amount / price * 1000000) / 1000000;
        return sendChildOrder(api, "BTC_JPY", "SELL", amount);
      })
      .then(resolve, reject);
  });
}

function buyBTCJPY(api, jpy_amount) {
  return new Promise(function (resolve, reject) {
    getPrice(api, "BTC_JPY")
      .then(function(price){
        amount = Math.floor(jpy_amount / price * 1000000) / 1000000;
        return sendChildOrder(api, "BTC_JPY", "BUY", amount);
      })
      .then(resolve, reject)
  });
}

function getPrice(api, pair) {
  return new Promise(function(resolve, reject) {
    api.raw_request_public(function(err, data){
      if (err) {
        reject(err);
        return;
      }
      resolve(data['ltp']);
    }, "GET", "/v1/getticker?product_code="+pair, "");
  });
}

function sendChildOrder(api, pair, side, amount) {
  return new Promise(function(resolve, reject) {
    var req = {
      "product_code": pair,
      "child_order_type": "MARKET",
      "side": side,
      "size": amount
    };
    api.raw_request_private(function(err, data) {
      if (err) {
        reject(err);
        return;
      }
      if (data.status < 0) {
        reject(data);
        return;
      }
      resolve(data);
    }, "POST", "/v1/me/sendchildorder", JSON.stringify(req));
  });
}
