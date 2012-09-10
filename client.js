// client side code (with jQuery)
$(function() {
	var query = "";

	var getMovieHtml = function(movie, score) {
		var img = movie.image.lastIndexOf("http", 0) === 0 ? movie.image : "";
		var h = '<div class="movie">'
		+ '<div class="runtime">Runtime: ' + (movie.runtime || 'unknown') + '</div>'
		+ '<div class="rating">' + (movie.rating || '?') + '/10</div>'
		+ '<a href="http://www.imdb.com/title/' + movie.imdbId + '" target="_blank"><img src="' + img + '" class="thumb" /></a>'
		+ '<div class="text">'
		+ '<h1 class="title">' + (movie.title || movie.fileTitle) + ' (' + movie.year + ')</h1>'
		+ '<h2 class="director">by ' + movie.director + '</h2>'
		+ '<h2 class="actors">with ' + movie.actors + '</h2>'
		+ '<p class="plot">' + movie.plot + '</p>';
		for (var i=0, l=movie.files.length; i<l; ++i) {
			var f = movie.files[i];
			h += '<a href="/play/' + 
				encodeURIComponent(movie.safeId) + '/' + i + '">' + 
				f.substr(f.lastIndexOf('\\') + 1) + 
				'</a> ';
		}
		h += '</div></div><div class="clear"></div>';
		return h;
	}
	
	var showSearchResults = function(data, status, req) {
		$('#result').text('"' + data.q + '" : ' + data.results.length + " results");
		for (var i=0, l=data.results.length; i<l; ++i) {
			$('#result').append(getMovieHtml(
				data.results[i].movie,
				data.results[i].score
			));
		};
	};

	var showError = function(title, error) {
		alert('"' + title + '" failed\n' + error);
	};

	var showResult = function(title, data) {
		alert('"' + title + '"\n' + JSON.stringify(data));
	};

	$('#search').keyup(function(e) {
		var r = $('#result');

		/*var c = e.keyCode;
		var updown = c == 38 || c == 40;
		if (updown && !r.is(":focus")) {
			alert(":)");
			r.focus();
			return;
		}*/

		var q = $(this).val();
		if (q == query) { return; }
		query = q;

		r.text(query);
		$.ajax("/q/" + encodeURIComponent(query), {
			success: function(data, status, req) { showSearchResults(data); },
			error: function(req, textStatus, error) { showError('searching', error); }, 
		});
	});

	$(document).keyup(function(e) {
		var c = e.keyCode;
		var s = $('#search');

		var digit = c >= 48 && c <= 57;
		var letter = c >= 65 && c <= 90;

		if ((digit || letter) && !s.is(":focus"))  {
			s.focus();
		}
	});


	// stare box update

	var autoUpdate = false;
	var updateStateHtml = function(state) {
		// update indicator
		$('#indicator').toggleClass('green');

		// content 
		$('#time').text(state.time);
		$('#docs').text(state.docs);
		$('#needResolve').text(state.needResolve);
		$('#resolving').text(state.resolving ? "yes" : "no");
		if (state.resolving) {
			$('#resolveDone').text(state.resolveDone);
			$('#resolveWaiting').text(state.resolveWaiting);
			$('#resolveQueue').text(state.resolveQueue);
			$('#resolveErrors').text(state.resolveErrors);
			$('#resolveHits').text(state.resolveHits);
			$('#resolveProgress').text(Math.floor(state.resolveProgress * 100) + '%');
		}

		if (state.resolving === $('#imdb').hasClass("hidden")) {
			if (state.resolving) {
				$('#imdb').removeClass("hidden");
			} else {
				$('#imdb').addClass("hidden");
			}
		}
		
		/*
		// html content
		$.each(getStateHtml(), function(key, val) {
			val.appendTo('#cBody');
		});*/
	};

	var updateState = function() {
		$.getJSON("/state", function(data) {
			updateStateHtml(data);
			
			if (autoUpdate) {
				setTimeout(updateState, 1000);
			}
		});
	};

	$('#toggleControls').click(function() {
		//alert('lol');
		var controls = $('#controlMenu');
		controls.toggleClass('hidden');
		autoUpdate = !controls.hasClass('hidden');
		if (autoUpdate) { updateState(); }
	});

	var addActionLink = function(buttonId, actionPath, title) {
		$('#' + buttonId).click(function() {
			$.ajax(actionPath, {
				success: function(data, status, req) { 
					showResult(title, data);
				},
				error: function(req, textStatus, error) { 
					showError(title, 'Connection error : "' + error  +"'");
				}, 
			});
		});
	};
	addActionLink('scan', '/scan', 'Directory scan');
	addActionLink('resolveStart', '/resolve/start', 'Imdb resolve (start)');
	addActionLink('resolveStop', '/resolve/stop', 'Imdb resolve (stop)');
	addActionLink('index', '/index', 'Index update');
	addActionLink('save', '/save', 'Store save');

	var addFilter = function(filterName) {
		$('<a>')
			.attr('href', '#')
			.text(filterName)
			.click(function() {
				$.ajax("/filter/" + filterName, {
					success: function(data, status, req) { showSearchResults(data); },
					error: function(req, textStatus, error) { showError('filtering on ' + filterName, error); }, 
				});	
			})
			.appendTo('#filters')
		;
		$(document.createTextNode(' ')).appendTo('#filters');
	};
	addFilter('noTitle');
	addFilter('noYear');
	addFilter('manyFiles');
	addFilter('imdbNotDone');
	addFilter('imdbNotFound');

	var addValueEditor = function(buttonId, basePath, valueName) {
		$('#' + buttonId).click(function() {
			$.ajax(basePath + '/get', {
				success: function(data, status, req) { 
					var oldValue = data;
					var newValue = prompt("Set '" + valueName + "':", oldValue);
					if (newValue && newValue !== oldValue) {
						$.ajax(basePath + '/set/' + encodeURIComponent(newValue), {
							success: function(data, status, req) { showResult("'" + valueName + "' updated", data); },
							error: function(req, textStatus, error) { showError('getting ' + valueName, error); }, 
						});	
					}
				},
				error: function(req, textStatus, error) { showError('setting ' + valueName, error); }, 
			});
		});
	};
	addValueEditor('player', '/player', 'media player path');
	addValueEditor('moviePathModifier', '/moviePathModifier', 'movie path modifier');

	$('#search').focus();
});
