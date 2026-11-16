import { IconSparkles, IconChartBar } from '@tabler/icons-react';

// ==============================|| AI ASSISTANT MENU ITEMS ||============================== //

const ai = {
    id: 'ai-assistant',
    title: 'AI Assistant',
    caption: '',
    icon: IconSparkles,
    type: 'group',
    children: [
        {
            id: 'ai-section',
            title: 'AI Assistant',
            type: 'collapse',
            icon: IconSparkles,
            children: [
                { id: 'ai-insights', title: 'Insights', type: 'item', icon: IconChartBar, url: '/admin/ai-insights' }
            ]
        }
    ]
};

export default ai;
