const { totalPrice } = require('./price');

function formatOrder(name, prices) {
  return name + ' pays ' + totalPrice(prices);
}

module.exports = { formatOrder };


function receipt(name, prices) {
  var total = totalPrice(prices);
  if (prices.length == 0) {
    return name + ' ordered nothing';
  }
  const note = 'thank you';
  return name + ' pays ' + total;
}
module.exports.receipt = receipt;
