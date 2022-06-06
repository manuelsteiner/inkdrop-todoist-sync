'use babel';

import React, {useEffect, useState} from 'react';
import {Inkdrop, SYNC_STATUS, SyncStatus} from './types';

declare let inkdrop: Inkdrop;

const SidebarStatusItem = () => {
  const {SideBarMenuItem} = inkdrop.components.classes;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SYNC_STATUS.ACTIVE);

  useEffect(() => {
    const handler = (event: CustomEvent<SyncStatus>) => {
      setSyncStatus(event.detail);
    };
    window.addEventListener('todoist-sync-status', handler as EventListener);
    return () =>
      window.removeEventListener(
        'todoist-sync-status',
        handler as EventListener
      );
  }, [syncStatus]);

  return (
    <SideBarMenuItem
      className={'sidebar-menu-todoist-sync sync-' + syncStatus}
      indentLevel={0}
      renderIcon={() => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={
            'feather-icon' +
            (syncStatus === SYNC_STATUS.ACTIVE ? ' animate-spin' : '')
          }
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
        >
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      )}
    >
      Todoist Synchronisation
    </SideBarMenuItem>
  );
};

export const componentName = SidebarStatusItem.name;

const layoutName = 'sidebar';

export function hide() {
  setTimeout(() => {
    inkdrop.layouts.removeComponentFromLayout(layoutName, componentName);
  }, 10000);
}

export function show() {
  inkdrop.layouts.insertComponentToLayoutAfter(
    layoutName,
    'SideBarNavigation',
    componentName
  );
}

export default SidebarStatusItem;
