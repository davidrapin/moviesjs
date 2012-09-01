
var c = require('./common.js');
var child = require('child_process');
var log = c.log;
var warn = c.warn;

var http = require('http');
var fs = require('fs');

function Server(port, store, config) {
	this.port = port;
	this.store = store;
	this.config = config;

	this.indexer = require('./indexer.js').new();
	
	this.page = fs.readFileSync('client.html');
	this.jquery = fs.readFileSync('jquery-1.7.2.min.js');
	this.client = fs.readFileSync('client.js');
	this.css = fs.readFileSync('client.css');	
};

Server.prototype.start = function(callback) {
	var server = this;

	http.createServer(function(req, res) {
		log("req:'" + req.url + "'");
		
		if (req.url == '/die') {
			log("bye.");
			res.writeHead(204);
			res.end();
			this.close();

		} else if (req.url == '/scan') {
			server.scan(res);

		} else if (req.url == '/index') {
			server.index(res);
		
		} else if (req.url == '/resolve/start') {
			server.resolveStart(res);
		
		} else if (req.url == '/resolve/stop') {
			server.resolveStop(res);

		} else if (req.url == '/save') {
			server.save(res);

		} else if (req.url == '/state') {
			server.state(res);

		} else if (req.url == '/') {
			server.rawResponse(res, server.page, 'text/html');
		
		} else if (req.url.startsWith('/play/')) {
			server.play(res, req.url.substring('/play/'.length));

		} else if (req.url == '/player/get') {
			server.getPlayerPath(res);

		} else if (req.url.startsWith('/player/set')) {
			server.setPlayerPath(res, req.url.substring('/player/set/'.length))

		} else if (req.url == '/moviePathModifier/get') {
			server.getMoviePathModifier(res);

		} else if (req.url.startsWith('/moviePathModifier/set')) {
			server.setMoviePathModifier(res, req.url.substring('/moviePathModifier/set/'.length))
		
		} else if (req.url.startsWith('/q/')) {
			server.query(res, req.url.substring('/q/'.length));

		} else if (req.url.startsWith('/filter/')) {
			server.filter(res, req.url.substring('/filter/'.length));

		} else if (req.url == '/jquery.js') {
			server.rawResponse(res, server.jquery, 'text/javascript');
		
		} else if (req.url == '/client.css') {
			//server.rawResponse(res, server.css, 'text/css');
			server.rawResponse(res, fs.readFileSync('client.css'), 'text/css');
		
		} else if (req.url == '/client.js') {
			//server.rawResponse(res, server.client, 'text/javascript');
			server.rawResponse(res, fs.readFileSync('client.js'), 'text/javascript');

		} else {
			res.writeHead(404);
			res.end();
		}
	}).listen(server.port);

	this.indexStore(null, function(newIndex) {
		server.indexer = newIndex;

		// start+initialIndex done !
		callback.call(null, server.port);
	});
};

// index defaults to a newly created index
Server.prototype.indexStore = function(index, callback) {
	if (!index) { index = require('./indexer.js').new(); }
	var server = this;

	this.store.forMovies(function(m) {
		server.indexMovie(m, index);
	}, function(total) {
		callback.call(null, index);
	});
};

Server.prototype.state = function(response) {
	var resolving = this.store.isResolving();

	var result = { 
		'docs': this.indexer.docCount(),
		'time': Date.now(),
		'resolving': resolving,
		'needResolve': this.store.needResolveCount()
	};

	if (resolving) {
		result.resolveErrors = this.store.resolveStats.errors.length;
		result.resolveHits = this.store.resolveStats.httpHits;
		result.resolveDone = this.store.resolveStats.done;
		result.resolveWaiting = this.store.resolveWaiting;
		result.resolveQueue = this.store.resolveQueue.length;
		result.resolveProgress = (
			result.resolveDone / (result.resolveDone + 
			result.resolveWaiting + result.resolveQueue)
		);
	}

	this.jsonResponse(response, result); 
};

Server.prototype.play = function(response, query) {
	var a = query.split('/', 2);
	var safeId = decodeURIComponent(a[0]);
	var fileIndex = a[1];
	var movie = this.store.getMovieBySafeId(safeId);
	if (!movie || fileIndex >= movie.files.length) {
		var result = { type: 'error', error: 'not found' };
		this.jsonResponse(response, result);
	} else {
		response.writeHead(204);
		response.end();
		
		var filePath = movie.files[fileIndex];
		var modifier = this.config.get('moviePathModifier');
		if (modifier) {
			var func = eval("( " + modifier + " );");
			filePath = func.call(undefined, filePath);
			log("[modified]:" + filePath);
		}

		var player = this.config.get('playerPath');
		child.execFile(player, [filePath], {}, function(error) {
			if (error) { warn(error); }
			else { log("player done"); }
		});
	}
};

Server.prototype.resolveStart = function(response) {
	var result = { 
		type: 'success', 
		start: this.store.startResolving(false)
	};
	this.jsonResponse(response, result);
};

Server.prototype.resolveStop = function(response) {
	var result = { 
		type: 'success', 
		stop: this.store.stopResolving()
	}
	this.jsonResponse(response, result);
};

Server.prototype.scan = function(response) {
	var store = this.store;
	var server = this;

	var result = {};
	store.loadFromFiles(function(errors, newMovies, newFiles) {
		if (errors) { 
			result.type = 'error';
			result.errors = errors;
			
		} else {
			result.type = 'success';
			result.newMovies = newMovies.length;
			result.newFiles = newFiles;

			for (var i=0, l=newMovies.length; i<l; ++i) {
				server.indexMovie(newMovies[i]);
			}
		}
		server.jsonResponse(response, result);

	});
};

