"use strict";
'use babel';
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoistSyncCore = void 0;
const todoist_api_typescript_1 = require("@doist/todoist-api-typescript");
const types_1 = require("./types");
const inkdrop_1 = require("inkdrop");
const inkdrop_model_1 = require("inkdrop-model");
class TodoistSyncCore {
    constructor(books, notes, tags, todoistApi, todoistProjects, todoistSections, todoistTasks, todoistLabels) {
        this.books = books;
        this.notes = notes;
        this.tags = tags;
        this.todoistApi = todoistApi;
        this.todoistProjects = todoistProjects;
        this.todoistSections = todoistSections;
        this.todoistTasks = todoistTasks;
        this.todoistLabels = todoistLabels;
    }
    static async construct() {
        let books = null;
        let notes = null;
        let tags = null;
        const todoistApi = TodoistSyncCore.getTodoistApi();
        let todoistProjects = null;
        let todoistSections = null;
        let todoistTasks = null;
        let todoistLabels = null;
        if (!todoistApi) {
            throw new Error('Todoist API initialisation failed.');
        }
        try {
            books = await TodoistSyncCore.getBooks();
            notes = await TodoistSyncCore.getNotes();
            if (inkdrop.config.get('todoist-sync.syncCompleted')) {
                notes = notes.concat(await TodoistSyncCore.getCompletedNotes());
            }
            tags = await TodoistSyncCore.getTags();
        }
        catch (error) {
            inkdrop_1.logger.error('Getting Inkdrop data failed. Details: ' + error);
            throw new Error('Getting Inkdrop data failed.');
        }
        try {
            todoistProjects = await TodoistSyncCore.getTodoistProjects(todoistApi);
            todoistSections = await TodoistSyncCore.getTodoistSections(todoistApi);
            todoistTasks = await TodoistSyncCore.getTodoistTasks(todoistApi);
            todoistLabels = await TodoistSyncCore.getTodoistLabels(todoistApi);
        }
        catch (error) {
            inkdrop_1.logger.error('Getting Todoist data failed. Details: ' + error);
            throw new Error('Getting Todoist data failed.');
        }
        return new TodoistSyncCore(books, notes, tags, todoistApi, todoistProjects, todoistSections, todoistTasks, todoistLabels);
    }
    async syncAll() {
        const syncDirection = inkdrop.config.get('todoist-sync.syncDirection');
        if (syncDirection === types_1.SYNC_DIRECTION.EXPORT ||
            syncDirection === types_1.SYNC_DIRECTION.EXPORT) {
            await this.exportAllBooks();
        }
        if (syncDirection === types_1.SYNC_DIRECTION.IMPORT ||
            syncDirection === types_1.SYNC_DIRECTION.EXPORT) {
            await this.importAllProjects();
        }
    }
    async syncSelected() {
        const syncDirection = inkdrop.config.get('todoist-sync.syncDirection');
        if (syncDirection === types_1.SYNC_DIRECTION.EXPORT ||
            syncDirection === types_1.SYNC_DIRECTION.EXPORT) {
            await this.exportSelectedBooks();
        }
        if (syncDirection === types_1.SYNC_DIRECTION.IMPORT ||
            syncDirection === types_1.SYNC_DIRECTION.EXPORT) {
            await this.importSelectedProjects();
        }
    }
    async importAllProjects() {
        await this.importProjects(this.getTodoistRootProjects());
    }
    async importSelectedProjects() {
        var _a;
        const book = inkdrop.store.getState().bookList.bookForContextMenu;
        const bookHierarchy = this.getBookHierarchy(book);
        const todoistProject = (_a = this.getTodoistProjectHierarchyByBookHierarchy(bookHierarchy)) === null || _a === void 0 ? void 0 : _a.pop();
        if (!todoistProject) {
            throw new Error('The notebook hierarchy containing ' +
                book.name +
                ' does not exist as task hierarchy in Todoist.');
        }
        await this.importProject(todoistProject);
    }
    async importProjects(projects) {
        for (const project of projects) {
            await this.importProject(project);
        }
    }
    async importProject(project) {
        await this.importTasks(this.getTodoistProjectTasks(project));
        if (inkdrop.config.get('todoist-sync.importSubTasks')) {
            await this.importTasks(this.getTodoistProjectSubTasks(project));
        }
        await this.importProjects(this.getTodoistSubProjects(project));
    }
    async exportAllBooks() {
        await this.exportBooks(this.getRootBooks());
    }
    async exportSelectedBooks() {
        const book = inkdrop.store.getState().bookList.bookForContextMenu;
        await this.exportBook(book);
    }
    async exportBooks(books) {
        for (const book of books) {
            await this.exportBook(book);
        }
    }
    async exportBook(book) {
        await this.exportNotes(this.getBookNotes(book));
        await this.exportBooks(this.getSubBooks(book));
    }
    async importTasks(tasks) {
        for (const task of tasks) {
            //try {
            await this.importTask(task);
            //if(inkdrop.config.get('todoist-sync.importSubTasks')) {
            //  for (const subTask of this.getTodoistSubTasks(task)) {
            //    await this.importTask(subTask);
            //  }
            //}
            //} catch(error) {
            //  logger.error(
            //      'Importing single task failed. Details: ' + error
            //  );
            //  throw new Error('Importing single task failed.');
            //}
        }
    }
    async importTask(task) {
        var _a;
        if (!this.todoistTaskCanBeImported(task)) {
            return;
        }
        const project = this.getTodoistProjectById(task.projectId);
        if (!project) {
            inkdrop_1.logger.error('Todoist project ' +
                task.projectId +
                ' (from task ' +
                task.id +
                ') not found.');
            throw new Error('Todoist project ' +
                task.projectId +
                ' (from task ' +
                task.id +
                ') not found.');
        }
        let book = await this.createBookHierarchyToRoot(project);
        if (!book) {
            throw new Error('Could not find book for Todoist project ' +
                project.id +
                ' to attach task ' +
                task.id +
                '.');
        }
        if (inkdrop.config.get('todoist-sync.importSectionsAsNotebooks') &&
            task.sectionId) {
            const section = this.getTodoistSectionById(task.sectionId);
            if (!section) {
                throw new Error('Could not find Todoist section ' +
                    task.sectionId +
                    ' for task ' +
                    task.id +
                    '.');
            }
            book =
                (_a = this.getBookByNameAndParent(section.name, book)) !== null && _a !== void 0 ? _a : (await this.createBook(section.name, book));
        }
        if (book && !this.bookContainsNoteWithTitle(book, task.content)) {
            const labels = inkdrop.config.get('todoist-sync.syncTags')
                ? this.getTodoistTaskLabels(task)
                : [];
            if (inkdrop.config.get('todoist-sync.syncTags')) {
                await this.importLabels(labels);
            }
            const tags = inkdrop.config.get('todoist-sync.syncTags')
                ? this.getTagsByNames(labels.map(label => {
                    return label.name;
                }))
                : [];
            const taskDescription = inkdrop.config.get('todoist-sync.importTaskDescriptions')
                ? task.description
                : '';
            await this.createNote(task.content, book, taskDescription, tags);
        }
    }
    async importLabels(labels) {
        for (const label of labels) {
            //try {
            await this.importLabel(label);
            //} catch (error) {
            //  logger.error('Importing single label failed. Details: ' + error);
            //  throw new Error('Importing single label failed.');
            //}
        }
    }
    async importLabel(label) {
        if (!this.tagExists(label.name)) {
            await this.createTag(label.name, inkdrop.config.get('todoist-sync.tagColor'));
        }
    }
    async exportSelectedNotes() {
        const notes = this.getSelectedNotes();
        const projectName = inkdrop.config.get('todoist-sync.singleNoteExportProject');
        try {
            await this.exportNotes(notes, projectName, true);
        }
        catch (error) {
            inkdrop_1.logger.error('Exporting notes failed. Details: ' + error);
            throw new Error('Exporting selected notes failed.');
        }
    }
    async exportNotes(notes, projectName, forceExport) {
        for (const note of notes) {
            // try {
            projectName
                ? await this.exportNoteToProjectWithName(note, projectName, forceExport)
                : await this.exportNote(note, undefined, forceExport);
            // } catch (error) {
            //   logger.error('Exporting single note failed. Details: ' + error);
            //   throw new Error('Exporting single note failed.');
            // }
        }
    }
    async exportNote(note, todoistProject, forceExport) {
        var _a, _b, _c;
        if (!forceExport && !this.noteCanBeExported(note)) {
            return;
        }
        const book = this.getBookById(note.bookId);
        let project = undefined;
        if (!book) {
            inkdrop_1.logger.error('Book ' + note.bookId + ' (from note ' + note._id + ') not found.');
            throw new Error('Book ' + note.bookId + ' (from note ' + note._id + ') not found.');
        }
        if (inkdrop.config.get('todoist-sync.exportNotebooksAsSections') &&
            !inkdrop.config.get('todoist-sync.exportSection').length &&
            !todoistProject &&
            book.parentBookId &&
            !this.getSubBooks(book).length &&
            !this.getTodoistProjectHierarchyByBookHierarchy(this.getBookHierarchy(book))) {
            const parentBook = this.getBookById(book.parentBookId);
            if (!parentBook) {
                throw new Error('Could not find Todoist project for book ' +
                    book.parentBookId +
                    ' to attach note ' +
                    note._id +
                    '.');
            }
            project = await this.createTodoistProjectHierarchyToRoot(parentBook);
        }
        else {
            project =
                todoistProject !== null && todoistProject !== void 0 ? todoistProject : (await this.createTodoistProjectHierarchyToRoot(book));
        }
        if (!project) {
            throw new Error('Could not find Todoist project for book ' +
                book._id +
                ' to attach note ' +
                note._id +
                '.');
        }
        if (project &&
            !this.todoistProjectContainsTaskWithContent(project, note.title)) {
            let section = undefined;
            if (inkdrop.config.get('todoist-sync.exportNotebooksAsSections') &&
                !inkdrop.config.get('todoist-sync.exportSection').length &&
                book.parentBookId &&
                !this.getSubBooks(book).length &&
                project.name.trim() === ((_a = this.getBookById(book.parentBookId)) === null || _a === void 0 ? void 0 : _a.name.trim())) {
                section =
                    (_b = this.getTodoistSectionByNameAndProject(book.name, project)) !== null && _b !== void 0 ? _b : (await this.createTodoistSection(book.name, project));
            }
            else if (inkdrop.config.get('todoist-sync.exportSection') &&
                !this.todoistProjectContainsSectionWithName(project, inkdrop.config.get('todoist-sync.exportSection'))) {
                section =
                    (_c = this.getTodoistSectionByName(inkdrop.config.get('todoist-sync.exportSection'))) !== null && _c !== void 0 ? _c : (await this.createTodoistSection(inkdrop.config.get('todoist-sync.exportSection'), project));
            }
            const tags = inkdrop.config.get('todoist-sync.syncTags')
                ? this.getNoteTags(note)
                : [];
            if (inkdrop.config.get('todoist-sync.syncTags')) {
                await this.exportTags(tags);
            }
            const labels = inkdrop.config.get('todoist-sync.syncTags')
                ? this.getTodoistLabelsByNames(tags.map(tag => {
                    return tag.name;
                }))
                : [];
            const todoistTask = await this.createTodoistTask(note.title, labels, project, section);
            if (note.status === 'completed') {
                await this.completeTodoistTask(todoistTask);
            }
        }
    }
    async exportNoteToProjectWithName(note, projectName, forceExport) {
        var _a;
        const project = (_a = this.getTodoistProjectByName(projectName)) !== null && _a !== void 0 ? _a : (await this.createTodoistProject(projectName, types_1.TodoistColorNames[inkdrop.config.get('todoist-sync.projectColor')]));
        await this.exportNote(note, project, forceExport);
    }
    async exportTags(tags) {
        for (const tag of tags) {
            try {
                await this.exportTag(tag);
            }
            catch (error) {
                inkdrop_1.logger.error('Exporting single tag failed. Details: ' + error);
                throw new Error('Exporting single tag failed.');
            }
        }
    }
    async exportTag(tag) {
        if (!this.todoistLabelExists(tag.name)) {
            await this.createTodoistLabel(tag.name);
        }
    }
    static getBooks() {
        return inkdrop.main.dataStore
            .getLocalDB()
            .books.all()
            .then((books) => {
            return books;
        });
    }
    getBook(id) {
        return inkdrop.main.dataStore
            .getLocalDB()
            .books.get(id)
            .then((book) => {
            return book;
        });
    }
    async createBook(name, parent) {
        const timestamp = Date.now();
        const parameters = {
            _id: inkdrop.main.dataStore.getLocalDB().books.createId(),
            name: name.trim(),
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        if (parent) {
            parameters.parentBookId = parent._id;
        }
        return inkdrop.main.dataStore
            .getLocalDB()
            .books.put(parameters)
            .then(async (result) => {
            const book = await this.getBook(result.id);
            this.books.push(book);
            return book;
        });
    }
    async createBookHierarchyToRoot(project) {
        var _a;
        const todoistProjectHierarchy = this.getTodoistProjectHierarchy(project);
        let currentBook = undefined;
        try {
            for (const project of todoistProjectHierarchy) {
                currentBook =
                    (_a = this.getBookByNameAndParent(project.name, currentBook)) !== null && _a !== void 0 ? _a : (await this.createBook(project.name, currentBook));
            }
        }
        catch (error) {
            inkdrop_1.logger.error('Creating book hierarchy failed. Details: ' + error);
            throw new Error('Creating book hierarchy failed.');
        }
        return currentBook;
    }
    static getNotes() {
        return inkdrop.main.dataStore
            .getLocalDB()
            .notes.all({ limit: null })
            .then((notes) => {
            return notes.docs;
        });
    }
    getNote(id) {
        return inkdrop.main.dataStore
            .getLocalDB()
            .notes.get(id)
            .then((note) => {
            return note;
        });
    }
    async createNote(title, book, body, tags) {
        const timestamp = Date.now();
        title = title.trim();
        if (title.length > 128) {
            body = '...' + title.substring(125) + (body ? '\n\n' + body : '');
            title = title.substring(0, 125) + '...';
        }
        const parameters = {
            _id: inkdrop.main.dataStore.getLocalDB().notes.createId(),
            doctype: 'markdown',
            title: title,
            body: body !== null && body !== void 0 ? body : '',
            createdAt: timestamp,
            updatedAt: timestamp,
            bookId: book._id,
            tags: tags
                ? tags.map(tag => {
                    return tag._id;
                })
                : [],
        };
        return inkdrop.main.dataStore
            .getLocalDB()
            .notes.put(parameters)
            .then(async (result) => {
            const note = await this.getNote(result.id);
            this.notes.push(note);
            return note;
        });
    }
    static getCompletedNotes() {
        return inkdrop.main.dataStore
            .getLocalDB()
            .notes.findWithStatus(inkdrop_model_1.NOTE_STATUS.COMPLETED, { limit: null })
            .then((notes) => {
            return notes.docs;
        });
    }
    getSelectedNotes() {
        return inkdrop.store
            .getState()
            .notes.items.filter((note) => inkdrop.store
            .getState()
            .noteListBar.actionTargetNoteIds.includes(note._id));
    }
    static getTags() {
        return inkdrop.main.dataStore
            .getLocalDB()
            .tags.all({ limit: null })
            .then((tags) => {
            return tags;
        });
    }
    getTag(id) {
        return inkdrop.main.dataStore
            .getLocalDB()
            .tags.get(id)
            .then((tag) => {
            return tag;
        });
    }
    async createTag(name, color, count) {
        const timestamp = Date.now();
        const parameters = {
            _id: inkdrop.main.dataStore.getLocalDB().tags.createId(),
            name: name,
            color: color !== null && color !== void 0 ? color : inkdrop_model_1.TAG_COLOR.DEFAULT,
            count: count !== null && count !== void 0 ? count : 0,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        return inkdrop.main.dataStore
            .getLocalDB()
            .tags.put(parameters)
            .then(async (result) => {
            const tag = await this.getTag(result.id);
            this.tags.push(tag);
            return tag;
        });
    }
    getBookById(bookId) {
        var _a;
        return (_a = this.books.find(book => book._id === bookId)) !== null && _a !== void 0 ? _a : null;
    }
    getBookByNameAndParent(name, parent) {
        var _a;
        return ((_a = this.books.find(book => book.name.trim() === name.trim() &&
            ((parent && book.parentBookId === parent._id) ||
                (!parent && !book.parentBookId)))) !== null && _a !== void 0 ? _a : null);
    }
    getRootBooks() {
        return this.books.filter(filterBook => filterBook.parentBookId === null);
    }
    getSubBooks(book) {
        return this.books.filter(filterBook => filterBook.parentBookId === book._id);
    }
    getBookNotes(book) {
        return this.notes.filter(note => note.bookId === book._id);
    }
    bookContainsNoteWithTitle(book, bookTitle) {
        return this.notes.some(note => note.title.trim() === bookTitle.trim() && note.bookId === book._id);
    }
    getBookHierarchy(book) {
        const bookHierarchy = [];
        let currentBook = book;
        while (currentBook) {
            bookHierarchy.unshift(currentBook);
            currentBook = currentBook.parentBookId
                ? this.getBookById(currentBook.parentBookId)
                : null;
        }
        return bookHierarchy;
    }
    noteCanBeExported(note) {
        if (note.status === 'completed' &&
            !inkdrop.config.get('todoist-sync.syncCompleted')) {
            return false;
        }
        if (inkdrop.config.get('todoist-sync.exportTags') &&
            !this.noteHasSomeTags(note, this.getTagsFromString(inkdrop.config.get('todoist-sync.exportTags')))) {
            return false;
        }
        return true;
    }
    getNoteTags(note) {
        return this.tags.filter(label => { var _a; return (_a = note.tags) === null || _a === void 0 ? void 0 : _a.includes(label._id); });
    }
    noteHasSomeTags(note, tags) {
        return tags.some(tag => { var _a; return (_a = note.tags) === null || _a === void 0 ? void 0 : _a.includes(tag._id); });
    }
    noteHasTagWithName(note, tagName) {
        return this.tags.some(tag => { var _a; return tag.name.trim() === tagName.trim() && ((_a = note.tags) === null || _a === void 0 ? void 0 : _a.includes(tag._id)); });
    }
    tagExists(name) {
        return this.tags.some(tag => tag.name.trim() === name.trim());
    }
    getTagsByNames(names) {
        const tagNames = names.map(name => {
            return name.trim();
        });
        return this.tags.filter(tag => tagNames.includes(tag.name.trim()));
    }
    getTagsFromString(tagString) {
        return this.getTagsByNames(tagString.split(',').map(tagName => {
            return tagName.trim().replace(/^"|"$/g, '');
        }));
    }
    static getTodoistApi() {
        if (!inkdrop.config.get('todoist-sync.apiKey')) {
            inkdrop.notifications.addWarning('Todoist API key not set', {
                detail: 'Please provide your Todoist API key in the plugin settings.',
                dismissable: true,
            });
            return null;
        }
        return new todoist_api_typescript_1.TodoistApi(inkdrop.config.get('todoist-sync.apiKey'));
    }
    static getTodoistProjects(todoistApi) {
        return todoistApi
            .getProjects()
            .then(projects => {
            return projects;
        })
            .catch(error => {
            this.handleTodoistError(error);
            throw error;
        });
    }
    createTodoistProject(name, color, parent) {
        const parameters = {
            name: name.trim(),
        };
        if (color) {
            parameters.color = color;
        }
        if (parent) {
            parameters.parentId = parent.id;
        }
        return this.todoistApi
            .addProject(parameters)
            .then(project => {
            this.todoistProjects.push(project);
            return project;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    async createTodoistProjectHierarchyToRoot(book) {
        var _a;
        const bookHierarchy = this.getBookHierarchy(book);
        let currentTodoistProject = undefined;
        try {
            for (const book of bookHierarchy) {
                currentTodoistProject =
                    (_a = this.getTodoistProjectByNameAndParent(book.name, currentTodoistProject)) !== null && _a !== void 0 ? _a : (await this.createTodoistProject(book.name, types_1.TodoistColorNames[(inkdrop.config.get('todoist-sync.projectColor'))], currentTodoistProject));
            }
        }
        catch (error) {
            inkdrop_1.logger.error('Creating Todoist task hierarchy failed. Details: ' + error);
            throw new Error('Creating Todoist task hierarchy failed.');
        }
        return currentTodoistProject;
    }
    static getTodoistSections(todoistApi) {
        return todoistApi
            .getSections()
            .then(projects => {
            return projects;
        })
            .catch(error => {
            this.handleTodoistError(error);
            throw error;
        });
    }
    createTodoistSection(name, project) {
        const parameters = {
            name: name.trim(),
            projectId: project.id,
        };
        return this.todoistApi
            .addSection(parameters)
            .then(section => {
            this.todoistSections.push(section);
            return section;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    static getTodoistTasks(todoistApi) {
        return todoistApi
            .getTasks()
            .then((tasks) => {
            return tasks;
        })
            .catch((error) => {
            this.handleTodoistError(error);
            throw error;
        });
    }
    createTodoistTask(content, labels, project, section, parent) {
        const parameters = {
            content: content.trim(),
        };
        if (labels) {
            parameters.labelIds = labels.map(label => {
                return label.id;
            });
        }
        if (project) {
            parameters.projectId = project.id;
        }
        if (section) {
            parameters.sectionId = section.id;
        }
        if (parent) {
            parameters.parentId = parent.id;
        }
        return this.todoistApi
            .addTask(parameters)
            .then(task => {
            this.todoistTasks.push(task);
            return task;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    completeTodoistTask(task) {
        return this.todoistApi
            .closeTask(task.id)
            .then()
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    static getTodoistLabels(todoistApi) {
        return todoistApi
            .getLabels()
            .then(labels => {
            return labels;
        })
            .catch(error => {
            this.handleTodoistError(error);
            throw error;
        });
    }
    createTodoistLabel(name) {
        const parameters = {
            name: name.trim(),
        };
        return this.todoistApi
            .addLabel(parameters)
            .then(label => {
            this.todoistLabels.push(label);
            return label;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    todoistProjectExists(name) {
        return this.todoistProjects.some(project => project.name.trim() === name.trim());
    }
    getTodoistProjectById(projectId) {
        var _a;
        return ((_a = this.todoistProjects.find(project => project.id === projectId)) !== null && _a !== void 0 ? _a : null);
    }
    getTodoistProjectByName(name) {
        var _a;
        return ((_a = this.todoistProjects.find(project => project.name.trim() === name.trim())) !== null && _a !== void 0 ? _a : null);
    }
    getTodoistProjectByNameAndParent(name, parent) {
        var _a;
        return ((_a = this.todoistProjects.find(project => project.name.trim() === name.trim() &&
            ((parent && project.parentId === parent.id) ||
                (!parent && project.parentId === undefined)))) !== null && _a !== void 0 ? _a : null);
    }
    getTodoistRootProjects() {
        return this.todoistProjects.filter(project => project.parentId === undefined);
    }
    getTodoistProjectHierarchyByBookHierarchy(bookHierarchy) {
        const todoistProjectHierarchy = [];
        let currentTodoistProject = undefined;
        for (const book of bookHierarchy) {
            currentTodoistProject = this.getTodoistProjectByNameAndParent(book.name, currentTodoistProject);
            if (!currentTodoistProject) {
                //logger.error('Error');
                //   'Getting Todoist project hierarchy for book hierarchy ' +
                //     bookHierarchy
                //       .map(book => {
                //         return book.name;
                //       })
                //       .join(', ') +
                //     ' failed.'
                // );
                return null;
            }
            todoistProjectHierarchy.push(currentTodoistProject);
        }
        return todoistProjectHierarchy;
    }
    getTodoistSubProjects(project) {
        return this.todoistProjects.filter(filterProject => filterProject.parentId === project.id);
    }
    getTodoistProjectHierarchy(project) {
        const projectHierarchy = [];
        let currentProject = project;
        while (currentProject) {
            projectHierarchy.unshift(currentProject);
            currentProject = currentProject.parentId
                ? this.getTodoistProjectById(currentProject.parentId)
                : null;
        }
        return projectHierarchy;
    }
    getTodoistProjectSections(project) {
        return this.todoistSections.filter(section => section.projectId === project.id);
    }
    getTodoistProjectTasks(project) {
        return this.todoistTasks.filter(task => task.projectId === project.id && task.parentId === undefined);
    }
    getTodoistProjectSubTasks(project) {
        return this.todoistTasks.filter(task => task.projectId === project.id && task.parentId !== undefined);
    }
    getTodoistSectionsFromString(sectionString) {
        return this.getTodoistSectionsByNames(sectionString.split(',').map(sectionName => {
            return sectionName.trim().replace(/^"|"$/g, '');
        }));
    }
    getTodoistSectionsByNames(names) {
        const sectionNames = names.map(name => {
            return name.trim();
        });
        return this.todoistSections.filter(section => sectionNames.includes(section.name.trim()));
    }
    getTodoistSectionById(sectionId) {
        var _a;
        return ((_a = this.todoistSections.find(section => section.id === sectionId)) !== null && _a !== void 0 ? _a : null);
    }
    getTodoistSectionByName(name) {
        var _a;
        return ((_a = this.todoistSections.find(section => section.name.trim() === name.trim())) !== null && _a !== void 0 ? _a : null);
    }
    getTodoistSectionByNameAndProject(name, project) {
        var _a;
        return ((_a = this.todoistSections.find(section => section.name.trim() === name.trim() &&
            section.projectId === project.id)) !== null && _a !== void 0 ? _a : null);
    }
    getTodoistSectionTasks(section) {
        return this.todoistTasks.filter(task => task.projectId === section.id);
    }
    todoistTaskCanBeImported(task) {
        if (inkdrop.config.get('todoist-sync.importLabels') &&
            !this.todoistTaskHasSomeLabels(task, this.getTodoistLabelsFromString(inkdrop.config.get('todoist-sync.importLabels')))) {
            return false;
        }
        if (inkdrop.config.get('todoist-sync.importSections') &&
            !this.todoistTaskIsInAnySection(task, this.getTodoistSectionsFromString(inkdrop.config.get('todoist-sync.importSections')))) {
            return false;
        }
        return true;
    }
    getTodoistSubTasks(task) {
        return this.todoistTasks.filter(filterTask => filterTask.parentId === task.id);
    }
    todoistTaskIsInAnySection(task, sections) {
        return sections.some(section => section.id === task.sectionId);
    }
    getTodoistTaskLabels(task) {
        return this.todoistLabels.filter(label => task.labelIds.includes(label.id));
    }
    todoistTaskHasSomeLabels(task, labels) {
        return labels.some(label => task.labelIds.includes(label.id));
    }
    getTodoistLabelsByNames(names) {
        const labelNames = names.map(name => {
            return name.trim();
        });
        return this.todoistLabels.filter(label => labelNames.includes(label.name.trim()));
    }
    getTodoistLabelsFromString(tagString) {
        return this.getTodoistLabelsByNames(tagString.split(',').map(tagName => {
            return tagName.trim().replace(/^"|"$/g, '');
        }));
    }
    todoistProjectContainsSectionWithName(project, sectionName) {
        return this.todoistSections.some(section => section.name.trim() === sectionName.trim() &&
            section.projectId === project.id);
    }
    todoistProjectContainsTaskWithContent(project, taskContent) {
        taskContent = taskContent.trim();
        let startsWith = false;
        if (taskContent.endsWith('...')) {
            taskContent = taskContent.substring(0, taskContent.length - 3);
            startsWith = true;
        }
        return inkdrop.config.get('todoist-sync.exportExistingSubTasks')
            ? this.todoistTasks.some(task => (startsWith
                ? task.content.startsWith(taskContent)
                : task.content === taskContent) &&
                task.projectId === project.id &&
                task.parentId === undefined)
            : this.todoistTasks.some(task => (startsWith
                ? task.content.startsWith(taskContent)
                : task.content === taskContent) && task.projectId === project.id);
    }
    todoistSectionContainsTaskWithContent(section, taskContent) {
        return this.todoistTasks.some(task => task.content.trim() === taskContent.trim() &&
            task.sectionId === section.id);
    }
    todoistTaskHasLabelWithName(task, labelName) {
        return this.todoistLabels.some(label => label.name.trim() === labelName.trim() &&
            task.labelIds.includes(label.id));
    }
    todoistLabelExists(name) {
        return this.todoistLabels.some(label => label.name.trim() === name.trim());
    }
    static handleTodoistError(error) {
        switch (error.httpStatusCode) {
            case 401:
                inkdrop_1.logger.error('todoist-sync: Todoist API access was denied.');
                inkdrop.notifications.addError('Todoist API access failed', {
                    detail: 'Please check your Todoist API key in the plugin settings.',
                    dismissable: true,
                });
                break;
            default:
                inkdrop_1.logger.error('todoist-syc: Undefined API error.');
                break;
        }
    }
}
exports.TodoistSyncCore = TodoistSyncCore;
//# sourceMappingURL=todoist-sync-core.js.map