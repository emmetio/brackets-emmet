/**
 * Definition of interactive functions: the function
 * that require additional dialog prompt and update
 * editor content when user types data in prompt
 */
define(function(require, exports, module) {
	var utils       = require('emmet/utils/common');
	var editorUtils = require('emmet/utils/editor');
	var actionUtils = require('emmet/utils/action');

	var range       = require('emmet/assets/range');
	var htmlMatcher = require('emmet/assets/htmlMatcher');
	var parser      = require('emmet/parser/abbreviation');
	var updateTag   = require('emmet/action/updateTag');

	var prompt = require('./prompt');

	/**
	 * Caches wrapping context for current selection in editor
	 * @param  {IEmmetEditor} editor 
	 * @param  {Object} info Current editor info (content, syntax, etc.) 
	 * @return {Object}
	 */
	function selectionContext(editor, info) {
		info = info || editorUtils.outputInfo(editor);
		var result = [];
		editor.exec(function(i, sel) {
			var r = range(sel);
			var tag = htmlMatcher.tag(info.content, r.start);
			if (!r.length() && tag) {
				// no selection, use tag pair
				r = utils.narrowToNonSpace(info.content, tag.range);
			}

			var out = {
				selection: r,
				tag: tag,
				caret: r.start,
				syntax: info.syntax,
				profile: info.profile || null,
				counter: i + 1,
				contextNode: actionUtils.captureContext(editor, r.start)
			};

			if (r.length()) {
				var pasted = utils.escapeText(r.substring(info.content));
				out.pastedContent = editorUtils.unindent(editor, pasted);
			}

			result[i] = out;
		}, true);

		return result;
	}

	function updateFinalCarets(selCtx, fromIndex, delta) {
		if (!delta) {
			return;
		}

		for (var i = fromIndex + 1, il = selCtx.length; i < il; i++) {
			selCtx[i].finalCaret.line += delta;
		}
	}

	/**
	 * Returns current caret position for given editor
	 * @param  {Editor} editor Brackets editor instance
	 * @return {Point}        Character position in editor
	 */
	function getCaret(editor) {
		// make sure we’re taking first caret
		return editor.getSelections()[0].start;
	}

	function lineDelta(prev, cur) {
		return utils.splitByLines(cur).length - utils.splitByLines(prev).length;
	}

	function setFinalCarets(selCtx, editor) {
		if (selCtx && selCtx.length > 1) {
			editor.setSelections(selCtx.map(function(ctx) {
				return {
					start: ctx.finalCaret,
					end: ctx.finalCaret
				};
			}));
		}
	}

	return {
		run: function(cmd, editor) {
			if (cmd === 'wrap_with_abbreviation') {
				return this.wrapWithAbbreviation(editor);
			}

			if (cmd === 'update_tag') {
				return this.updateTag(editor);
			}

			if (cmd === 'interactive_expand_abbreviation') {
				return this.expandAbbreviation(editor);
			}
		},

		expandAbbreviation: function(editor) {
			var info = editorUtils.outputInfo(editor);
			var selCtx = [];
			editor.exec(function(i, sel) {
				var r = range(sel);
				selCtx[i] = {
					selection: r,
					caret: r.start,
					syntax: info.syntax,
					profile: info.profile || null,
					counter: i + 1,
					contextNode: actionUtils.captureContext(editor, r.start)
				};
			});

			return this.wrapWithAbbreviation(editor, selCtx);
		},

		wrapWithAbbreviation: function(editor, selCtx) {
			selCtx = selCtx || selectionContext(editor);

			// show prompt dialog that will wrap each selection
			// on user typing
			prompt.show({
				label: 'Enter Abbreviation',
				editor: editor.editor,
				update: function(abbr) {
					var result, replaced;
					for (var i = selCtx.length - 1, ctx; i >= 0; i--) {
						ctx = selCtx[i];
						result = '';
						try {
							if (abbr) {
								result = parser.expand(abbr, ctx);
							} else {
								result = ctx.pastedContent;
							}
						} catch (e) {
							console.error(e);
							result = ctx.pastedContent;
						}

						editor._selection.index = i;
						replaced = editor.replaceContent(result, ctx.selection.start, ctx.selection.end);
						ctx.finalCaret = getCaret(editor.editor);
						updateFinalCarets(selCtx, i, lineDelta(ctx.pastedContent, replaced));
					}
				},
				confirm: function() {
					setFinalCarets(selCtx, editor.editor);
				}
			});
		},

		updateTag: function(editor) {
			var info = editorUtils.outputInfo(editor);
			var selCtx = selectionContext(editor, info);

			// show prompt dialog that will update each
			// tag from selection
			prompt.show({
				label: 'Enter Abbreviation',
				editor: editor.editor,
				update: function(abbr) {
					abbr = abbr.trim();
					var tag, replaced;
					var didUpdate = false;
					for (var i = selCtx.length - 1, ctx; i >= 0; i--) {
						ctx = selCtx[i];
						tag = null;

						if (abbr) {
							try {
								tag = updateTag.getUpdatedTag(abbr, {match: ctx.tag}, info.content, {
									counter: ctx.counter
								});
							} catch (e) {
								console.error(e);
							}
						}

						if (!tag) {
							continue;
						}

						replaced = [{
							start: ctx.tag.open.range.start, 
							end: ctx.tag.open.range.end,
							content: tag.source
						}];

						if (tag.name() != ctx.tag.name && ctx.tag.close) {
							replaced.unshift({
								start: ctx.tag.close.range.start, 
								end: ctx.tag.close.range.end,
								content: '</' + tag.name() + '>'
							});
						}

						replaced.forEach(function(data) {
							didUpdate = true;
							editor.replaceContent(data.content, data.start, data.end);
							ctx.finalCaret = editor._posFromIndex(data.start);
						});
					}

					return didUpdate;
				},
				confirm: function() {
					setFinalCarets(selCtx, editor.editor);
				}
			});
		}
	};
});