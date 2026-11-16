// Single source of truth for dashboard access (matrix R1 in docs/dashboard/DASHBOARD_AUDIT.md).
// The backend enforces the same rules; the UI only hides what the API would reject.

const ALL = ['admin', 'manager', 'editor'];
const ADMIN_MANAGER = ['admin', 'manager'];
const ADMIN = ['admin'];

// Page access, keyed by route
export const routeRoles = {
    dashboard: ADMIN_MANAGER,
    products: ALL,
    categories: ALL,
    inventory: ALL,
    orders: ADMIN_MANAGER,
    users: ADMIN_MANAGER,
    permissions: ADMIN,
    discounts: ADMIN,
    employees: ADMIN_MANAGER,
    departments: ADMIN_MANAGER,
    suppliers: ADMIN_MANAGER,
    distributors: ADMIN_MANAGER,
    settings: ADMIN,
    aiInsights: ADMIN_MANAGER,
    aiKnowledge: ADMIN_MANAGER,
    aiSettings: ADMIN,
    accessDenied: ALL
};

// Actions inside pages (buttons)
export const actionRoles = {
    'product.delete': ADMIN_MANAGER,
    'category.delete': ADMIN_MANAGER,
    'order.update': ADMIN_MANAGER,
    'employee.delete': ADMIN,
    'department.delete': ADMIN_MANAGER,
    'supplier.delete': ADMIN_MANAGER,
    'distributor.delete': ADMIN_MANAGER,
    'discount.manage': ADMIN,
    'permission.manage': ADMIN,
    'user.history': ADMIN_MANAGER
};

const normalize = (role) => (role || '').toLowerCase();

export const canAccess = (role, routeKey) => (routeRoles[routeKey] || []).includes(normalize(role));

export const can = (role, action) => (actionRoles[action] || []).includes(normalize(role));

// Menu URL → route key, so the sidebar uses the same rules as the routes
const urlRouteKeys = [
    ['/admin/dashboard', 'dashboard'],
    ['/admin/add-product', 'products'],
    ['/admin/all-product', 'products'],
    ['/admin/add-category', 'categories'],
    ['/admin/all-category', 'categories'],
    ['/admin/all-inventory', 'inventory'],
    ['/admin/all-order', 'orders'],
    ['/admin/all-user', 'users'],
    ['/admin/all-permission', 'permissions'],
    ['/admin/discount-code', 'discounts'],
    ['/admin/employee', 'employees'],
    ['/admin/employees', 'employees'],
    ['/admin/departments', 'departments'],
    ['/admin/supplier', 'suppliers'],
    ['/admin/suppliers', 'suppliers'],
    ['/admin/distributors', 'distributors'],
    ['/admin/store-info', 'settings'],
    ['/admin/ai-insights', 'aiInsights'],
    ['/admin/ai-knowledge', 'aiKnowledge'],
    ['/admin/ai-settings', 'aiSettings']
];

export const canAccessUrl = (role, url) => {
    if (!url) return true;
    const match = urlRouteKeys.find(([prefix]) => url === prefix || url.startsWith(prefix + '/'));
    return match ? canAccess(role, match[1]) : false; // unknown admin URLs are hidden
};

// Recursively drop menu items the role can't open, and groups that end up empty
export const filterMenuByRole = (items, role) =>
    items
        .map((item) => (item.children ? { ...item, children: filterMenuByRole(item.children, role) } : item))
        .filter((item) => (item.children ? item.children.length > 0 : canAccessUrl(role, item.url)));

// Landing page per role (used after login and by AccessDenied)
export const homeFor = (role) => (canAccess(role, 'dashboard') ? '/admin/dashboard' : '/admin/all-product');
