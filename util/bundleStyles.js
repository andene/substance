'use strict';

/* globals Promise */

var fs = require('fs');
var path = require('path');

// use this from within another process
// cb is optional
module.exports = function(params, cb) {
  return new Promise(function(resolve, reject) {
    if (params.scssPath) {
      var input = fs.readFileSync(params.scssPath, 'utf8');
      _postCss({
        input: input,
        rootDir: params.rootDir,
        sourcePath: params.scssPath
      }, _finalize);
    } else {
      console.info('Bundling styles for package %s', params.mainPackagePath);
      var cp = require('child_process');
      var child = cp.fork(require.resolve('./_bundleStyles'));
      child.on('message', function(resultStr) {
        var input = JSON.parse(resultStr);
        _postCss({
          input: input,
          rootDir: params.rootDir,
          sourcePath: params.rootDir,
        }, _finalize);
      });
      child.on('error', function(err) {
        reject(err);
        if (cb) cb(err);
      });
      // this sends the params over to the child process
      child.send(JSON.stringify(params));
    }

    function _finalize(err, result) {
      if (err) reject(err);
      else resolve(result.css);
      // if used with callback
      if (cb) {
        if (err) cb(err);
        else cb(null, result.css);
      }
    }

  });
};

function _postCss(params, cb) {
  var postcss = require('postcss');
  var scssParser = require('postcss-scss');
  var cssImport = require('postcss-import');
  var simpleVars = require('postcss-simple-vars');
  var nested = require('postcss-nested');
  var input = params.input;
  var sourcePath = params.sourcePath;
  postcss([
    simpleVars, nested,
    cssImport({
      path: sourcePath,
      resolve: _resolveScss
    })
  ])
  .process(input, {
    parser: scssParser,
    from: path.join(params.rootDir, 'app.scss'),
    to: path.join(params.rootDir, 'app.css'),
    map: { inline: true },
  }).then(function (result) {
    cb(null, result);
  }).catch(function(err) {
    cb(err);
  });
}

/* eslint-disable no-unreachable, no-empty */

function _resolveScss(id, basedir) {
  try {
    return require.resolve(path.join(basedir, id));
  } catch(err) {} //
  // try to append '.scss' extension
  var name = path.basename(id);
  var dir = path.join(basedir, path.dirname(id));
  try {
    return require.resolve(path.join(dir, name + '.scss'));
  } catch(err) {}
  // try with _ appended
  if (name[0] !== '_') {
    try {
      return require.resolve(path.join(dir, '_' + name + '.scss'));
    } catch(err) {}
  }
  // try without _
  if (name[0] === '_') {
    try {
      return require.resolve(path.join(dir, name.slice(1) + '.scss'));
    } catch(err) {}
  }
  throw new Error('Could not find '+id+ ' relative to ' + basedir);
}
