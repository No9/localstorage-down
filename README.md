# localstorage-down [![Build Status](https://travis-ci.org/No9/localstorage-down.svg)](https://travis-ci.org/No9/localstorage-down)

LocalStorage implementation of [leveldown](https://github.com/Level/leveldown) for mobile and desktop browsers. The idea is to be able to use the [level](http://github.com/level) stack on any browser that supports LocalStorage.

The scenarios envisaged are:

1. Occasionally connected clients

2. Adhoc Networks where clients need to sync directly with each other.  

This project is intended for use with the [level eco-system](https://github.com/level/).

## Install

```
npm install localstorage-down
```

## Browser support

Basically we support [any browser that has LocalStorage](http://caniuse.com/namevalue-storage), but since we also rely on an ES5 environment due to dependencies from abstract-leveldown, in practice you will need the following shims in order to work correctly on all browsers (e.g. IE 8/9):

* [typedarray](https://github.com/substack/typedarray) for binary storage
* [es5-shim](https://github.com/es-shims/es5-shim) for just about everything

We run automated tests in the following browsers:

* **Android**: 4.0-5.1
* **Firefox**: 38-42
* **Chrome**: 42-beta
* **IE**: 8-11
* **iPhone**: 8.0-9.1
* **Safari**: 7.1-9

In environments without LocalStorage, such as Node or Safari private browsing, this module
will fall back to a temporary in-memory implementation, thanks to [humble-localstorage](https://www.npmjs.com/package/humble-localstorage).

## Example 

At the command prompt in your chosen directory : 

```
npm install localstorage-down
npm install levelup 
npm install browserify -g
npm install beefy -g
```

Create a file called index.js and enter the following:

```
var localstorage = require('localstorage-down');
var levelup = require('levelup');
var db = levelup('/does/not/matter', { db: localstorage });

db.put('name', 'Yuri Irsenovich Kim');
db.put('dob', '16 February 1941');
db.put('spouse', 'Kim Young-sook');
db.put('occupation', 'Clown');

db.readStream()
   .on('data', function (data) {
      if (typeof data.value !== 'undefined') {
         console.log(data.key, '=', data.value);
      }
   })
   .on('error', function (err) {
      console.log('Oh my!', err);
   })
   .on('close', function () {
      console.log('Stream closed');
   })
   .on('end', function () {
     console.log('Stream ended');
   });
```

Publish the site :

```
beefy index.js
```

See the output :

[http://localhost:9966](http://localhost:9966)

Listen to John Cage :

http://www.youtube.com/watch?v=ExUosomc8Uc 

## Tests

```
npm run test
```

This will run tests in Node against `localstorage-memory`. 

To test in Saucelabs, you can run e.g.:

```
BROWSER_NAME=firefox BROWSER_VERSION="38..latest" npm run test-saucelabs
```

Or to test in Zuul locally:

```
npm run test-zuul-local
```

##  Contributors

Anton Whalley https://github.com/no9

Adam Shih https://github.com/adamshih

Nolan Lawson https://github.com/nolanlawson
