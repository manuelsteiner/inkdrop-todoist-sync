import {Note} from 'inkdrop-model';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export interface Inkdrop {
  commands: any;
  config: any;
  components: any;
  layouts: any;
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

export declare type SyncStatus = 'active' | 'error' | 'success';
export const enum SYNC_STATUS {
  ACTIVE = 'active',
  ERROR = 'error',
  SUCCESS = 'success',
}

export const SYNC_DIRECTION_VALUES = ['both', 'import', 'export'] as const;
export declare type SyncDirection = typeof SYNC_DIRECTION_VALUES[number];
export const enum SYNC_DIRECTION {
  BOTH = 'both',
  IMPORT = 'import',
  EXPORT = 'export',
}

export const TAG_COLOR_NAMES = [
  'default',
  'red',
  'orange',
  'yellow',
  'olive',
  'green',
  'teal',
  'blue',
  'violet',
  'purple',
  'pink',
  'brown',
  'grey',
  'black',
] as const;

export const TODOIST_COLOR_NAMES = [
  'berry red',
  'red',
  'orange',
  'yellow',
  'olive green',
  'lime green',
  'green',
  'mint green',
  'teal',
  'sky blue',
  'light blue',
  'blue',
  'grape',
  'violet',
  'lavender',
  'magenta',
  'salmon',
  'charcoal',
  'grey',
  'taupe',
] as const;
export declare type TodoistColorSetting = typeof TODOIST_COLOR_NAMES[number];
export const enum TODOIST_COLOR_SETTING {
  BERRY_RED = 'berry red',
  RED = 'red',
  ORANGE = 'orange',
  YELLOW = 'yellow',
  OLIVE_GREEN = 'olive green',
  LIME_GREEN = 'lime green',
  GREEN = 'green',
  MINT_GREEN = 'mint green',
  TEAL = 'teal',
  SKY_BLUE = 'sky blue',
  LIGHT_BLUE = 'light blue',
  BLUE = 'blue',
  GRAPE = 'grape',
  VIOLET = 'violet',
  LAVENDER = 'lavender',
  MAGENTA = 'magenta',
  SALMON = 'salmon',
  CHARCOAL = 'charcoal',
  GREY = 'grey',
  TAUPE = 'taupe',
}

export enum TodoistColor {
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
  TAUPE = 49,
}

export const TodoistColorNames: {[key in TodoistColorSetting]: TodoistColor} = {
  'berry red': TodoistColor.BERRY_RED,
  red: TodoistColor.RED,
  orange: TodoistColor.ORANGE,
  yellow: TodoistColor.YELLOW,
  'olive green': TodoistColor.OLIVE_GREEN,
  'lime green': TodoistColor.LIME_GREEN,
  green: TodoistColor.GREEN,
  'mint green': TodoistColor.MINT_GREEN,
  teal: TodoistColor.TEAL,
  'sky blue': TodoistColor.SKY_BLUE,
  'light blue': TodoistColor.LIGHT_BLUE,
  blue: TodoistColor.BLUE,
  grape: TodoistColor.GRAPE,
  violet: TodoistColor.VIOLET,
  lavender: TodoistColor.LAVENDER,
  magenta: TodoistColor.MAGENTA,
  salmon: TodoistColor.SALMON,
  charcoal: TodoistColor.CHARCOAL,
  grey: TodoistColor.GREY,
  taupe: TodoistColor.TAUPE,
};
