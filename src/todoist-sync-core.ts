'use babel';

import {
  AddLabelArgs,
  AddProjectArgs,
  AddSectionArgs,
  AddTaskArgs,
  Label,
  Project,
  Section,
  Task,
  TodoistApi,
  TodoistRequestError,
} from '@doist/todoist-api-typescript';
import {
  DbGetNotesResult,
  DbPutResult,
  Inkdrop,
  SYNC_DIRECTION,
  TodoistColor,
  TodoistColorNames,
  TodoistColorSetting,
} from './types';
import {logger} from "inkdrop";

import type {Note, Book, Tag, TagColor} from 'inkdrop-model';
import {NOTE_STATUS, TAG_COLOR} from 'inkdrop-model';

declare let inkdrop: Inkdrop;

export class TodoistSyncCore {
  private books: Book[];
  private notes: Note[];
  private tags: Tag[];

  private todoistApi: TodoistApi;
  private todoistProjects: Project[];
  private todoistSections: Section[];
  private todoistTasks: Task[];
  private todoistLabels: Label[];

  constructor(
    books: Book[],
    notes: Note[],
    tags: Tag[],
    todoistApi: TodoistApi,
    todoistProjects: Project[],
    todoistSections: Section[],
    todoistTasks: Task[],
    todoistLabels: Label[]
  ) {
    this.books = books;
    this.notes = notes;
    this.tags = tags;

    this.todoistApi = todoistApi;
    this.todoistProjects = todoistProjects;
    this.todoistSections = todoistSections;
    this.todoistTasks = todoistTasks;
    this.todoistLabels = todoistLabels;
  }

  static async construct(): Promise<TodoistSyncCore> {
    let books: Book[] | null = null;
    let notes: Note[] | null = null;
    let tags: Tag[] | null = null;

    const todoistApi: TodoistApi | null = TodoistSyncCore.getTodoistApi();
    let todoistProjects: Project[] | null = null;
    let todoistSections: Section[] | null = null;
    let todoistTasks: Task[] | null = null;
    let todoistLabels: Label[] | null = null;

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
    } catch (error) {
      logger.error('Getting Inkdrop data failed. Details: ' + error);
      throw new Error('Getting Inkdrop data failed.');
    }

    try {
      todoistProjects = await TodoistSyncCore.getTodoistProjects(todoistApi);
      todoistSections = await TodoistSyncCore.getTodoistSections(todoistApi);
      todoistTasks = await TodoistSyncCore.getTodoistTasks(todoistApi);
      todoistLabels = await TodoistSyncCore.getTodoistLabels(todoistApi);
    } catch (error) {
      logger.error('Getting Todoist data failed. Details: ' + error);
      throw new Error('Getting Todoist data failed.');
    }

