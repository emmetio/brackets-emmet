define(['emmet'], function(emmet) {

	var FileUtils = brackets.getModule('file/FileUtils');

	function isURL(path) {
		var re = /^https?:\/\//;
		return re.test(path);
	}

	function startsWith(str, chars) {
		return str.indexOf(chars) === 0;
	}

	function getFileName(path) {
		var re = /([\w\.\-]+)$/i;
		var m = re.exec(path);
		return m ? m[1] : '';
	}

	function getBasePath(path) {
		return path.substring(0, path.length - getFileName(path).length);
	}

	return {
		_parseParams: function(args) {
			var params = {
				path: args[0],
				size: 0
			};

			args = _.rest(args);
			params.callback = _.last(args);
			args = _.initial(args);
			if (args.length) {
				params.size = args[0];
			}

			return params;
		},

		/**
		 * Read file content and return it
		 * @param {String} path File's relative or absolute path
		 * @return {String}
		 */
		read: function(path, size, callback) {
			// TODO binary reading is not implemented yet
			return this.readText.apply(this, arguments);
		},

		/**
		 * Read file content and return it
		 * @param {String} path File's relative or absolute path
		 * @return {String}
		 */
		readText: function(path, size, callback) {
			var params = this._parseParams(arguments);
			brackets.fs.readFile(params.path, 'utf8', function(err, content) {
				params.callback(err, content);
			});
		},
		
		/**
		 * Locate <code>file_name</code> file that relates to <code>editor_file</code>.
		 * File name may be absolute or relative path
		 * 
		 * <b>Dealing with absolute path.</b>
		 * Many modern editors have a "project" support as information unit, but you
		 * should not rely on project path to find file with absolute path. First,
		 * it requires user to create a project before using this method (and this 
		 * is not very convenient). Second, project path doesn't always points to
		 * to website's document root folder: it may point, for example, to an 
		 * upper folder which contains server-side scripts.
		 * 
		 * For better result, you should use the following algorithm in locating
		 * absolute resources:
		 * 1) Get parent folder for <code>editorFile</code> as a start point
		 * 2) Append required <code>fileName</code> to start point and test if
		 * file exists
		 * 3) If it doesn't exists, move start point one level up (to parent folder)
		 * and repeat step 2.
		 * 
		 * @param {String} editorFile
		 * @param {String} fileName
		 * @return {String} Returns null if <code>fileName</code> cannot be located
		 */
		locateFile: function(editorFile, fileName) {
			// TODO implement
		},
		
		/**
		 * Creates absolute path by concatenating <code>parent</code> and <code>fileName</code>.
		 * If <code>parent</code> points to file, its parent directory is used
		 * @param {String} parent
		 * @param {String} fileName
		 * @return {String}
		 */
		createPath: function(parent, fileName, callback) {
			// TODO implement
		},
		
		/**
		 * Saves <code>content</code> as <code>file</code>
		 * @param {String} file File's absolute path
		 * @param {String} content File content
		 */
		save: function(file, content) {
			brackets.fs.writeFile(file, content);
		},
		
		/**
		 * Returns file extension in lower case
		 * @param {String} file
		 * @return {String}
		 */
		getExt: function(file) {
			var m = (file || '').match(/\.([\w\-]+)$/);
			return m ? m[1].toLowerCase() : '';
		}
	}
});