# [Emmet](http://emmet.io) plugin for [Brackets](http://brackets.io) editor #

[![Get Support](http://codersclan.net/graphics/getSupport_github4.png)](http://codersclan.net/support/step1.php?repo_id=4)

Emmet is a web-developer’s toolkit that can greatly improve your HTML & CSS workflow: http://docs.emmet.io

## Installation ##

1. Run Brackets.
2. Select _File > Extension Manager..._
3. Find “Emmet” extension and click “Install” button

### Manual instalation

1. Clone this repo into `~/Library/Application Support/Brackets/extensions/user/`.
2. In Terminal, go to cloned repo: `cd ~/Library/Application Support/Brackets/extensions/user/brackets-emmet`.
3. Run `npm install` to install all plugin dependencies.
4. Restart Brackets

----------------

After the extension installation is completed, you should see _Emmet_ menu item with all available actions.

## Default keybindings ##

All available keybindings are defined in `keymap.json`. 

To redefine them, simply update `keymap.json` action values with new keybindings (see [CodeMirror Manual](http://codemirror.net/doc/manual.html#keymaps) for key reference).

## [Extensions support](http://docs.emmet.io/customization/)

Emmet for Brackets supports extensions: you should open `Emmet > Preferences…` dialog and enter absolute path to extentions folder. Unfortunately, Brackets doesn’t support folder picking dialog so you have to type it manually.
