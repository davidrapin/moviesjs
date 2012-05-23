
var c = require('./common.js');
var log = c.log;

function Callback() { };

Callback.split = function(cb, count, each) {
	var current = 0;
	var _each = function() {
		if (each) each.apply(arguments.callee, arguments);
		if (++current === count) {
			//log(JSON.stringify(arguments));
			cb.call(arguments.callee);
		};	
	};
	return _each;
}

exports.split = Callback.split;
