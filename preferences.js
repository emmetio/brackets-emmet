define(function (require, exports, module) {
	"use strict";
	
	var Dialogs                = brackets.getModule("widgets/Dialogs"),
		PreferencesManager     = brackets.getModule("preferences/PreferencesManager"),
		ProjectManager         = brackets.getModule("project/ProjectManager"),
		Strings                = brackets.getModule("strings"),
		PrefsTemplate          = require("text!ui/preferences.html");


	var preferenceKeyId = 'io.emmet.preferences';

	var defaultPreferences = {
		tab: true,
		extPath: ''
	};

	function getStorage() {
		var userData = localStorage.getItem(preferenceKeyId);
		return userData ? JSON.parse(userData) : $.extend({}, defaultPreferences);
	}

	function saveStorage(storage) {
		localStorage.setItem(preferenceKeyId, JSON.stringify(storage));
	}

	function setPreference(name, value) {
		var storage = getStorage();
		if (typeof name == 'object') {
			for (var p in name) if (name.hasOwnProperty(p)) {
				storage[p] = name[p];
			}
		} else {
			storage[name] = value;
		}
		saveStorage(storage);
	}

	function getPreference(name) {
		return getStorage()[name];
	}

	function showEmmetPreferencesDialog(baseUrl, errorMessage) {
		var dlg, tabFld, extPathFld;

		var promise = Dialogs.showModalDialogUsingTemplate(Mustache.render(PrefsTemplate, Strings))
			.done(function (id) {
				if (id === Dialogs.DIALOG_BTN_OK) {
					setPreference({
						tab: !!tabFld[0].checked,
						extPath: extPathFld.val()
					});
				}
			});

		
		dlg = $(".emmet-settings-dialog.instance");
		tabFld = dlg.find('#emmet-tab-fld');
		extPathFld = dlg.find('#emmet-ext-path-fld');

		tabFld[0].checked = !!getPreference('tab');
		extPathFld.val(getPreference('extPath'));

		tabFld.focus();

		return promise;
	}

	exports.showPreferencesDialog = showEmmetPreferencesDialog;
	exports.getPreference         = getPreference;
	exports.setPreference         = setPreference;
});