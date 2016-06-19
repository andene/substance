'use strict';

var extend = require('lodash/extend');
var forEach = require('lodash/forEach');
var isArray = require('lodash/isArray');
var keyBy = require('lodash/keyBy');
var oo = require('../util/oo');
var EventEmitter = require('../util/EventEmitter');
var TreeIndex = require('../util/TreeIndex');

/*
  Defines a list of stages which are used to register listeners
  which are called in appropriate order to either accumulate state
  or work on state updates, such rerendering things.
*/
function Flow(stages, context) {
  Flow.super.call(this);

  this.context = context;
  this._graph = new Flow.Graph(stages);
  this._state = {};

  this._isFlowing = false;
}

Flow.Prototype = function() {

  this.getStageNames = function() {
    var names = this._graph._sortedStages.map(function(stage) {
      return stage.name;
    });
    return names;
  };

  this.setState = function(name, state) {
    this._state[name] = state;
    this._process(name);
  };

  this.updateState = function(name, state) {
    this.setState(extend(this._state[name], state));
  };

  this._process = function(name) {
    if (this._isFlowing) return;
    try {
      this._isFlowing = true;
      var graph = this._graph;
      var stages = graph.stages;
      var queue = [name];
      while (queue.length > 0) {
        var stageName = queue.shift();
        var stage = stages[stageName];
        if (!stage) {
          throw new Error('Unknown stage ' + stageName);
        }
        this._processStage(stage);
        queue = queue.concat(graph.outEdges.get(stageName));
      }
    } finally {
      this._isFlowing = false;
    }
  };

  this._processStage = function(stage) {
    var name = stage.name;
    this.emit('before:'+name, this);
    this.emit(name, this._state[name], this);
    this.emit('after:'+name, this);
  };

  this.before = function(name, fn, context, options) { // eslint-disable-line
    this.on.apply(this, ['before:'+name].concat(Array.prototype.slice.call(arguments, 1)));
  };

  this.after = function(name, fn, context, options) { // eslint-disable-line
    this.on.apply(this, ['after:'+name].concat(Array.prototype.slice.call(arguments, 1)));
  };

};

EventEmitter.extend(Flow);

Flow.Graph = function(stages) {
  if (isArray(stages)) {
    stages = keyBy(stages, 'name');
  }
  this.inEdges = null;
  this.outEdges = null;
  this.stages = stages;
  this._sortedStages = null;

  this._extractEdges(stages);
  this._compileStages(stages);
};

Flow.Graph.Prototype = function() {

  this._extractEdges = function(stages) {
    var inEdges = new TreeIndex.Arrays();
    var outEdges = new TreeIndex.Arrays();
    forEach(stages, function(stage) {
      inEdges.create(stage.name);
      outEdges.create(stage.name);
      // add edges for given requirements
      if (stage.requires) {
        stage.requires.forEach(function(other) {
          // 'in' means that the first has a requirement fulfilled by the second
          inEdges.add(stage.name, other);
          // 'out' means that the first fulfills a requirement for the second
          outEdges.add(other, stage.name);
        });
      }
    });
    this.inEdges = inEdges;
    this.outEdges = outEdges;
  };

  /*
    Brings the stages into an topological order using the DFS algo
    as described in https://en.wikipedia.org/wiki/Topological_sorting

    L ← Empty list that will contain the sorted nodes
    while there are unmarked nodes do
        select an unmarked node n
        visit(n)

    function visit(node n)
        if n has a temporary mark then stop (not a DAG)
        if n is not marked (i.e. has not been visited yet) then
            mark n temporarily
            for each node m with an edge from n to m do
                visit(m)
            mark n permanently
            add n to head of L

  */
  this._compileStages = function(stages) {
    var result = [];
    var visited = {};
    var visiting = {};
    var inEdges = this.inEdges;
    var outEdges = this.outEdges;
    // grab all stages that have no dependencies
    var stagesWithoutDeps = [];
    forEach(stages, function(stage, name) {
      var deps = inEdges.get(name);
      if (deps.length === 0) {
        stagesWithoutDeps.push(stages[name]);
      }
    });
    // and visit them to create the topologically sorted list stored into `result`
    stagesWithoutDeps.forEach(visit);
    this._sortedStages = result;
    // if not all stages could be visited, then this is due to a cyclic clique
    // which could not been reached
    if (result.length !== Object.keys(stages).length) {
      throw new Error('Cyclic dependencies found.');
    }
    return;

    function visit(stage) {
      if (visiting[stage.name]) {
        throw new Error('Detected cyclic dependency for stage ' + stage.name);
      }
      if (!visited[stage.name]) {
        visiting[stage.name] = true;
        var deps = outEdges.get(stage.name) || [];
        deps.forEach(function(dep) {
          if (!visited[dep]) visit(stages[dep]);
        });
        visited[stage.name] = true;
        result.unshift(stage);
      }
    }
  };

};

oo.initClass(Flow.Graph);

module.exports = Flow;
