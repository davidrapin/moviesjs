
var c = require('./common.js');
var log = c.log;
var warn = c.warn;

var path = require('path');
var imdb = require('./imdb.js');


/**
 *
 * Movie
 *
 */
function Movie() {
	this.imdbId = null;
	this.safeId = null;
	this.title = '';
	this.fileTitle = '';
	this.lang = '';
	this.year = '';
	this.genre = '';
	this.director = '';
	this.actors = '';
	this.actors = '';
	this.plot = '';
	this.runtime = '';
	this.rating = '';
	this.votes = '';
	this.image = '';
	this.extension = '';
	this.files = [];
	this.imdbDone = false;
	this.imdbFound = null;
};

Movie.prototype.loadFromImdb = function(infos) {
	if (infos === null || infos === undefined) return;
	this.imdbId = infos.ID;
	this.title = infos.Title;
	this.year = infos.Year;
	this.genre = infos.Genre;
	this.director = infos.Director;
	this.actors = infos.Actors;
	this.actors = infos.Actors;
	this.plot = infos.Plot;
	this.runtime = infos.Runtime;
	this.rating = infos.Rating;
	this.votes = infos.Votes;
	this.image = infos.Poster;
	return this;
};

Movie.prototype.loadFromJSON = function(json) {
	if (json === null || json === undefined) return;
	var movie = JSON.parse(json);
	for (var key in movie) {
		this[key] = movie[key];
	}

	// todo: delete
	/*this.forFiles(function(file) {
		this.readInfosFromFilePath(file);
	});*/

	return this;
};

// return the number of new files actually added
Movie.prototype.mergeFiles = function(m) {
	var filesBefore = this.files.length;
	this.files = this.files.concat(m.files);
	this.files = Array.deduplicate(this.files);
	return this.files.length - filesBefore;
};

Movie.prototype.addFile = function(filePath) {
	this.files.push(filePath);
	this.files = Array.deduplicate(this.files);
	this.readInfosFromFilePath(filePath);
};

Movie.prototype.forFiles = function(callback) {
	for (var i=0, l=this.files.length; i<l; ++i) {
		callback.call(this, this.files[i], i, l);
	}
};

Movie.prototype.readInfosFromFilePath = function(filePath) {
	var filename = path.basename(filePath);

	var re1 = new RegExp(
		"^([^(]+)\\s*\\(([^)]+)\\)\\s*(tt\\d+)?\\.(" + 
		Movie.extensions.join('|') + ")$",
		"i"
	);

	var re2 = new RegExp(
		"^([^(\\[]+)\\.(" + 
		Movie.extensions.join('|') + ")$",
		"i"
	);	

	var infos;
	if ((infos = re1.exec(filename)) !== null) {
		
		this.fileTitle = infos[1].trim();
		
		var sub = infos[2].split(/\s*,\s*/);
		if (sub.length > 0) { this.lang = sub[0].trim(); }
		if (sub.length > 1) { this.director = sub[1].trim(); }
		if (sub.length > 2 && sub[2].trim().match(/^\d{4}$/)) { 
			this.year = sub[2].trim(); 
		}

		if (infos[4]) {
			this.imdbId = infos[3];
			this.extension = infos[4];
		} else {
			this.extension = infos[3];
		}

		this.safeId = this.getSafeId();
	} else if ((infos = re2.exec(filename)) !== null) {
		this.fileTitle = infos[1].trim();
		this.extension = infos[2];
	} else {
		this.fileTitle = filename;
	}
};

Movie.prototype.getSafeId = function() {
	this.safeId = this.year + '#' + 
		String.normalize(this.fileTitle.toLowerCase());
	return this.safeId;
}

// callback(httpHit, [error]) this=movie
Movie.prototype.imdbResolve = function(callback, retryNotFound) {
	var movie = this;

	var load = function(byId, searchValue) {
		var getData = byId ? imdb.getDataById : imdb.getDataByTitle;

		var matchScore = function(m, imdbData) {
			if (byId) return 1;
			return m.matches(new Movie().loadFromImdb(imdbData));
		};

		var y = byId ? null : movie.year;
		getData(searchValue, y, function(imdbData, error) {
			if (error) {
				callback.call(movie, true, error);
				return;	
			}

			if (this == 'success') {
				movie.imdbDone = true;
				var score = matchScore(movie, imdbData);
				if (score >= 0.7) {
					movie.imdbFound = true;
					movie.loadFromImdb(imdbData);
				} else {
					movie.imdbFound = false;
					log('bad match : (' + score + ') ' + JSON.stringify(imdbData) + " <======> " + JSON.stringify(movie));
				}
			} else if (this == 'not_found') {
				log('not found : ' + JSON.stringify(movie));
				movie.imdbDone = true;
				movie.imdbFound = false;
			} else {
				movie.imdbDone = false;
				movie.imdbFound = false;
			}
			callback.call(movie, true);
		});
	};

	var needResolve = movie.needResolve(retryNotFound);
	//log(needResolve + "_" + movie.imdbDone + "_" + movie.imdbFound + "_" + movie.retryNotFound);
	if (needResolve && movie.imdbId) {
		// Not resolved, has an imdb ID
		load(true, movie.imdbId);

	} else if (needResolve && movie.fileTitle) {
		// Not resolved, has a title
		load(false, movie.fileTitle);

	} else {
		// resolved already, nothing to do
		callback.call(movie, false);
	}
};

Movie.prototype.needResolve = function(retryNotFound) {
	return !this.imdbDone || (!this.imdbFound && retryNotFound);
};

Movie.prototype.matches = function(m) {
	if (!m) { return; }
	var score = [];
	
	if ((this.title || this.fileTitle) && (m.title || m.fileTitle)) {
		//log(this.title + "//" + m.title + "//" + this.title.levenshteinMatch(m.title));
		var t1 = this.title ? this.title : this.fileTitle,
				t2 = m.title ? m.title : m.fileTitle;
		score.push(t1.levenshteinMatch(t2));
	}
	if (this.director && m.director) {
		//log(this.director + "//" + m.director + "//" + this.director.levenshteinMatch(m.director));
		score.push(this.director.levenshteinMatch(m.director));
	}
	if (this.year && m.year) {
		var d = Math.distance(this.year, m.year);
		//log(this.year + "//" + m.year + "//" + (Math.max(0, (-0.25*d + 1))));
		score.push(Math.max(0, (-0.25*d + 1)));
	}

	return Math.average(score);
};

Movie.extensions = ['avi', 'mkv', 'mpg', 'mpeg'];

exports.new = function() { return new Movie(); };
exports.extensions = Movie.extensions;
