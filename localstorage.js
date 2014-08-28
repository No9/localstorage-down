'use strict';

var jsonPrefix = "J";
var stringPrefix = "S";
var bufferPrefix = 'B';

var utils = require('./utils');
var LocalStorageCore = require('./localstorage-core');
var TaskQueue = require('./taskqueue');
var d64 = require('d64');

function encode(val) {
  if (Buffer.isBuffer(val)) {
    return bufferPrefix + d64.encode(val);
  } else if (typeof val === 'string') {
    return stringPrefix + val;
  } else if (typeof val === 'number') {
    return stringPrefix + String(val);
  } else {
    return jsonPrefix + JSON.stringify(val);
  }
}

function decode(val, asBuffer) {
  var type = val[0];
  val = val.substring(1);

  switch (type) {
    case bufferPrefix:
      return d64.decode(val);
    case stringPrefix:
      return asBuffer ? new Buffer(val) : val;
    default:
      var res = JSON.parse(val);
      if (asBuffer) {
        if (utils.isArray(res)) {
          return new Buffer(res.toString());
        }
        return new Buffer(res);
      }
      return res;
  }
}

function LocalStorage(dbname) {
  this._store = new LocalStorageCore(dbname);
  this._queue = new TaskQueue();
}

LocalStorage.prototype.sequentialize = function (callback, fun) {
  this._queue.add(fun, callback);
};

LocalStorage.prototype.init = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    self._store.getKeys(function (err, keys) {
      if (err) {
        return callback(err);
      }
      self._keys = keys;
      return callback();
    });
  });
};

// returns the key index if found, else the index where
// the key should be inserted. also returns the key
// at that index
LocalStorage.prototype.binarySearch = function (key, callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    var index = utils.sortedIndexOf(self._keys, encode(key));
    var found = (index >= self._keys.length || index < 0);
    var foundKey = found ? undefined : decode(self._keys[index]);
    callback(null, {index: index, key: foundKey});
  });
};

LocalStorage.prototype.getKeyAt = function (index, callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    var found = (index >= self._keys.length || index < 0);
    var foundKey = found ? undefined : decode(self._keys[index]);
    callback(null, foundKey);
  });
};

//setItem: Saves and item at the key provided.
LocalStorage.prototype.setItem = function (key, value, callback) {
  var self = this;
  value = encode(value);
  key = encode(key);
  self.sequentialize(callback, function (callback) {
    var idx = utils.sortedIndexOf(self._keys, key);
    if (self._keys[idx] !== key) {
      self._keys.splice(idx, 0, key);
    }
    self._store.put(key, value, callback);
  });
};

//getItem: Returns the item identified by it's key.
LocalStorage.prototype.getItem = function (key, asBuffer, callback) {
  var self = this;
  key = encode(key);
  self.sequentialize(callback, function (callback) {
    self._store.get(key, function (err, retval) {
      if (err) {
        return callback(err);
      }
      if (typeof retval === 'undefined' || retval === null) {
        // 'NotFound' error, consistent with LevelDOWN API
        return callback(new Error('NotFound'));
      }
      callback(null, decode(retval, asBuffer));
    });
  });
};

//removeItem: Removes the item identified by it's key.
LocalStorage.prototype.removeItem = function (key, callback) {
  var self = this;
  key = encode(key);
  self.sequentialize(callback, function (callback) {
    var idx = utils.sortedIndexOf(self._keys, key);
    if (self._keys[idx] === key) {
      self._keys.splice(idx, 1);
      self._store.remove(key, function (err) {
        if (err) {
          return callback(err);
        }
        callback();
      });
    } else {
      callback();
    }
  });
};

LocalStorage.prototype.length = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    callback(null, self._keys.length);
  });
};

exports.LocalStorage = LocalStorage;
