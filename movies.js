
var c = require('./common.js');
var log = c.log;
var warn = c.warn;

if (process.argv.length !== 3) {
	log("argument required : config file");
	return;
}
var configFile = process.argv[2];
log("loading config. file '" + configFile + "' ...");

var config = require('./config.js').new(configFile, true);
config.setIfEmpty('playerPath', 'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe');

var store = require('./store.js').new(
	config.get('storeCache'),
	config.get('videoDirs')
);

store.readStore(function(read, error) {
	if (error) { return warn(error); } 
	log("loaded store from file (" + read + " movies)");

	//store.loadFromFiles(function() { });
	//store.startResolving(true);

	var server = require('./server.js').new(
		config.get('serverPort'),
		store,
		config
	);

	server.start(function(port) {
		log("server ready on http://localhost:" + port + "/");
	});
});







/*
var scrapVideos = function(source, storeFile) {
	var fs = require('fs');
	store.readFiles(source, function(errors, dir, videos) {
			if (errors) {
				warn(errors)
			} else {
				log("found : " + videos.length);
				var data = JSON.stringify(videos, null, 4);

				fs.writeFile(storeFile, data, "utf8", function(error) {
					if (error) { 
						warn(error); 
					} else {
						log("written:" + storeFile);
						log("--------------");
					}
				});
			}
			//log("done.");
	});
};
scrapVideos('E:\\Video\\Films\\Films A VOIR', '.films_voir');
scrapVideos('E:\\Video\\Films\\Films VUS', '.films_vus');
*/

/*
var retryNotFound = false;
var resolveProgress = function(movie, waiting, httpHits, notFound, errors) {
	log(
		" - resolve : '" + (movie ? movie.title : "null") + 
		"'. waiting:" + waiting + 
		" httpHits:" + httpHits + 
		" notFound:" + notFound +
		" errors:" + errors
	);
};

var doSearch = function(index, store) {
	var query = process.argv[2];
	var results = index.query(query);

	log(" ");
	log("query='" + query + "'");
	for (var i=0, l=results.length; i<l; ++i) {
		var r = results[i];
		var m = store.getMovieBySafeId(r.id);

		log(
			"res: " +
			m.fileTitle + " (" + m.title + ")" +
			" [" + (Math.round(r.score*10)/10) + "]"
		);
	}
};

store.readStore(function(read, error) {
	if (error) { return warn(error); } 
	log("loaded store (" + read + ")"); 

	store.loadFromFiles(function(errors) {
		if (errors) { return warn(errors); }

		log("loaded '" + this.movies.length + "' movies");

		store.writeStore(function(written, error) {
			if (error) { return warn(error); }
			log("wrote store (" + written + ")");

			store.imdbResolveAll(function(stats, errors) {
				if (errors) { warn(errors); }

				log(
					"resolved movies from Imdb (" + 
					stats.hits + " requests, " + 
					stats.missed + " not found, " +
					stats.errors + " errors)"
				);

				store.writeStore(function(written, error) {
					if (error) { return warn(error); }

					log("wrote store (" + written + ")");

					var index = require('./indexer.js').new();
					store.forMovies(function(m) {
						index.addDoc(m.safeId, m.fileTitle + " " + m.title);
					}, function(total) {
						log("added movies to index (" + total + ")");

						// search index
						doSearch(index, store);

						// done
						log("done :)");

						var server = require('./server.js').new(store, index);
						server.start();

					});
				});
			}, retryNotFound, resolveProgress);
		});
	});
});

*/
