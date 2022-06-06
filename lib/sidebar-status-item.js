"use strict";
'use babel';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.show = exports.hide = exports.componentName = void 0;
const react_1 = __importStar(require("react"));
const types_1 = require("./types");
const SidebarStatusItem = () => {
    const { SideBarMenuItem } = inkdrop.components.classes;
    const [syncStatus, setSyncStatus] = (0, react_1.useState)(types_1.SYNC_STATUS.ACTIVE);
    (0, react_1.useEffect)(() => {
        const handler = (event) => {
            setSyncStatus(event.detail);
        };
        window.addEventListener('todoist-sync-status', handler);
        return () => window.removeEventListener('todoist-sync-status', handler);
    }, [syncStatus]);
    return (react_1.default.createElement(SideBarMenuItem, { className: 'sidebar-menu-todoist-sync sync-' + syncStatus, indentLevel: 0, renderIcon: () => (react_1.default.createElement("svg", { xmlns: "http://www.w3.org/2000/svg", className: 'feather-icon' +
                (syncStatus === types_1.SYNC_STATUS.ACTIVE ? ' animate-spin' : ''), width: "1em", height: "1em", viewBox: "0 0 24 24" },
            react_1.default.createElement("polyline", { points: "23 4 23 10 17 10" }),
            react_1.default.createElement("polyline", { points: "1 20 1 14 7 14" }),
            react_1.default.createElement("path", { d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" }))) }, "Todoist Synchronisation"));
};
exports.componentName = SidebarStatusItem.name;
const layoutName = 'sidebar';
function hide() {
    setTimeout(() => {
        inkdrop.layouts.removeComponentFromLayout(layoutName, exports.componentName);
    }, 10000);
}
exports.hide = hide;
function show() {
    inkdrop.layouts.insertComponentToLayoutAfter(layoutName, 'SideBarNavigation', exports.componentName);
}
exports.show = show;
exports.default = SidebarStatusItem;
//# sourceMappingURL=sidebar-status-item.js.map