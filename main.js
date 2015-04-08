define(function(require, exports, module) {
	var fs = require('./brackets-fs');
	var preferences = require('./preferences');
	var editor      = require('./editor');
	var path        = require('./path');
	var prompt      = require('./prompt');
	var interactive = require('./interactive');

	var emmet       = require('emmet/emmet');
	var resources   = require('emmet/assets/resources');
	var actions     = require('emmet/action/main');
	var keymap      = require('text!keymap.json');
	var snippets    = require('text!emmet/snippets.json');
	var ciu         = require('text!emmet/caniuse.json');

	var CommandManager    = brackets.getModule('command/CommandManager');
	var KeyBindingManager = brackets.getModule('command/KeyBindingManager');
	var Menus             = brackets.getModule('command/Menus');
	var EditorManager     = brackets.getModule('editor/EditorManager');
	var Dialogs           = brackets.getModule('widgets/Dialogs');
	var FileSystem        = brackets.getModule('filesystem/FileSystem');
	var ExtensionUtils    = brackets.getModule('utils/ExtensionUtils');
	var AppInit           = brackets.getModule('utils/AppInit');

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
				editor.exec(function() {
					runAction(action, df);
				});
				editor.applyBatchedSelections();
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
			// do not allow tab expander in JS/JSX since it breakes native
			// snippets and indentation. Hardcode this exception for now
			if (syntax === 'jsx' || !preferences.getPreference('tab') || !resources.hasSyntax(syntax)) {
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

		if (action == 'insert_formatted_line_break') {
			var activeEditor = editor.editor;
			var allowAction = !activeEditor.hasSelection() && ~lineBreakSyntaxes.indexOf(editor.getSyntax());
			if (!allowAction) {
				// handle Enter key for limited syntaxes only
				return df.reject();
			}
		}

		return emmet.run(action, editor);
	}

	function loadExtensions(callback) {
		var extPath = preferences.getPreference('extPath');
		if (extPath) {
			var dir;
			try {
				dir = FileSystem.getDirectoryForPath(extPath);
			} catch (e) {
				console.error('Error while loading extensions:', e);
				callback();
			}
			dir.exists(function(err, exists) {
				if (exists) {
					emmet.resetUserData();
					dir.getContents(function(err, files) {
						if (err) {
							return callback(err);
						}

						files = files.filter(function(entry) {
							return !entry.isDirectory;
						});

						var complete = function() {
							emmet.loadExtensions(files);
							callback();
						};

						var waitForKeymap = false;

						// if extensions path contains keymap file —
						// use it as current Emmet keymap
						files = files.map(function(file) {
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

	/**
	 * Register special, interactive versions of some Emmet actions
	 */
	function registerInteractiveCommands(menu) {
		actions.add('interactive_expand_abbreviation', function() {}, 'Expand Abbreviation (interactive)');
		
		['wrap_with_abbreviation', 'update_tag', 'interactive_expand_abbreviation'].forEach(function(cmd) {
			var action = actions.get(cmd);
			CommandManager.register(actionLabel(action, cmd), 'io.emmet.' + cmd, function() {
				editor.setup(EditorManager.getFocusedEditor());
				interactive.run(cmd, editor);
			});
		});

	}

	function actionLabel(action, fallback) {
		if (action && action.options.label) {
			return action.options.label.split('/').pop().replace(/\\/g, '/');
		}

		return fallback.replace(/^[a-z]|_([a-z])/g, function(str, ch) {
			return str.toUpperCase().replace('_', ' ');
		});
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

		var menu = Menus.addMenu('Emmet', 'io.emmet.EmmetMainMenu');
		registerInteractiveCommands(menu);

		// register all commands
		actions.getList().forEach(function(action) {
			if (~skippedActions.indexOf(action.name)) {
				return;
			}

			var id = 'io.emmet.' + action.name;
			
			if (!CommandManager.get(id)) {
				// regiester new command only if wasn’t defined previously
				var cmd = ~singleSelectionActions.indexOf(action.name) 
					? actionDecorator(action.name)
					: multiSelectionActionDecorator(action.name);

				CommandManager.register(actionLabel(action), id, cmd);
			}

			var shortcut = keymap[action.name];
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
		cmdEnable.on('checkedStateChange', function() {
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

	AppInit.appReady(function() {
		ExtensionUtils.loadStyleSheet(module, 'ui/style.css');
		loadExtensions(init);
	});
});