"use strict";
'use babel';
Object.defineProperty(exports, "__esModule", { value: true });
exports.show = exports.hide = exports.toggle = exports.componentName = void 0;
const React = require("react");
const inkdrop_1 = require("inkdrop");
function LayoutExampleSidebarMenuItem() {
    const { SideBarMenuItem } = inkdrop.components.classes;
    const handleClick = () => {
        inkdrop_1.logger.debug('Clicked!');
    };
    return (React.createElement(SideBarMenuItem, { className: "layout-example", indentLevel: 0, onClick: handleClick, renderIcon: () => React.createElement("i", { className: "flask icon" }) }, "Custom Sidebar Item"));
}
exports.default = LayoutExampleSidebarMenuItem;
exports.componentName = LayoutExampleSidebarMenuItem.name;
const layoutName = 'sidebar-menu';
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
    inkdrop.layouts.insertComponentToLayoutAfter(layoutName, 'SideBarMenuItemSearch', exports.componentName);
}
exports.show = show;
//# sourceMappingURL=todoist-sync-menu-item.js.map