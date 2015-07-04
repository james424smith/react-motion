import React, {PropTypes} from 'react';
import {range, mapTree, clone} from './utils';
import stepper from './stepper';

let hackOn = null;
let hackOn2 = null;
window.addEventListener('keypress', ({which}) => {
  if (which === 50) {
    hackOn = hackOn == null ? 10 : null;
  }
  if(which === 51) {
    hackOn2 = hackOn2 == null ? {data: [], curr: -1} : null;
  }
});

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

function updateValsAndV(frameRate, currVals, currV, destVals, k = -1, b = -1) {
  if (destVals != null && destVals.__springK != null) {
    return updateValsAndV(frameRate, currVals, currV, destVals.value, destVals.__springK, destVals.__springB);
  }
  if (Object.prototype.toString.call(destVals) === '[object Array]') {
    let newCurrVals = new Array(destVals.length);
    let newCurrV = new Array(destVals.length);
    destVals.forEach((val, i) => {
      let [nextCurVals, nextCurV] = updateValsAndV(frameRate, currVals[i], currV[i], val, k, b);
      newCurrVals[i] = nextCurVals;
      newCurrV[i] = nextCurV;
    });

    return [newCurrVals, newCurrV];
  }
  if (Object.prototype.toString.call(destVals) === '[object Object]') {
    let newCurrVals = {};
    let newCurrV = {};
    Object.keys(destVals).forEach(key => {
      let [nextCurVals, nextCurV] = updateValsAndV(frameRate, currVals[key], currV[key], destVals[key], k, b);
      newCurrVals[key] = nextCurVals;
      newCurrV[key] = nextCurV;
    });
    return [newCurrVals, newCurrV];
  }

  // haven't received any tween from parent yet
  if (k === -1 || b === -1) {
    return [destVals, currV];
  }
  return stepper(frameRate, currVals, currV, destVals, k, b);
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
//   if (f.length === 0) {
//     console.warn(
//       `You're passing a function to Spring prop \`endValue\` which doesn't \
// receive \`tween\` as the first argument. In this case, nothing will be \
// animated. You might as well directly pass the value.`
//     );
//   }
}

export default React.createClass({
  propTypes: {
    endValue: PropTypes.oneOfType([
      PropTypes.func,
      PropTypes.object,
      PropTypes.number,
    ]).isRequired,
  },

  getInitialState() {
    let {endValue} = this.props;
    let vals;
    if (typeof endValue === 'function') {
      checkValuesFunc(endValue);
      vals = endValue(tween);
    } else {
      vals = endValue;
    }
    let defaultVals = stripMarks(vals);
    return {
      currVals: defaultVals,
      currV: mapTree(zero, defaultVals),
      now: null,
    };
  },

  componentDidMount() {
    this.raf();
  },

  componentWillUnmount() {
    cancelAnimationFrame(this._rafID);
  },

  _rafID: null,

  raf() {
    this._rafID = requestAnimationFrame(() => {
      let {currVals, currV, now} = this.state;
      let {endValue} = this.props;

      // TODO: lol, refactor
      let annotatedVals;
      if (typeof endValue === 'function') {
        checkValuesFunc(endValue);
        annotatedVals = endValue(tween, currVals);
      } else {
        annotatedVals = tween(endValue);
      }
      let [newCurrVals, newCurrV] = updateValsAndV(FRAME_RATE, currVals, currV, annotatedVals);

      this.setState(() => {
        return {
          currVals: newCurrVals,
          currV: newCurrV
        };
      });

      this.raf();
    });
  },

  render() {
    let {currVals, currV} = this.state;
    if(hackOn2 != null) {
      if(hackOn2.curr === hackOn2.data.length - 1) {
        hackOn2.data.push([currVals, currV]);
        hackOn2.curr = hackOn2.data.length - 1;
      }
      currVals = hackOn2.data[hackOn2.curr][0];
      currV = hackOn2.data[hackOn2.curr][1];

      // Dirty mutations for the sake of time travel
      this.state.currVals = currVals;
      this.state.currV = currV;
    }

    if(hackOn != null) {
      let {endValue} = this.props;
      return <div {...this.props}>{
        range(hackOn)
        .reduce((acc) => {
          let [currVals, currV] = acc[acc.length - 1];

          let annotatedVals;
          if (typeof endValue === 'function') {
            annotatedVals = endValue(tween, currVals);
          } else {
            annotatedVals = tween(endValue);
          }

          let [newCurrVals, newCurrV] = updateValsAndV(FRAME_RATE, currVals, currV, annotatedVals);

          return [...acc, [newCurrVals, newCurrV]];
        }, [[currVals, currV]])
        .map(([currVals]) => {
          return (
            <span style={{opacity: 0.2}}>
              {hackOn2 != null &&
                <div style={{position: 'absolute', left: 300, zIndex: 100, top: 0}}><input
                    type="range"
                    min={0}
                    max={hackOn2.data.length - 1}
                    value={hackOn2.curr}
                    onChange={({target: {value}}) => {
                      hackOn2.curr = parseInt(value);
                    }} />
                    {hackOn2.curr}
                </div>}
              {this.props.children(currVals)}
            </span>
          );
        })}</div>;
    }

    return (<div {...this.props}>
      {hackOn2 != null &&
        <div style={{position: 'absolute', left: 300, zIndex: 100, top: 0}}><input
            type="range"
            min={0}
            max={hackOn2.data.length - 1}
            value={hackOn2.curr}
            onChange={({target: {value}}) => {
              hackOn2.curr = parseInt(value);
            }} />
            {hackOn2.curr}
        </div>}
      {this.props.children(currVals)}
    </div>);
  }
});

export let TransitionSpring = React.createClass({
  propTypes: {
    endValue: PropTypes.oneOfType([
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

  getDefaultProps() {
    return {
      willEnter: (key, currVals) => currVals[key],
      willLeave: () => null
    };
  },

  getInitialState() {
    let {endValue} = this.props;
    let vals;
    if (typeof endValue === 'function') {
      checkValuesFunc(endValue);
      vals = endValue(tween);
    } else {
      vals = endValue;
    }
    let defaultVals = stripMarks(vals);
    return {
      currVals: defaultVals,
      currV: mapTree(zero, defaultVals),
      now: null,
    };
  },

  componentDidMount() {
    this.raf();
  },

  componentWillUnmount() {
    cancelAnimationFrame(this._rafID);
  },

  _rafID: null,

  raf() {
    this._rafID = requestAnimationFrame(() => {
      let {currVals, currV, now} = this.state;
      let {
        endValue,
        willEnter,
        willLeave,
      } = this.props;

      let annotatedVals;
      if (typeof endValue === 'function') {
        checkValuesFunc(endValue);
        annotatedVals = endValue(tween, currVals);
      } else {
        annotatedVals = tween(endValue);
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
      let [newCurrVals, newCurrV] = updateValsAndV(frameRate, currVals, currV, mergedVals);

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

  render() {
    let {currVals} = this.state;
    return (<div {...this.props}>
      {this.props.children(currVals)}
    </div>);
  },
});
