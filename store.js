'use strict';

var arrayBuffPrefix = 'ArrayBuffer:';
var arrayBuffRegex = new RegExp('^' + arrayBuffPrefix);
var uintPrefix = 'Uint8Array:';
var uintRegex = new RegExp('^' + uintPrefix);

var utils = require('./utils');
var store = require('./localstorage-store.js');

function AbstractStore(dbname) {
  this._keys = [];
  this._prefix = dbname + '!';
}

AbstractStore.prototype.init = function (callback) {
  var self = this;

  var prefixLen = this._prefix.length;
  var i = -1;

  store.size(function (err, len) {
    if (err) {
      return callback(err);
    } else if (!len) {
      return callback();
    }
    var numDone = 0;
    var theErr;

    function checkDone() {
      if (++numDone === len) {
        self._keys.sort();
        callback(theErr);
      }
    }

    function getKey(err, fullKey) {
      if (err) {
        theErr = err;
      } else {
        if (fullKey.substring(0, prefixLen) === self._prefix) {
          self._keys.push(fullKey.substring(prefixLen));
        }
      }
      checkDone();
    }

    while (++i < len) {
      store.key(i, getKey);
    }
  });
};

//key: Returns the name of the key at the position specified.
AbstractStore.prototype.key = function (keyindex) {
  var retVal = this._keys[keyindex];
  if (typeof retVal !== 'undefined') {
    // this needs to be a last and first;
    retVal = retVal.replace('!bin');
  }
  return retVal;
};

// returns the key index if found, else the index where
// the key should be inserted
AbstractStore.prototype.indexOfKey = function (key) {
  return utils.sortedIndexOf(this._keys, key);
};

//setItem: Saves and item at the key provided.
AbstractStore.prototype.setItem = function (key, value, callback) {
  if (value instanceof ArrayBuffer) {
    value = arrayBuffPrefix + btoa(String.fromCharCode.apply(null, value));
  } else if (value instanceof Uint8Array) {
    value = uintPrefix + btoa(String.fromCharCode.apply(null, value));
  }

  store.put(this._prefix + key, value, function (err) {
    if (err) {
      return callback(err);
    }
    var idx = utils.sortedIndexOf(this._keys, key);
    if (this._keys[idx] !== key) {
      this._keys.splice(idx, 0, key);
    }
    callback();
  });
};

//getItem: Returns the item identified by it's key.
AbstractStore.prototype.getItem = function (key, callback) {
  store.get(key, function (err, retval) {
    if (err) {
      return callback(err);
    }
    var value;

    if (arrayBuffRegex.test(retval)) {
      value = retval.substring(arrayBuffPrefix.length);
      retval = new ArrayBuffer(atob(value).split('').map(function (c) {
        return c.charCodeAt(0);
      }));
    } else if (uintRegex.test(retval)) {
      value = retval.substring(uintPrefix.length);
      retval = new Uint8Array(atob(value).split('').map(function (c) {
        return c.charCodeAt(0);
      }));
    }
    callback(null, retval);
  });
};

//removeItem: Removes the item identified by it's key.
AbstractStore.prototype.removeItem = function (key, callback) {
  var self = this;

  var idx = utils.sortedIndexOf(this._keys, key);
  if (this._keys[idx] === key) {
    store.remove(this._prefix + key, function (err) {
      if (err) {
        return callback(err);
      }
      self._keys.splice(idx, 1);
      callback();
    });
  } else {
    process.nextTick(callback);
  }
};

AbstractStore.prototype.length = function (callback) {
  return store.size(callback);
};

exports = AbstractStore;
