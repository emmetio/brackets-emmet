define(['./path', 'filesystem/FileSystem', 'emmet/plugin/file'], function(path, fs, emmetFile) {
	emmetFile({
		_exists: function(file) {
			
		},
		read: function(file, size, callback) {
			var fd = fs.getFileForPath(file);
			if (!fd) {
				return callback('File "' + path + '" does not exists.');
			}

			fd.read({encoding: 'utf8'}, callback);
		},

		readText: function(file, size, callback) {
			return this.read(file, size, callback);
		},

		locateFile: function(editorFile, fileName) {
			var dirname = editorFile, f;
			fileName = fileName.replace(/^\/+/, '');
			while (dirname && dirname !== path.dirname(dirname)) {
				dirname = path.dirname(dirname);
				f = path.join(dirname, fileName);
				if (fs.getFileForPath(f)) {
					return f;
				}
			}
			
			return '';
		},

		createPath: function(parent, fileName, callback) {
			fs.getFileForPath(parent).exists(function(err, exists) {
				if (exists) {
					parent = path.dirname(parent);
				}
				
				return callback(path.resolve(parent, fileName));
			});
		},

		save: function(file, content) {
			fs.getFileForPath(file).write(content, {encoding: 'ascii'});
		}
	});

	return emmetFile;
});