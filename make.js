var b = require('substance-bundler');
var fs = require('fs')
var path = require('path')
var docgenConfig = require('./.docgenrc')

b.task('clean', function() {
  b.rm('./dist');
});

function _css(DIST) {
  b.copy('*.css', DIST);
  b.copy('packages/**/*.css', DIST);
}

b.task('css', function() {
  _css('dist/')
});

function _browser(DIST, transpileToES5) {
  b.js('./index.es.js', {
    buble: transpileToES5,
    ignore: ['substance-cheerio'],
    commonjs: { include: ['node_modules/lodash/**'] },
    targets: [{
      dest: DIST+'substance.js',
      format: 'umd', moduleName: 'substance', sourceMapRoot: __dirname, sourceMapPrefix: 'substance'
    }]
  });
}

b.task('browser', function() {
  _browser('./dist/', false)
})

function _server(DIST, transpileToES5) {
  b.js('./index.es.js', {
    buble: transpileToES5,
    commonjs: { include: [
      '/**/lodash/**'
    ] },
    external: [ 'substance-cheerio' ],
    targets: [{
      dest: DIST+'substance.cjs.js',
      format: 'cjs', sourceMapRoot: __dirname, sourceMapPrefix: 'substance'
    }]
  });
}

b.task('server', function() {
  // for the time being we transpile the cjs bundle
  // so it works in node 4 too
  _server('./dist/', true)
});

var TEST ='.test/'

b.task('test:clean', function() {
  b.rm(TEST)
})

b.task('test:assets', function() {
  // TODO: it would be nice to treat such glob patterns
  // differently, so that we do not need to specify glob root
  b.copy('./node_modules/substance-test/dist/*', TEST, { root: './node_modules/substance-test/dist' })
})

b.task('test:browser', function() {
  b.js('./test/index.js', {
    // buble necessary here, as travis has old browser versions
    buble: true,
    ignore: ['substance-cheerio'],
    external: ['substance-test'],
    commonjs: { include: ['node_modules/lodash/**'] },
    targets: [
      { dest: TEST+'tests.js', format: 'umd', moduleName: 'tests' }
    ]
  });
})

b.task('test:server', function() {
  b.js('./test/index.js', {
    // buble necessary here, for nodejs
    buble: true,
    external: ['substance-test'],
    commonjs: {
      include: [
        '/**/lodash/**',
        '/**/substance-cheerio/**'
      ]
    },
    targets: [
      { dest: TEST+'tests.cjs.js', format: 'cjs' },
    ]
  });
})

var NPM = '.npm/'
var NPMDIST = NPM+'dist/'

b.task('npm:clean', function() {
  b.rm(NPM)
})

b.task('npm:copy:js', function() {
  b.copy('index.es.js', NPM);
  b.copy('collab/*.js', NPM);
  b.copy('model/**/*.js', NPM);
  b.copy('packages/**/*.js', NPM);
  b.copy('ui/*.js', NPM);
  b.copy('util/*.js', NPM);
});

b.task('npm:copy:css', function() {
  _css(NPM)
  _css(NPMDIST)
});

b.task('npm:docs', function() {
  b.copy('node_modules/substance-docgen/dist/reader', NPM+'doc')
  var docgen = require('substance-docgen');
  b.custom('Generating API docs...', {
    dest: NPM+'doc/docs.js',
    execute: function() {
      var json = docgen.generate(docgenConfig)
      fs.writeFileSync(NPM+'doc/docs.js', "window.DOCGEN_DATA = "+JSON.stringify(json, null, 2));
    }
  })
})

// a fully debuggable version of the docgenerator
b.task('docs', function() {
  b.copy('node_modules/substance-docgen/.dev', '.doc')
  b.copy('node_modules/substance-docgen/.dev/reader.js', '.doc/')
  b.copy('node_modules/substance-docgen/.dev/reader.css', '.doc/')
  b.custom('Bundling sourcefiles for docgen...', {
    src: [
      './*.md',
      './doc/*.md',
      './collab/*.js',
      './model/**/*.js',
      './packages/**/*.js',
      './ui/*.js',
      './util/*.js',
    ],
    dest: '.doc/data.js',
    execute: function(files) {
      var bundleSources = require('substance-docgen/bundleSources')
      files = files.map(function(file) {
        return path.relative(__dirname, file)
      })
      bundleSources(files, '.doc/data.js', docgenConfig)
    }
  })
})

b.task('npm:js', function() {
  _browser(NPMDIST, true)
  _server(NPMDIST, true)
})

var stuff = [
  'package.json',
  'LICENSE',
  'README.md',
  'CHANGELOG.md'
]
b.task('npm:stuff', function() {
  stuff.forEach(function(f) {
    b.copy(f, NPM)
  })
})

b.task('build', ['clean', 'css', 'browser', 'server'])

b.task('test', ['test:clean', 'test:assets', 'test:browser', 'test:server'])

b.task('npm', ['npm:clean', 'npm:copy:js', 'npm:copy:css', 'npm:docs', 'npm:js', 'npm:stuff'])

b.task('default', ['build'])

// SERVER

// starts a server when CLI argument '-s' is set
b.setServerPort(5550)
b.serve({ static: true, route: '/', folder: 'dist' })
b.serve({ static: true, route: '/test/', folder: '.test' })
b.serve({ static: true, route: '/doc/', folder: '.doc' })
