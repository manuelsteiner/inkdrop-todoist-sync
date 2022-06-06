import { Label, Project, Section, Task, TodoistApi } from '@doist/todoist-api-typescript';
import type { Note, Book, Tag } from 'inkdrop-model';
export declare class TodoistSyncCore {
    private books;
    private notes;
    private tags;
    private todoistApi;
    private todoistProjects;
    private todoistSections;
    private todoistTasks;
    private todoistLabels;
    constructor(books: Book[], notes: Note[], tags: Tag[], todoistApi: TodoistApi, todoistProjects: Project[], todoistSections: Section[], todoistTasks: Task[], todoistLabels: Label[]);
    static construct(): Promise<TodoistSyncCore>;
    syncAll(): Promise<void>;
    syncSelected(): Promise<void>;
    importAllProjects(): Promise<void>;
    importSelectedProjects(): Promise<void>;
    private importProjects;
    private importProject;
    exportAllBooks(): Promise<void>;
    exportSelectedBooks(): Promise<void>;
    private exportBooks;
    private exportBook;
    private importTasks;
    private importTask;
    private importLabels;
    private importLabel;
    private importComments;
    private importComment;
    exportSelectedNotes(): Promise<void>;
    private exportNotes;
    private exportNote;
    private exportNoteToProjectWithName;
    private exportTags;
    private exportTag;
    private static getBooks;
    private getBook;
    private createBook;
    private createBookHierarchyToRoot;
    private static getNotes;
    private getNote;
    private createNote;
    private static getCompletedNotes;
    private getSelectedNotes;
    private static getTags;
    private getTag;
    private createTag;
    private getBookById;
    private getBookByNameAndParent;
    private getRootBooks;
    private getSubBooks;
    private getBookNotes;
    private bookContainsNoteWithTitle;
    private getBookHierarchy;
    private getTrimmedNoteTitle;
    private noteCanBeExported;
    private getNoteTags;
    private noteHasSomeTags;
    private noteHasTagWithName;
    private tagExists;
    private getTagsByNames;
    private getTagsFromString;
    private static getTodoistApi;
    private static getTodoistProjects;
    private createTodoistProject;
    private createTodoistProjectHierarchyToRoot;
    private static getTodoistSections;
    private createTodoistSection;
    private static getTodoistTasks;
    private createTodoistTask;
    private completeTodoistTask;
    private static getTodoistLabels;
    private createTodoistLabel;
    private getTodoistCommentsForProject;
    private getTodoistCommentsForTask;
    private todoistProjectExists;
    private getTodoistProjectById;
    private getTodoistProjectByName;
    private getTodoistProjectByNameAndParent;
    private getTodoistRootProjects;
    private getTodoistProjectHierarchyByBookHierarchy;
    private getTodoistSubProjects;
    private getTodoistProjectHierarchy;
    private getTodoistProjectSections;
    private getTodoistProjectTasks;
    private getTodoistProjectSubTasks;
    private getTodoistSectionsFromString;
    private getTodoistSectionsByNames;
    private getTodoistSectionById;
    private getTodoistSectionByName;
    private getTodoistSectionByNameAndProject;
    private getTodoistSectionTasks;
    private todoistTaskCanBeImported;
    private getTodoistSubTasks;
    private todoistTaskIsInAnySection;
    private getTodoistTaskLabels;
    private todoistTaskHasSomeLabels;
    private getTodoistLabelsByNames;
    private getTodoistLabelsFromString;
    private getTodoistTaskCommentString;
    private todoistProjectContainsSectionWithName;
    private todoistProjectContainsTaskWithContent;
    private todoistSectionContainsTaskWithContent;
    private todoistTaskHasLabelWithName;
    private todoistLabelExists;
    private static handleTodoistError;
}
