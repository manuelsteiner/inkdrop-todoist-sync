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
    return (react_1.default.createElement(SideBarMenuItem, { className: 'sidebar-menu-todoist-sync sync-' + syncStatus, indentLevel: 0, renderIcon: () => (react_1.default.createElement("svg", { className: 'streamline-icon' +
                (syncStatus === types_1.SYNC_STATUS.ACTIVE ? ' animate-spin' : ''), width: "1em", height: "1em", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 600 600" },
            react_1.default.createElement("g", { transform: "matrix(42.857142857142854,0,0,42.857142857142854,0,0)" },
                react_1.default.createElement("g", null,
                    react_1.default.createElement("g", null,
                        react_1.default.createElement("polyline", { points: "11 9 13 8.5 13.5 10.5", fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round" }),
                        react_1.default.createElement("path", { d: "M13,8.5A6.76,6.76,0,0,1,7,13H7A6,6,0,0,1,1.36,9.05", fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round" })),
                    react_1.default.createElement("g", null,
                        react_1.default.createElement("polyline", { points: "3 5 1 5.5 0.5 3.5", fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round" }),
                        react_1.default.createElement("path", { d: "M1,5.5C1.84,3.2,4.42,1,7,1H7a6,6,0,0,1,5.64,4", fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round" })))))) }, "Todoist Synchronisation"));
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