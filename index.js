'use strict';

var inherits = require('inherits');
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var AbstractIterator = require('abstract-leveldown').AbstractIterator;

var LocalStorage = require('./localstorage').LocalStorage;
var LocalStorageCore = require('./localstorage-core');
var utils = require('./utils');

// see http://stackoverflow.com/a/15349865/680742
var nextTick = global.setImmediate || process.nextTick;

function LDIterator(db, options) {

  AbstractIterator.call(this, db);

  this._reverse = !!options.reverse;

  if ('start' in options || 'end' in options) {
    // translate the old system to the new system
    if ('start' in options) {
      if (this._reverse) {
        if (options.exclusiveStart) {
          this._lt = options.start;
        } else {
          this._lte = options.start;
        }
      } else {
        if (options.exclusiveStart) {
          this._gt = options.start;
        } else {
          this._gte = options.start;
        }
      }
    }
    if ('end' in options) {
      if (this._reverse) {
        this._gte = options.end;
      } else {
        this._lte = options.end;
      }
    }
  } else {
    // just use the new system
    this._gt      = options.gt && String(options.gt);
    this._gte     = options.gte && String(options.gte);
    this._lt      = options.lt && String(options.lt);
    this._lte     = options.lte && String(options.lte);
  }
  this._limit   = options.limit;
  this._keyAsBuffer = 'keyAsBuffer' in options ? !!options.keyAsBuffer : true;
  this._valueAsBuffer = 'valueAsBuffer' in options ? !!options.valueAsBuffer: true;
  this._count = 0;

  this.onInitCompleteListeners = [];
}

inherits(LDIterator, AbstractIterator);

LDIterator.prototype._getStartKey = function () {
  if (this._reverse) {
    if (typeof this._lt !== 'undefined') {
      return this._lt;
    } else if (typeof this._lte !== 'undefined') {
      return this._lte;
    }
  } else {
    if (typeof this._gt !== 'undefined') {
      return this._gt;
    } else if (typeof this._gte !== 'undefined') {
      return this._gte;
    }
  }
};

LDIterator.prototype._init = function (callback) {
  var self = this;
  self.db.container.length(function (err, len) {
    if (err) {
      return callback(err);
    }

    var startkey = self._getStartKey();

    if (typeof startkey !== 'undefined') {
      self.db.container.binarySearch(startkey, function (err, res) {
        if (err) {
          return callback(err);
        }
        self._pos = res.index;
        var key = res.key;
        if (self._reverse) {
          if (typeof self._lte !== 'undefined' && self._lte !== key) {
            self._pos--;
          } else if (typeof self._lt !== 'undefined' && self._lt <= key) {
            self._pos--;
          }
        } else {
          if (typeof self._gt !== 'undefined' && self._gt === key) {
            self._pos++;
          }
        }
        callback();
      });
    } else {
      self._pos = self._reverse ? len - 1 : 0;
      callback();
    }
  });
};

LDIterator.prototype._next = function (callback) {
  var self = this;

  function onInitComplete() {
    self.db.container.getKeyAt(self._pos, function (err, key) {
      if (err) {
        return callback(err);
      }

      if (typeof key === 'undefined') { // done reading
        return callback();
      }

      if (typeof self._limit === 'number' && self._limit > -1 && self._count++ >= self._limit) {
        return callback();
      }

      if ((self._lt  && key >= self._lt) ||
        (self._lte && key > self._lte) ||
        (self._gt  && key <= self._gt) ||
        (self._gte && key < self._gte)) {
        return callback();
      }

      self._pos += self._reverse ? -1 : 1;

      self.db.container.getItem(key, self._valueAsBuffer, function (err, value) {
        if (err) {
          if (err.message === 'NotFound') {
            return callback();
          }
          return callback(err);
        }
        var keyToReturn = self._keyAsBuffer ? new Buffer(key) : key;
        callback(null, keyToReturn, value);
      });
    });
  }
  if (!self.initStarted) {
    self.initStarted = true;
    self._init(function (err) {
      if (err) {
        return callback(err);
      }
      onInitComplete();

      self.initCompleted = true;
      var i = -1;
      while (++i < self.onInitCompleteListeners) {
        nextTick(self.onInitCompleteListeners[i]);
      }
    });
  } else if (!self.initCompleted) {
    self.onInitCompleteListeners.push(function () {
      onInitComplete();
    });
  } else {
    onInitComplete();
  }
};

function LD(location) {
  if (!(this instanceof LD)) {
    return new LD(location);
  }
  AbstractLevelDOWN.call(this, location);
  this.container = new LocalStorage(location);
}

inherits(LD, AbstractLevelDOWN);

LD.prototype._open = function (options, callback) {
  this.container.init(callback);
};

LD.prototype._put = function (key, value, options, callback) {

  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }

  err = checkKeyValue(value, 'value');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }

  this.container.setItem(key, value, callback);
};

LD.prototype._get = function (key, options, callback) {

  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }

  var asBuffer = 'asBuffer' in options ? !!options.asBuffer : true;

  this.container.getItem(key, asBuffer, function (err, value) {
    if (err) {
      return callback(err);
    }
    callback(null, value);
  });
};

LD.prototype._del = function (key, options, callback) {

  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }
  this.container.removeItem(key, callback);
};

LD.prototype._batch = function (array, options, callback) {
  var self = this;
  nextTick(function () {
    var err;
    var key;
    var value;

    var numDone = 0;
    var overallErr;
    function checkDone() {
      if (++numDone === array.length) {
        callback(overallErr);
      }
    }

    if (utils.isArray(array) && array.length) {
      for (var i = 0; i < array.length; i++) {
        var task = array[i];
        if (task) {
          key = task.key;
          err = checkKeyValue(key, 'key');
          if (err) {
            overallErr = err;
            checkDone();
          } else if (task.type === 'del') {
            self._del(task.key, options, checkDone);
          } else if (task.type === 'put') {
            value = task.value;
            err = checkKeyValue(value, 'value');
            if (err) {
              overallErr = err;
              checkDone();
            } else {
              self._put(key, value, options, checkDone);
            }
          }
        } else {
          checkDone();
        }
      }
    } else {
      callback();
    }
  });
};

LD.prototype._iterator = function (options) {
  return new LDIterator(this, options);
};

LD.destroy = function (name, callback) {
  LocalStorageCore.destroy(name, callback);
};

function checkKeyValue(obj, type) {
  if (type === 'key') {
    if (obj === null || obj === undefined) {
      return new Error(type + ' cannot be `null` or `undefined`');
    }
    if (obj instanceof Boolean) {
      return new Error(type + ' cannot be `null` or `undefined`');
    }
    if (obj === '') {
      return new Error(type + ' cannot be empty');
    }
  }

  if (Buffer.isBuffer(obj)) {
    if (obj.length === 0) {
      return new Error(type + ' cannot be an empty Buffer');
    }
  } else if (String(obj) === '') {
    return new Error(type + ' cannot be an empty String');
  }
}


module.exports = LD;
