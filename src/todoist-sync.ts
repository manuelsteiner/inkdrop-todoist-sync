'use babel';

import {TodoistSyncCore} from './todoist-sync-core';
import {
  Inkdrop,
  SYNC_DIRECTION_VALUES,
  TAG_COLOR_NAMES,
  TODOIST_COLOR_NAMES,
} from './types';

declare let inkdrop: Inkdrop;

module.exports = {
  config: {
    apiKey: {
      title: 'Todoist API key',
      description:
        'Your Todoist API key that allows todoist-sync to access your Todoist data. You can find it in Todoist under Settings -> Integrations -> API Tokens.',
      type: 'string',
      default: '',
    },
    syncDirection: {
      title: 'Synchronisation direction',
      description:
        'Sets the default synchronisation direction to allow only imports from Todoist, exports to Todoist or imports and exports at the same time.',
      type: 'string',
      default: 'both',
      enum: SYNC_DIRECTION_VALUES,
    },
    projectColor: {
      title: 'Todoist project colour',
      description: 'Todoist projects will be created with the selected colour.',
      type: 'string',
      default: 'charcoal',
      enum: TODOIST_COLOR_NAMES,
    },
    singleNoteExportProject: {
      title: 'Project for selected note exports',
      description:
        'If set, selected notes that are exported from the notes list will be stored in this specific project. The project will be created if it does not exist. If the setting is left blank, the notes are exported like with any other export. Depending on the settings, a project, section and todo hierarchy will be created to reflect notebooks in which the notes are contained.',
      type: 'string',
      default: '',
    },
    exportSection: {
      title: 'Export notes to a specific Todoist project section',
      description:
        'If set, notes will be exported to this section in each project. This is useful to easily spot which tasks were exported from Inkdrop. Otherwise notes will be attached to the Todoist project without a section.',
      type: 'string',
      default: '',
    },
    importSections: {
      title:
        'Import Todoist tasks from specific project sections (coma separated)',
      description:
        'If set, tasks will be imported from these sections in each project. This is useful to easily control which Todoist tasks get imported. Otherwise all tasks from a Todoist project will be imported.',
      type: 'string',
      default: '',
    },
    exportTags: {
      title: 'Export only notes with specific tags (coma separated)',
      description:
        'If set, only notes with ONE OR MORE of these tags will be exported. This is useful to easily control which notes get exported to Todoist. Otherwise all notes of a notebook get exported. This filter does not apply when exporting selected notes.',
      type: 'string',
      default: '',
    },
    importLabels: {
      title: 'Import only Todoist tasks with specific labels (coma separated)',
      description:
        'If set, only Todoist tasks with ONE ORE MORE of these labels will be imported. This is useful to easily control which Todoist tasks get imported. Otherwise all tasks of a notebook get imported.',
      type: 'string',
      default: '',
    },
    syncTags: {
      title: 'Synchronise tags',
      description:
        'If this feature is enabled, Inkdrop tags and Todoist labels are synchronised.',
      type: 'boolean',
      default: true,
    },
    tagColor: {
      title: 'Tag colour',
      description: 'Tags will be created with the selected colours.',
      type: 'string',
      default: 'default',
      enum: TAG_COLOR_NAMES,
    },
    syncCompleted: {
      title: 'Synchronise completed elements',
      description:
        'If this feature is enabled, completed notes and tasks are synchonised between Inkdrop and Todoist.',
      type: 'boolean',
      default: false,
    },
    importSubTasks: {
      title: 'Import Todoist sub tasks',
      description:
        'If this feature is enabled, Todoist sub tasks will be imported as notes into the notebook that corresponds to the project containing the main task. Otherwise sub tasks will not be imported. Be aware of implications on subsequent synchronisations!',
      type: 'boolean',
      default: false,
    },
    exportExistingSubTasks: {
      title: 'Export notes when a sub task exists',
      description:
        'If this feature is enabled, notes will be exported to the project even if a sub task of an other task in the same project has the same name. Otherwise the notes will not be exported.',
      type: 'boolean',
      default: true,
    },
    exporttNotebooksAsSections: {
      title:
        'Treat leaf notebooks as Todoist sections if corresponding projects are absent',
      description:
        'If this feature is enabled, leaf (deepested nested) notebooks will be exported as Todoist sections if no corresponding project is found. This means missing Todoist projects are created until the second to last level. The last level will then become a section in the project. If this feature is disabled, leaf notebooks will become projects and the tasks will not contain any sections. Be aware of implications on subsequent synchronisations!',
      type: 'boolean',
      default: false,
    },
    importSectionsAsNotebooks: {
      title: 'Treat Todoist sections as notebooks',
      description:
        'If this feature is enabled, Todoist sections will be imported as notebooks when synchronising. This means Todoist sections will become the lowest Inkdrop sub notebooks in the hierarchy. Otherwise sections will be ignored and all tasks of a Todoist project will be imported into a single Inkdrop notebook. Be aware of implications on subsequent synchronisations!',
      type: 'boolean',
      default: false,
    },
    importTaskDescriptions: {
      title: 'Import Todoist task descriptions as note body',
      description:
        'If this feature is enabled, the task description will be imported as note body when creating notes. Otherwise the note body will be emtpy.',
      type: 'boolean',
      default: true,
    },
  },

  activate() {
    inkdrop.commands.add(document.body, {
      'todoist-sync:sync-all': async () => {
        try {
          inkdrop.notifications.addInfo('Todoist synchronisation started', {
            detail: 'Synchronising all notebooks and projects.',
            dismissable: true,
          });

          await (await TodoistSyncCore.construct()).syncAll();

          inkdrop.notifications.addSuccess('Todoist synchronisation finished', {
            detail: 'Synchronising all notebooks and projects finished.',
            dismissable: true,
          });
        } catch (error) {
          inkdrop.logger.error(
            'todoist-sync:sync-all: Synchronising all notebooks and projects failed. Details: ' +
              (<Error>error).message
          );
          inkdrop.notifications.addError('Todoist synchronisation failed', {
            detail:
              'Synchronising all notebooks and projects failed. Details: ' +
              (<Error>error).message,
            dismissable: true,
          });
        }
      },
    });

    inkdrop.commands.add(document.body, {
      'todoist-sync:sync-selected': async () => {
        try {
          inkdrop.notifications.addInfo('Todoist synchronisation started', {
            detail: 'Synchronising selected notebooks and projects.',
            dismissable: true,
          });

          await (await TodoistSyncCore.construct()).syncSelected();

          inkdrop.notifications.addSuccess('Todoist synchronisation finished', {
            detail: 'Synchronising selected notebooks and projects finished.',
            dismissable: true,
          });
        } catch (error) {
          inkdrop.logger.error(
            'todoist-sync:sync-all: Synchronising selected notebooks and projects failed. Details: ' +
              (<Error>error).message
          );
          inkdrop.notifications.addError('Todoist synchronisation failed', {
            detail:
              'Synchronising selected notebooks and projects failed. Details: ' +
              (<Error>error).message,
            dismissable: true,
          });
        }
      },
    });

    inkdrop.commands.add(document.body, {
      'todoist-sync:import-all-projects': async () => {
        //try {
        inkdrop.notifications.addInfo('Todoist import started', {
          detail: 'Importing all projects.',
          dismissable: true,
        });

        await (await TodoistSyncCore.construct()).importAllProjects();

        inkdrop.notifications.addSuccess('Todoist import finished', {
          detail: 'Importing all projects finished.',
          dismissable: true,
        });
        //} catch (error) {
        //  inkdrop.logger.error(
        //    'todoist-sync:import-all-projects: Importing all projects failed. Details: ' +
        //      (<Error>error).message
        //  );
        //  inkdrop.notifications.addError('Todoist import failed', {
        //    detail:
        //      'Importing all projects failed. Details: ' +
        //      (<Error>error).message,
        //    dismissable: true,
        //  });
        //}
      },
    });

    inkdrop.commands.add(document.body, {
      'todoist-sync:import-selected-projects': async () => {
        //try {
        inkdrop.notifications.addInfo('Todoist import started', {
          detail: 'Importing selected projects.',
          dismissable: true,
        });

        await (await TodoistSyncCore.construct()).importSelectedProjects();

        inkdrop.notifications.addSuccess('Todoist import finished', {
          detail: 'Importing selected projects finished.',
          dismissable: true,
        });
        //} catch (error) {
        //  inkdrop.logger.error(
        //    'todoist-sync:import-selected-projects: Importing selected projects failed. Details: ' +
        //      (<Error>error).message
        //  );
        //  inkdrop.notifications.addError('Todoist import failed', {
        //    detail:
        //      'Importing selected projects failed. Details: ' +
        //      (<Error>error).message,
        //    dismissable: true,
        //  });
        //}
      },
    });

    inkdrop.commands.add(document.body, {
      'todoist-sync:export-all-books': async () => {
        try {
          inkdrop.notifications.addInfo('Todoist export started', {
            detail: 'Exporting all notebooks.',
            dismissable: true,
          });

          await (await TodoistSyncCore.construct()).exportAllBooks();

          inkdrop.notifications.addSuccess('Todoist export finished', {
            detail: 'Exporting all notebooks finished.',
            dismissable: true,
          });
        } catch (error) {
          inkdrop.logger.error(
            'todoist-sync:export-all-books: Exporting all notebooks failed. Details: ' +
              (<Error>error).message
          );
          inkdrop.notifications.addError('Todoist export failed', {
            detail:
              'Exporting all notebooks failed. Details: ' +
              (<Error>error).message,
            dismissable: true,
          });
        }
      },
    });

    inkdrop.commands.add(document.body, {
      'todoist-sync:export-selected-books': async () => {
        try {
          inkdrop.notifications.addInfo('Todoist export started', {
            detail: 'Exporting selected projects.',
            dismissable: true,
          });

          await (await TodoistSyncCore.construct()).exportSelectedBooks();

          inkdrop.notifications.addSuccess('Todoist export finished', {
            detail: 'Exporting selected projects finished.',
            dismissable: true,
          });
        } catch (error) {
          inkdrop.logger.error(
            'todoist-sync:export-selected-books: Exporting selected notebooks failed. Details: ' +
              (<Error>error).message
          );
          inkdrop.notifications.addError('Todoist export failed', {
            detail:
              'Exporting selected notebooks failed. Details: ' +
              (<Error>error).message,
            dismissable: true,
          });
        }
      },
    });

    inkdrop.commands.add(document.body, {
      'todoist-sync:export-selected-notes': async () => {
        try {
          inkdrop.notifications.addInfo('Todoist export started', {
            detail: 'Exporting selected notes.',
            dismissable: true,
          });

          await (await TodoistSyncCore.construct()).exportSelectedNotes();

          inkdrop.notifications.addSuccess('Todoist export finished', {
            detail: 'Exporting selected notes finished.',
            dismissable: true,
          });
        } catch (error) {
          inkdrop.logger.error(
            'todoist-sync:export-selected-notes: Exporting selected notes failed. Details: ' +
              (<Error>error).message
          );
          inkdrop.notifications.addError('Todoist export failed', {
            detail:
              'Exporting selected notes failed. Details: ' +
              (<Error>error).message,
            dismissable: true,
          });
        }
      },
    });
  },

  deactivate() {},
};
