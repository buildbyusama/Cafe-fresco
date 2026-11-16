// Hand the conversation to a person: a dashboard notification (at most once per 10 min per chat) + the shop's contact info
const Notify = require('../../../models/notification');
const ChatSession = require('../../../models/chatSession');
const { getSettings } = require('../../settings');

module.exports = [
    {
        name: 'escalate_to_human',
        description: 'Ask the staff to follow up when the customer wants a real person, is upset, or has a problem you cannot solve (wrong order, refund, complaint).',
        parameters: { type: 'object', additionalProperties: false, required: ['reason'], properties: { reason: { type: 'string', maxLength: 300 } } },
        async handler({ reason }, ctx) {
            const s = await getSettings();
            const c = s.contact || {};
            const contact = [c.phone && `phone ${c.phone}`, c.email && `email ${c.email}`].filter(Boolean).join(' or ');
            const session = ctx.sessionId ? await ChatSession.findById(ctx.sessionId) : null;
            const recent = session?.escalatedAt && Date.now() - session.escalatedAt.getTime() < 10 * 60 * 1000;
            // guest spam can open many chats: at most 20 hand-off alerts an hour in total
            const flood = (await Notify.countDocuments({ type: 'chat_escalation', time: { $gte: new Date(Date.now() - 60 * 60 * 1000) } })) >= 20;
            if (session && !recent) {
                await ChatSession.updateOne({ _id: session._id }, { $set: { escalated: true, escalatedAt: new Date() } });
            }
            if (session && !recent && !flood) {
                await Notify.create({
                    name: ctx.userName || 'Customer',
                    message: `${ctx.userName || 'A guest'} asked for a person in chat: ${String(reason || '').replace(/\s+/g, ' ').slice(0, 140)}`,
                    type: 'chat_escalation',
                    link: `/admin/ai-insights?session=${session._id}`,
                });
                // optional email (Store Info → escalation email); never blocks the reply
                if (s.chatbot?.escalationEmail) {
                    require('../../../config/mailer')
                        .sendMail({ from: process.env.EMAIL, to: s.chatbot.escalationEmail, subject: 'Cafe Fresco: a customer asked for a person', text: `Reason: ${String(reason).slice(0, 300)}\nOpen the dashboard → AI Assistant to read the chat.` })
                        .catch((err) => console.error('Escalation email failed:', err.message));
                }
            }
            return {
                data: {
                    escalated: true,
                    message: `I've let our team know${recent ? ' (already notified)' : ''}. ${contact ? `You can also reach us by ${contact}.` : 'You can also use the Contact page.'}`,
                },
            };
        },
    },
];
