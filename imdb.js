
var c = require('./common.js');
var log = c.log;
var warn = c.warn;

var http = require('http');


/**
 *
 * Imdb
 *
 */
function Imdb() { };

Imdb.getDataByTitle = function(title, year, callback) {
	Imdb._getData('t', title, year, callback);
};

Imdb.getDataById = function(imdbId, year, callback) {
	Imdb._getData('i', imdbId, year, callback);
};

Imdb._getData = function(param, value, year, callback) {
	var encodedValue = encodeURIComponent(value.trim().toLowerCase());
	//log("_______"+encodedValue);
	var options = {
		host: 'imdbapi.com',
		port: 80,
		path: '/?' + param + '=' + encodedValue + (year ? ('&y=' + year) : '')
	};

	var body = '';

	
	http.get(options, function(res) {

		res.on('data', function(chunk) {
			body += chunk;
		});

		res.on('end', function() {
			//log(body);
			var data = [];
			try {
				data = JSON.parse(body);
			} catch(error) {
				callback.call('not_found', {});
				return;
			}

			if (data['Response'] == "True") {
				callback.call('success', data);
			} else {
				callback.call('not_found', data);
			}
		});

	}).on('error', function(error) {
		callback.call('error', {}, error)
	});
};

exports.getDataByTitle = Imdb.getDataByTitle;
exports.getDataById = Imdb.getDataById;
