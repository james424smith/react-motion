'use strict';

import React, {PropTypes} from 'react';
import {mapTree, clone} from './utils';
import stepper from './stepper';

let hackOn = false;
window.interval = 1000 / 60;
window.addEventListener('keypress', e => {
  if (e.which === 100) {
    hackOn = !hackOn;
    window.interval = hackOn ? 3000 : 1000 / 60;
  }
});

function requestAnimationFrame(f) {
  setTimeout(f, window.interval);
}

// ---------
let FRAME_RATE = 1 / 60;

function zero() {
  return 0;
}

// see stepper for constant k, b usage
function tween(tree, k = 170, b = 26) {
  return {
    __springK: k,
    __springB: b,
    value: tree,
  };
}

function stripMarks(tree) {
  if (tree != null && tree.__springK != null) {
    return stripMarks(tree.value);
  }
  if (Object.prototype.toString.call(tree) === '[object Array]') {
    return tree.map(stripMarks);
  }
  if (Object.prototype.toString.call(tree) === '[object Object]') {
    let newTree = {};
    Object.keys(tree).forEach(key => newTree[key] = stripMarks(tree[key]));
    return newTree;
  }
  // scalar
  return tree;
}

// see stepper for constant k, b usage
function updateVals(frameRate, currVals, currV, destVals, k = -1, b = -1) {
  if (destVals != null && destVals.__springK != null) {
    return updateVals(frameRate, currVals, currV, destVals.value, destVals.__springK, destVals.__springB);
  }
  if (Object.prototype.toString.call(destVals) === '[object Array]') {
    return destVals.map((val, i) => updateVals(frameRate, currVals[i], currV[i], val, k, b));
  }
  if (Object.prototype.toString.call(destVals) === '[object Object]') {
    let newTree = {};
    Object.keys(destVals).forEach(key => {
      newTree[key] = updateVals(frameRate, currVals[key], currV[key], destVals[key], k, b);
    });
    return newTree;
  }
  // haven't received any tween from parent yet
  if (k === -1 || b === -1) {
    return destVals;
  }
  return stepper(frameRate, currVals, currV, destVals, k, b)[0];
}

function updateV(frameRate, currVals, currV, destVals, k = -1, b = -1) {
  if (destVals != null && destVals.__springK != null) {
    return updateV(frameRate, currVals, currV, destVals.value, destVals.__springK, destVals.__springB);
  }
  if (Object.prototype.toString.call(destVals) === '[object Array]') {
    return destVals.map((val, i) => updateV(frameRate, currVals[i], currV[i], val, k, b));
  }
  if (Object.prototype.toString.call(destVals) === '[object Object]') {
    let newTree = {};
    Object.keys(destVals).forEach(key => {
      newTree[key] = updateV(frameRate, currVals[key], currV[key], destVals[key], k, b);
    });
    return newTree;
  }
  // haven't received any tween from parent yet
  if (k === -1 || b === -1) {
    return currV;
  }
  return stepper(frameRate, currVals, currV, destVals, k, b)[1];
}

function mergeDiff(collA, collB, onRemove, accum) {
  let [a, ...aa] = collA;
  let [b, ...bb] = collB;

  if (collA.length === 0 && collB.length === 0) {
    return accum;
  }
  if (collA.length === 0) {
    return accum.concat(collB);
  }
  if (collB.length === 0) {
    if (onRemove(a)) {
      return mergeDiff(aa, collB, onRemove, accum);
    }
    return mergeDiff(aa, collB, onRemove, accum.concat(a));
  }
  if (a === b) { // fails for ([undefined], [], () => true). but don't do that
    return mergeDiff(aa, bb, onRemove, accum.concat(a));
  }
  if (collB.indexOf(a) === -1) {
    if (onRemove(a)) {
      return mergeDiff(aa, collB, onRemove, accum);
    }
    return mergeDiff(aa, collB, onRemove, accum.concat(a));
  }
  return mergeDiff(aa, collB, onRemove, accum);
}

function mergeDiffObj(a, b, onRemove) {
  let keys = mergeDiff(Object.keys(a), Object.keys(b), a => !onRemove(a), []);
  let ret = {};
  keys.forEach(key => {
    if (b.hasOwnProperty(key)) {
      ret[key] = b[key];
    } else {
      ret[key] = onRemove(key);
    }
  });

  return ret;
}