    return new TodoistSyncCore(
      books,
      notes,
      tags,
      todoistApi,
      todoistProjects,
      todoistSections,
      todoistTasks,
      todoistLabels
    );
  }

  public async syncAll() {
    const syncDirection = inkdrop.config.get('todoist-sync.syncDirection');

    if (
      syncDirection === SYNC_DIRECTION.EXPORT ||
      syncDirection === SYNC_DIRECTION.EXPORT
    ) {
      await this.exportAllBooks();
    }

    if (
      syncDirection === SYNC_DIRECTION.IMPORT ||
      syncDirection === SYNC_DIRECTION.EXPORT
    ) {
      await this.importAllProjects();
    }
  }

  public async syncSelected() {
    const syncDirection = inkdrop.config.get('todoist-sync.syncDirection');

    if (
      syncDirection === SYNC_DIRECTION.EXPORT ||
      syncDirection === SYNC_DIRECTION.EXPORT
    ) {
      await this.exportSelectedBooks();
    }

    if (
      syncDirection === SYNC_DIRECTION.IMPORT ||
      syncDirection === SYNC_DIRECTION.EXPORT
    ) {
      await this.importSelectedProjects();
    }
  }

  public async importAllProjects() {
    await this.importProjects(this.getTodoistRootProjects());
  }

  public async importSelectedProjects() {
    const book = inkdrop.store.getState().bookList.bookForContextMenu;
    const bookHierarchy = this.getBookHierarchy(book);

    const todoistProject =
      this.getTodoistProjectHierarchyByBookHierarchy(bookHierarchy)?.pop();

    if (!todoistProject) {
      throw new Error(
        'The notebook hierarchy containing ' +
          book.name +
          ' does not exist as task hierarchy in Todoist.'
      );
    }

    await this.importProject(todoistProject);
  }

  private async importProjects(projects: Project[]) {
    for (const project of projects) {
      await this.importProject(project);
    }
  }

  private async importProject(project: Project) {
    await this.importTasks(this.getTodoistProjectTasks(project));
    if (inkdrop.config.get('todoist-sync.importSubTasks')) {
      await this.importTasks(this.getTodoistProjectSubTasks(project));
    }
    await this.importProjects(this.getTodoistSubProjects(project));
  }

  public async exportAllBooks() {
    await this.exportBooks(this.getRootBooks());
  }

  public async exportSelectedBooks() {
    const book = inkdrop.store.getState().bookList.bookForContextMenu;

    await this.exportBook(book);
  }

  private async exportBooks(books: Book[]) {
    for (const book of books) {
      await this.exportBook(book);
    }
  }

  private async exportBook(book: Book) {
    await this.exportNotes(this.getBookNotes(book));
    await this.exportBooks(this.getSubBooks(book));
  }

  private async importTasks(tasks: Task[]) {
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

  private async importTask(task: Task) {
    if (!this.todoistTaskCanBeImported(task)) {
      return;
    }

    const project = this.getTodoistProjectById(task.projectId);

    if (!project) {
      logger.error(
        'Todoist project ' +
          task.projectId +
          ' (from task ' +
          task.id +
          ') not found.'
      );
      throw new Error(
        'Todoist project ' +
          task.projectId +
          ' (from task ' +
          task.id +
          ') not found.'
      );
    }

    let book = await this.createBookHierarchyToRoot(project);

    if (!book) {
      throw new Error(
        'Could not find book for Todoist project ' +
          project.id +
          ' to attach task ' +
          task.id +
          '.'
      );
    }

    if (
      inkdrop.config.get('todoist-sync.importSectionsAsNotebooks') &&
      task.sectionId
    ) {
      const section: Section | null = this.getTodoistSectionById(
        task.sectionId
      );

      if (!section) {
        throw new Error(
          'Could not find Todoist section ' +
            task.sectionId +
            ' for task ' +
            task.id +
            '.'
        );
      }

      book =
        this.getBookByNameAndParent(section.name, book) ??
        (await this.createBook(section.name, book));
    }

    if (book && !this.bookContainsNoteWithTitle(book, task.content)) {
      const labels: Label[] = inkdrop.config.get('todoist-sync.syncTags')
        ? this.getTodoistTaskLabels(task)
        : [];
      if (inkdrop.config.get('todoist-sync.syncTags')) {
        await this.importLabels(labels);
      }
      const tags: Tag[] = inkdrop.config.get('todoist-sync.syncTags')
        ? this.getTagsByNames(
            labels.map(label => {
              return label.name;
            })
          )
        : [];

      const taskDescription = inkdrop.config.get(
        'todoist-sync.importTaskDescriptions'
      )
        ? task.description
        : '';
      await this.createNote(task.content, book, taskDescription, tags);
    }
  }

  private async importLabels(labels: Label[]) {
    for (const label of labels) {
      //try {
      await this.importLabel(label);
      //} catch (error) {
      //  logger.error('Importing single label failed. Details: ' + error);
      //  throw new Error('Importing single label failed.');
      //}
    }
  }

  private async importLabel(label: Label) {
    if (!this.tagExists(label.name)) {
      await this.createTag(
        label.name,
        inkdrop.config.get('todoist-sync.tagColor')
      );
    }
  }

  public async exportSelectedNotes() {
    const notes: Note[] = this.getSelectedNotes();
    const projectName: string = inkdrop.config.get(
      'todoist-sync.singleNoteExportProject'
    );

    try {
      await this.exportNotes(notes, projectName, true);
    } catch (error) {
      logger.error('Exporting notes failed. Details: ' + error);
      throw new Error('Exporting selected notes failed.');
    }
  }

  private async exportNotes(
    notes: Note[],
    projectName?: string,
    forceExport?: boolean
  ) {
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

  private async exportNote(
    note: Note,
    todoistProject?: Project,
    forceExport?: boolean
  ) {
    if (!forceExport && !this.noteCanBeExported(note)) {
      return;
    }

    const book = this.getBookById(note.bookId);
    let project: Project | undefined = undefined;

    if (!book) {
      logger.error(
        'Book ' + note.bookId + ' (from note ' + note._id + ') not found.'
      );
      throw new Error(
        'Book ' + note.bookId + ' (from note ' + note._id + ') not found.'
      );
    }

    if (
      inkdrop.config.get('todoist-sync.exportNotebooksAsSections') &&
      !inkdrop.config.get('todoist-sync.exportSection').length &&
      !todoistProject &&
      book.parentBookId &&
      !this.getSubBooks(book).length &&
      !this.getTodoistProjectHierarchyByBookHierarchy(
        this.getBookHierarchy(book)
      )
    ) {
      const parentBook: Book | null = this.getBookById(book.parentBookId);

      if (!parentBook) {
        throw new Error(
          'Could not find Todoist project for book ' +
            book.parentBookId +
            ' to attach note ' +
            note._id +
            '.'
        );
      }

      project = await this.createTodoistProjectHierarchyToRoot(parentBook);
    } else {
      project =
        todoistProject ??
        (await this.createTodoistProjectHierarchyToRoot(book));
    }

    if (!project) {
      throw new Error(
        'Could not find Todoist project for book ' +
          book._id +
          ' to attach note ' +
          note._id +
          '.'
      );
    }

    if (
      project &&
      !this.todoistProjectContainsTaskWithContent(project, note.title)
    ) {
      let section: Section | undefined = undefined;

      if (
        inkdrop.config.get('todoist-sync.exportNotebooksAsSections') &&
        !inkdrop.config.get('todoist-sync.exportSection').length &&
        book.parentBookId &&
        !this.getSubBooks(book).length &&
        project.name.trim() === this.getBookById(book.parentBookId)?.name.trim()
      ) {
        section =
          this.getTodoistSectionByNameAndProject(book.name, project) ??
          (await this.createTodoistSection(book.name, project));
      } else if (
        inkdrop.config.get('todoist-sync.exportSection') &&
        !this.todoistProjectContainsSectionWithName(
          project,
          inkdrop.config.get('todoist-sync.exportSection')
        )
      ) {
        section =
          this.getTodoistSectionByName(
            inkdrop.config.get('todoist-sync.exportSection')
          ) ??
          (await this.createTodoistSection(
            inkdrop.config.get('todoist-sync.exportSection'),
            project
          ));
      }

      const tags: Tag[] = inkdrop.config.get('todoist-sync.syncTags')
        ? this.getNoteTags(note)
        : [];
      if (inkdrop.config.get('todoist-sync.syncTags')) {
        await this.exportTags(tags);
      }
      const labels: Label[] = inkdrop.config.get('todoist-sync.syncTags')
        ? this.getTodoistLabelsByNames(
            tags.map(tag => {
              return tag.name;
            })
          )
        : [];

      const todoistTask = await this.createTodoistTask(
        note.title,
        labels,
        project,
        section
      );

      if (note.status === 'completed') {
        await this.completeTodoistTask(todoistTask);
      }
    }
  }

  private async exportNoteToProjectWithName(
    note: Note,
    projectName: string,
    forceExport?: boolean
  ) {
    const project =
      this.getTodoistProjectByName(projectName) ??
      (await this.createTodoistProject(
        projectName,
        TodoistColorNames[
          <TodoistColorSetting>inkdrop.config.get('todoist-sync.projectColor')
        ]
      ));

    await this.exportNote(note, project, forceExport);
  }

  private async exportTags(tags: Tag[]) {
    for (const tag of tags) {
      try {
        await this.exportTag(tag);
      } catch (error) {
        logger.error('Exporting single tag failed. Details: ' + error);
        throw new Error('Exporting single tag failed.');
      }
    }
  }

  private async exportTag(tag: Tag) {
    if (!this.todoistLabelExists(tag.name)) {
      await this.createTodoistLabel(tag.name);
    }
  }

  private static getBooks(): Promise<Book[]> {
    return inkdrop.main.dataStore
      .getLocalDB()
      .books.all()
      .then((books: Book[]) => {
        return books;
      });
  }

  private getBook(id: string): Promise<Book> {
    return inkdrop.main.dataStore
      .getLocalDB()
      .books.get(id)
      .then((book: Book) => {
        return book;
      });
  }

  private async createBook(name: string, parent?: Book): Promise<Book> {
    const timestamp = Date.now();

    const parameters: Book = {
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
      .then(async (result: DbPutResult) => {
        const book: Book = await this.getBook(result.id);
        this.books.push(book);
        return book;
      });
  }

  private async createBookHierarchyToRoot(
    project: Project
  ): Promise<Book | undefined> {
    const todoistProjectHierarchy = this.getTodoistProjectHierarchy(project);
    let currentBook: Book | undefined = undefined;

    try {
      for (const project of todoistProjectHierarchy) {
        currentBook =
          this.getBookByNameAndParent(project.name, currentBook) ??
          (await this.createBook(project.name, currentBook));
      }
    } catch (error) {
      logger.error('Creating book hierarchy failed. Details: ' + error);
      throw new Error('Creating book hierarchy failed.');
    }

    return currentBook;
  }

  private static getNotes(): Promise<Note[]> {
    return inkdrop.main.dataStore
      .getLocalDB()
      .notes.all({limit: null})
      .then((notes: DbGetNotesResult) => {
        return notes.docs;
      });
  }

  private getNote(id: string): Promise<Note> {
    return inkdrop.main.dataStore
      .getLocalDB()
      .notes.get(id)
      .then((note: Note) => {
        return note;
      });
  }

  private async createNote(
    title: string,
    book: Book,
    body?: string,
    tags?: Tag[]
  ): Promise<Note> {
    const timestamp = Date.now();

    title = title.trim();

    if (title.length > 128) {
      body = '...' + title.substring(125) + (body ? '\n\n' + body : '');
      title = title.substring(0, 125) + '...';
    }

    const parameters: Note = {
      _id: inkdrop.main.dataStore.getLocalDB().notes.createId(),
      doctype: 'markdown',
      title: title,
      body: body ?? '',
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
      .then(async (result: DbPutResult) => {
        const note: Note = await this.getNote(result.id);
        this.notes.push(note);
        return note;
      });
  }

  private static getCompletedNotes(): Promise<Note[]> {
    return inkdrop.main.dataStore
      .getLocalDB()
      .notes.findWithStatus(NOTE_STATUS.COMPLETED, {limit: null})
      .then((notes: DbGetNotesResult) => {
        return notes.docs;
      });
  }

  private getSelectedNotes(): Note[] {
    return inkdrop.store
      .getState()
      .notes.items.filter((note: Note) =>
        inkdrop.store
          .getState()
          .noteListBar.actionTargetNoteIds.includes(note._id)
      );
  }

  private static getTags(): Promise<Tag[]> {
    return inkdrop.main.dataStore
      .getLocalDB()
      .tags.all({limit: null})
      .then((tags: Tag[]) => {
        return tags;
      });
  }

  private getTag(id: string): Promise<Tag> {
    return inkdrop.main.dataStore
      .getLocalDB()
      .tags.get(id)
      .then((tag: Tag) => {
        return tag;
      });
  }

  private async createTag(
    name: string,
    color?: TagColor,
    count?: number
  ): Promise<Tag> {
    const timestamp = Date.now();

    const parameters: Tag = {
      _id: inkdrop.main.dataStore.getLocalDB().tags.createId(),
      name: name,
      color: color ?? TAG_COLOR.DEFAULT,
      count: count ?? 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return inkdrop.main.dataStore
      .getLocalDB()
      .tags.put(parameters)
      .then(async (result: DbPutResult) => {
        const tag: Tag = await this.getTag(result.id);
        this.tags.push(tag);
        return tag;
      });
  }

  private getBookById(bookId: string): Book | null {
    return this.books.find(book => book._id === bookId) ?? null;
  }

  private getBookByNameAndParent(name: string, parent?: Book): Book | null {
    return (
      this.books.find(
        book =>
          book.name.trim() === name.trim() &&
          ((parent && book.parentBookId === parent._id) ||
            (!parent && !book.parentBookId))
      ) ?? null
    );
  }

  private getRootBooks(): Book[] {
    return this.books.filter(filterBook => filterBook.parentBookId === null);
  }

  private getSubBooks(book: Book): Book[] {
    return this.books.filter(
      filterBook => filterBook.parentBookId === book._id
    );
  }

  private getBookNotes(book: Book): Note[] {
    return this.notes.filter(note => note.bookId === book._id);
  }

  private bookContainsNoteWithTitle(book: Book, bookTitle: string): boolean {
    return this.notes.some(
      note => note.title.trim() === bookTitle.trim() && note.bookId === book._id
    );
  }

  private getBookHierarchy(book: Book): Book[] {
    const bookHierarchy: Book[] = [];
    let currentBook: Book | null = book;

    while (currentBook) {
      bookHierarchy.unshift(currentBook);
      currentBook = currentBook.parentBookId
        ? this.getBookById(currentBook.parentBookId)
        : null;
    }

    return bookHierarchy;
  }

  private noteCanBeExported(note: Note): boolean {
    if (
      note.status === 'completed' &&
      !inkdrop.config.get('todoist-sync.syncCompleted')
    ) {
      return false;
    }

    if (
      inkdrop.config.get('todoist-sync.exportTags') &&
      !this.noteHasSomeTags(
        note,
        this.getTagsFromString(inkdrop.config.get('todoist-sync.exportTags'))
      )
    ) {
      return false;
    }

    return true;
  }

  private getNoteTags(note: Note): Tag[] {
    return this.tags.filter(label => note.tags?.includes(label._id));
  }

  private noteHasSomeTags(note: Note, tags: Tag[]) {
    return tags.some(tag => note.tags?.includes(tag._id));
  }

  private noteHasTagWithName(note: Note, tagName: string): boolean {
    return this.tags.some(
      tag => tag.name.trim() === tagName.trim() && note.tags?.includes(tag._id)
    );
  }

  private tagExists(name: string): boolean {
    return this.tags.some(tag => tag.name.trim() === name.trim());
  }

  private getTagsByNames(names: string[]): Tag[] {
    const tagNames: string[] = names.map(name => {
      return name.trim();
    });

    return this.tags.filter(tag => tagNames.includes(tag.name.trim()));
  }

  private getTagsFromString(tagString: string): Tag[] {
    return this.getTagsByNames(
      tagString.split(',').map(tagName => {
        return tagName.trim().replace(/^"|"$/g, '');
      })
    );
  }

  private static getTodoistApi(): TodoistApi | null {
    if (!inkdrop.config.get('todoist-sync.apiKey')) {
      inkdrop.notifications.addWarning('Todoist API key not set', {
        detail: 'Please provide your Todoist API key in the plugin settings.',
        dismissable: true,
      });

      return null;
    }

    return new TodoistApi(inkdrop.config.get('todoist-sync.apiKey'));
  }

  private static getTodoistProjects(
    todoistApi: TodoistApi
  ): Promise<Project[]> {
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

  private createTodoistProject(
    name: string,
    color?: TodoistColor,
    parent?: Project
  ): Promise<Project> {
    const parameters: AddProjectArgs = {
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

  private async createTodoistProjectHierarchyToRoot(
    book: Book
  ): Promise<Project | undefined> {
    const bookHierarchy = this.getBookHierarchy(book);
    let currentTodoistProject: Project | undefined = undefined;

    try {
      for (const book of bookHierarchy) {
        currentTodoistProject =
          this.getTodoistProjectByNameAndParent(
            book.name,
            currentTodoistProject
          ) ??
          (await this.createTodoistProject(
            book.name,
            TodoistColorNames[
              <TodoistColorSetting>(
                inkdrop.config.get('todoist-sync.projectColor')
              )
            ],
            currentTodoistProject
          ));
      }
    } catch (error) {
      logger.error(
        'Creating Todoist task hierarchy failed. Details: ' + error
      );
      throw new Error('Creating Todoist task hierarchy failed.');
    }

    return currentTodoistProject;
  }

  private static getTodoistSections(
    todoistApi: TodoistApi
  ): Promise<Section[]> {
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

  private createTodoistSection(
    name: string,
    project: Project
  ): Promise<Section> {
    const parameters: AddSectionArgs = {
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

  private static getTodoistTasks(todoistApi: TodoistApi): Promise<Task[]> {
    return todoistApi
      .getTasks()
      .then((tasks: Task[]) => {
        return tasks;
      })
      .catch((error: TodoistRequestError) => {
        this.handleTodoistError(error);
        throw error;
      });
  }

  private createTodoistTask(
    content: string,
    labels?: Label[],
    project?: Project,
    section?: Section,
    parent?: Task
  ): Promise<Task> {
    const parameters: AddTaskArgs = {
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

  private completeTodoistTask(task: Task) {
    return this.todoistApi
      .closeTask(task.id)
      .then()
      .catch(error => {
        TodoistSyncCore.handleTodoistError(error);
        throw error;
      });
  }

  private static getTodoistLabels(todoistApi: TodoistApi): Promise<Label[]> {
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

  private createTodoistLabel(name: string): Promise<Label> {
    const parameters: AddLabelArgs = {
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

  private todoistProjectExists(name: string): boolean {
    return this.todoistProjects.some(
      project => project.name.trim() === name.trim()
    );
  }

  private getTodoistProjectById(projectId: number): Project | null {
    return (
      this.todoistProjects.find(project => project.id === projectId) ?? null
    );
  }

  private getTodoistProjectByName(name: string): Project | null {
    return (
      this.todoistProjects.find(
        project => project.name.trim() === name.trim()
      ) ?? null
    );
  }

  private getTodoistProjectByNameAndParent(
    name: string,
    parent?: Project
  ): Project | null {
    return (
      this.todoistProjects.find(
        project =>
          project.name.trim() === name.trim() &&
          ((parent && project.parentId === parent.id) ||
            (!parent && project.parentId === undefined))
      ) ?? null
    );
  }

  private getTodoistRootProjects(): Project[] {
    return this.todoistProjects.filter(
      project => project.parentId === undefined
    );
  }

  private getTodoistProjectHierarchyByBookHierarchy(
    bookHierarchy: Book[]
  ): Project[] | null {
    const todoistProjectHierarchy: Project[] = [];
    let currentTodoistProject: Project | null | undefined = undefined;

    for (const book of bookHierarchy) {
      currentTodoistProject = this.getTodoistProjectByNameAndParent(
        book.name,
        currentTodoistProject
      );

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

  private getTodoistSubProjects(project: Project): Project[] {
    return this.todoistProjects.filter(
      filterProject => filterProject.parentId === project.id
    );
  }

  private getTodoistProjectHierarchy(project: Project): Project[] {
    const projectHierarchy: Project[] = [];
    let currentProject: Project | null = project;

    while (currentProject) {
      projectHierarchy.unshift(currentProject);
      currentProject = currentProject.parentId
        ? this.getTodoistProjectById(currentProject.parentId)
        : null;
    }

    return projectHierarchy;
  }

  private getTodoistProjectSections(project: Project): Section[] {
    return this.todoistSections.filter(
      section => section.projectId === project.id
    );
  }

  private getTodoistProjectTasks(project: Project): Task[] {
    return this.todoistTasks.filter(
      task => task.projectId === project.id && task.parentId === undefined
    );
  }

  private getTodoistProjectSubTasks(project: Project): Task[] {
    return this.todoistTasks.filter(
      task => task.projectId === project.id && task.parentId !== undefined
    );
  }

  private getTodoistSectionsFromString(sectionString: string): Section[] {
    return this.getTodoistSectionsByNames(
      sectionString.split(',').map(sectionName => {
        return sectionName.trim().replace(/^"|"$/g, '');
      })
    );
  }

  private getTodoistSectionsByNames(names: string[]): Section[] {
    const sectionNames: string[] = names.map(name => {
      return name.trim();
    });

    return this.todoistSections.filter(section =>
      sectionNames.includes(section.name.trim())
    );
  }

  private getTodoistSectionById(sectionId: number): Section | null {
    return (
      this.todoistSections.find(section => section.id === sectionId) ?? null
    );
  }

  private getTodoistSectionByName(name: string): Section | null {
    return (
      this.todoistSections.find(
        section => section.name.trim() === name.trim()
      ) ?? null
    );
  }

  private getTodoistSectionByNameAndProject(
    name: string,
    project: Project
  ): Section | null {
    return (
      this.todoistSections.find(
        section =>
          section.name.trim() === name.trim() &&
          section.projectId === project.id
      ) ?? null
    );
  }

  private getTodoistSectionTasks(section: Section): Task[] {
    return this.todoistTasks.filter(task => task.projectId === section.id);
  }

  private todoistTaskCanBeImported(task: Task): boolean {
    if (
      inkdrop.config.get('todoist-sync.importLabels') &&
      !this.todoistTaskHasSomeLabels(
        task,
        this.getTodoistLabelsFromString(
          inkdrop.config.get('todoist-sync.importLabels')
        )
      )
    ) {
      return false;
    }

    if (
      inkdrop.config.get('todoist-sync.importSections') &&
      !this.todoistTaskIsInAnySection(
        task,
        this.getTodoistSectionsFromString(
          inkdrop.config.get('todoist-sync.importSections')
        )
      )
    ) {
      return false;
    }

    return true;
  }

  private getTodoistSubTasks(task: Task): Task[] {
    return this.todoistTasks.filter(
      filterTask => filterTask.parentId === task.id
    );
  }

  private todoistTaskIsInAnySection(task: Task, sections: Section[]) {
    return sections.some(section => section.id === task.sectionId);
  }

  private getTodoistTaskLabels(task: Task): Label[] {
    return this.todoistLabels.filter(label => task.labelIds.includes(label.id));
  }

  private todoistTaskHasSomeLabels(task: Task, labels: Label[]) {
    return labels.some(label => task.labelIds.includes(label.id));
  }

  private getTodoistLabelsByNames(names: string[]): Label[] {
    const labelNames: string[] = names.map(name => {
      return name.trim();
    });

    return this.todoistLabels.filter(label =>
      labelNames.includes(label.name.trim())
    );
  }

  private getTodoistLabelsFromString(tagString: string): Label[] {
    return this.getTodoistLabelsByNames(
      tagString.split(',').map(tagName => {
        return tagName.trim().replace(/^"|"$/g, '');
      })
    );
  }

  private todoistProjectContainsSectionWithName(
    project: Project,
    sectionName: string
  ) {
    return this.todoistSections.some(
      section =>
        section.name.trim() === sectionName.trim() &&
        section.projectId === project.id
    );
  }

  private todoistProjectContainsTaskWithContent(
    project: Project,
    taskContent: string
  ): boolean {
    taskContent = taskContent.trim();
    let startsWith = false;

    if (taskContent.endsWith('...')) {
      taskContent = taskContent.substring(0, taskContent.length - 3);
      startsWith = true;
    }

    return inkdrop.config.get('todoist-sync.exportExistingSubTasks')
      ? this.todoistTasks.some(
          task =>
            (startsWith
              ? task.content.startsWith(taskContent)
              : task.content === taskContent) &&
            task.projectId === project.id &&
            task.parentId === undefined
        )
      : this.todoistTasks.some(
          task =>
            (startsWith
              ? task.content.startsWith(taskContent)
              : task.content === taskContent) && task.projectId === project.id
        );
  }

  private todoistSectionContainsTaskWithContent(
    section: Section,
    taskContent: string
  ): boolean {
    return this.todoistTasks.some(
      task =>
        task.content.trim() === taskContent.trim() &&
        task.sectionId === section.id
    );
  }

  private todoistTaskHasLabelWithName(task: Task, labelName: string): boolean {
    return this.todoistLabels.some(
      label =>
        label.name.trim() === labelName.trim() &&
        task.labelIds.includes(label.id)
    );
  }

  private todoistLabelExists(name: string): boolean {
    return this.todoistLabels.some(label => label.name.trim() === name.trim());
  }

  private static handleTodoistError(error: TodoistRequestError) {
    switch (error.httpStatusCode) {
      case 401:
        logger.error('todoist-sync: Todoist API access was denied.');
        inkdrop.notifications.addError('Todoist API access failed', {
          detail: 'Please check your Todoist API key in the plugin settings.',
          dismissable: true,
        });
        break;
      default:
        logger.error('todoist-syc: Undefined API error.');
        break;
    }
  }
}
