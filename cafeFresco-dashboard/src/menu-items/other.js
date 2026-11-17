// assets
// import { IconKey } from '@tabler/icons-react';
import { IconDots } from '@tabler/icons-react';  // Changed to an order-related icon

// constant
const icons = {
  IconDots
};

// ==============================|| ORDER MANAGEMENT MENU ITEMS ||============================== //

const orderManagement = {
  id: 'additional',
  title: 'Additional Feature',
  caption: '',
  icon: icons.IconDots,
  type: 'group',
  children: [
    {
      id: 'feature',
      title: 'Feature',
      type: 'collapse',
      icon: icons.IconDots,
      children: [
        {
          id: 'create-discount',
          title: 'Discount Code',
          type: 'item',
          url: '/admin/discount-code',
        },
        {
          id: 'store-info',
          title: 'Store Info',
          type: 'item',
          url: '/admin/store-info',
        },
        {
          id: 'activity-log',
          title: 'Activity Log',
          type: 'item',
          url: '/admin/activity-log',
        },

      ]
    }
  ]
};

export default orderManagement;
