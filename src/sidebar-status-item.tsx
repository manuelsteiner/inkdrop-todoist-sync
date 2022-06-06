'use babel';

import React, {useEffect, useState} from 'react';
import {Inkdrop, SYNC_STATUS, SyncStatus} from './types';

declare let inkdrop: Inkdrop;

const SidebarStatusItem = () => {
  const {SideBarMenuItem} = inkdrop.components.classes;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('active');

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
          className={
            'streamline-icon' +
            (syncStatus === SYNC_STATUS.ACTIVE ? ' animate-spin' : '')
          }
          width="1em"
          height="1em"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 600 600"
        >
          <g transform="matrix(42.857142857142854,0,0,42.857142857142854,0,0)">
            <g>
              <g>
                <polyline
                  points="11 9 13 8.5 13.5 10.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></polyline>
                <path
                  d="M13,8.5A6.76,6.76,0,0,1,7,13H7A6,6,0,0,1,1.36,9.05"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
              </g>
              <g>
                <polyline
                  points="3 5 1 5.5 0.5 3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></polyline>
                <path
                  d="M1,5.5C1.84,3.2,4.42,1,7,1H7a6,6,0,0,1,5.64,4"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
              </g>
            </g>
          </g>
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
