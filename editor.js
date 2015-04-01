/**
 * Emmet Editor interface implementation for Brackets.
 * Interface is optimized for multiple cursor usage: authors
 * should run acttion multiple times and update `_selection.index`
 * property on each iteration.
 */
define(function(require, exports, module) {
	var emmet = require('emmet/emmet');
	var utils = require('emmet/utils/common');
	var editorUtils = require('emmet/utils/editor');
	var actionUtils = require('emmet/utils/action');
	var tabStops = require('emmet/assets/tabStops');
	
	var Editor = brackets.getModule('editor/Editor').Editor;

	/**
	 * Normalizes text before it goes to editor: replaces indentation
	 * and newlines with ones used in editor
	 * @param  {String} text   Text to normalize
	 * @param  {Editor} editor Brackets editor instance
	 * @return {String}
	 */
	function normalize(text) {
		var indentation = '\t';
		if (!Editor.getUseTabChar()) {
			indentation = '';
			var units = Editor.getSpaceUnits();
			while (units--) {
				indentation += ' ';
			}
		}

		return editorUtils.normalize(text, {
			indentation: indentation,
			newline: '\n'
		});
	}

	function visualize(str) {
		return str
			.replace(/\t/g, '\\t')
			.replace(/\n/g, '\\n')
			.replace(/\s/g, '\\s');
	}

	return {
		editor: null,
		modeMap: {
			'text/html': 'html',
			'application/xml': 'xml',
			'text/xsl': 'xsl',
			'text/css': 'css',
			'text/x-less': 'less',
			'text/x-scss': 'scss',
			'text/x-sass': 'sass',
			'javascript': 'jsx',
			'text/javascript': 'jsx'
		},

		setup: function(editor, singleSelectionMode) {
			this.editor = editor;
			var bufRanges = editor.getSelections();
			this._selection = {
				index: 0,
				saved: new Array(bufRanges),
				bufferRanges: bufRanges,
				indexRanges: bufRanges.map(function(r) {
					return {
						start: editor.indexFromPos(r.start),
						end:   editor.indexFromPos(r.end)
					};
				}),
				batch: []
			};

			if (singleSelectionMode) {
				this._selection.index = bufRanges.length - 1;
			}
		},

		/**
		 * Executes given function for every selection
		 * @param  {Function} fn
		 */
		exec: function(fn, skipSelSet) {
			var sel = this._selection;
			var ix = sel.bufferRanges.length - 1;
			var success = true;
			sel.saved = [];
			while (ix >= 0) {
				sel.index = ix;
				if (fn(ix, sel.indexRanges[ix], sel.bufferRanges[ix]) === false) {
					success = false;
					break;
				}
				ix--;
			}

			if (!skipSelSet && success && sel.saved.length > 1) {
				this.editor.setSelections(sel.saved);
			}
		},

		_saveSelection: function(delta) {
			var sel = this._selection;
			sel.saved[sel.index] = this.editor.getSelection();
			if (delta) {
				var i = sel.index, r;
				while (++i < sel.saved.length) {
					r = sel.saved[i];
					r.start.line += delta;
					r.end.line += delta;
				}
			}
		},

		_convertRange: function(sel) {
			return {
				start: this.editor.indexFromPos(sel.start),
				end: this.editor.indexFromPos(sel.end)
			};
		},

		_posFromIndex: function(index) {
			// XXX: shouldn’t use private editor._codeMirror here,
			// Brackets must provide `posFromIndex()` method alias
			return this.editor._codeMirror.posFromIndex(index);
		},

		/**
		 * Returns list of selections for current CodeMirror instance. 
		 * @return {Array}
		 */
		selectionList: function() {
			return this._selection.indexRanges;
		},

		getCaretPos: function() {
			return this.getSelectionRange().start;
		},

		setCaretPos: function(pos) {
			this.createSelection(pos);
		},

		/**
		 * Returns current selection range (for current selection index)
		 * @return {Object}
		 */
		getSelectionRange: function() {
			var sel = this._selection;
			return sel.indexRanges[sel.index];
		},

		getSelectionBufferRange: function() {
			var sel = this._selection;
			return sel.bufferRanges[sel.index];
		},

		createSelection: function(start, end) {
			end = end || start;


			start = this._posFromIndex(start);
			end = this._posFromIndex(end);
			this.editor.setSelection(start, end);
			this._selection.batch.unshift({start: start, end: end});

			// var sels = this._selection.bufferRanges;
			// sels[this._selection.index] = {
			// 	start: this._posFromIndex(start), 
			// 	end: this._posFromIndex(end)
			// };
			// this.editor.setSelections(sels);
		},

		applyBatchedSelections: function() {
			if (this._selection.batch.length) {
				this.editor.setSelections(this._selection.batch);
			}
		},

		/**
		 * Returns current selection
		 * @return {String}
		 */
		getSelection: function() {
			var sel = this.getSelectionBufferRange();
			return this.editor.document.getRange(sel.start, sel.end);
		},

		_currentLineRange: function() {
			var sel = this.getSelectionBufferRange();
			return this.editor.convertToLineSelections([sel])[0].selectionForEdit;
		},

		getCurrentLineRange: function() {
			return this._convertRange(this._currentLineRange());
		},

		getCurrentLine: function() {
			var lineRange = this._currentLineRange();
			return this.editor.document.getRange(lineRange.start, lineRange.end);
		},

		getContent: function() {
			return this.editor.document.getText();
		},

		replaceContent: function(value, start, end, noIndent) {
			if (typeof end == 'undefined') {
				end = (typeof start == 'undefined') ? this.getContent().length : start;
			}
			if (typeof start == 'undefined') {
				start = 0;
			}

			value = normalize(value);
			
			// indent new value
			if (!noIndent) {
				var pad = utils.getLinePaddingFromPosition(this.getContent(), start);
				value = utils.padString(value, pad);
			}
			
			// find new caret position
			var tabstopData = tabStops.extract(value, {
				escape: function(ch) {
					return ch;
				}
			});
			value = tabstopData.text;

			var firstTabStop = tabstopData.tabstops[0] || {start: value.length, end: value.length};
			firstTabStop.start += start;
			firstTabStop.end += start;

			var doc = this.editor.document;
			start = this._posFromIndex(start);
			end = this._posFromIndex(end);

			var oldValue = doc.getRange(start, end);

			doc.replaceRange(value, start, end);
			this.createSelection(firstTabStop.start, firstTabStop.end);
			this._saveSelection(utils.splitByLines(value).length - utils.splitByLines(oldValue).length);
			return value;
		},

		getSyntax: function() {
			var sel = this.getSelectionBufferRange();
			var mode = this.editor.getModeForRange(sel.start, sel.end).name;
			if (!mode) {
				mode = this.editor.getModeForDocument();
			}
			return this.modeMap[mode] || mode;
		},

		/**
		 * Returns current output profile name (@see emmet#setupProfile)
		 * @return {String}
		 */
		getProfileName: function() {
			return actionUtils.detectProfile(this);
		},

		/**
		 * Ask user to enter something
		 * @param {String} title Dialog title
		 * @return {String} Entered data
		 */
		prompt: function(title) {
			return prompt(title);
		},

		/**
		 * Returns current editor's file path
		 * @return {String}
		 */
		getFilePath: function() {
			if (this.editor.document.isUntitled()) {
				return null;
			}

			return this.editor.document.file.fullPath;
		}
	};
});