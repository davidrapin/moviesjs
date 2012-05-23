
var c = require('./common.js');
var log = c.log;
var warn = c.warn;

var cb = require('./callback.js');
var movie = require('./movie.js');
var path = require('path');
var fs = require('fs');


/**
 *
 * Store
 *
 */
function Store(storePath, videoDirs) {
	this.videoExtensions = movie.extensions;
	this.file = path.normalize(storePath);
	this.videoPaths = [];
	for (var i=0, l=videoDirs.length; i<l; ++i) {
		this.videoPaths.push(path.normalize(videoDirs[i]));
	};
	
	this.movies = [];
	this.moviesBySafeId = {};
	this.moviesByImdbId = {};

	// imdb resolve pipeline
	this.maxResolveWaiting = 3;
	this.resolveWaiting = 0;
	this.resolveQueue = [];
	this.resolveStats = {
		done: 0,
		errors: [],
		httpHits: 0,
	};
	this.needResolve;
};

Store.prototype.needResolveCount = function() {
	if (this.needResolve === undefined) {
		var store = this;
		store.needResolve = 0;
		store.movies.forEach(function(m) {
			if (!m.imdbDone) store.needResolve++;
		});
	}
	return this.needResolve;
};

Store.prototype.isResolving = function() {
	return this.resolveQueue.length > 0 || this.resolveWaiting > 0;
};

Store.prototype.startResolving = function(retryNotFound) {
	var store = this;
	if (store.isResolving()) return false;

	var clearState = function() {
		store.resolveWaiting = 0;
		store.resolveDone = 0;
		store.resolveQueue = [];
		store.resolveStats = {
			done: 0,
			errors: [],
			httpHits: 0, 
		};
	};
	clearState();

	this.resolveQueue = this.movies.filter(function(m) {
		return (m.imdbDone !== true) 
			|| (retryNotFound && m.imdbFound === false);
	});

	var oneResolved = function(httpHit, error) {
		log("resolve done");
		//var m = this;
		store.resolveWaiting--;
		store.resolveStats.done++;
		store.resolveStats.httpHits += (httpHit ? 1 : 0); 
		if (error) { store.resolveStats.errors.push(error); }
		consume();
	};

	var consume = function() {
		while(store.resolveWaiting < store.maxResolveWaiting) {
			var m = store.resolveQueue.pop();
			if (!m) {
				// resolve queue is empty
				clearState();
				// clear needResolve cache 
				store.needResolve = undefined;
				return;
			} else {
				log("gonna resolve: " + m.safeId);
				store.resolveWaiting++;
				m.imdbResolve(oneResolved, retryNotFound);
			}
		}
	}

	consume();
	return true;
};

Store.prototype.stopResolving = function() {
	this.resolveQueue = [];
};

// callback(read, [errors])
Store.prototype.readStore = function(callback) {
	var store = this;

	path.exists(store.file, function(exists) {
		if (!exists) {
			callback.call(store, 0);
			return;
		}

		// naive impl for a start
		fs.readFile(store.file, "utf8", function(error, data) {
			if (error) { 
				callback.call(store, 0, error);
				return;
			}
			var lines = data.split(/[\r\n]+/);
			var i, l, m, line, movies = 0;
			for (i=0, l=lines.length; i<l; ++i) {
				line = lines[i].trim();
				if (line == "") continue;
				m = movie.new();
				m.loadFromJSON(line);
				store.addMovie(m);
				++movies;
			}
			callback.call(store, movies);
		});
	});
};

// callback(written, [errors])
Store.prototype.writeStore = function(callback) {
	var store = this;

	var data = "";
	store.forMovies(function(m, index, total) {
		data += JSON.stringify(m) + "\r\n";
	}, function(total) {
		fs.writeFile(store.file, data, "utf8", function(error) {
			if (error) { 
				callback.call(store, 0, error); 
			} else {
				callback.call(store, total);
			}
		});
	});
};

// callback(errors, videos)
Store.prototype.scanDirs = function(videoPaths, callback) {
	var mErrors = [], mVideos = [], store = this;
	var done = function() {
		callback.call(
			store,
			mErrors.length === 0 ? undefined : mErrors,
			mVideos
		);
	};

	var pcb = cb.split(done, videoPaths.length, function(errors, dir, videos) {
		if (errors) { mErrors = mErrors.concat(errors); }
		if (videos) { mVideos = mVideos.concat(videos); }
	});
	for (var i in videoPaths) {
		this.scanDir(videoPaths[i], pcb);
	}
} 

