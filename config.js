
var fs = require('fs');

function Config(file, autoSave) {
	this.file = file;
	this.autoSave = autoSave;
	this.load();
}

Config.prototype.load = function() {
	this.values = {};
	if (!fs.existsSync(this.file)) { return 0; }
	var data = fs.readFileSync(this.file, "utf8");
	if (!data) { return 0; }
	this.values = JSON.parse(data);
};

Config.prototype.save = function() {
	var success = fs.writeFileSync(
		this.file, 
		JSON.stringify(this.values, null, " "), 
		"utf8"
	);
	return success ? 1 : 0;
};

Config.prototype.get = function(key, defaultValue) {
	var v = this.values[key];
	return v === undefined ? defaultValue : v;
};

Config.prototype.set = function(key, value) {
	this.values[key] = value;
	if (this.autoSave) { this.save(); }
};

Config.prototype.setIfEmpty = function(key, value) {
	var v = this.values[key];
	if (v !== undefined && v !== null && v !== '') return;
	this.set(key, value);
};

exports.new = function(file, autoSave) { 
	return new Config(file, autoSave); 
};
