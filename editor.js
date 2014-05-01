/**
 * Emmet Editor interface implementation for Brackets.
 * Interface is optimized for multiple cursor usage: authors
 * should run acttion multiple times and update `selectionIndex`
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
	function normalize(text, editor) {
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

	return {
		editor: null,
		selectionIndex: 0,
		modeMap: {
			'text/html': 'html',
			'application/xml': 'xml',
			'text/xsl': 'xsl',
			'text/css': 'css',
			'text/x-less': 'less',
			'text/x-scss': 'scss',
			'text/x-sass': 'sass'
		},

		setup: function(editor, selIndex) {
			this.editor = editor;
			this.selectionIndex = selIndex || 0;
		},

		_convertRange: function(sel) {
			return {
				start: this.editor.indexFromPos(sel.start),
				end: this.editor.indexFromPos(sel.end)
			};
		},

		_currentLineRange: function() {
			var sel = this.editor.getSelections()[this.selectionIndex];
			return this.editor.convertToLineSelections([sel])[0].selectionForEdit;
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
			return this.editor.getSelections().map(this._convertRange, this);
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
			return this.selectionList()[this.selectionIndex];
		},

		createSelection: function(start, end) {
			end = end || start;

			var sels = this.editor.getSelections();
			sels[this.selectionIndex] = {
				start: this._posFromIndex(start), 
				end: this._posFromIndex(end)
			};
			this.editor.setSelections(sels);
		},

		/**
		 * Returns current selection
		 * @return {String}
		 */
		getSelection: function() {
			var sel = this.editor.getSelections()[this.selectionIndex];
			return this.editor.document.getRange(sel.start, sel.end);
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
			
			// indent new value
			if (!noIndent) {
				value = utils.padString(value, utils.getLinePaddingFromPosition(this.getContent(), start));
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

			this.editor.document.replaceRange(value, this._posFromIndex(start), this._posFromIndex(end));
			this.createSelection(firstTabStop.start, firstTabStop.end);
			return value;
		},

		getSyntax: function() {
			var sel = this.editor.getSelections()[this.selectionIndex];
			var mode = this.editor.getModeForRange(sel.start, sel.end).name;
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