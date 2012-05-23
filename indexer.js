
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

		if (!/^\w+$/.test(w)) {
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
	request = String.normalize(request);

	var requestTerms = request.split(/\s+/),
			mergedScores = [], results = [],
			scores, i, il, j, jl, docId, termData, matches;
	
	for (i=0, il=requestTerms.length; i<il; ++i) {
		
		matches = this.getTermMatches(requestTerms[i]);

		for (j=0, jl=matches.length; j<jl; ++j) {

			scores = this.queryByTerm(matches[j].termData);

			for (docId in scores) {
				if (!mergedScores[docId]) {
					mergedScores[docId] = 0;
				}
				// this is how we merge
				mergedScores[docId] += scores[docId] * matches[j].weight;
			}
		}
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
