"use strict";
'use babel';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.show = exports.hide = exports.toggle = exports.componentName = void 0;
const react_1 = __importDefault(require("react"));
const SidebarMenuItem = ({ status }) => {
    const { SideBarMenuItem } = inkdrop.components.classes;
    return (react_1.default.createElement(SideBarMenuItem, { className: "sidebar-menu-todoist-sync" + status, indentLevel: 0, renderIcon: () => (react_1.default.createElement("svg", { className: "streamline-icon animate-spin", width: "1em", height: "1em", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 600 600" },
            react_1.default.createElement("g", { transform: "matrix(42.857142857142854,0,0,42.857142857142854,0,0)" },
                react_1.default.createElement("g", null,
                    react_1.default.createElement("g", null,
                        react_1.default.createElement("polyline", { points: "11 9 13 8.5 13.5 10.5", fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round" }),
                        react_1.default.createElement("path", { d: "M13,8.5A6.76,6.76,0,0,1,7,13H7A6,6,0,0,1,1.36,9.05", fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round" })),
                    react_1.default.createElement("g", null,
                        react_1.default.createElement("polyline", { points: "3 5 1 5.5 0.5 3.5", fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round" }),
                        react_1.default.createElement("path", { d: "M1,5.5C1.84,3.2,4.42,1,7,1H7a6,6,0,0,1,5.64,4", fill: "none", stroke: "currentColor", "stroke-linecap": "round", "stroke-linejoin": "round" })))))) }, "Todoist Synchronisation"));
};
exports.componentName = SidebarMenuItem.name;
const layoutName = 'sidebar';
function toggle() {
    const isVisible = inkdrop.layouts.indexOfComponentInLayout(layoutName, exports.componentName) >= 0;
    isVisible ? hide() : show();
}
exports.toggle = toggle;
function hide() {
    inkdrop.layouts.removeComponentFromLayout(layoutName, exports.componentName);
}
exports.hide = hide;
function show() {
    inkdrop.layouts.insertComponentToLayoutAfter(layoutName, 'SideBarNavigation', exports.componentName);
}
exports.show = show;
exports.default = SidebarMenuItem;
//# sourceMappingURL=sidebar-menu-item.js.map