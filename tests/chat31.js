// Step 3.1: chat data model (TTL, ownership, truncation, scrubbing)
const { model, check, connect, done, mongoose } = require('./lib');
(async () => {
    await connect();
    const ChatSession = model('chatSession');
    const ChatMessage = model('chatMessage');
    await ChatSession.init();
    await ChatMessage.init();
    const ttl = (idx) => idx.find((i) => i.expireAfterSeconds)?.expireAfterSeconds;
    check('session TTL = 30 days on lastAt', ttl(await ChatSession.collection.indexes()) === 30 * 86400);
    check('message TTL = 30 days', ttl(await ChatMessage.collection.indexes()) === 30 * 86400);

    const userA = new mongoose.Types.ObjectId();
    const s = await ChatSession.create({ userId: userA });
    const g = await ChatSession.create({ anonId: 'a'.repeat(32) });
    check('owner check: own user', s.ownedBy({ userId: userA }));
    check('owner check: other user rejected', !s.ownedBy({ userId: new mongoose.Types.ObjectId() }));
    check("owner check: a guest can't open a user's chat", !s.ownedBy({ anonId: 'a'.repeat(32) }));
    check('owner check: guest by cookie', g.ownedBy({ anonId: 'a'.repeat(32) }) && !g.ownedBy({ anonId: 'b'.repeat(32) }));
    check('owner check: nothing → rejected', !g.ownedBy({}));

    const m = await ChatMessage.create({ sessionId: s._id, role: 'user', content: 'x'.repeat(5000) });
    check('content capped at 4000 chars', m.content.length === 4000);
    const card = await ChatMessage.create({ sessionId: s._id, role: 'user', content: 'my card is 4242 4242 4242 4242 and cvc 123, password is Hunter2!' });
    check('card number scrubbed', !/4242/.test(card.content) && /card number removed/.test(card.content), card.content);
    check('cvc and password scrubbed', !/123\b/.test(card.content.replace('[card number removed]', '')) && !/Hunter2/.test(card.content), card.content);
    const phone = await ChatMessage.create({ sessionId: s._id, role: 'user', content: 'call me on +92 300 1234567 about order 6AB3F1' });
    check('a phone number or order id is not mistaken for a card', /\+92 300 1234567/.test(phone.content) && /6AB3F1/.test(phone.content));

    await ChatMessage.deleteMany({ sessionId: { $in: [s._id, g._id] } });
    await ChatSession.deleteMany({ _id: { $in: [s._id, g._id] } });
    await done();
})();
