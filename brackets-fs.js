define(function(require, exports, module) {
	var path = require('./path');
	var emmetFile = require('emmet/plugin/file');
	var FileSystem = brackets.getModule('filesystem/FileSystem');

	emmetFile({
		read: function(file, callback) {
			var fd = FileSystem.getFileForPath(file);
			if (!fd) {
				return callback('File "' + path + '" does not exists.');
			}

			fd.read({encoding: 'utf8'}, callback);
		},

		readText: function(file, callback) {
			return this.read(file, callback);
		},

		locateFile: function(editorFile, fileName) {
			var dirname = editorFile, f;
			fileName = fileName.replace(/^\/+/, '');
			while (dirname && dirname !== path.dirname(dirname)) {
				dirname = path.dirname(dirname);
				f = path.join(dirname, fileName);
				if (FileSystem.getFileForPath(f)) {
					return f;
				}
			}
			
			return '';
		},

		createPath: function(parent, fileName, callback) {
			FileSystem.getFileForPath(parent).exists(function(err, exists) {
				if (exists) {
					parent = path.dirname(parent);
				}
				
				return callback(path.resolve(parent, fileName));
			});
		},

		save: function(file, content) {
			FileSystem.getFileForPath(file).write(content, {encoding: 'ascii'});
		}
	});

	return emmetFile;
});