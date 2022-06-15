'use babel';

import {
  AddLabelArgs,
  AddProjectArgs,
  AddSectionArgs,
  AddTaskArgs,
  Comment,
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
  SyncDirection,
  SYNC_DIRECTION,
  TodoistColor,
  TodoistColorNames,
  TodoistColorSetting,
} from './types';

import type {Note, Book, Tag, TagColor} from 'inkdrop-model';
import {NOTE_STATUS, TAG_COLOR} from 'inkdrop-model';

export class TodoistSyncCore {
  private books: Book[];
  private notes: Note[];
  private tags: Tag[];

  private todoistApi: TodoistApi;
  private projects: Project[];
  private sections: Section[];
  private tasks: Task[];
  private labels: Label[];

  constructor(
    books: Book[],
    notes: Note[],
    tags: Tag[],
    todoistApi: TodoistApi,
    projects: Project[],
    sections: Section[],
    tasks: Task[],
    labels: Label[]
  ) {
    this.books = books;
    this.notes = notes;
    this.tags = tags;

    this.todoistApi = todoistApi;
    this.projects = projects;
    this.sections = sections;
    this.tasks = tasks;
    this.labels = labels;
  }

  static async construct(): Promise<TodoistSyncCore> {
    let books: Book[] | null = null;
    let notes: Note[] | null = null;
    let tags: Tag[] | null = null;

    const todoistApi: TodoistApi | null = TodoistSyncCore.getTodoistApi();
    let projects: Project[] | null = null;
    let sections: Section[] | null = null;
    let tasks: Task[] | null = null;
    let labels: Label[] | null = null;

    if (!todoistApi) {
      throw new Error('Todoist API initialisation failed.');
    }

    try {
      books = await TodoistSyncCore.getBooks();
      notes = await TodoistSyncCore.getNotes();
      notes = notes.concat(await TodoistSyncCore.getCompletedNotes());
      notes = notes.concat(await TodoistSyncCore.getDroppedNotes());
      tags = await TodoistSyncCore.getTags();
    } catch (error) {
      throw new Error('Getting Inkdrop data failed.');
    }

    try {
      projects = await TodoistSyncCore.getProjects(todoistApi);
      sections = await TodoistSyncCore.getSections(todoistApi);
      tasks = await TodoistSyncCore.getTasks(todoistApi);
      labels = await TodoistSyncCore.getLabels(todoistApi);
    } catch (error) {
      throw new Error('Getting Todoist data failed.');
    }

    return new TodoistSyncCore(
      books,
      notes,
      tags,
      todoistApi,
      projects,
      sections,
      tasks,
      labels
    );
  }

  public async syncAll() {
    const syncDirection: SyncDirection = inkdrop.config.get(
      'todoist-sync.syncDirection'
    );

    if (
      syncDirection === SYNC_DIRECTION.EXPORT ||
      syncDirection === SYNC_DIRECTION.BOTH
    ) {
      await this.exportAllBooks();
    }

    if (
      syncDirection === SYNC_DIRECTION.IMPORT ||
      syncDirection === SYNC_DIRECTION.BOTH
    ) {
      await this.importAllProjects();
    }
  }

  public async syncSelected() {
    const syncDirection: SyncDirection = inkdrop.config.get(
      'todoist-sync.syncDirection'
    );

    if (
      syncDirection === SYNC_DIRECTION.EXPORT ||
      syncDirection === SYNC_DIRECTION.BOTH
    ) {
      await this.exportSelectedBooks();
    }

    if (
      syncDirection === SYNC_DIRECTION.IMPORT ||
      syncDirection === SYNC_DIRECTION.BOTH
    ) {
      await this.importSelectedProjects();
    }
  }

  public async importAllProjects() {
    await this.importProjects(this.getRootProjects());
  }

  public async importSelectedProjects() {
    const book = inkdrop.store.getState().bookList.bookForContextMenu;
    const bookHierarchy = this.getBookHierarchy(book);

    const project =
      this.getProjectHierarchyByBookHierarchy(bookHierarchy)?.pop();

    if (!project) {
      throw new Error(
        'The notebook hierarchy containing ' +
          book.name +
          ' does not exist as project hierarchy in Todoist.'
      );
    }

    await this.importProject(project);
  }

