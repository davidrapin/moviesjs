
var c = require('./common.js');
var log = c.log;
var warn = c.warn;


/**
 *
 * Indexer
 *
 */
function Indexer() {
	// term => { docs: numberOfDocsWithTerm, occurences: [{ 'docId' : docId, 'count' : occurencesInDoc}, ...]
	this.terms = {};
	// docId => { 'words' : numberOfWords, 'unique' : numberofUniqueWords}
	this.docs = {};
};

Indexer.prototype.docCount = function() {
	return Object.keys(this.docs).length;
};

Indexer.prototype._addWordMap = function(docId, wordMap, wordCount) {
	var words, w;
	for (w in wordMap) {

		// doc occurences
		var t = this.terms[w];
		if (!t) {
			t = { 'docs': 0, 'occurences': [] };
			this.terms[w] = t;
		} else if (t.occurences === undefined) {
			log("w: " + w);
			log("t(json): " + JSON.stringify(t));
			log("t: " + t);
		}
		// doc occurences
		t.docs++;

		// term occurences
		t.occurences.push({'docId' : docId, 'count' : wordMap[w]});
	}

	this.docs[docId] = {'words': wordCount, 'unique': wordMap.length};
};

Indexer.prototype.addDoc = function(docId, text) {
	if (
		docId === undefined 
		|| docId === null 
		|| text === undefined
		|| text === null
		) return;

	text = String.normalize(text);

	var words = text.split(/\s+/), wordCount, i, w, map = [];

	for (i=0, wordCount=words.length; i<wordCount; ++i) {
		w = words[i];

		if (w !== '' && !/^\w+$/.test(w)) {
			log("not indexed : '" + w + "'");
			continue;
		}

		if (map[w]) {
			map[w]++;
		} else {
			map[w] = 1;
		}
	}
	
	this._addWordMap(docId, map, wordCount);
};

Indexer.prototype.queryByTerm = function(termData) {
	var scores = [],
			docCount = this.docCount(),
			r, i, l, tfidf, docData, occData;
	
	for (i=0, l=termData.occurences.length; i<l; ++i) {
		occData = termData.occurences[i];
		docData = this.docs[occData.docId];
		tfidf = (occData.count/docData.words)/(termData.docs/docCount);
		// (occurencesInDoc/wordsInDoc)/(docsWithTerm/docCount);
		scores[occData.docId] = tfidf;
	}

	return scores;
};

Indexer.prototype.query = function(request) {

	var requestTerms;
	if (Array.isArray(request)) {
		requestTerms = request;
	} else {
		request = String.normalize(request);
		requestTerms = request.split(/\s+/);
	}

	var mergedScores = [], results = [],
		scores, i, il, j, jl, docId, termData, matches;
	
	// for each request term
	for (i=0, il=requestTerms.length; i<il; ++i) {
		
		// get all matching tesaurus terms with associated weight
		matches = this.getTermMatches(requestTerms[i]);

		// for each matching tesaurus term
		for (j=0, jl=matches.length; j<jl; ++j) {

			// get all docs matching the term with associated score
			scores = this.queryByTerm(matches[j].termData);

			// for each matchig doc, compute the final score as (query-term-weight * term-doc-match)
			for (docId in scores) {
				if (!mergedScores[docId]) {
					mergedScores[docId] = 0;
				}
				// this is how we merge
				mergedScores[docId] += scores[docId] * matches[j].weight;
			}
		}
	}

	if (!mergedScores.length && requestTerms.length && requestTerms[0] === '*') {
		//var ids = Object.keys(this.docs);
		for (docId in this.docs) results.push({ 'id' : docId, 'score' : 0});
	}

	for (docId in mergedScores) {
		results.push({ 'id' : docId, 'score' : mergedScores[docId]});
	}

	// sort results by descending score
	return results.sort(function(a, b) {
		return b.score - a.score;
	});

	return mergedScores;
};

Indexer.prototype.getTermMatches = function(term) {
	var matches = [], match, termData, term;

	for (t in this.terms) {
		if (!this.isTermMatch(term, t)) continue;
		match = { 
			'termData': this.terms[t], 
			'term': term, 
			'match': t, 
			'weight': term.levenshteinMatch(t)
		};

		//log("approx: " + match.term + " -> " + match.match + " (" + match.weight + ")");

		matches.push(match); 
	}

	return matches;
};

Indexer.prototype.isTermMatch = function(term, word) {
	return word.indexOf(term) >= 0;
};

exports.new = function() { return new Indexer(); };
