import { lazy } from 'react';
import { Navigate } from 'react-router-dom';

// project imports
import Loadable from 'ui-component/Loadable';
import AdminRoute from './AdminRoutes';
import RequireRole from './RequireRole';
import HomeRedirect from './HomeRedirect';
import MainLayout from 'layout/MainLayout';

// dashboard routing
const DashboardDefault = Loadable(lazy(() => import('views/dashboard/Default')));
const NotFound = Loadable(lazy(() => import('views/Error/NotFound')));
const AccessDenied = Loadable(lazy(() => import('views/Error/AccessDenied')));
const AddProduct = Loadable(lazy(() => import('views/pages/product/addProduct')));
const AllProduct = Loadable(lazy(() => import('views/pages/product/allProduct')));
const EditProduct = Loadable(lazy(() => import('views/pages/product/editProduct')));
const AllCategory = Loadable(lazy(() => import('views/pages/category/allCategory')));
const AllOrder = Loadable(lazy(() => import('views/pages/order/allOrder')));
const AllPermission = Loadable(lazy(() => import('views/pages/permission/allPermission')));
const AllUser = Loadable(lazy(() => import('views/pages/user/allUser')));
const AddCategory = Loadable(lazy(() => import('views/pages/category/addCategory')));
const EditCategory = Loadable(lazy(() => import('views/pages/category/EditCategory')));
const AllDiscount = Loadable(lazy(() => import('views/pages/discountCode/discount.jsx')));
const StoreInfo = Loadable(lazy(() => import('views/pages/settings/StoreInfo.jsx')));
const AiInsights = Loadable(lazy(() => import('views/pages/ai/AiInsights.jsx')));
const Departments = Loadable(lazy(() => import('views/pages/department/department.jsx')));
const Distributor = Loadable(lazy(() => import('views/pages/distributor/distributor.jsx')));
const AddEmployee = Loadable(lazy(() => import('views/pages/employee/addEmployee.jsx')));
const AllEmployee = Loadable(lazy(() => import('views/pages/employee/allEmployee.jsx')));
const EditEmployee = Loadable(lazy(() => import('views/pages/employee/editEmployee.jsx')));
const AddSupplier = Loadable(lazy(() => import('views/pages/supplier/addSupplier.jsx')));
const AllSupplier = Loadable(lazy(() => import('views/pages/supplier/allSupplier.jsx')));
const EditSupplier = Loadable(lazy(() => import('views/pages/supplier/editSupplier.jsx')));
const Inventory = Loadable(lazy(() => import('views/pages/inventory/inventory.jsx')));
// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
  path: '/',
  children: [
    {
      index: true,
      element: <Navigate to="/admin" />
    },
    // Ã°Å¸â€â€™ Admin routes with MainLayout
    {
      path: 'admin',
      element: <AdminRoute />,
      children: [
        {
          path: '',
          element: <MainLayout />,
          children: [
            {
              index: true, // Redirect `/admin` to `/admin/dashboard`
              element: <HomeRedirect />
            },
            {
              path: 'dashboard',
              element: <RequireRole route="dashboard"><DashboardDefault /></RequireRole>
            },
            {
              path: 'all-category',
              element: <RequireRole route="categories"><AllCategory /></RequireRole>
            },
            {
              path: 'access-denied',
              element: <AccessDenied />
            },
            {
              path: 'add-product',
              element: <RequireRole route="products"><AddProduct /></RequireRole>
            },
            {
              path: 'all-product',
              element: <RequireRole route="products"><AllProduct /></RequireRole>
            },
            {
              path: 'edit-product/:id',
              element: <RequireRole route="products"><EditProduct /></RequireRole>
            },
            {
              path: 'all-order',
              element: <RequireRole route="orders"><AllOrder /></RequireRole>
            },
            {
              path: 'all-permission',
              element: <RequireRole route="permissions"><AllPermission /></RequireRole>
            },
            {
              path: 'all-user',
              element: <RequireRole route="users"><AllUser /></RequireRole>
            },
            {
              path: 'add-category',
              element: <RequireRole route="categories"><AddCategory /></RequireRole>
            },
            {
              path: 'edit-category/:id',
              element: <RequireRole route="categories"><EditCategory /></RequireRole>
            },
            {
              path: 'discount-code',
              element: <RequireRole route="discounts"><AllDiscount /></RequireRole>
            },
            {
              path: 'ai-insights',
              element: <RequireRole route="aiInsights"><AiInsights /></RequireRole>
            },
            {
              path: 'store-info',
              element: <RequireRole route="settings"><StoreInfo /></RequireRole>
            },
            {
              path: 'departments',
              element: <RequireRole route="departments"><Departments /></RequireRole>
            },
            {
              path: 'distributors',
              element: <RequireRole route="distributors"><Distributor /></RequireRole>
            },
            {
              path: 'employee/add',
              element: <RequireRole route="employees"><AddEmployee /></RequireRole>
            },
            {
              path: 'employees/list',
              element: <RequireRole route="employees"><AllEmployee /></RequireRole>
            },
            {
              path: 'supplier/add',
              element: <RequireRole route="suppliers"><AddSupplier /></RequireRole>
            },
            {
              path: 'suppliers/',
              element: <RequireRole route="suppliers"><AllSupplier /></RequireRole>
            },
            {
              path: 'edit-supplier/:id',
              element: <RequireRole route="suppliers"><EditSupplier /></RequireRole>
            },
            
            {
              path: 'edit-employee/:id',
              element: <RequireRole route="employees"><EditEmployee /></RequireRole>
            },
            {
              path: 'all-inventory',
              element: <RequireRole route="inventory"><Inventory /></RequireRole>
            },
            {
              path: '*',
              element: <NotFound />
            },

          ]
        }
      ]
    },
    { path: '*', element: <NotFound /> }
  ]
};

export default MainRoutes;
