/**
 * Interactive prompt: create panel at the bottom of the editor
 * and provies basic features for performing interactive editor actions
 */
define(function(require, exports, module) {
	var panelHtml = require('text!ui/panel.html');

	var PanelManager      = brackets.getModule('view/PanelManager');
	var ExtensionUtils    = brackets.getModule('utils/ExtensionUtils');
	var AppInit           = brackets.getModule('utils/AppInit');

	var ENTER_KEY = 13;
	var ESC_KEY = 27;
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

	AppInit.appReady(function() {
		panel = PanelManager.createBottomPanel('io.emmet.interactive-prompt', $panel);

		// register keyboard handlers
		$panel.find('.emmet-prompt__input')
			.on('keyup', function(evt) {
				if (evt.keyCode === ENTER_KEY) {
					$panel.triggerHandler('confirm.emmet', [this.value]);
					hidePanel();
					return evt.preventDefault();
				}

				if (evt.keyCode === ESC_KEY) {
					$panel.triggerHandler('cancel.emmet');
					hidePanel();
					return evt.preventDefault();
				}
			})
			.on('input', function() {
				$panel.triggerHandler('update.emmet', [this.value]);
			});
		
	});

	return {
		show: function(delegate) {
			delegate = delegate || {};

			this.hide();

			var label = $panel.find('.emmet-prompt__label');
			label.text(delegate.label || label.data('default'));

			var input = $panel.find('.emmet-prompt__input');
			if (delegate.placeholder) {
				input.val(delegate.placeholder);
			}

			var update = method(delegate, 'update');
			var updated = false;
			
			panel.show();

			$panel
				.on('update.emmet', function(evt, value) {
					updated = true;
					delegate.editor.undo();
					delegate.editor.document.batchOperation(function() {
						update(value);
					});
				})
				.on('confirm.emmet', function(evt, value) {
					method(delegate, 'confirm')();
					delegate.editor.focus();
				})
				.on('cancel.emmet', function(evt) {
					if (updated) {
						delegate.editor.undo();
					}
					method(delegate, 'cancel')();
					delegate.editor.focus();
				});

			input.focus();

			method(delegate, 'show')();

			if (input.val()) {
				update(input.val());
				updated = true;
			}
		},

		hide: hidePanel
	};
});