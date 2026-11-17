import { IconSparkles, IconChartBar, IconBook, IconFileText, IconSettings } from '@tabler/icons-react';

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
                { id: 'ai-insights', title: 'Insights', type: 'item', icon: IconChartBar, url: '/admin/ai-insights' },
                { id: 'ai-knowledge', title: 'Knowledge (FAQ)', type: 'item', icon: IconBook, url: '/admin/ai-knowledge' },
                { id: 'ai-documents', title: 'Documents', type: 'item', icon: IconFileText, url: '/admin/ai-documents' },
                { id: 'ai-settings', title: 'Assistant settings', type: 'item', icon: IconSettings, url: '/admin/ai-settings' }
            ]
        }
    ]
};

export default ai;
