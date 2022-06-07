"use strict";
'use babel';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const todoist_sync_core_1 = require("./todoist-sync-core");
const types_1 = require("./types");
const inkdrop_1 = require("inkdrop");
const SidebarStatusItem = __importStar(require("./sidebar-status-item"));
const utils_1 = require("./utils");
const path_1 = __importDefault(require("path"));
const assets_1 = require("./assets");
class TodoistSync {
    constructor() {
        this.syncInProgress = false;
        this.syncInterval = 0;
    }
    activate() {
        inkdrop.components.registerClass(SidebarStatusItem.default);
        inkdrop.commands.add(document.body, {
            'todoist-sync:sync-all': async () => {
                await this.syncAll(false);
            },
        });
        inkdrop.commands.add(document.body, {
            'todoist-sync:sync-selected': async () => {
                if (!this.canRun()) {
                    return;
                }
                try {
                    this.preCommand('Todoist synchronisation started', 'Synchronising selected notebooks and projects.');
                    await (await todoist_sync_core_1.TodoistSyncCore.construct()).syncSelected();
                    this.handleSuccess('Todoist synchronisation finished', 'Synchronising selected notebooks and projects finished.');
                }
                catch (error) {
                    this.handleError(error, 'todoist-sync:sync-all: Synchronising selected notebooks and projects failed.', 'Todoist synchronisation failed', 'Synchronising selected notebooks and projects failed.');
                }
                finally {
                    await this.postCommand();
                }
            },
        });
        inkdrop.commands.add(document.body, {
            'todoist-sync:import-all-projects': async () => {
                if (!this.canRun()) {
                    return;
                }
                try {
                    this.preCommand('Todoist import started', 'Importing all projects');
                    await (await todoist_sync_core_1.TodoistSyncCore.construct()).importAllProjects();
                    this.handleSuccess('Todoist import finished', 'Importing all projects finished.');
                }
                catch (error) {
                    this.handleError(error, 'todoist-sync:import-all-projects: Importing all projects failed.', 'Todoist import failed', 'Importing all projects failed.');
                }
                finally {
                    await this.postCommand();
                }
            },
        });
        inkdrop.commands.add(document.body, {
            'todoist-sync:import-selected-projects': async () => {
                if (!this.canRun()) {
                    return;
                }
                try {
                    this.preCommand('Todoist import started', 'Importing selected projects');
                    await (await todoist_sync_core_1.TodoistSyncCore.construct()).importSelectedProjects();
                    this.handleSuccess('Todoist import finished', 'Importing selected projects finished.');
                }
                catch (error) {
                    this.handleError(error, 'todoist-sync:import-selected-projects: Importing selected projects failed.', 'Todoist import failed', 'Importing selected projects failed.');
                }
                finally {
                    await this.postCommand();
                }
            },
        });
        inkdrop.commands.add(document.body, {
            'todoist-sync:export-all-books': async () => {
                if (!this.canRun()) {
                    return;
                }
                try {
                    this.preCommand('Todoist export started', 'Exporting all notebooks.');
                    await (await todoist_sync_core_1.TodoistSyncCore.construct()).exportAllBooks();
                    this.handleSuccess('Todoist export finished', 'Exporting all notebooks finished.');
                }
                catch (error) {
                    this.handleError(error, 'todoist-sync:export-all-books: Exporting all notebooks failed.', 'Todoist export failed', 'Exporting all notebooks failed.');
                }
                finally {
                    await this.postCommand();
                }
            },
        });
        inkdrop.commands.add(document.body, {
            'todoist-sync:export-selected-books': async () => {
                if (!this.canRun()) {
                    return;
                }
                try {
                    this.preCommand('Todoist export started', 'Exporting selected projects.');
                    await (await todoist_sync_core_1.TodoistSyncCore.construct()).exportSelectedBooks();
                    this.handleSuccess('Todoist export finished', 'Exporting selected projects finished.');
                }
                catch (error) {
                    this.handleError(error, 'todoist-sync:export-selected-books: Exporting selected notebooks failed.', 'Todoist export failed', 'Exporting selected notebooks failed.');
                }
                finally {
                    await this.postCommand();
                }
            },
        });
        inkdrop.commands.add(document.body, {
            'todoist-sync:export-selected-notes': async () => {
                if (!this.canRun()) {
                    return;
                }
                try {
                    this.preCommand('Todoist export started', 'Exporting selected notes.');
                    await (await todoist_sync_core_1.TodoistSyncCore.construct()).exportSelectedNotes();
                    this.handleSuccess('Todoist export finished', 'Exporting selected notes finished.');
                }
                catch (error) {
                    this.handleError(error, 'todoist-sync:export-selected-notes: Exporting selected notes failed.', 'Todoist export failed', 'Exporting selected notes failed.');
                }
                finally {
                    await this.postCommand();
                }
            },
        });
        this.setupConfigEventHandlers();
        this.setupAutomaticSync();
    }
    deactivate() {
        this.syncInterval = 0;
        SidebarStatusItem.hide();
        inkdrop.components.deleteClass(SidebarStatusItem.default);
    }
    canRun() {
        if (this.syncInProgress) {
            inkdrop.notifications.addWarning('Todoist synchronisation in progress', {
                detail: 'A Todoist synchronisation is currently in progress. Please wait for it to finish.',
                dismissable: true,
            });
            return false;
        }
        if (inkdrop.store.getState().db.isSyncing) {
            inkdrop.notifications.addWarning('Inkdrop synchronisation in progress', {
                detail: 'An Inkdrop synchronisation is currently in progress. Please wait for it to finish.',
                dismissable: true,
            });
            return false;
        }
        return true;
    }
    preCommand(notificationHeader, notificationBody, showNativeNotification) {
        this.syncInProgress = true;
        if (notificationHeader) {
            inkdrop.notifications.addInfo(notificationHeader, {
                detail: notificationBody !== null && notificationBody !== void 0 ? notificationBody : '',
                dismissable: true,
            });
        }
        if (notificationHeader && showNativeNotification) {
            new Notification(notificationHeader, {
                icon: path_1.default.resolve(__dirname, '..', assets_1.ASSETFOLDER, assets_1.ICONFILE),
                body: notificationBody,
                requireInteraction: false,
            });
        }
        if (inkdrop.config.get('todoist-sync.showSyncStatus')) {
            SidebarStatusItem.show();
        }
    }
    handleError(error, errorMessage, notificationHeader, notificationBody, showNativeNotification) {
        inkdrop_1.logger.error(errorMessage + ' Details: ' + error.message);
        if (notificationHeader) {
            inkdrop.notifications.addError(notificationHeader, {
                detail: notificationBody !== null && notificationBody !== void 0 ? notificationBody : '' + 'Details: ' + error.message,
                dismissable: true,
            });
        }
        if (notificationHeader && showNativeNotification) {
            new Notification(notificationHeader, {
                icon: path_1.default.resolve(__dirname, '..', assets_1.ASSETFOLDER, assets_1.ICONFILE),
                body: notificationBody,
                requireInteraction: false,
            });
        }
        window.dispatchEvent(new CustomEvent('todoist-sync-status', { detail: "error" /* SYNC_STATUS.ERROR */ }));
    }
    handleSuccess(notificationHeader, notificationBody, showNativeNotification) {
        if (notificationHeader) {
            inkdrop.notifications.addSuccess(notificationHeader, {
                detail: notificationBody !== null && notificationBody !== void 0 ? notificationBody : '',
                dismissable: true,
            });
        }
        if (notificationHeader && showNativeNotification) {
            new Notification(notificationHeader, {
                icon: path_1.default.resolve(__dirname, '..', assets_1.ASSETFOLDER, assets_1.ICONFILE),
                body: notificationBody,
                requireInteraction: false,
            });
        }
        window.dispatchEvent(new CustomEvent('todoist-sync-status', { detail: "success" /* SYNC_STATUS.SUCCESS */ }));
    }
    async postCommand() {
        if (inkdrop.config.get('todoist-sync.showSyncStatus')) {
            await SidebarStatusItem.hideDelayed();
        }
        this.syncInProgress = false;
    }
    setupAutomaticSync() {
        const syncInterval = inkdrop.config.get('todoist-sync.syncInterval');
        if (syncInterval && syncInterval > 0) {
            this.syncInterval = syncInterval;
            this.automaticSync();
        }
    }
    setupConfigEventHandlers() {
        /* eslint-disable  @typescript-eslint/no-unused-vars */
        inkdrop.config.onDidChange('todoist-sync.syncInterval', ({ newValue, oldValue }) => {
            if (newValue && newValue > 0) {
                this.syncInterval = newValue;
                if (oldValue === 0) {
                    this.automaticSync();
                }
            }
            else {
                this.syncInterval = 0;
            }
        });
    }
    async automaticSync() {
        while (this.syncInterval > 0) {
            if (this.syncInterval > 0) {
                await this.syncAll(inkdrop.config.get('todoist-sync.showNativeNotifications'));
            }
            await (0, utils_1.sleep)(60 * 1000 * this.syncInterval);
        }
    }
    async syncAll(showNativeNotifications) {
        if (!this.canRun()) {
            return;
        }
        try {
            this.preCommand('Todoist synchronisation started', 'Synchronising all notebooks and projects.', showNativeNotifications);
            await (await todoist_sync_core_1.TodoistSyncCore.construct()).syncAll();
            this.handleSuccess('Todoist synchronisation finished', 'Synchronising all notebooks and projects finished.', showNativeNotifications);
        }
        catch (error) {
            this.handleError(error, 'todoist-sync:sync-all: Synchronising all notebooks and projects failed.', 'Todoist synchronisation failed', 'Synchronising all notebooks and projects failed.', showNativeNotifications);
        }
        finally {
            await this.postCommand();
        }
    }
}
const todoistSync = new TodoistSync();
module.exports = {
    config: {
        apiKey: {
            title: 'Todoist API key',
            description: 'Your Todoist API key which allows todoist-sync to access your Todoist data. You can find it in Todoist under Settings -> Integrations -> API Tokens.',
            type: 'string',
            default: '',
        },
        syncDirection: {
            title: 'Synchronisation direction',
            description: 'Sets the default synchronisation direction to allow only imports from Todoist, exports to Todoist or imports and exports at the same time.',
            type: 'string',
            default: 'both',
            enum: types_1.SYNC_DIRECTION_VALUES,
        },
        syncInterval: {
            title: 'Automatic synchronisation (in minutes)',
            description: 'If set to greater 0, synchronisations will automatically run automatically and repeatedly after the specified interval. Otherwise if set to 0, automatic synchronisation will be disabled.',
            type: 'integer',
            default: 0,
        },
        projectColor: {
            title: 'Todoist project colour',
            description: 'Todoist projects will be created with the selected colour.',
            type: 'string',
            default: 'charcoal',
            enum: types_1.TODOIST_COLOR_NAMES,
        },
        singleNoteExportProject: {
            title: 'Project for selected note exports',
            description: 'If set, selected notes that are exported from the notes list will be stored in this specific project. The project will be created if it does not exist. If the setting is left blank, the notes are exported like with any other export. Depending on the settings, a project, section and todo hierarchy will be created to reflect notebooks in which the notes are contained.',
            type: 'string',
            default: '',
        },
        exportSection: {
            title: 'Export notes to a specific Todoist project section',
            description: 'If set, notes will be exported to this section in each project. This is useful to easily spot which tasks were exported from Inkdrop. Otherwise notes will be attached to the Todoist project without a section. This option takes precedence over exporting leaf notebooks with no corresponding Todoist projects as sections.',
            type: 'string',
            default: '',
        },
        importSections: {
            title: 'Import Todoist tasks from specific project sections (coma separated)',
            description: 'If set, tasks will be imported from these sections in each project. This is useful to easily control which Todoist tasks get imported. Otherwise all tasks from a Todoist project will be imported.',
            type: 'string',
            default: '',
        },
        exportTags: {
            title: 'Export only notes with specific tags (coma separated)',
            description: 'If set, only notes with ONE OR MORE of these tags will be exported. This is useful to easily control which notes get exported to Todoist. Otherwise all notes of a notebook get exported. This filter does not apply when exporting selected notes.',
            type: 'string',
            default: '',
        },
        importLabels: {
            title: 'Import only Todoist tasks with specific labels (coma separated)',
            description: 'If set, only Todoist tasks with ONE ORE MORE of these labels will be imported. This is useful to easily control which Todoist tasks get imported. Otherwise all tasks of a notebook get imported.',
            type: 'string',
            default: '',
        },
        syncTags: {
            title: 'Synchronise tags',
            description: 'If this feature is enabled, Inkdrop tags and Todoist labels are synchronised.',
            type: 'boolean',
            default: true,
        },
        tagColor: {
            title: 'Tag colour',
            description: 'Tags will be created with the selected colours.',
            type: 'string',
            default: 'default',
            enum: types_1.TAG_COLOR_NAMES,
        },
        exportCompleted: {
            title: 'Export completed notes',
            description: 'If this feature is enabled, completed notes are exported as completed Todoist tasks.',
            type: 'boolean',
            default: false,
        },
        importSubTasks: {
            title: 'Import Todoist sub tasks',
            description: 'If this feature is enabled, Todoist sub tasks will be imported as notes into the notebook that corresponds to the project containing the main task. Otherwise sub tasks will not be imported. Exporting to a specific Todoist project section takes precedence over this option.  Be aware of implications on subsequent synchronisations!',
            type: 'boolean',
            default: false,
        },
        exportExistingSubTasks: {
            title: 'Export notes when a sub task exists',
            description: 'If this feature is enabled, notes will be exported to the project even if a sub task of an other task in the same project has the same name. Otherwise the notes will not be exported.',
            type: 'boolean',
            default: true,
        },
        exportNotebooksAsSections: {
            title: 'Export leaf notebooks as Todoist sections if corresponding projects are absent',
            description: 'If this feature is enabled, leaf (deepested nested) notebooks will be exported as Todoist sections if no corresponding project is found. This means missing Todoist projects are created until the second to last level. The last level will then become a section in the project. If this feature is disabled, leaf notebooks will become projects and the tasks will not contain any sections. Be aware of implications on subsequent synchronisations!',
            type: 'boolean',
            default: false,
        },
        importSectionsAsNotebooks: {
            title: 'Import Todoist sections as notebooks',
            description: 'If this feature is enabled, Todoist sections will be imported as notebooks when synchronising. This means Todoist sections will become the lowest Inkdrop sub notebooks in the hierarchy. Otherwise sections will be ignored and all tasks of a Todoist project will be imported into a single Inkdrop notebook. Be aware of implications on subsequent synchronisations!',
            type: 'boolean',
            default: false,
        },
        importTaskDescriptions: {
            title: 'Import Todoist task descriptions as note body',
            description: 'If this feature is enabled, the task description of a Todoist task will be imported as note body when creating notes. Otherwise the note body will be emtpy.',
            type: 'boolean',
            default: true,
        },
        importProjectComments: {
            title: 'Import Todoist project comments as notes',
            description: 'If this feature is enabled, comments of Todoist projects will be imported as notes in the corresponding notebook. Otherwise the comments will be ignored.',
            type: 'boolean',
            default: false,
        },
        importTaskComments: {
            title: 'Import Todoist task comments as note body',
            description: 'If this feature is enabled, comments of Todoist tasks will be imported as note body in the corresponding note. Otherwise the comments will be ignored.',
            type: 'boolean',
            default: false,
        },
        showSyncStatus: {
            title: 'Show synchronisation status in the sidebar',
            description: 'If this feature is enabled, the sidebar will show a status item during an active synchronisation.',
            type: 'boolean',
            default: true,
        },
        showNativeNotifications: {
            title: 'Show platform-specific native notifications for automatic synchronisation',
            description: 'If this feature is enabled, platform-secific native notifications will be shown in addition to Inkdrop notifications for automatic synchronisations. This is useful for getting informed about synchronisations when Inkdrop running in the background. If disabled, only notifications inside of Inkdrop will be shown.',
            type: 'boolean',
            default: false,
        },
    },
    activate() {
        todoistSync.activate();
    },
    deactivate() {
        todoistSync.deactivate();
    },
};
//# sourceMappingURL=todoist-sync.js.map