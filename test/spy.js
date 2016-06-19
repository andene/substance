'use strict';

var isFunction = require('lodash/isFunction');

module.exports = function spy() {
  var f, self, name;
  if (isFunction(arguments[0])) {
    f = arguments[0];
  } else {
    self = arguments[0];
    name = arguments[1];
    f = self[name];
  }
  function spyFunction() {
    var res = f.apply(self, arguments);
    spyFunction.callCount++;
    spyFunction.args = arguments;
    return res;
  }
  spyFunction.callCount = 0;
  spyFunction.args = null;
  spyFunction.restore = function() {
    if (self) {
      self[name] = f;
    }
  };
  spyFunction.reset = function() {
    spyFunction.callCount = 0;
    spyFunction.args = 0;
  };
  if (self) {
    self[name] = spyFunction;
  }
  return spyFunction;
};
