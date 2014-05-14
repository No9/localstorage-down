'use strict';

exports.get = function (key, callback) {
  process.nextTick(function () {
    try {
      var value = window.localStorage.getItem(key);
      callback(null, value === null ? undefined : value);
    } catch (err) {
      callback(err);
    }
  });
};

exports.put = function (key, value, callback) {
  process.nextTick(function () {
    try {
      window.localStorage.setItem(key, value);
      callback();
    } catch (err) {
      callback(err);
    }
  });
};

exports.remove = function (key, callback) {
  process.nextTick(function () {
    try {
      window.localStorage.removeItem(key);
      callback();
    } catch (err) {
      callback(err);
    }
  });
};

exports.size = function (callback) {
  process.nextTick(function () {
    try {
      var len = window.localStorage.length;
      callback(null, len);
    } catch (err) {
      callback(err);
    }
  });
};

exports.key = function (i, callback) {
  process.nextTick(function () {
    try {
      var key = window.localStorage.key(i);
      callback(null, key);
    } catch (err) {
      callback(err);
    }
  });
};