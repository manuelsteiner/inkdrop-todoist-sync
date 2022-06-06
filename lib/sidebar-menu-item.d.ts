import React from 'react';
import { SyncStatus } from './types';
declare const SidebarMenuItem: React.FC<{
    status: SyncStatus;
}>;
export declare const componentName: string;
export declare function toggle(): void;
export declare function hide(): void;
export declare function show(): void;
export default SidebarMenuItem;