// callback(errors, dir, videos)
Store.prototype.scanDir = function(videosPath, callback) {
	var store = this;

	path.exists(videosPath, function(exists) {
		if (!exists) {
			callback.call(
				store,
				["movie dir. not found : '" + videosPath + "'"],
				videosPath,
				[]
			);
			return;
		}

		var videoRegexp = new RegExp("\\.(?:" + store.videoExtensions.join('|') + ")$", "i");;
		var isVideo = function(file) {
			return file.match(videoRegexp);
		};

		// callback(errors, dir, dirVideos)
		var loadDir = function(dir, dirCallback) {
			//log("entering dir " + dir);

			// collects results and calls callback when done
			var dirVideos = [];
			var subLoaders = 1; // 1 to include ourself
			var errors = [];
			var subLoaderDone = function(subErrors, subDir, subDirVideos) {
				--subLoaders;
				//log("sub dir ok for : '" + dir + "' (" + subLoaders + " left)");
				if (subErrors) {
					errors = errors.concat(subErrors);
				} else if (subDirVideos) {
					dirVideos = dirVideos.concat(subDirVideos);
				}
				if (subLoaders === 0) {
					//log("dir done: '" + dir + "'");
					dirCallback.call(
						store, 
						(errors.length == 0 ? undefined : errors),
						dir, 
						dirVideos
					);
				}
			}

			fs.readdir(dir, function(error, files) {
				// if reading the directory failed
				if (error) {
					dirCallback.call(
						store,
						["could not list content of directory '" + dir + "' (" + error + ")"],
						dir,
						dirVideos
					);
					return; // exit readdir callback (end)
				}

				var filePath, stats;
				for (var i = 0, l = files.length; i < l; ++i) {
					filePath = path.join(dir, files[i]);
					stats = fs.statSync(filePath);

					if (stats.isDirectory()) {
						++subLoaders;
						loadDir(filePath, subLoaderDone);
					} else if (stats.isFile()) {
						if (isVideo(filePath)) { 
							dirVideos.push(filePath);
						} else {
							//log("not video : " + filePath);
						}
					} else {
						//log("not a file or a directory '" + filePath + "'");
					}
				} // end for

				subLoaderDone(undefined, ".", undefined);
			}); // readdir end 
		}; // loadDir end

		// GO GO GO
		loadDir(videosPath, callback);
	}); // exists end
};

// callback([errors], addedArray, updatedCounts)
Store.prototype.loadFromFiles = function(callback) {
	this.scanDirs(this.videoPaths, function(errors, videos) {
		var newMovies = [], newFiles = 0, r;
		 
		if (errors) {
			callback.call(this, errors);

		} else {
			//log("files found:" + videos.length);
			for (var i=0, l=videos.length; i<l; ++i) {
				var m = movie.new();
				m.addFile(videos[i]);

				r = this.addMovie(m);
				if (r.movies > 0) { newMovies.push(m); }
				newFiles += r.files;
			}
			callback.call(this, undefined, newMovies, newFiles);
		}
		//log("done.");
	});
};

// return { movie:0/1, files:0+} : number of new items
Store.prototype.addMovie = function(m) {
	if (!m) return;

	var collision = this.moviesBySafeId[m.getSafeId()];
	var result = {};

	if (collision) {
		result.movies = 0;
		result.files = collision.mergeFiles(m);
	} else {
		result.movies = 1;
		result.files = m.files.length;

		// really add
		this.movies.push(m);
		this.moviesBySafeId[m.getSafeId()] = m;
		if (m.imdbId) this.moviesByImdbId[m.imdbId] = m;
	}

	return result;
};

Store.prototype.getMovieByImdbId = function(imdbId) {
	return this.moviesByImdbId[imdbId];
};

Store.prototype.getMovieBySafeId = function(safeId) {
	return this.moviesBySafeId[safeId];
};

// callback(movie, index, totalMovie, islast)
Store.prototype.forMovies = function(callback, doneCallback) {
	var i, l;
	for (i=0, l=this.movies.length; i<l; ++i) {
		callback.call(this, this.movies[i], i, l);
	}
	if (doneCallback) doneCallback.call(this, l);
}

// callback(stats{hits,missed,errors}, [errors])
Store.prototype.imdbResolveAll = function(callback, retryNotFound, progressCb) {
	var store = this, errors = [], errCount = 0; 
	var httpHits = 0, notFound = 0, waiting = 1;

	var pcb = function(m, httpHit, error) {
		if (error) { errors.push(error); errCount++; }
		if (httpHit) { httpHits++; }
		if (m && !m.imdbFound) { notFound++; }
		if (--waiting == 0) {
			callback.call(
				store,
				{ 'hits' : httpHits, 'missed' : notFound, 'errors' : errCount },
				errors.length == 0 ? undefined : errors
			);
		}
		if (progressCb && m) {
			progressCb.call(null, m, httpHit, m.imdbFound, error);
		}
	};

	this.forMovies(function(m) {
		++waiting;
		m.imdbResolve(function(httpHit, error) {
			pcb.call(store, this, httpHit, error);
		}, retryNotFound);
	});

	pcb.call(store, null, false);
};

exports.new = function(a, b) { return new Store(a, b); };