function checkValuesFunc(f) {
  if (f.length === 0) {
    console.warn(
      `You're passing a function to Spring prop \`values\` which doesn't \
receive \`tween\` as the first argument. In this case, nothing will be \
animated. You might as well directly pass the value.`
    );
  }
}

export default React.createClass({
  propTypes: {
    values: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.object,
      PropTypes.number,
    ]).isRequired,
  },

  getInitialState: function() {
    let {values} = this.props;
    let vals;
    if (typeof values === 'function') {
      checkValuesFunc(values);
      vals = values(tween);
    } else {
      vals = values;
    }
    let defaultVals = stripMarks(vals);
    return {
      currVals: defaultVals,
      currV: mapTree(zero, defaultVals),
      now: null,
    };
  },

  raf: function() {
    requestAnimationFrame(() => {
      let {currVals, currV, now} = this.state;
      let {values} = this.props;

      // TODO: lol, refactor
      let annotatedVals;
      if (typeof values === 'function') {
        checkValuesFunc(values);
        annotatedVals = values(tween, currVals);
      } else {
        annotatedVals = tween(values);
      }
      let frameRate = now ? (Date.now() - now) / 1000 : FRAME_RATE;
      let newCurrVals = updateVals(frameRate, currVals, currV, annotatedVals);
      let newCurrV = updateV(frameRate, currVals, currV, annotatedVals);

      this.setState(() => {
        return {
          currVals: newCurrVals,
          currV: newCurrV,
          now: Date.now(),
        };
      });

      this.raf();
    });
  },

  componentDidMount: function() {
    this.raf();
  },

  render: function() {
    let {currVals} = this.state;
    return <div {...this.props}>{this.props.children(currVals)}</div>;
  }
});

export let TransitionSpring = React.createClass({
  propTypes: {
    values: PropTypes.oneOfType([
      PropTypes.func,
      // TODO: better warning
      PropTypes.object,
      PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.any.isRequired,
      })),
      PropTypes.arrayOf(PropTypes.element),
    ]).isRequired,
    willLeave: PropTypes.oneOfType([
      PropTypes.func,
      // TODO: better warning
      PropTypes.object,
    ]),
    willEnter: PropTypes.oneOfType([
      PropTypes.func,
      // TODO: better warning
      PropTypes.object,
    ]),
  },

  getInitialState: function() {
    let {values} = this.props;
    let vals;
    if (typeof values === 'function') {
      checkValuesFunc(values);
      vals = values(tween);
    } else {
      vals = values;
    }
    let defaultVals = stripMarks(vals);
    return {
      currVals: defaultVals,
      currV: mapTree(zero, defaultVals),
      now: null,
    };
  },

  raf: function() {
    requestAnimationFrame(() => {
      let {currVals, currV, now} = this.state;
      let {
        values,
        willEnter = (key, currVals) => currVals[key],
        willLeave = () => null,
      } = this.props;

      // TODO: lol, refactor
      let annotatedVals;
      if (typeof values === 'function') {
        checkValuesFunc(values);
        annotatedVals = values(tween, currVals);
      } else {
        annotatedVals = tween(values);
      }

      let strippedVals = stripMarks(annotatedVals);
      let shallowStrippedVals = annotatedVals.__springK == null ?
        annotatedVals :
        annotatedVals.value;

      let shallowStrippedMergedVals = mergeDiffObj(
        currVals,
        shallowStrippedVals,
        key => willLeave(key, tween, strippedVals, currVals, currV),
      );

      let mergedVals = annotatedVals.__springK == null ?
        shallowStrippedMergedVals :
        tween(shallowStrippedMergedVals, annotatedVals.__springK, annotatedVals.__springB);

      currVals = clone(currVals);
      currV = clone(currV);
      Object.keys(shallowStrippedMergedVals)
        .filter(key => !currVals.hasOwnProperty(key))
        .forEach(key => {
          currVals[key] = willEnter(key, strippedVals, currVals);
          currV[key] = mapTree(zero, currVals[key]);
        });

      let frameRate = now ? (Date.now() - now) / 1000 : FRAME_RATE;
      let newCurrVals = updateVals(frameRate, currVals, currV, mergedVals);
      let newCurrV = updateV(frameRate, currVals, currV, mergedVals);

      this.setState(() => {
        return {
          currVals: newCurrVals,
          currV: newCurrV,
          now: Date.now(),
        };
      });

      this.raf();
    });
  },

  componentDidMount: function() {
    this.raf();
  },

  render: function() {
    let {currVals} = this.state;
    return <div {...this.props}>{this.props.children(currVals)}</div>;
  },
});