Server.prototype.getPlayerPath = function(response) {
	var p = this.config.get('playerPath');
	this.jsonResponse(response, p);
};

Server.prototype.setPlayerPath = function(response, p) {
	var p = decodeURIComponent(p);
	this.config.set('playerPath', p);
	var result = { 
		'type': 'success',
		'playerPath': p
	};
	this.jsonResponse(response, result);
};

Server.prototype.getMoviePathModifier = function(response) {
	var p = this.config.get('moviePathModifier');
	this.jsonResponse(response, p);
};

Server.prototype.setMoviePathModifier = function(response, p) {
	var p = decodeURIComponent(p);
	this.config.set('moviePathModifier', p);
	var result = { 
		'type': 'success',
		'moviePathModifier': p
	};
	this.jsonResponse(response, result);
};

Server.prototype.index = function(response) {
	var server = this;

	this.indexStore(null, function(newIndex) {
		server.indexer = newIndex;
		var result = {
			type: 'success',
			index: newIndex.docCount()
		};
		server.jsonResponse(response, result);
	});

};

Server.prototype.save = function(response) {
	var server = this;

	this.store.writeStore(function(written, error) {
		var result;
		if (error) {
			result = {
				type: 'error',
				errors: [error]
			};
		} else {
			result = {
				type: 'success',
				movies: written
			};
		}
		server.jsonResponse(response, result);
	});
};

// index defaults to this.indexer 
Server.prototype.indexMovie = function(m, index) {
	if (!index) { index = this.indexer; }
	var text = 
		(m.fileTitle || '') + " " + 
		(m.title || '') + " " + 
		(m.director || '') + " " + 
		(m.actors || '') 
		;
	//log("__>" + text);
	index.addDoc(m.safeId, text);
};

Server.prototype.query = function(res, q)  {
	q = decodeURIComponent(q);
	log("query : '" + q + "'")
	
	function SearchEngine(store, indexer) { 
		this.store = store;
		this.indexer = indexer;
	};
	SearchEngine.prototype.search = function(query) {
		var specials = [],
			requestTerms = [],
			words = query.split(/\s+/),
			re = /^([+]{1,2})([a-z]+)(\<|\>|\=|\!|\~)(.+)$/i,
			w, s;

		for (var i=0, l=words.length; i<l; ++i) {
			w = words[i];
			if (s = re.exec(w)) {
				specials.push({
					strict: s[1].length === 2,
					name: s[2],
					operator: s[3],
					value: s[4] || ''
				});
			} else {
				s = String.normalize(w);
				if (!s.match(/^\s*$/)) requestTerms.push(s);
			}
		}

		log("specials: " + JSON.stringify(specials));
		log("requestTerms: " + JSON.stringify(requestTerms));
		var matches = this.indexer.query(requestTerms);

		// loop through all matching IDs
		var results = [], jl = specials.length, match, sf, movie, add;
		for (var i=0, l=matches.length; i<l; ++i) {
			match = matches[i];
			movie = this.store.getMovieBySafeId(match.id);

			// check if the movies also matches all special filters
			add = true;
			for (var j=0; j<jl; ++j) {
				sf = specials[j];
				if (!this.matchSpecialFilter(sf, movie)) {
					add = false;
					break;
				}
			}

			// add to results if everything matched
			if (add) results.push({
				'score': (Math.round(match.score*10)/10), 
				'movie' : movie
			});
		}

		return results;
	};
	SearchEngine.prototype.matchSpecialFilter = function(s, object) {

		var v = object[s.name];
		if (!s.strict && (v === null || v === undefined ||v === '')) return true;

		switch(s.operator) {
			case '>': return v >= s.value;
			case '<': return v <= s.value;
			case '=': return v === s.value;
			case '!': return v !== s.value;
			case '~': return v && (v+"").toLowerCase().indexOf(s.value.toLowerCase()) >= 0;
		}
		return true;
	};
	var search = new SearchEngine(this.store, this.indexer);

	/*var list = [];
	var results = this.indexer.query(q);
	for (var i=0, l=results.length; i<l; ++i) {
		var r = results[i];
		var m = this.store.getMovieBySafeId(r.id);
		list.push({
			'score': (Math.round(r.score*10)/10), 
			'movie' : m
		});
	}*/
	this.jsonResponse(res, { 'q': q, 'results': search.search(q) });
};

Server.movieFilters = {
	'noTitle'      : function(m) { return !m.title; },
	'noYear'       : function(m) { return !m.year; },
	'manyFiles'    : function(m) { return m.files.length > 1; },
	'imdbNotDone'  : function(m) { return !m.imdbDone; },
	'imdbNotFound' : function(m) { return m.imdbFound === false; },
};

Server.prototype.filter = function(res, filter)  {
	//log("filter : '" + filter + "'");
	var filterFunc = Server.movieFilters[filter];
	var list = [];
	var movies = this.store.movies.filter(filterFunc);
	movies.forEach(function(m) {
		list.push({ 'score': 0, 'movie' : m });
	});
	this.jsonResponse(res, { 'q': filter, 'results': list });
};

Server.prototype.jsonResponse = function(response, object) {
	this.rawResponse(
		response, 
		JSON.stringify(object, null, " "), 
		'application/json'
	);
};

Server.prototype.rawResponse = function(response, content, mimeType) {
	response.writeHead(200, {
		'Content-Type': mimeType + '; charset=UTF-8',
	});
	response.end(content, 'utf-8');
};




exports.new = function(port, store, config) { 
	return new Server(port, store, config); 
};
