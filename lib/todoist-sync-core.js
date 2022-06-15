"use strict";
'use babel';
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoistSyncCore = void 0;
const todoist_api_typescript_1 = require("@doist/todoist-api-typescript");
const types_1 = require("./types");
const inkdrop_model_1 = require("inkdrop-model");
class TodoistSyncCore {
    constructor(books, notes, tags, todoistApi, projects, sections, tasks, labels) {
        this.books = books;
        this.notes = notes;
        this.tags = tags;
        this.todoistApi = todoistApi;
        this.projects = projects;
        this.sections = sections;
        this.tasks = tasks;
        this.labels = labels;
    }
    static async construct() {
        let books = null;
        let notes = null;
        let tags = null;
        const todoistApi = TodoistSyncCore.getTodoistApi();
        let projects = null;
        let sections = null;
        let tasks = null;
        let labels = null;
        if (!todoistApi) {
            throw new Error('Todoist API initialisation failed.');
        }
        try {
            books = await TodoistSyncCore.getBooks();
            notes = await TodoistSyncCore.getNotes();
            notes = notes.concat(await TodoistSyncCore.getCompletedNotes());
            notes = notes.concat(await TodoistSyncCore.getDroppedNotes());
            tags = await TodoistSyncCore.getTags();
        }
        catch (error) {
            throw new Error('Getting Inkdrop data failed.');
        }
        try {
            projects = await TodoistSyncCore.getProjects(todoistApi);
            sections = await TodoistSyncCore.getSections(todoistApi);
            tasks = await TodoistSyncCore.getTasks(todoistApi);
            labels = await TodoistSyncCore.getLabels(todoistApi);
        }
        catch (error) {
            throw new Error('Getting Todoist data failed.');
        }
        return new TodoistSyncCore(books, notes, tags, todoistApi, projects, sections, tasks, labels);
    }
    async syncAll() {
        const syncDirection = inkdrop.config.get('todoist-sync.syncDirection');
        if (syncDirection === "export" /* SYNC_DIRECTION.EXPORT */ ||
            syncDirection === "both" /* SYNC_DIRECTION.BOTH */) {
            await this.exportAllBooks();
        }
        if (syncDirection === "import" /* SYNC_DIRECTION.IMPORT */ ||
            syncDirection === "both" /* SYNC_DIRECTION.BOTH */) {
            await this.importAllProjects();
        }
    }
    async syncSelected() {
        const syncDirection = inkdrop.config.get('todoist-sync.syncDirection');
        if (syncDirection === "export" /* SYNC_DIRECTION.EXPORT */ ||
            syncDirection === "both" /* SYNC_DIRECTION.BOTH */) {
            await this.exportSelectedBooks();
        }
        if (syncDirection === "import" /* SYNC_DIRECTION.IMPORT */ ||
            syncDirection === "both" /* SYNC_DIRECTION.BOTH */) {
            await this.importSelectedProjects();
        }
    }
    async importAllProjects() {
        await this.importProjects(this.getRootProjects());
    }
    async importSelectedProjects() {
        var _a;
        const book = inkdrop.store.getState().bookList.bookForContextMenu;
        const bookHierarchy = this.getBookHierarchy(book);
        const project = (_a = this.getProjectHierarchyByBookHierarchy(bookHierarchy)) === null || _a === void 0 ? void 0 : _a.pop();
        if (!project) {
            throw new Error('The notebook hierarchy containing ' +
                book.name +
                ' does not exist as project hierarchy in Todoist.');
        }
        await this.importProject(project);
    }
    async importProjects(projects) {
        for (const project of projects) {
            await this.importProject(project);
        }
    }
    async importProject(project) {
        await this.importTasks(this.getProjectTasks(project));
        if (inkdrop.config.get('todoist-sync.importSubTasks')) {
            await this.importTasks(this.getProjectSubTasks(project));
        }
        if (inkdrop.config.get('todoist-sync.importProjectComments')) {
            await this.importComments(await this.getCommentsForProject(project));
        }
        await this.importProjects(this.getSubProjects(project));
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
            try {
                await this.importTask(task);
                if (inkdrop.config.get('todoist-sync.importSubTasks')) {
                    for (const subTask of this.getSubTasks(task)) {
                        await this.importTask(subTask);
                    }
                }
            }
            catch (error) {
                throw new Error('Importing task failed.');
            }
        }
    }
    async importTask(task) {
        var _a;
        if (!this.taskCanBeImported(task)) {
            return;
        }
        const project = this.getProjectById(task.projectId);
        if (!project) {
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
            const section = this.getSectionById(task.sectionId);
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
                ? this.getTaskLabels(task)
                : [];
            if (inkdrop.config.get('todoist-sync.syncTags')) {
                await this.importLabels(labels);
            }
            const tags = inkdrop.config.get('todoist-sync.syncTags')
                ? this.getTagsByNames(labels.map(label => {
                    return label.name;
                }))
                : [];
            let taskDescription = inkdrop.config.get('todoist-sync.importTaskDescriptions')
                ? task.description
                : '';
            if (inkdrop.config.get('todoist-sync.importTaskComments')) {
                const commentsString = await this.getTaskCommentString(task);
                taskDescription = taskDescription ? taskDescription + '\n\n' : '';
                taskDescription = commentsString
                    ? taskDescription + commentsString
                    : taskDescription;
            }
            await this.createNote(task.content, book, taskDescription, tags);
        }
    }
    async importLabels(labels) {
        for (const label of labels) {
            try {
                await this.importLabel(label);
            }
            catch (error) {
                throw new Error('Importing label failed.');
            }
        }
    }
    async importLabel(label) {
        if (!this.tagExists(label.name)) {
            await this.createTag(label.name, inkdrop.config.get('todoist-sync.tagColor'));
        }
    }
    async importComments(comments) {
        for (const comment of comments) {
            try {
                await this.importComment(comment);
            }
            catch (error) {
                throw new Error('Importing comment failed.');
            }
        }
    }
    async importComment(comment) {
        if (!comment.projectId) {
            throw new Error('Todoist comment ' + comment.id + ' is not attached to a project.');
        }
        const project = this.getProjectById(comment.projectId);
        if (!project) {
            throw new Error('Todoist project ' +
                comment.projectId +
                ' (from comment ' +
                comment.id +
                ') not found.');
        }
        const book = await this.createBookHierarchyToRoot(project);
        if (!book) {
            throw new Error('Could not find book for Todoist project ' +
                project.id +
                ' to attach comment ' +
                comment.id +
                '.');
        }
        if (book && !this.bookContainsNoteWithTitle(book, comment.content)) {
            await this.createNote(comment.content, book);
        }
    }
    async exportSelectedNotes() {
        const notes = this.getSelectedNotes();
        const projectName = inkdrop.config.get('todoist-sync.singleNoteExportProject');
        try {
            await this.exportNotes(notes, projectName, true);
        }
        catch (error) {
            throw new Error('Exporting selected notes failed.');
        }
    }
    async exportNotes(notes, projectName, forceExport) {
        for (const note of notes) {
            try {
                projectName
                    ? await this.exportNoteToProjectWithName(note, projectName, forceExport)
                    : await this.exportNote(note, undefined, forceExport);
            }
            catch (error) {
                throw new Error('Exporting note failed.');
            }
        }
    }
    async exportNote(note, targetProject, forceExport) {
        var _a, _b, _c, _d, _e;
        if (!forceExport && !this.noteCanBeExported(note)) {
            return;
        }
        const book = this.getBookById(note.bookId);
        let project = undefined;
        if (!book) {
            throw new Error('Book ' + note.bookId + ' (from note ' + note._id + ') not found.');
        }
        if (inkdrop.config.get('todoist-sync.exportNotebooksAsSections') &&
            !inkdrop.config.get('todoist-sync.exportSection').length &&
            !targetProject &&
            book.parentBookId &&
            !this.getSubBooks(book).length &&
            !this.getProjectHierarchyByBookHierarchy(this.getBookHierarchy(book))) {
            const parentBook = this.getBookById(book.parentBookId);
            if (!parentBook) {
                throw new Error('Could not find Todoist project for book ' +
                    book.parentBookId +
                    ' to attach note ' +
                    note._id +
                    '.');
            }
            project = await this.createProjectHierarchyToRoot(parentBook);
        }
        else {
            project =
                targetProject !== null && targetProject !== void 0 ? targetProject : (await this.createProjectHierarchyToRoot(book));
        }
        if (!project) {
            throw new Error('Could not find Todoist project for book ' +
                book._id +
                ' to attach note ' +
                note._id +
                '.');
        }
        if (project && !this.projectContainsTaskWithContent(project, note.title)) {
            let section = undefined;
            if (inkdrop.config.get('todoist-sync.exportNotebooksAsSections') &&
                !inkdrop.config.get('todoist-sync.exportSection').length &&
                book.parentBookId &&
                !this.getSubBooks(book).length &&
                project.name.trim() === ((_a = this.getBookById(book.parentBookId)) === null || _a === void 0 ? void 0 : _a.name.trim())) {
                section =
                    (_b = this.getSectionByNameAndProject(book.name, project)) !== null && _b !== void 0 ? _b : (await this.createSection(book.name, project));
            }
            else if (inkdrop.config.get('todoist-sync.exportSection') &&
                !this.projectContainsSectionWithName(project, inkdrop.config.get('todoist-sync.exportSection'))) {
                section =
                    (_c = this.getSectionByName(inkdrop.config.get('todoist-sync.exportSection'))) !== null && _c !== void 0 ? _c : (await this.createSection(inkdrop.config.get('todoist-sync.exportSection'), project));
            }
            const tags = inkdrop.config.get('todoist-sync.syncTags')
                ? this.getNoteTags(note)
                : [];
            if (inkdrop.config.get('todoist-sync.syncTags')) {
                await this.exportTags(tags);
            }
            const labels = inkdrop.config.get('todoist-sync.syncTags')
                ? this.getLabelsByNames(tags.map(tag => {
                    return tag.name;
                }))
                : [];
            if (note.status === inkdrop_model_1.NOTE_STATUS.ACTIVE &&
                inkdrop.config.get('todoist-sync.activeLabel')) {
                const activeLabel = (_d = this.getLabelByName(inkdrop.config.get('todoist-sync.activeLabel'))) !== null && _d !== void 0 ? _d : (await this.createLabel(inkdrop.config.get('todoist-sync.activeLabel'), inkdrop.config.get('todoist-sync.labelColor')));
                labels.push(activeLabel);
            }
            if (note.status === inkdrop_model_1.NOTE_STATUS.ON_HOLD &&
                inkdrop.config.get('todoist-sync.onHoldLabel')) {
                const onHoldLabel = (_e = this.getLabelByName(inkdrop.config.get('todoist-sync.onHoldLabel'))) !== null && _e !== void 0 ? _e : (await this.createLabel(inkdrop.config.get('todoist-sync.onHoldLabel'), inkdrop.config.get('todoist-sync.labelColor')));
                labels.push(onHoldLabel);
            }
            const task = await this.createTask(note.title, inkdrop.config.get('todoist-sync.exportNoteBodies')
                ? note.body
                : undefined, labels, project, section);
            if (note.status === inkdrop_model_1.NOTE_STATUS.COMPLETED ||
                note.status === inkdrop_model_1.NOTE_STATUS.DROPPED) {
                await this.completeTask(task);
            }
        }
    }
    async exportNoteToProjectWithName(note, projectName, forceExport) {
        var _a;
        const project = (_a = this.getProjectByName(projectName)) !== null && _a !== void 0 ? _a : (await this.createProject(projectName, types_1.TodoistColorNames[inkdrop.config.get('todoist-sync.projectColor')]));
        await this.exportNote(note, project, forceExport);
    }
    async exportTags(tags) {
        for (const tag of tags) {
            try {
                await this.exportTag(tag);
            }
            catch (error) {
                throw new Error('Exporting single tag failed.');
            }
        }
    }
    async exportTag(tag) {
        if (!this.labelExists(tag.name)) {
            await this.createLabel(tag.name, types_1.TodoistColorNames[inkdrop.config.get('todoist-sync.labelColor')]);
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
        const projectHierarchy = this.getProjectHierarchy(project);
        let currentBook = undefined;
        try {
            for (const project of projectHierarchy) {
                currentBook =
                    (_a = this.getBookByNameAndParent(project.name, currentBook)) !== null && _a !== void 0 ? _a : (await this.createBook(project.name, currentBook));
            }
        }
        catch (error) {
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
            title = this.getTrimmedNoteTitle(title) + '...';
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
    static getDroppedNotes() {
        return inkdrop.main.dataStore
            .getLocalDB()
            .notes.findWithStatus(inkdrop_model_1.NOTE_STATUS.DROPPED, { limit: null })
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
    bookContainsNoteWithTitle(book, noteTitle) {
        this.notes.forEach(note => {
            console.log('trimmed note title');
            console.log(this.getTrimmedNoteTitle(note.title));
            console.log('trimmed wanted title');
            console.log(this.getTrimmedNoteTitle(noteTitle));
        });
        return this.notes.some(note => this.getTrimmedNoteTitle(note.title) ===
            this.getTrimmedNoteTitle(noteTitle) && note.bookId === book._id);
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
    getTrimmedNoteTitle(title) {
        let trimmed = title.trim();
        trimmed = trimmed.endsWith('...')
            ? trimmed.substring(0, trimmed.length - 3)
            : trimmed;
        return trimmed.length > 128 ? trimmed.substring(0, 125) : trimmed;
    }
    noteCanBeExported(note) {
        if (note.status === 'completed' &&
            !inkdrop.config.get('todoist-sync.exportCompleted')) {
            return false;
        }
        if (note.status === 'dropped' &&
            !inkdrop.config.get('todoist-sync.exportDropped')) {
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
    static getProjects(todoistApi) {
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
    createProject(name, color, parent) {
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
            this.projects.push(project);
            return project;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    async createProjectHierarchyToRoot(book) {
        var _a;
        const bookHierarchy = this.getBookHierarchy(book);
        let currentProject = undefined;
        try {
            for (const book of bookHierarchy) {
                currentProject =
                    (_a = this.getProjectByNameAndParent(book.name, currentProject)) !== null && _a !== void 0 ? _a : (await this.createProject(book.name, types_1.TodoistColorNames[(inkdrop.config.get('todoist-sync.projectColor'))], currentProject));
            }
        }
        catch (error) {
            throw new Error('Creating Todoist task hierarchy failed.');
        }
        return currentProject;
    }
    static getSections(todoistApi) {
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
    createSection(name, project) {
        const parameters = {
            name: name.trim(),
            projectId: project.id,
        };
        return this.todoistApi
            .addSection(parameters)
            .then(section => {
            this.sections.push(section);
            return section;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    static getTasks(todoistApi) {
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
    createTask(content, description, labels, project, section, parent) {
        const parameters = {
            content: content.trim(),
        };
        if (description) {
            parameters.description = description;
        }
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
            this.tasks.push(task);
            return task;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    completeTask(task) {
        return this.todoistApi
            .closeTask(task.id)
            .then()
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    static getLabels(todoistApi) {
        return todoistApi
            .getLabels()
            .then(labels => {
            return labels;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    createLabel(name, color) {
        const parameters = {
            name: name.trim().replace(/[ @!"(),\\]/g, '_'),
        };
        if (color) {
            parameters.color = color;
        }
        return this.todoistApi
            .addLabel(parameters)
            .then(label => {
            this.labels.push(label);
            return label;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    getCommentsForProject(project) {
        return this.todoistApi
            .getComments({ projectId: project.id })
            .then(comments => {
            return comments;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    getCommentsForTask(task) {
        return this.todoistApi
            .getComments({ taskId: task.id })
            .then(comments => {
            return comments;
        })
            .catch(error => {
            TodoistSyncCore.handleTodoistError(error);
            throw error;
        });
    }
    projectExists(name) {
        return this.projects.some(project => project.name.trim() === name.trim());
    }
    getProjectById(projectId) {
        var _a;
        return (_a = this.projects.find(project => project.id === projectId)) !== null && _a !== void 0 ? _a : null;
    }
    getProjectByName(name) {
        var _a;
        return ((_a = this.projects.find(project => project.name.trim() === name.trim())) !== null && _a !== void 0 ? _a : null);
    }
    getProjectByNameAndParent(name, parent) {
        var _a;
        return ((_a = this.projects.find(project => project.name.trim() === name.trim() &&
            ((parent && project.parentId === parent.id) ||
                (!parent && project.parentId === undefined)))) !== null && _a !== void 0 ? _a : null);
    }
    getRootProjects() {
        return this.projects.filter(project => project.parentId === undefined);
    }
    getProjectHierarchyByBookHierarchy(bookHierarchy) {
        const projectHierarchy = [];
        let currentProject = undefined;
        for (const book of bookHierarchy) {
            currentProject = this.getProjectByNameAndParent(book.name, currentProject);
            if (!currentProject) {
                return null;
            }
            projectHierarchy.push(currentProject);
        }
        return projectHierarchy;
    }
    getSubProjects(project) {
        return this.projects.filter(filterProject => filterProject.parentId === project.id);
    }
    getProjectHierarchy(project) {
        const projectHierarchy = [];
        let currentProject = project;
        while (currentProject) {
            projectHierarchy.unshift(currentProject);
            currentProject = currentProject.parentId
                ? this.getProjectById(currentProject.parentId)
                : null;
        }
        return projectHierarchy;
    }
    getProjectTasks(project) {
        return this.tasks.filter(task => task.projectId === project.id && task.parentId === undefined);
    }
    getProjectSubTasks(project) {
        return this.tasks.filter(task => task.projectId === project.id && task.parentId !== undefined);
    }
    getSectionsFromString(sectionString) {
        return this.getSectionsByNames(sectionString.split(',').map(sectionName => {
            return sectionName.trim().replace(/^"|"$/g, '');
        }));
    }
    getSectionsByNames(names) {
        const sectionNames = names.map(name => {
            return name.trim();
        });
        return this.sections.filter(section => sectionNames.includes(section.name.trim()));
    }
    getSectionById(sectionId) {
        var _a;
        return (_a = this.sections.find(section => section.id === sectionId)) !== null && _a !== void 0 ? _a : null;
    }
    getSectionByName(name) {
        var _a;
        return ((_a = this.sections.find(section => section.name.trim() === name.trim())) !== null && _a !== void 0 ? _a : null);
    }
    getSectionByNameAndProject(name, project) {
        var _a;
        return ((_a = this.sections.find(section => section.name.trim() === name.trim() &&
            section.projectId === project.id)) !== null && _a !== void 0 ? _a : null);
    }
    getSectionTasks(section) {
        return this.tasks.filter(task => task.projectId === section.id);
    }
    taskCanBeImported(task) {
        if (inkdrop.config.get('todoist-sync.importLabels') &&
            !this.taskHasSomeLabels(task, this.getLabelsFromString(inkdrop.config.get('todoist-sync.importLabels')))) {
            return false;
        }
        if (inkdrop.config.get('todoist-sync.importSections') &&
            !this.taskIsInAnySection(task, this.getSectionsFromString(inkdrop.config.get('todoist-sync.importSections')))) {
            return false;
        }
        return true;
    }
    getSubTasks(task) {
        return this.tasks.filter(filterTask => filterTask.parentId === task.id);
    }
    taskIsInAnySection(task, sections) {
        return sections.some(section => section.id === task.sectionId);
    }
    getTaskLabels(task) {
        return this.labels.filter(label => task.labelIds.includes(label.id));
    }
    taskHasSomeLabels(task, labels) {
        return labels.some(label => task.labelIds.includes(label.id));
    }
    getLabelByName(name) {
        var _a;
        return ((_a = this.labels.find(label => label.name.trim() === name.trim().replace(/[ @!"(),\\]/g, '_'))) !== null && _a !== void 0 ? _a : null);
    }
    getLabelsByNames(names) {
        const labelNames = names.map(name => {
            return name.trim().replace(/[ @!"(),\\]/g, '_');
        });
        return this.labels.filter(label => labelNames.includes(label.name.trim()));
    }
    getLabelsFromString(tagString) {
        return this.getLabelsByNames(tagString.split(',').map(tagName => {
            return tagName.trim().replace(/^"|"$/g, '');
        }));
    }
    async getTaskCommentString(task) {
        const comments = await this.getCommentsForTask(task);
        if (!comments.length) {
            return '';
        }
        let commentsString = '# Todoist Comments';
        comments.forEach(comment => {
            commentsString += '\n';
            commentsString +=
                '## ' + new Date(Date.parse(comment.posted)).toLocaleString();
            commentsString += '\n';
            commentsString += comment.content;
        });
        return commentsString;
    }
    projectContainsSectionWithName(project, sectionName) {
        return this.sections.some(section => section.name.trim() === sectionName.trim() &&
            section.projectId === project.id);
    }
    projectContainsTaskWithContent(project, taskContent) {
        taskContent = taskContent.trim();
        let startsWith = false;
        if (taskContent.endsWith('...')) {
            taskContent = taskContent.substring(0, taskContent.length - 3);
            startsWith = true;
        }
        return inkdrop.config.get('todoist-sync.exportExistingSubTasks')
            ? this.tasks.some(task => (startsWith
                ? task.content.startsWith(taskContent)
                : task.content === taskContent) &&
                task.projectId === project.id &&
                task.parentId === undefined)
            : this.tasks.some(task => (startsWith
                ? task.content.startsWith(taskContent)
                : task.content === taskContent) && task.projectId === project.id);
    }
    labelExists(name) {
        return this.labels.some(label => label.name.trim() === name.trim().replace(/[ @!"(),\\]/g, '_'));
    }
    static handleTodoistError(error) {
        switch (error.httpStatusCode) {
            case 401:
                inkdrop.notifications.addError('Todoist API access failed', {
                    detail: 'Please check your Todoist API key in the plugin settings.',
                    dismissable: true,
                });
                break;
            default:
                break;
        }
    }
}
exports.TodoistSyncCore = TodoistSyncCore;
//# sourceMappingURL=todoist-sync-core.js.map