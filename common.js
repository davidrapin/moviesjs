
var log = function(msg) {
	console.log(Date.now() + " " + msg);
};
exports.log = log;

exports.warn = function(err) {
	if (err === undefined) {
		log("ERROR: unknow error");
	} else if (err instanceof Array) {
		for (var i=1, l=err.length; i<=l; ++i) {
			log("ERROR (" + i + "/" + l + "): " + err[i-1]);
		}
	} else {
		log("ERROR: " + err);
	}
}


/**
 *
 * Extend String
 *
 */
String.prototype.levenshteinDistance = function(t) {
	var s = this, m = this.length, n = t.length, i, j;
	// for all i and j, d[i,j] will hold the Levenshtein distance between
	// the first i characters of s and the first j characters of t;
	// note that d has (m+1)x(n+1) values
	var d = []; // [0..m, 0..n]

	for (i=0; i<=m; ++i) {
		d[i] = [];
		d[i][0] = i; // the distance of any first string to an empty second string
	}
	for (j=0; j<=n; ++j) {
		d[0][j] = j; // the distance of any second string to an empty first string
	}

	for (j=1; j<=n; ++j) {
		for (i=1; i<=m; ++i) {
			if (s[i-1] == t[j-1]) {  
				d[i][j] = d[i-1][j-1];       // no operation required
			} else {
				d[i][j] = Math.min(
					d[i-1][j] + 1,  // a deletion
					d[i][j-1] + 1,  // an insertion
					d[i-1][j-1] + 1 // a substitution
				);
			}
		}
	}
	return d[m][n];
};

String.prototype.levenshteinMatch = function(o) {
	var t = this, l;	
	
	t = t.toLowerCase();
	o = o.toLowerCase();
	
	t = t.replace(/[^a-z0-9]+/g, ' ').trim();
	o = o.replace(/[^a-z0-9]+/g, ' ').trim();

	l = Math.max(o.length, t.length);

	// returns a match score between 0 and 1
	return 1 - (t.levenshteinDistance(o)/l);
};

String.prototype.startsWith = function(s) {
	return this.lastIndexOf(s, 0) === 0;
};

String.normalize = function(t, special) {
	if (!special) { special = ' '; }
	t = t.trim();
	t = t.replace(/\s{2,}/g, ' ');
	t = t.replace(/[,.:;!?()\/\-'"&+#]+/g, special);
	t = t.toLowerCase();
	t = String.removeAccentuation(t);
	//log(" --->" + t)
	return t; 
};

String.removeAccentuation = function(w) {
	return w
		// a
		.replace(/à/ig, 'a')
		.replace(/â/ig, 'a')
		.replace(/ä/ig, 'a')
		.replace(/á/ig, 'a')
		.replace(/å/ig, 'a')
		// c
		.replace(/ç/ig, 'c')
		// d
		.replace(/ð/ig, 'd')
		// e
		.replace(/é/ig, 'e')
		.replace(/è/ig, 'e')
		.replace(/ê/ig, 'e')
		.replace(/ë/ig, 'e')
		// i
		.replace(/ï/ig, 'i')
		.replace(/î/ig, 'i')
		.replace(/ì/ig, 'i')
		.replace(/í/ig, 'i')
		// n
		.replace(/ñ/ig, 'n')
		// o
		.replace(/ö/ig, 'o')
		.replace(/ô/ig, 'o')
		.replace(/ò/ig, 'o')
		.replace(/ó/ig, 'o')
		.replace(/ø/ig, 'o')
		// u
		.replace(/ü/ig, 'u')
		.replace(/û/ig, 'u')
		.replace(/ú/ig, 'u')
		.replace(/ù/ig, 'u')
		// y
		.replace(/ÿ/ig, 'y')
		;
};


/**
 *
 * Extend Math
 *
 */
Math.distance = function(a, b) {
	return Math.abs(a - b);
}

Math.average = function(a) {
	var i, sum = 0, l = a.length;
	for (i=0; i<l; ++i) { sum += a[i]; }
	return sum/l;
}



/**
 *
 * Extend Array
 *
 */
Array.deduplicate = function(a) {
	var items = [], i, l=a.length;
	for (i=0; i<l; ++i) {
		items[a[i]] = true;
	}
	return Object.keys(items);
}

