// assets
import { IconUser } from '@tabler/icons-react';

// constant
const icons = {
    IconUser
};

// ==============================|| USER INFO MENU ITEMS ||============================== //

const userInfo = {
    id: 'user-info',
    title: 'User Information',
    caption: '',
    icon: icons.IconUser,
    type: 'group',
    children: [
        {
            id: 'User',
            title: 'User',
            type: 'collapse',
            icon: icons.IconUser,
            children: [
                {
                    id: 'all-user',
                    title: 'All User',
                    type: 'item',
                    url: '/admin/all-user',
                },


            ]
        }
    ]
};

export default userInfo;
