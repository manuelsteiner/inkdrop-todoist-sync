import { Note } from 'inkdrop-model';
export interface Inkdrop {
    commands: any;
    config: any;
    logger: any;
    main: any;
    notifications: any;
    store: any;
}
export declare type DbGetNotesResult = {
    docs: Note[];
};
export declare type DbPutResult = {
    ok: boolean;
    id: string;
    rev: string;
};
export declare const TAG_COLOR_NAMES: readonly ["default", "red", "orange", "yellow", "olive", "green", "teal", "blue", "violet", "purple", "pink", "brown", "grey", "black"];
export declare const SYNC_DIRECTION_VALUES: readonly ["both", "import", "export"];
export declare type SyncDirection = typeof SYNC_DIRECTION_VALUES[number];
export declare const SYNC_DIRECTION: {
    BOTH: 'both';
    IMPORT: 'import';
    EXPORT: 'export';
};
export declare const TODOIST_COLOR_NAMES: readonly ["berry red", "red", "orange", "yellow", "olive green", "lime green", "green", "mint green", "teal", "sky blue", "light blue", "blue", "grape", "violet", "lavender", "magenta", "salmon", "charcoal", "grey", "taupe"];
export declare type TodoistColorSetting = typeof TODOIST_COLOR_NAMES[number];
export declare const TODOIST_COLOR_SETTING: {
    BERRY_RED: 'berry red';
    RED: 'red';
    ORANGE: 'orange';
    YELLOW: 'yellow';
    OLIVE_GREEN: 'olive green';
    LIME_GREEN: 'lime green';
    GREEN: 'green';
    MINT_GREEN: 'mint green';
    TEAL: 'teal';
    SKY_BLUE: 'sky blue';
    LIGHT_BLUE: 'light blue';
    BLUE: 'blue';
    GRAPE: 'grape';
    VIOLET: 'violet';
    LAVENDER: 'lavender';
    MAGENTA: 'magenta';
    SALMON: 'salmon';
    CHARCOAL: 'charcoal';
    GREY: 'grey';
    TAUPE: 'taupe';
};
export declare const enum TodoistColor {
    BERRY_RED = 30,
    RED = 31,
    ORANGE = 32,
    YELLOW = 33,
    OLIVE_GREEN = 34,
    LIME_GREEN = 35,
    GREEN = 36,
    MINT_GREEN = 37,
    TEAL = 38,
    SKY_BLUE = 39,
    LIGHT_BLUE = 40,
    BLUE = 41,
    GRAPE = 42,
    VIOLET = 43,
    LAVENDER = 44,
    MAGENTA = 45,
    SALMON = 46,
    CHARCOAL = 47,
    GREY = 48,
    TAUPE = 49
}
export declare const TodoistColorNames: {
    [key in TodoistColorSetting]: TodoistColor;
};
