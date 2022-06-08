# Todoist Sync Readme

# inkdrop-todoist-sync
![icon.png](https://github.com/manuelsteiner/inkdrop-todoist-sync/blob/ed57373e7991254b69f98ecb4e8e55b8d2be7601/assets/icon.png?raw=true)

Todoist Sync is an Inkdrop plugin that allows synchronising of Inkdrop notebooks and notes with Todoist projects, sections and tasks. The core features of the plugin include the following.

* Synchronising missing Inkdrop notebooks and notes as well as Todoist projects, sections and tasks
* Recursive synchronisation of Inkdrop notebooks and Todoist projects
* Selective synchronisation, import or export of the whole or a partial Inkdrop notebook tree
* Automatic recurring synchronisation
* Highly customasiable via settings

## Screenshot
![todoist-sync.png](https://github.com/manuelsteiner/inkdrop-todoist-sync/blob/249f9d4b25dd191f645895327e4dfb6c061df719/assets/todoist-sync.png?raw=true)
The screenshot shows the following UI features.

* Top: Native operating system notification for automatic synchronisation status (end).
* Botton right: Inkdrop notifications for the synchronisation status (start, end).
* Bottom left: Synchronisation status while a synchronisation is in progress (green -> end status).

## Important Note
Todoist Sync will only operate on data which is present at the synchronisation source and missing at the target. This means the only operations carried out are the creation of Inkdrop notebooks, notes and tags as well as Todoist projects, sections, tasks, comments and labels. Since Inkdrop and Todoist contain information that is potentially important and valuable to their users, Todoist Sync will **NEVER** delete or alter any existing data. The principle of how elements are synchronised is as follows.

* An Inkdrop notebook or Todoist project will be created if no corresponding element based on the name can be found at the same tree level with the same parent structure
* An Inkdrop note or Todoist task will be created if no corresponding element can be found with the same title/name (taking the parent hierachy into account, depending on the settings)
* A Todoist section will be created if no corresponding project can be found for a leaf notebook based on the name, depending on the settings.
* Inkdrop tags or Todoist labels will be created if no corresponding element with the same name can be found.

This approach makes sure that no user data is ever lost. It can however lead to unwanted elements, depending on the settings and how both applications are used. This however is a rather small price to pay compared to losing valuable Inkdrop notes or Todoist tasks. Unwanted elements can easily be deleted manually. An example of such created element can be described in the following scenario.

* The Inkdrop notebook `Todos` contains a note with the title `Fix the car`.
* The notebook is exported to Todoist. The Todoist project `Todos` now contains a task `Fix the car`.
* The Inkdrop note is updated with a new title `Fix the car window` to better reflect which part of the car is broken.
* The notebook is once again exported to Todoist.
* The project `Todos` in Todoist will now contain two tasks. The already existing `Fix the car` task as well as the newly exported `Fix the car window` task. This is because Todoist Sync can not find a matching task for the renamed note based on the title.

## Synchronisation sequence
Todoist Sync offers a setting to change the default synchronisation behaviour. The setting determins the synchronisation direction. The three possible options are as follows.

* `both`  
Todoist Sync first exports all elements present in Inkdrop but missing in Todoist. AFterwards, all elements present in Todoist but missing in Inkdrop will be imported.  
* `export`  
Todoist Sync will only export elements which are missing in Todoist.  
* `import`  
Todoist Sync will only import elements which are missing in Inkdrop.

If a synchronisation, export or import is carried out for a notebook that contains sub notebooks, the process works as follows.

* The selected Inkdrop notebook is synchronised, exported or a corresponding Todoist project is imported. If no corresponding Todoist project hierarchy is found up to the a Inkdrop root notebook, the missing Todoist projects will be created. In the case of an import, the hierarchy of Todoist projects must match the Inkdrop notebook hierarchy for the import process to be started.
* All Inkdrop notes that are direct children of the notebook are synchronised, exported or the corresponding direct children of the Todoist project are imported.
* Depending on the setting, sub tasks of the tasks that were just imported are also imported.
* The process is repated with all children notebooks of the selected notbook. The notebooks are handled recurisvely til all leaf notebooks were handled.
* Todoist project and task comments are attached as notes in a notebook or in a note body respectively if relevant settings are enabled.

When exporting selected notes, the Inkdrop notebook hierarchy to a root notebook must exist as corresponding Todoist project hierarchy in order for the export to be carried out.

## Commands
Todoist Sync exposes the following commands, which can be accesed via various menu items or bound to keyboard shortcuts.

* `todoist-sync:sync-all`  
Synchronises all available Inkdrop notebooks and notes as well as Todoist projects, sections and tasks based on the settings.
* `todoist-sync:sync-selected`  
Synchronises the currently selected Inkdrop notebook including sub notebooks recursively.
* `todoist-sync:import-all-projects`  
Imports all Todoist projects, sections and tasks.
* `todoist-sync:import-selected-projects`  
Imports all Todoist projects starting from a project matching the selected Inkdrop notebook hierarchy. The import includes sub-projects.
* `todoist-sync:export-all-books`  
Exports all Inkdrop notebooks including sub notebooks recursively.
* `todoist-sync:export-selected-books`  
Exports a selected Inkdrop notebook including sub notebooks recursively.
* `todoist-sync:export-selected-notes`  
Exports selected Inkdrop notes to a corresponding Todoist project, depending on the settings.

## Menu Items
The following menu items are available when Todoist Sync is activated.

* `Application Menu` -> `Plugins` -> `Todoist Sync` -> `Synchronise`  
Calls `todoist-sync:sync-all`. Synchronises all available Inkdrop notebooks and notes as well as Todoist projects, sections and tasks based on the settings.
* `Application Menu` -> `Plugins` -> `Todoist Sync` -> `Export to Todoist`  
Calls `todoist-sync:export-all-books`. Exports all Inkdrop notebooks including sub notebooks recursively.
* `Application Menu` -> `Plugins` -> `Todoist Sync` -> `Import from Todoist`  
Calls `todoist-sync:import-all-projects`. Imports all Todoist projects, sections and tasks.

* `Notebook context menu` -> `Synchronise with Todoist`  
Calls `todoist-sync:sync-selected`. Synchronises the currently selected Inkdrop notebook including sub notebooks recursively.
* `Notebook context menu` -> `Export to Todoist`  
Calls `todoist-sync:export-selected-books`. Exports the selected Inkdrop notebook including sub notebooks recursively.
* `Notebook context menu` -> `Import from Todoist`  
Calls `todoist-sync:import-selected-projects`. Imports all Todoist projects starting from a project matching the selected Inkdrop notebook hierarchy. The import includes sub-projects.

* `Note context menu` -> `Export to Todoist`  
Calls `todoist-sync:export-selected-notes`. Exports selected Inkdrop notes to a corresponding Todoist project, depending on the settings.


## Keyboard shortcuts
Todoist Sync defines the following default keyboard shortcuts.

* `Ctrl-Alt-t` or `Cmd-Ald-t`  
Starts a synchronisation process of all available Inkdrop notebooks and notes.

## Settings
The following settings can be used to control various aspects of Todoist Sync.

* `Todoist API key`  
Your Todoist API key which allows todoist-sync to access your Todoist data. You can find it in Todoist under `Settings` -> `Integrations` -> `API Tokens`.
* `Synchronisation direction`  
Sets the default synchronisation direction to allow only imports from Todoist, exports to Todoist or imports and exports at the same time.
* `Automatic synchronisation (in minutes)`  
If set to greater `0`, synchronisations will automatically run automatically and repeatedly after the specified interval. Otherwise if set to `0`, automatic synchronisation will be disabled.
* `Todoist project colour`  
Todoist projects will be created with the selected colour.
* `Todoist project for selected note exports`  
If set, selected notes that are exported from the notes list will be stored in this specific project. The project will be created if it does not exist. If the setting is left blank, the notes are exported like with any other export. Depending on the settings, a project, section and task hierarchy will be created to reflect notebooks in which the notes are contained.
* `Export notes to a specific Todoist project section`  
If set, notes will be exported to this section in each project. This is useful to easily spot which tasks were exported from Inkdrop. Otherwise notes will be attached to the Todoist project without a section. This option takes precedence over exporting leaf notebooks with no corresponding Todoist projects as sections.
* `Import Todoist tasks from specific project sections (coma separated)`  
If set, tasks will be imported from these sections in each project. This is useful to easily control which Todoist tasks get imported. Otherwise all tasks from a Todoist project will be imported.
* `Export only notes with specific tags (coma separated)`  
If set, only notes with **ONE OR MORE** of these tags will be exported. This is useful to easily control which notes get exported to Todoist. Otherwise all notes of a notebook get exported. This filter does not apply when exporting selected notes. 
* `Import only Todoist tasks with specific labels (coma separated)`  
If set, only Todoist tasks with **ONE ORE MORE** of these labels will be imported. This is useful to easily control which Todoist tasks get imported. Otherwise all tasks of a notebook get imported.   
* `Synchronise tags`  
If this feature is enabled, Inkdrop tags and Todoist labels are synchronised.   
* `Tag colour`  
Tags will be created with the selected colours. 
* `Todoist label colour`  
Todoist labels will be created with the selected colour.
* `Todoist label for notes with status active`  
If set, notes with status active will be exported with an additional label. **This setting is independent from the setting that controls label synchronisation.**
* `Todoist label for notes with status on hold`  
If set, notes with status on hold will be exported with an additional label. **This setting is independent from the setting that controls label synchronisation.**
* `Export completed notes`  
If this feature is enabled, completed notes are exported as completed Todoist tasks.
* `Export dropped notes`  
If this feature is enabled, dropped notes are exported as completed Todoist tasks.
* `Import Todoist sub tasks`  
If this feature is enabled, Todoist sub tasks will be imported as notes into the notebook that corresponds to the project containing the main task. Otherwise sub tasks will not be imported. Exporting to a specific Todoist project section takes precedence over this option. **Be aware of implications on subsequent synchronisations!**
* `Export notes when a Todoist sub task exists`  
If this feature is enabled, notes will be exported to the project even if a sub task of an other task in the same project has the same name. Otherwise the notes will not be exported.
* `Export leaf notebooks as Todoist sections if corresponding projects are absent`  
If this feature is enabled, leaf (deepested nested) notebooks will be exported as Todoist sections if no corresponding project is found. This means missing Todoist projects are created until the second to last level. The last level will then become a section in the project. If this feature is disabled, leaf notebooks will become projects and the tasks will not contain any sections. **Be aware of implications on subsequent synchronisations!**
* `Import Todoist sections as notebooks`  
If this feature is enabled, Todoist sections will be imported as notebooks when synchronising. This means Todoist sections will become the lowest Inkdrop sub notebooks in the hierarchy. Otherwise sections will be ignored and all tasks of a Todoist project will be imported into a single Inkdrop notebook. **Be aware of implications on subsequent synchronisations!**
* `Import Todoist task descriptions as note body`  
If this feature is enabled, the task description of a Todoist task will be imported as note body when creating notes. Otherwise the note body will be emtpy.
* `Export note bodies as Todoist task descriptions`  
If this feature is enabled, note bodies will be exported to Todoist task descriptions. Otherwise the note bodies will note be exported. **Be aware that Todoist only supports a small sub-set of Markdown formatting options.**
* `Import Todoist project comments as notes`  
If this feature is enabled, comments of Todoist projects will be imported as notes in the corresponding notebook. Otherwise the comments will be ignored.
* `Import Todoist task comments as note body`  
If this feature is enabled, comments of Todoist tasks will be imported as note body in the corresponding note. Otherwise the comments will be ignored.
* `Show synchronisation status in the sidebar`  
If this feature is enabled, the sidebar will show a status item during an active synchronisation.
* `Show platform-specific native notifications for automatic synchronisation`  
If this feature is enabled, platform-secific native notifications will be shown in addition to Inkdrop notifications for automatic synchronisations. This is useful for getting informed about synchronisations when Inkdrop running in the background. If disabled, only notifications inside of Inkdrop will be shown.