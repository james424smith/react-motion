// smarter component version with child function
// faster than 0
'use strict';

let React = require('react');
let stepper = require('../stepper');

function map3Tree(t1, t2, t3, f) {
  if (Object.prototype.toString.call(t1) === '[object Array]') {
    return t1.map((val, i) => map3Tree(val, t2[i], t3[i], f));
  }
  if (Object.prototype.toString.call(t1) === '[object Object]') {
    let newTree = {};
    Object.keys(t1).forEach(key => newTree[key] = map3Tree(t1[key], t2[key], t3[key], f));
    return newTree;
  }
  return f(t1, t2, t3);
}

let Springs = React.createClass({
  getInitialState() {
    let {initVals} = this.props;
    return {
      currVals: initVals,
      currV: map3Tree(initVals, initVals, initVals, () => 0),
    };
  },

  raf() {
    requestAnimationFrame(() => {
      let {currVals, currV} = this.state;
      let {newFinalValsF, initVals} = this.props;

      let newFinalVals = newFinalValsF(currVals);

      let newCurrVals = map3Tree(
        newFinalVals,
        currVals,
        currV,
        (destX, x, vx) => stepper(x, vx, destX, 120, 16)[0],
      );
      let newCurrV = map3Tree(
        newFinalVals,
        currVals,
        currV,
        (destX, x, vx) => stepper(x, vx, destX, 120, 16)[1],
      );

      this.setState(() => {
        return {
          currVals: newCurrVals,
          currV: newCurrV,
        };
      });

      this.raf();
    });
  },

  componentDidMount() {
    this.raf();
  },

  render() {
    return (
      <div>
        {this.props.children(this.state.currVals)}
      </div>
    );
  }
});

var App = React.createClass({
  getInitialState() {
    return {
      mouseX: 0,
      mouseY: 0,
    };
  },

  handleMouseMove(e) {
    if (e.nativeEvent.which === 1) {
      this.setState({
        mouseX: e.pageX,
        mouseY: e.pageY,
      });
    }
  },

  render() {
    let {mouseX, mouseY, springs} = this.state;
    let box = {
      width: 500,
      height: 600,
      backgroundColor: 'lightgray',
    };

    let s = {
      position: 'absolute',
      border: '1px solid black',
      borderRadius: 99,
      width: 50,
      height: 50,
      backgroundColor: 'red',
    };

    let initVals = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ];

    return (
      <div onMouseMove={this.handleMouseMove} onMouseDown={this.handleMouseMove} style={box}>
        <Springs initVals={initVals} newFinalValsF={currVals => {
          return currVals.reduce((accum, val, i) => {
            if (i === 0) {
              return [[mouseX, mouseY]];
            }
            return [...accum, currVals[i - 1]];
          }, []);
        }}>
          {currVals => currVals.map(([x, y], i) => (
            <div key={i} style={{
              ...s,
              WebkitTransform: `translate3d(${x}px, ${y}px, 0)`,
              transform: `translate3d(${x}px, ${y}px, 0)`,
              zIndex: currVals.length - i,
            }} />
          ))}
        </Springs>
      </div>
    );
  }
});

module.exports = App;