  private async importProjects(projects: Project[]) {
    for (const project of projects) {
      await this.importProject(project);
    }
  }

  private async importProject(project: Project) {
    await this.importTasks(this.getProjectTasks(project));
    if (inkdrop.config.get('todoist-sync.importSubTasks')) {
      await this.importTasks(this.getProjectSubTasks(project));
    }
    if (inkdrop.config.get('todoist-sync.importProjectComments')) {
      await this.importComments(await this.getCommentsForProject(project));
    }
    await this.importProjects(this.getSubProjects(project));
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
      try {
        await this.importTask(task);

        if (inkdrop.config.get('todoist-sync.importSubTasks')) {
          for (const subTask of this.getSubTasks(task)) {
            await this.importTask(subTask);
          }
        }
      } catch (error) {
        throw new Error('Importing task failed.');
      }
    }
  }

  private async importTask(task: Task) {
    if (!this.taskCanBeImported(task)) {
      return;
    }

    const project = this.getProjectById(task.projectId);

    if (!project) {
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
      const section: Section | null = this.getSectionById(task.sectionId);

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
        ? this.getTaskLabels(task)
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

      let taskDescription = inkdrop.config.get(
        'todoist-sync.importTaskDescriptions'
      )
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

  private async importLabels(labels: Label[]) {
    for (const label of labels) {
      try {
        await this.importLabel(label);
      } catch (error) {
        throw new Error('Importing label failed.');
      }
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

  private async importComments(comments: Comment[]) {
    for (const comment of comments) {
      try {
        await this.importComment(comment);
      } catch (error) {
        throw new Error('Importing comment failed.');
      }
    }
  }

  private async importComment(comment: Comment) {
    if (!comment.projectId) {
      throw new Error(
        'Todoist comment ' + comment.id + ' is not attached to a project.'
      );
    }

    const project = this.getProjectById(comment.projectId);

    if (!project) {
      throw new Error(
        'Todoist project ' +
          comment.projectId +
          ' (from comment ' +
          comment.id +
          ') not found.'
      );
    }

    const book = await this.createBookHierarchyToRoot(project);

    if (!book) {
      throw new Error(
        'Could not find book for Todoist project ' +
          project.id +
          ' to attach comment ' +
          comment.id +
          '.'
      );
    }

    if (book && !this.bookContainsNoteWithTitle(book, comment.content)) {
      await this.createNote(comment.content, book);
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
      throw new Error('Exporting selected notes failed.');
    }
  }

  private async exportNotes(
    notes: Note[],
    projectName?: string,
    forceExport?: boolean
  ) {
    for (const note of notes) {
      try {
        projectName
          ? await this.exportNoteToProjectWithName(
              note,
              projectName,
              forceExport
            )
          : await this.exportNote(note, undefined, forceExport);
      } catch (error) {
        throw new Error('Exporting note failed.');
      }
    }
  }

  private async exportNote(
    note: Note,
    targetProject?: Project,
    forceExport?: boolean
  ) {
    if (!forceExport && !this.noteCanBeExported(note)) {
      return;
    }

    const book = this.getBookById(note.bookId);
    let project: Project | undefined = undefined;

    if (!book) {
      throw new Error(
        'Book ' + note.bookId + ' (from note ' + note._id + ') not found.'
      );
    }

    if (
      inkdrop.config.get('todoist-sync.exportNotebooksAsSections') &&
      !inkdrop.config.get('todoist-sync.exportSection').length &&
      !targetProject &&
      book.parentBookId &&
      !this.getSubBooks(book).length &&
      !this.getProjectHierarchyByBookHierarchy(this.getBookHierarchy(book))
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

      project = await this.createProjectHierarchyToRoot(parentBook);
    } else {
      project =
        targetProject ?? (await this.createProjectHierarchyToRoot(book));
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

    if (project && !this.projectContainsTaskWithContent(project, note.title)) {
      let section: Section | undefined = undefined;

      if (
        inkdrop.config.get('todoist-sync.exportNotebooksAsSections') &&
        !inkdrop.config.get('todoist-sync.exportSection').length &&
        book.parentBookId &&
        !this.getSubBooks(book).length &&
        project.name.trim() === this.getBookById(book.parentBookId)?.name.trim()
      ) {
        section =
          this.getSectionByNameAndProject(book.name, project) ??
          (await this.createSection(book.name, project));
      } else if (
        inkdrop.config.get('todoist-sync.exportSection') &&
        !this.projectContainsSectionWithName(
          project,
          inkdrop.config.get('todoist-sync.exportSection')
        )
      ) {
        section =
          this.getSectionByName(
            inkdrop.config.get('todoist-sync.exportSection')
          ) ??
          (await this.createSection(
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
        ? this.getLabelsByNames(
            tags.map(tag => {
              return tag.name;
            })
          )
        : [];
      if (
        note.status === NOTE_STATUS.ACTIVE &&
        inkdrop.config.get('todoist-sync.activeLabel')
      ) {
        const activeLabel: Label =
          this.getLabelByName(inkdrop.config.get('todoist-sync.activeLabel')) ??
          (await this.createLabel(
            inkdrop.config.get('todoist-sync.activeLabel'),
            inkdrop.config.get('todoist-sync.labelColor')
          ));
        labels.push(activeLabel);
      }
      if (
        note.status === NOTE_STATUS.ON_HOLD &&
        inkdrop.config.get('todoist-sync.onHoldLabel')
      ) {
        const onHoldLabel: Label =
          this.getLabelByName(inkdrop.config.get('todoist-sync.onHoldLabel')) ??
          (await this.createLabel(
            inkdrop.config.get('todoist-sync.onHoldLabel'),
            inkdrop.config.get('todoist-sync.labelColor')
          ));
        labels.push(onHoldLabel);
      }

      const task = await this.createTask(
        note.title,
        inkdrop.config.get('todoist-sync.exportNoteBodies')
          ? note.body
          : undefined,
        labels,
        project,
        section
      );

      if (
        note.status === NOTE_STATUS.COMPLETED ||
        note.status === NOTE_STATUS.DROPPED
      ) {
        await this.completeTask(task);
      }
    }
  }

  private async exportNoteToProjectWithName(
    note: Note,
    projectName: string,
    forceExport?: boolean
  ) {
    const project =
      this.getProjectByName(projectName) ??
      (await this.createProject(
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
        throw new Error('Exporting single tag failed.');
      }
    }
  }

  private async exportTag(tag: Tag) {
    if (!this.labelExists(tag.name)) {
      await this.createLabel(
        tag.name,
        TodoistColorNames[
          <TodoistColorSetting>inkdrop.config.get('todoist-sync.labelColor')
        ]
      );
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
    const projectHierarchy = this.getProjectHierarchy(project);
    let currentBook: Book | undefined = undefined;

    try {
      for (const project of projectHierarchy) {
        currentBook =
          this.getBookByNameAndParent(project.name, currentBook) ??
          (await this.createBook(project.name, currentBook));
      }
    } catch (error) {
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
      title = this.getTrimmedNoteTitle(title) + '...';
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

  private static getDroppedNotes(): Promise<Note[]> {
    return inkdrop.main.dataStore
      .getLocalDB()
      .notes.findWithStatus(NOTE_STATUS.DROPPED, {limit: null})
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

  private bookContainsNoteWithTitle(book: Book, noteTitle: string): boolean {
    this.notes.forEach(note => {
      console.log('trimmed note title');
      console.log(this.getTrimmedNoteTitle(note.title));
      console.log('trimmed wanted title');
      console.log(this.getTrimmedNoteTitle(noteTitle));
    });

    return this.notes.some(
      note =>
        this.getTrimmedNoteTitle(note.title) ===
          this.getTrimmedNoteTitle(noteTitle) && note.bookId === book._id
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

  private getTrimmedNoteTitle(title: string): string {
    let trimmed = title.trim();
    trimmed = trimmed.endsWith('...')
      ? trimmed.substring(0, trimmed.length - 3)
      : trimmed;
    return trimmed.length > 128 ? trimmed.substring(0, 125) : trimmed;
  }

  private noteCanBeExported(note: Note): boolean {
    if (
      note.status === 'completed' &&
      !inkdrop.config.get('todoist-sync.exportCompleted')
    ) {
      return false;
    }

    if (
      note.status === 'dropped' &&
      !inkdrop.config.get('todoist-sync.exportDropped')
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

  private static getProjects(todoistApi: TodoistApi): Promise<Project[]> {
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

  private createProject(
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
        this.projects.push(project);
        return project;
      })
      .catch(error => {
        TodoistSyncCore.handleTodoistError(error);
        throw error;
      });
  }

  private async createProjectHierarchyToRoot(
    book: Book
  ): Promise<Project | undefined> {
    const bookHierarchy = this.getBookHierarchy(book);
    let currentProject: Project | undefined = undefined;

    try {
      for (const book of bookHierarchy) {
        currentProject =
          this.getProjectByNameAndParent(book.name, currentProject) ??
          (await this.createProject(
            book.name,
            TodoistColorNames[
              <TodoistColorSetting>(
                inkdrop.config.get('todoist-sync.projectColor')
              )
            ],
            currentProject
          ));
      }
    } catch (error) {
      throw new Error('Creating Todoist task hierarchy failed.');
    }

    return currentProject;
  }

  private static getSections(todoistApi: TodoistApi): Promise<Section[]> {
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

  private createSection(name: string, project: Project): Promise<Section> {
    const parameters: AddSectionArgs = {
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

  private static getTasks(todoistApi: TodoistApi): Promise<Task[]> {
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

  private createTask(
    content: string,
    description?: string,
    labels?: Label[],
    project?: Project,
    section?: Section,
    parent?: Task
  ): Promise<Task> {
    const parameters: AddTaskArgs = {
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

  private completeTask(task: Task) {
    return this.todoistApi
      .closeTask(task.id)
      .then()
      .catch(error => {
        TodoistSyncCore.handleTodoistError(error);
        throw error;
      });
  }

  private static getLabels(todoistApi: TodoistApi): Promise<Label[]> {
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

  private createLabel(name: string, color?: TodoistColor): Promise<Label> {
    const parameters: AddLabelArgs = {
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

  private getCommentsForProject(project: Project): Promise<Comment[]> {
    return this.todoistApi
      .getComments({projectId: project.id})
      .then(comments => {
        return comments;
      })
      .catch(error => {
        TodoistSyncCore.handleTodoistError(error);
        throw error;
      });
  }

  private getCommentsForTask(task: Task): Promise<Comment[]> {
    return this.todoistApi
      .getComments({taskId: task.id})
      .then(comments => {
        return comments;
      })
      .catch(error => {
        TodoistSyncCore.handleTodoistError(error);
        throw error;
      });
  }

  private projectExists(name: string): boolean {
    return this.projects.some(project => project.name.trim() === name.trim());
  }

  private getProjectById(projectId: number): Project | null {
    return this.projects.find(project => project.id === projectId) ?? null;
  }

  private getProjectByName(name: string): Project | null {
    return (
      this.projects.find(project => project.name.trim() === name.trim()) ?? null
    );
  }

  private getProjectByNameAndParent(
    name: string,
    parent?: Project
  ): Project | null {
    return (
      this.projects.find(
        project =>
          project.name.trim() === name.trim() &&
          ((parent && project.parentId === parent.id) ||
            (!parent && project.parentId === undefined))
      ) ?? null
    );
  }

  private getRootProjects(): Project[] {
    return this.projects.filter(project => project.parentId === undefined);
  }

  private getProjectHierarchyByBookHierarchy(
    bookHierarchy: Book[]
  ): Project[] | null {
    const projectHierarchy: Project[] = [];
    let currentProject: Project | null | undefined = undefined;

    for (const book of bookHierarchy) {
      currentProject = this.getProjectByNameAndParent(
        book.name,
        currentProject
      );

      if (!currentProject) {
        return null;
      }

      projectHierarchy.push(currentProject);
    }

    return projectHierarchy;
  }

  private getSubProjects(project: Project): Project[] {
    return this.projects.filter(
      filterProject => filterProject.parentId === project.id
    );
  }

  private getProjectHierarchy(project: Project): Project[] {
    const projectHierarchy: Project[] = [];
    let currentProject: Project | null = project;

    while (currentProject) {
      projectHierarchy.unshift(currentProject);
      currentProject = currentProject.parentId
        ? this.getProjectById(currentProject.parentId)
        : null;
    }

    return projectHierarchy;
  }

  private getProjectTasks(project: Project): Task[] {
    return this.tasks.filter(
      task => task.projectId === project.id && task.parentId === undefined
    );
  }

  private getProjectSubTasks(project: Project): Task[] {
    return this.tasks.filter(
      task => task.projectId === project.id && task.parentId !== undefined
    );
  }

  private getSectionsFromString(sectionString: string): Section[] {
    return this.getSectionsByNames(
      sectionString.split(',').map(sectionName => {
        return sectionName.trim().replace(/^"|"$/g, '');
      })
    );
  }

  private getSectionsByNames(names: string[]): Section[] {
    const sectionNames: string[] = names.map(name => {
      return name.trim();
    });

    return this.sections.filter(section =>
      sectionNames.includes(section.name.trim())
    );
  }

  private getSectionById(sectionId: number): Section | null {
    return this.sections.find(section => section.id === sectionId) ?? null;
  }

  private getSectionByName(name: string): Section | null {
    return (
      this.sections.find(section => section.name.trim() === name.trim()) ?? null
    );
  }

  private getSectionByNameAndProject(
    name: string,
    project: Project
  ): Section | null {
    return (
      this.sections.find(
        section =>
          section.name.trim() === name.trim() &&
          section.projectId === project.id
      ) ?? null
    );
  }

  private getSectionTasks(section: Section): Task[] {
    return this.tasks.filter(task => task.projectId === section.id);
  }

  private taskCanBeImported(task: Task): boolean {
    if (
      inkdrop.config.get('todoist-sync.importLabels') &&
      !this.taskHasSomeLabels(
        task,
        this.getLabelsFromString(
          inkdrop.config.get('todoist-sync.importLabels')
        )
      )
    ) {
      return false;
    }

    if (
      inkdrop.config.get('todoist-sync.importSections') &&
      !this.taskIsInAnySection(
        task,
        this.getSectionsFromString(
          inkdrop.config.get('todoist-sync.importSections')
        )
      )
    ) {
      return false;
    }

    return true;
  }

  private getSubTasks(task: Task): Task[] {
    return this.tasks.filter(filterTask => filterTask.parentId === task.id);
  }

  private taskIsInAnySection(task: Task, sections: Section[]) {
    return sections.some(section => section.id === task.sectionId);
  }

  private getTaskLabels(task: Task): Label[] {
    return this.labels.filter(label => task.labelIds.includes(label.id));
  }

  private taskHasSomeLabels(task: Task, labels: Label[]) {
    return labels.some(label => task.labelIds.includes(label.id));
  }

  private getLabelByName(name: string): Label | null {
    return (
      this.labels.find(
        label => label.name.trim() === name.trim().replace(/[ @!"(),\\]/g, '_')
      ) ?? null
    );
  }

  private getLabelsByNames(names: string[]): Label[] {
    const labelNames: string[] = names.map(name => {
      return name.trim().replace(/[ @!"(),\\]/g, '_');
    });

    return this.labels.filter(label => labelNames.includes(label.name.trim()));
  }

  private getLabelsFromString(tagString: string): Label[] {
    return this.getLabelsByNames(
      tagString.split(',').map(tagName => {
        return tagName.trim().replace(/^"|"$/g, '');
      })
    );
  }

  private async getTaskCommentString(task: Task): Promise<string> {
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

  private projectContainsSectionWithName(
    project: Project,
    sectionName: string
  ) {
    return this.sections.some(
      section =>
        section.name.trim() === sectionName.trim() &&
        section.projectId === project.id
    );
  }

  private projectContainsTaskWithContent(
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
      ? this.tasks.some(
          task =>
            (startsWith
              ? task.content.startsWith(taskContent)
              : task.content === taskContent) &&
            task.projectId === project.id &&
            task.parentId === undefined
        )
      : this.tasks.some(
          task =>
            (startsWith
              ? task.content.startsWith(taskContent)
              : task.content === taskContent) && task.projectId === project.id
        );
  }

  private labelExists(name: string): boolean {
    return this.labels.some(
      label => label.name.trim() === name.trim().replace(/[ @!"(),\\]/g, '_')
    );
  }

  private static handleTodoistError(error: TodoistRequestError) {
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
