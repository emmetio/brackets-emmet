define(function(require, exports, module) {
	var fs = require('./brackets-fs');
	var preferences = require('./preferences');
	var editor = require('./editor');
	var path = require('./path');

	var emmet     = require('emmet/emmet');
	var resources = require('emmet/assets/resources');
	var actions   = require('emmet/action/main');
	var keymap    = require('text!keymap.json');
	var snippets  = require('text!emmet/snippets.json');
	var ciu       = require('text!emmet/caniuse.json');

	var CommandManager    = brackets.getModule('command/CommandManager');
	var KeyBindingManager = brackets.getModule('command/KeyBindingManager');
	var Menus             = brackets.getModule('command/Menus');
	var EditorManager     = brackets.getModule('editor/EditorManager');
	var Dialogs           = brackets.getModule('widgets/Dialogs');
	var FileSystem        = brackets.getModule('filesystem/FileSystem');

	var skippedActions = ['update_image_size', 'encode_decode_data_url'];
	// actions that should be performed in single selection mode
	var singleSelectionActions = [
		'prev_edit_point', 'next_edit_point', 'merge_lines',
		'reflect_css_value', 'select_next_item', 'select_previous_item',
		'wrap_with_abbreviation', 'update_tag', 'insert_formatted_line_break_only'
	];
	var isEnabled = true;
	var lineBreakSyntaxes = ['html', 'xml', 'xsl'];

	/**
	 * Emmet action decorator: creates a command function
	 * for CodeMirror and executes Emmet action as single
	 * undo command
	 * @param  {Object} action Action to perform
	 * @return {Function}
	 */
	function actionDecorator(action) {
		return function() {
			var df = new $.Deferred();
			var bracketsEditor = EditorManager.getFocusedEditor();
			if (!bracketsEditor) {
				return df.reject();
			}

			editor.setup(bracketsEditor);
			bracketsEditor.document.batchOperation(function() {
				runAction(action, df);
			});

			return df.resolve().promise();
		};
	}

	/**
	 * Same as `actionDecorator()` but executes action
	 * with multiple selections
	 * @param  {Object} action Action to perform
	 * @return {Function}
	 */
	function multiSelectionActionDecorator(action) {
		return function() {
			var df = new $.Deferred();
			var bracketsEditor = EditorManager.getFocusedEditor();
			if (!bracketsEditor) {
				return df.reject();
			}

			editor.setup(bracketsEditor);
			bracketsEditor.document.batchOperation(function() {
				var selections = editor.selectionList();
				for (var i = 0, il = selections.length; i < il; i++) {
					editor.selectionIndex = i;
					runAction(action, df);
				}
			});
			return df.resolve().promise();
		};
	}


	function runAction(action, df) {
		if (!isEnabled) {
			return df.reject().promise();
		}

		// do not handle Tab key for unknown syntaxes
		if (action == 'expand_abbreviation_with_tab') {
			var syntax = editor.getSyntax();
			var activeEditor = editor.editor;
			if (!preferences.getPreference('tab') || !resources.hasSyntax(syntax)) {
				return df.reject();
			}

			// do not expand abbreviation if there’s a selection
			if (activeEditor.hasSelection()) {
				if (activeEditor._handleTabKey) {
					activeEditor._handleTabKey();
				}
				return df.resolve();
			}
		}

		if (action == 'insert_formatted_line_break' && lineBreakSyntaxes.indexOf(editor.getSyntax()) === -1) {
			// handle Enter key for limited syntaxes only
			return df.reject();
		}

		return emmet.run(action, editor);
	}

	function loadExtensions(callback) {
		var extPath = preferences.getPreference('extPath');
		if (extPath) {
			var dir = FileSystem.getDirectoryForPath(extPat);
			dir.exists(function(err, exists) {
				if (exists) {
					emmet.resetUserData();
					dir.getContents(function(err, files) {
						if (err) {
							return callback(err);
						}

						var complete = function() {
							emmet.loadExtensions(files);
							callback();
						};

						var waitForKeymap = false;

						// if extensions path contains keymap file —
						// use it as current Emmet keymap
						files.map(function(file) {
							if (path.basename(file.fullPath) == 'keymap.json') {
								waitForKeymap = true;
								file.read({encoding: 'utf8'}, function(content) {
									keymap = content;
									complete();
								});
							}

							return file.fullPath;
						});

						if (!waitForKeymap) {
							complete();
						}
					});
				}
			});
		} else {
			callback();
		}
	}

	function init() {
		try {
			if (typeof keymap == 'string') {
				keymap = JSON.parse(keymap);
			}
		} catch(e) {
			console.error(e);
		}

		emmet.loadSystemSnippets(snippets);
		emmet.loadCIU(ciu);

		// register all commands
		var menu = Menus.addMenu('Emmet', 'io.emmet.EmmetMainMenu');
		actions.getList().forEach(function(action) {
			if (~skippedActions.indexOf(action)) {
				return;
			}

			var id = 'io.emmet.' + action.name;
			var shortcut = keymap[action.name];
			var cmd = ~singleSelectionActions.indexOf(action.name) 
				? actionDecorator(action.name)
				: multiSelectionActionDecorator(action.name);

			CommandManager.register(action.options.label, id, cmd);

			if (!action.options.hidden) {
				menu.addMenuItem(id, shortcut);
			} else if (shortcut) {
				KeyBindingManager.addBinding(id, shortcut);
			}
		});

		menu.addMenuDivider();

		// Allow enable and disable Emmet
		var cmdEnable = CommandManager.register('Enable Emmet', 'io.emmet.enabled', function() {
			this.setChecked(!this.getChecked());
		});
		$(cmdEnable).on('checkedStateChange', function() {
			isEnabled = cmdEnable.getChecked();
		});
		menu.addMenuItem(cmdEnable);
		cmdEnable.setChecked(isEnabled);

		// Add Preferences
		var cmdPreferences = CommandManager.register('Preferences...', 'io.emmet.preferences', function() {
			preferences.showPreferencesDialog().done(function(id) {
				if (id === Dialogs.DIALOG_BTN_OK) {
					loadExtensions();
				}
			});
		});
		menu.addMenuItem(cmdPreferences);
	}

	loadExtensions(init);
});