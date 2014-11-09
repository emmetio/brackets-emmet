/**
 * Interactive prompt: create panel at the bottom of the editor
 * and provies basic features for performing interactive editor actions
 */
define(function(require, exports, module) {
	var panelHtml = require('text!ui/panel.html');

	var ExtensionUtils   = brackets.getModule('utils/ExtensionUtils');
	var AppInit          = brackets.getModule('utils/AppInit');
	var KeyEvent         = brackets.getModule('utils/KeyEvent');
	var EditorManager    = brackets.getModule('editor/EditorManager');
    var WorkspaceManager = brackets.getModule('view/WorkspaceManager');

	var $panel = $(panelHtml);
	var panel = null;

	function hidePanel() {
		$panel.off('.emmet');
		panel.hide();
	}

	function noop() {}

	function method(delegate, method) {
		if (delegate && delegate[method]) {
			return delegate[method].bind(delegate);
		}

		return noop;
	}

	function preparePanel($panel, delegate) {
		var label = $panel.find('.emmet-prompt__label');
		label.text(delegate.label || label.data('default'));

		var input = $panel.find('.emmet-prompt__input');
		if (delegate.placeholder) {
			input.val(delegate.placeholder);
		}

		if (!EditorManager.getFocusedEditor()) {
			EditorManager.focusEditor();
		}

		return {
			label: label,
			input: input
		};
	}

	AppInit.appReady(function() {
		panel = WorkspaceManager.createBottomPanel('io.emmet.interactive-prompt', $panel);

		// register keyboard handlers
		$panel.find('.emmet-prompt__input')
			.on('keyup', function(evt) {
				if (evt.keyCode === KeyEvent.DOM_VK_TAB) {
					// do not accidentally loose focus from input panel
					evt.stopPropagation();
					return evt.preventDefault();
				}

				if (evt.keyCode === KeyEvent.DOM_VK_RETURN || evt.keyCode === KeyEvent.DOM_VK_ENTER) {
					$panel.triggerHandler('confirm.emmet', [this.value]);
					hidePanel();
					return evt.preventDefault();
				}

				if (evt.keyCode === KeyEvent.DOM_VK_ESCAPE) {
					$panel.triggerHandler('cancel.emmet');
					hidePanel();
					return evt.preventDefault();
				}
			})
			.on('blur cancel', function() {
				setTimeout(function() {
					if (panel.isVisible()) {
						$panel.triggerHandler('cancel.emmet');
						hidePanel();
					}
				}, 10);
			})
			.on('input', function() {
				$panel.triggerHandler('update.emmet', [this.value]);
			});
	});

	return {
		show: function(delegate) {
			delegate = delegate || {};

			this.hide();
			var panelElems = preparePanel($panel, delegate);
			var update = method(delegate, 'update');
			var updated = false;
			var cm = delegate.editor._codeMirror;
			var undoToken = cm.changeGeneration();
			var undo = function() {
				if (updated && undoToken < cm.changeGeneration()) {
					delegate.editor.undo();
				}
			};

			panel.show();
			$panel
				.on('update.emmet', function(evt, value) {
					undo();
					updated = true;
					delegate.editor.document.batchOperation(function() {
						updated = (update(value) !== false);
					});
				})
				.on('confirm.emmet', function(evt, value) {
					method(delegate, 'confirm')();
					delegate.editor.focus();
				})
				.on('cancel.emmet', function(evt) {
					undo();
					method(delegate, 'cancel')();
					delegate.editor.focus();
				});

			panelElems.input.focus();
			method(delegate, 'show')();
			if (panelElems.input.val()) {
				var defaultValue = panelElems.input.val();
				panelElems.input[0].setSelectionRange(0, defaultValue.length);
				$panel.triggerHandler('update.emmet', [defaultValue]);
			}
		},

		hide: hidePanel
	};
});
